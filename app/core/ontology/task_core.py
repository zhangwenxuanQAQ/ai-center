"""
本体工作台核心逻辑 - 数据抽取任务
包含任务执行、流式进度推送、结果管理等核心业务逻辑
"""

import json
import os
import logging
import time
from datetime import datetime, timedelta
from threading import Thread, Lock
from typing import Optional, Dict, Any, List

from app.database.models import OntologyTask, OntologyObject
from app.services.datasource.service import DatasourceService
from app.database.redis_utils import redis_utils
from app.constants.ontology_constants import (
    OntologyTaskStatus, OntologyExportFormat, OntologyQueryMode,
    ONTOLOGY_TASK_STREAM_PREFIX, ONTOLOGY_TASK_STATUS_PREFIX,
    ONTOLOGY_TASK_RESULT_PREFIX, ONTOLOGY_TASK_REDIS_EXPIRE,
    ONTOLOGY_TASK_EVENTS_CHANNEL,
    ONTOLOGY_TASK_QUEUE_KEY,
    ONTOLOGY_TASK_MAX_CONCURRENT, ONTOLOGY_TASK_QUEUE_POLL_INTERVAL,
    ONTOLOGY_EXPORT_FORMAT_FILE_EXT,
    ONTOLOGY_PAGINATION_DEFAULT_PAGE_SIZE,
)
from app.core.ontology.utils import ontology_object_to_dict, task_to_dict
from app.core.datasource.utils import quote_ident, normalize_rows, format_data
from app.core.hooks.ontology_task_hook import OntologyTaskHook
from app.core.hooks.task_info_hook import TaskInfoHook
from app.utils.file_utils import (
    create_result_file, write_bytes, append_bytes, write_text, append_text,
    read_file_bytes, delete_file, file_exists, get_temp_dir,
    cleanup_expired_files,
)

logger = logging.getLogger(__name__)


class OntologyTaskCore:
    """数据抽取任务核心服务"""

    # 运行中任务取消标志：task_id -> True（请求取消）
    _running_cancels: Dict[str, bool] = {}
    _running_cancels_lock = Lock()

    @staticmethod
    def _publish_task_event(task) -> None:
        """推送任务实时状态事件到Redis频道（供前端SSE订阅）"""
        try:
            redis_utils.publish(ONTOLOGY_TASK_EVENTS_CHANNEL, {
                'task_id': task.id,
                'status': task.status,
                'task_progress': task.task_progress or 0,
                'task_progress_message': task.task_progress_message or '',
            })
        except Exception as e:
            logger.warning(f"推送任务事件失败: task_id={task.id}, error={e}")

    # ==================== 任务状态管理 ====================

    @staticmethod
    def update_task_status(task_id: str, status: str) -> bool:
        """更新任务状态"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task:
            return False
        task.status = status
        if status == OntologyTaskStatus.RUNNING:
            task.task_begin_at = datetime.now()
            # 新一轮执行开始，重置进度与日志（日志按换行符累积保存）
            task.task_progress = 0
            task.task_progress_message = None
        elif status in (OntologyTaskStatus.DONE, OntologyTaskStatus.FAIL, OntologyTaskStatus.CANCEL):
            task.task_end_at = datetime.now()
            if task.task_begin_at:
                task.task_duration = int((task.task_end_at - task.task_begin_at).total_seconds() * 1000)
        task.save()
        # 同步任务信息表（任务中心）
        TaskInfoHook.sync_ontology_task_runtime(task)
        OntologyTaskCore._publish_task_event(task)
        return True

    @staticmethod
    def update_task_progress(task_id: str, progress: float, message: str = '') -> bool:
        """更新任务进度（消息追加保存所有中间日志，换行符拼接）"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task:
            return False
        task.task_progress = progress
        if message:
            timestamp = datetime.now().strftime('%H:%M:%S')
            existing = task.task_progress_message or ''
            task.task_progress_message = f"{existing}\n[{timestamp}] {message}".strip()
        task.save()
        # 同步任务信息表（任务中心）
        TaskInfoHook.sync_ontology_task_runtime(task)
        OntologyTaskCore._publish_task_event(task)
        return True

    @staticmethod
    def get_task(task_id: str) -> Optional[dict]:
        """获取单个任务"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        return task_to_dict(task) if task else None

    # ==================== 任务取消管理 ====================

    @staticmethod
    def _register_running(task_id: str) -> None:
        """注册任务为运行中"""
        with OntologyTaskCore._running_cancels_lock:
            OntologyTaskCore._running_cancels[task_id] = False

    @staticmethod
    def _unregister_running(task_id: str) -> None:
        """取消注册运行中任务"""
        with OntologyTaskCore._running_cancels_lock:
            OntologyTaskCore._running_cancels.pop(task_id, None)

    @staticmethod
    def _is_cancelled(task_id: str) -> bool:
        """检查任务是否请求了取消"""
        with OntologyTaskCore._running_cancels_lock:
            return OntologyTaskCore._running_cancels.get(task_id, False)

    @staticmethod
    def _request_cancel(task_id: str) -> None:
        """请求取消任务"""
        with OntologyTaskCore._running_cancels_lock:
            if task_id in OntologyTaskCore._running_cancels:
                OntologyTaskCore._running_cancels[task_id] = True

    # ==================== 任务执行（队列调度） ====================

    # 队列调度器线程状态（模块级，避免重复启动）
    _queue_scheduler_started = False
    _queue_scheduler_lock = Lock()

    @staticmethod
    def execute_task(task_id: str) -> bool:
        """执行任务：加入队列等待调度（默认同时最多执行 ONTOLOGY_TASK_MAX_CONCURRENT 个任务）"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task:
            return False
        # 运行中/等待执行的任务不可重复入队
        if task.status in (OntologyTaskStatus.RUNNING, OntologyTaskStatus.WAITING):
            return False

        # 置为等待执行并加入队列（LPUSH 队首 + RPOP 队尾 = FIFO）
        OntologyTaskCore.update_task_status(task_id, OntologyTaskStatus.WAITING)
        redis_utils.client.lpush(ONTOLOGY_TASK_QUEUE_KEY, task_id)

        OntologyTaskCore._ensure_queue_scheduler()
        logger.info(f"任务已加入执行队列: task_id={task_id}, 队列长度={redis_utils.client.llen(ONTOLOGY_TASK_QUEUE_KEY)}")
        return True

    @staticmethod
    def _ensure_queue_scheduler():
        """确保队列调度器线程已启动（进程级单例）"""
        with OntologyTaskCore._queue_scheduler_lock:
            if OntologyTaskCore._queue_scheduler_started:
                return
            OntologyTaskCore._queue_scheduler_started = True
            thread = Thread(target=OntologyTaskCore._queue_scheduler_loop, daemon=True, name='ontology-task-queue-scheduler')
            thread.start()
            logger.info(f"本体任务队列调度器已启动（并发上限={ONTOLOGY_TASK_MAX_CONCURRENT}）")

    @staticmethod
    def _queue_scheduler_loop():
        """队列调度循环：并发数未满时从队列取任务执行，超出的排队等待"""
        while True:
            try:
                running_count = OntologyTask.select().where(
                    OntologyTask.status == OntologyTaskStatus.RUNNING,
                    OntologyTask.deleted == False
                ).count()
                if running_count < ONTOLOGY_TASK_MAX_CONCURRENT:
                    # RPOP 从队尾取（最早入队的先执行）
                    raw = redis_utils.client.rpop(ONTOLOGY_TASK_QUEUE_KEY)
                    if raw:
                        task_id = raw.decode('utf-8') if isinstance(raw, bytes) else raw
                        logger.info(f"队列调度: 取出任务 task_id={task_id}, 当前运行数={running_count}")
                        Thread(target=OntologyTaskCore._run_task, args=(task_id,), daemon=True).start()
            except Exception as e:
                logger.error(f"本体任务队列调度异常: {e}")
            time.sleep(ONTOLOGY_TASK_QUEUE_POLL_INTERVAL)

    @staticmethod
    def _run_task(task_id: str):
        """实际执行任务（由队列调度器派发到后台线程）"""
        # 出队后再次校验状态：等待期间被停止/删除的任务不再执行
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task or task.status != OntologyTaskStatus.WAITING:
            logger.info(f"任务出队但状态已变更，跳过执行: task_id={task_id}, status={task.status if task else 'deleted'}")
            return

        stream_key = f"{ONTOLOGY_TASK_STREAM_PREFIX}{task_id}"
        status_key = f"{ONTOLOGY_TASK_STATUS_PREFIX}{task_id}"

        # 注册任务为运行中
        OntologyTaskCore._register_running(task_id)

        def _push_progress(msg: str, progress: float = None):
            """推送进度消息到Redis流"""
            data = {'type': 'progress', 'message': msg}
            if progress is not None:
                data['progress'] = progress
            redis_utils.client.rpush(stream_key, json.dumps(data, ensure_ascii=False))

        def _finalize(status: str, error_msg: str = ''):
            """写入耗时（毫秒）并更新任务状态"""
            OntologyTaskCore._unregister_running(task_id)
            try:
                t = OntologyTask.select().where(OntologyTask.id == task_id).first()
                if t and t.task_begin_at:
                    end_at = datetime.now()
                    t.task_end_at = end_at
                    t.task_duration = int((end_at - t.task_begin_at).total_seconds() * 1000)
                    elapsed = t.task_duration
                    log_msg = f"任务{'执行失败: ' + error_msg if error_msg else '执行完成'}，耗时 {elapsed / 1000:.2f} 秒"
                    existing = t.task_progress_message or ''
                    ts = datetime.now().strftime('%H:%M:%S')
                    t.task_progress_message = f"{existing}\n[{ts}] {log_msg}".strip()
                if t:
                    t.status = status
                    t.save()
                    # 同步任务信息表（任务中心）
                    TaskInfoHook.sync_ontology_task_runtime(t)
                    OntologyTaskCore._publish_task_event(t)
            except Exception as ex:
                logger.error(f"任务结束状态写入失败: task_id={task_id}, error={ex}")
            redis_utils.set(status_key, status, exp=ONTOLOGY_TASK_REDIS_EXPIRE)

        result_file_path = None

        try:
            # 更新状态为运行中
            OntologyTaskCore.update_task_status(task_id, OntologyTaskStatus.RUNNING)
            redis_utils.set(status_key, OntologyTaskStatus.RUNNING, exp=ONTOLOGY_TASK_REDIS_EXPIRE)

            _push_progress("任务开始执行", 0.0)
            OntologyTaskCore.update_task_progress(task_id, 0.0, "任务开始执行")

            # 启动时清理过期文件
            try:
                cleanup_expired_files()
            except Exception:
                pass

            # 解析configs
            configs = json.loads(task.configs) if task.configs else {}
            ontology_object_id = configs.get('ontology_object_id', '')
            custom_sql = configs.get('custom_sql', '')
            export_format = configs.get('export_format', OntologyExportFormat.JSON)
            selected_columns = configs.get('columns', [])
            query_mode = configs.get('query_mode', OntologyQueryMode.PAGINATED)

            # 构建SQL
            _push_progress("正在构建查询SQL", 0.1)
            if custom_sql:
                sql = custom_sql
            elif ontology_object_id:
                ontology_obj = OntologyTaskCore._get_ontology_object(ontology_object_id)
                if not ontology_obj:
                    raise Exception("本体对象不存在")
                table_name = ontology_obj['name']
                # 校验选中的字段是否存在于本体对象字段中，防止SQL注入
                if selected_columns:
                    valid_columns = {col.get('column_name', '') for col in (ontology_obj.get('content', {}).get('columns') or [])}
                    valid_selected = [c for c in selected_columns if c in valid_columns]
                    if not valid_selected:
                        raise Exception("未选择有效的抽取字段")
                    column_list = ', '.join(quote_ident(c) for c in valid_selected)
                    sql = f"SELECT {column_list} FROM {quote_ident(table_name)}"
                else:
                    sql = f"SELECT * FROM {quote_ident(table_name)}"
            else:
                raise Exception("任务配置缺失：请指定本体对象或自定义SQL")

            # 日志中打印执行的SQL语句
            OntologyTaskCore.update_task_progress(task_id, 0.1, f"构建SQL完成: {sql}")

            # 清洗SQL：去除末尾分号与空白（Oracle ORA-00911 对末尾分号零容忍）
            # 同时处理英文; 中文； 及不可见的空白
            sql = sql.strip()
            while sql and sql[-1] in (';', '；', '\n', '\r', '\t', ' '):
                sql = sql[:-1].rstrip()
            sql = sql.strip()

            # SQL安全校验
            _push_progress("正在进行SQL安全校验", 0.2)
            hook = OntologyTaskHook()
            hook.before(sql=sql)

            # 检查取消标志
            if OntologyTaskCore._is_cancelled(task_id):
                raise Exception("任务已被用户取消")

            # 生成结果文件名
            file_ext = ONTOLOGY_EXPORT_FORMAT_FILE_EXT.get(export_format, export_format)
            file_name = f"{task.name}.{file_ext}"
            result_file_path = create_result_file(file_name)

            if query_mode == OntologyQueryMode.PAGINATED:
                # ===== 分页查询模式 =====
                _push_progress("正在执行分页查询", 0.3)
                OntologyTaskCore.update_task_progress(task_id, 0.3, "开始分页查询")
                row_count, exported_rows = OntologyTaskCore._execute_paginated_query(
                    task_id, task.datasource_id, sql, export_format,
                    result_file_path, file_name, _push_progress
                )
            else:
                # ===== 全量查询模式 =====
                _push_progress("正在执行数据查询", 0.3)
                OntologyTaskCore.update_task_progress(task_id, 0.3, "开始执行数据查询")

                # 检查取消标志
                if OntologyTaskCore._is_cancelled(task_id):
                    raise Exception("任务已被用户取消")

                # 执行查询
                result = DatasourceService.execute_query(task.datasource_id, sql)

                if not result.get('success'):
                    raise Exception(result.get('message', '查询执行失败'))

                data = result.get('data')
                # execute_query 返回的 data 为 {columns, rows, total}，兼容直接返回列表的情况
                if isinstance(data, dict):
                    rows = data.get('rows', []) or []
                    row_count = data.get('total', len(rows))
                elif isinstance(data, list):
                    rows = data
                    row_count = len(rows)
                else:
                    rows = []
                    row_count = 0
                # 将 datetime/date 等非JSON可序列化值转为字符串，保证导出文件正常生成
                rows = normalize_rows(rows)
                _push_progress(f"查询完成，共获取 {row_count} 条数据", 0.5)
                OntologyTaskCore.update_task_progress(task_id, 0.5, f"查询完成，共获取 {row_count} 条数据")

                # 检查取消标志
                if OntologyTaskCore._is_cancelled(task_id):
                    raise Exception("任务已被用户取消")

                _push_progress("正在格式化数据", 0.7)
                OntologyTaskCore.update_task_progress(task_id, 0.7, "正在格式化数据")

                # 再检查一次取消标志（format_data 内部也会周期性检查）
                if OntologyTaskCore._is_cancelled(task_id):
                    raise Exception("任务已被用户取消")

                file_content = format_data(
                    rows, export_format,
                    cancel_check_fn=lambda: OntologyTaskCore._is_cancelled(task_id)
                )

                # 写文件前再检查一次
                if OntologyTaskCore._is_cancelled(task_id):
                    raise Exception("任务已被用户取消")

                _push_progress("正在生成结果文件", 0.85)
                write_bytes(result_file_path, file_content)
                exported_rows = row_count

            # 保存结果文件元数据到Redis（不再存储base64）
            _push_progress("正在保存结果文件", 0.9)
            result_key = f"{ONTOLOGY_TASK_RESULT_PREFIX}{task_id}"
            now = datetime.now()
            redis_utils.set_obj(result_key, {
                'file_path': result_file_path,
                'file_name': file_name,
                'format': export_format,
                'row_count': row_count,
                'exported_rows': exported_rows,
                'total_rows': row_count,
                'executed_at': now.strftime('%Y-%m-%d %H:%M:%S'),
                'expire_at': (now + timedelta(seconds=ONTOLOGY_TASK_REDIS_EXPIRE)).strftime('%Y-%m-%d %H:%M:%S'),
            }, exp=ONTOLOGY_TASK_REDIS_EXPIRE)

            _push_progress("任务执行完成", 1.0)
            OntologyTaskCore.update_task_progress(task_id, 1.0, f"任务执行完成，共导出 {exported_rows}/{row_count} 行数据")
            _finalize(OntologyTaskStatus.DONE)
            redis_utils.client.rpush(stream_key, json.dumps(
                {'type': 'done', 'message': '任务执行完成'}, ensure_ascii=False
            ))

        except Exception as e:
            # 区分取消 vs 真正失败
            is_cancelled = (
                OntologyTaskCore._is_cancelled(task_id)
                or isinstance(e, InterruptedError)
                or "取消" in str(e)
            )
            if is_cancelled:
                logger.info(f"任务已取消: task_id={task_id}")
                _push_progress("任务已取消", 0)
                OntologyTaskCore.update_task_progress(task_id, 0, "任务已取消")
                status = OntologyTaskStatus.CANCEL
            else:
                logger.error(f"任务执行失败: task_id={task_id}, error={e}")
                _push_progress(f"执行失败: {str(e)}", 0)
                OntologyTaskCore.update_task_progress(task_id, 0, f"执行失败: {str(e)}")
                status = OntologyTaskStatus.FAIL

            # 任务失败/取消时清理临时文件
            if result_file_path:
                delete_file(result_file_path)
            _finalize(status, str(e))
            event_type = 'cancel' if is_cancelled else 'error'
            redis_utils.client.rpush(stream_key, json.dumps(
                {'type': event_type, 'message': str(e)}, ensure_ascii=False
            ))

    @staticmethod
    def _execute_paginated_query(
        task_id: str, datasource_id: str, base_sql: str, export_format: str,
        result_file_path: str, file_name: str, _push_progress
    ) -> tuple:
        """执行分页查询，逐页写入结果文件

        Args:
            task_id: 任务ID
            datasource_id: 数据源ID
            base_sql: 基础SQL（不含LIMIT/OFFSET）
            export_format: 导出格式
            result_file_path: 结果文件路径
            file_name: 结果文件名
            _push_progress: 进度推送函数

        Returns:
            tuple: (总行数, 已导出行数)
        """
        from app.core.datasource.utils import normalize_row_value

        page_size = ONTOLOGY_PAGINATION_DEFAULT_PAGE_SIZE

        # 1. 查询总行数
        count_sql = DatasourceService.build_count_query(datasource_id, base_sql)
        _push_progress("正在查询总行数", 0.3)
        # 把实际执行的总行数SQL也放在进度里，方便用户定位错误（截取400字符防止过长）
        count_sql_display = count_sql if len(count_sql) <= 400 else count_sql[:400] + '...'
        _push_progress(f"总行数SQL: {count_sql_display}", 0.31)
        OntologyTaskCore.update_task_progress(task_id, 0.31, f"总行数SQL: {count_sql_display}")
        count_result = DatasourceService.execute_query(datasource_id, count_sql)
        if not count_result.get('success'):
            raise Exception(count_result.get('message', '查询总行数失败'))

        count_data = count_result.get('data')
        # 各数据源 build_count_query 的列别名不一致（Oracle 是 cnt，Base/MySQL/PG 是 total_count），
        # 因此通用做法：取第一行的唯一值/第一个值，不依赖具体列名
        if isinstance(count_data, dict):
            rows_data = count_data.get('rows', [])
            if rows_data:
                first_row = rows_data[0]
                if isinstance(first_row, dict):
                    total_rows = int(next(iter(first_row.values()), 0))
                else:
                    total_rows = int(first_row)
            else:
                total_rows = 0
        elif isinstance(count_data, list) and count_data:
            first_row = count_data[0]
            if isinstance(first_row, dict):
                total_rows = int(next(iter(first_row.values()), 0))
            else:
                total_rows = int(first_row)
        else:
            total_rows = 0

        _push_progress(f"总行数: {total_rows}", 0.32)
        OntologyTaskCore.update_task_progress(task_id, 0.32, f"总行数: {total_rows}，每页 {page_size} 行")

        if total_rows == 0:
            # 无数据，写入空结果文件
            file_content = format_data([], export_format)
            write_bytes(result_file_path, file_content)
            return 0, 0

        # 2. 初始化结果文件写入器
        writer = _ResultFileWriter(result_file_path, export_format)
        writer.init()

        # 3. 分页查询并逐页写入
        exported_rows = 0
        current_page = 0

        while True:
            # 检查取消标志
            if OntologyTaskCore._is_cancelled(task_id):
                writer.abort()
                raise Exception("任务已被用户取消")

            offset = current_page * page_size
            # 用数据源实例构建正确的分页SQL（MySQL/PostgreSQL: LIMIT/OFFSET, Oracle: ROWNUM, SQL Server: OFFSET..FETCH）
            ds_instance = DatasourceService.get_datasource_instance(datasource_id)
            page_sql = ds_instance.build_page_query(base_sql, page_size, offset)

            # 第一页时把实际执行的SQL打印到进度，方便用户定位错误
            if current_page == 0:
                first_sql_display = page_sql if len(page_sql) <= 400 else page_sql[:400] + '...'
                _push_progress(f"第一页SQL: {first_sql_display}", 0.34)
                OntologyTaskCore.update_task_progress(task_id, 0.34, f"第一页SQL: {first_sql_display}")

            page_result = DatasourceService.execute_query(datasource_id, page_sql)
            if not page_result.get('success'):
                writer.abort()
                raise Exception(page_result.get('message', f'第{current_page + 1}页查询失败'))

            data = page_result.get('data')
            if isinstance(data, dict):
                rows = data.get('rows', []) or []
            elif isinstance(data, list):
                rows = data
            else:
                rows = []

            if not rows:
                break

            rows = normalize_rows(rows)
            writer.write_page(rows, is_first_page=(current_page == 0))
            exported_rows += len(rows)

            # 更新进度
            progress = 0.35 + min(exported_rows / max(total_rows, 1), 1.0) * 0.55
            msg = f"已导出 {exported_rows}/{total_rows} 行 (第{current_page + 1}页)"
            _push_progress(msg, progress)
            OntologyTaskCore.update_task_progress(task_id, progress, msg)

            if len(rows) < page_size:
                break

            current_page += 1

        # 4. 完成结果文件
        writer.finalize(total_rows)
        _push_progress(f"结果文件写入完成，共导出 {exported_rows} 行", 0.92)

        return total_rows, exported_rows

    @staticmethod
    def stop_task(task_id: str) -> bool:
        """停止正在运行或排队等待的任务"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task or task.status not in (OntologyTaskStatus.RUNNING, OntologyTaskStatus.WAITING):
            return False

        # 设置取消标志（运行中线程会在下次检查点退出）
        OntologyTaskCore._request_cancel(task_id)

        OntologyTaskCore.update_task_status(task_id, OntologyTaskStatus.CANCEL)
        status_key = f"{ONTOLOGY_TASK_STATUS_PREFIX}{task_id}"
        redis_utils.set(status_key, OntologyTaskStatus.CANCEL, exp=ONTOLOGY_TASK_REDIS_EXPIRE)
        # 等待执行的任务同时从队列中移除（避免调度器后续取出执行）
        if task.status == OntologyTaskStatus.WAITING:
            try:
                redis_utils.client.lrem(ONTOLOGY_TASK_QUEUE_KEY, 0, task_id)
            except Exception as e:
                logger.warning(f"从队列移除任务失败（可忽略）: task_id={task_id}, error={e}")
        return True

    # ==================== 任务结果 ====================

    @staticmethod
    def _get_result_file(task_id: str) -> Optional[dict]:
        """获取任务结果文件信息（从Redis读取元数据，检查文件是否存在）"""
        try:
            result_key = f"{ONTOLOGY_TASK_RESULT_PREFIX}{task_id}"
            result = redis_utils.get_obj(result_key) if redis_utils.is_available else None
            if not result:
                return None
            # 检查文件是否存在
            file_path = result.get('file_path', '')
            if file_path and not file_exists(file_path):
                logger.warning(f"结果文件不存在: {file_path}, task_id={task_id}")
                return None
            return result
        except Exception:
            return None

    @staticmethod
    def get_task_result(task_id: str) -> dict:
        """获取任务执行结果"""
        task = OntologyTaskCore.get_task(task_id)
        if not task:
            return None

        result_key = f"{ONTOLOGY_TASK_RESULT_PREFIX}{task_id}"
        result = redis_utils.get_obj(result_key) if redis_utils.is_available else None

        # 检查文件是否存在
        has_result = False
        if result:
            file_path = result.get('file_path', '')
            has_result = bool(file_path) and file_exists(file_path)

        if not result or not has_result:
            return {
                'status': task['status'],
                'status_label': task['status_label'],
                'has_result': False,
                'message': '暂无结果文件（可能已过期或未执行）',
                'task_progress': task['task_progress'],
                'task_progress_message': task['task_progress_message'],
                'task_begin_at': task['task_begin_at'],
                'task_end_at': task['task_end_at'],
                'task_duration': task['task_duration'],
                'exported_rows': (result.get('exported_rows', 0) if result else 0),
                'total_rows': (result.get('total_rows', 0) if result else 0),
            }

        return {
            'status': task['status'],
            'status_label': task['status_label'],
            'has_result': True,
            'file_name': result.get('file_name', ''),
            'format': result.get('format', ''),
            'file_path': result.get('file_path', ''),
            'row_count': result.get('row_count', 0),
            'exported_rows': result.get('exported_rows', 0),
            'total_rows': result.get('total_rows', 0),
            'executed_at': result.get('executed_at', ''),
            'expire_at': result.get('expire_at', ''),
            'task_progress': task['task_progress'],
            'task_progress_message': task['task_progress_message'],
            'task_begin_at': task['task_begin_at'],
            'task_end_at': task['task_end_at'],
            'task_duration': task['task_duration'],
        }

    @staticmethod
    def get_stream_keys(task_id: str) -> tuple:
        """获取SSE流式Redis键"""
        stream_key = f"{ONTOLOGY_TASK_STREAM_PREFIX}{task_id}"
        status_key = f"{ONTOLOGY_TASK_STATUS_PREFIX}{task_id}"
        return stream_key, status_key

    # ==================== 私有方法 ====================

    @staticmethod
    def _get_ontology_object(object_id: str) -> Optional[dict]:
        """获取本体对象"""
        obj = OntologyObject.select().where(
            OntologyObject.id == object_id,
            OntologyObject.deleted == False
        ).first()
        return ontology_object_to_dict(obj) if obj else None


class _ResultFileWriter:
    """结果文件增量写入器（支持JSON/Markdown/Excel格式）"""

    def __init__(self, file_path: str, export_format: str):
        self.file_path = file_path
        self.export_format = export_format
        self._first_row_written = False
        self._headers = None
        self._excel_wb = None
        self._excel_ws = None

    def init(self):
        """初始化文件（写入头部内容）"""
        if self.export_format == OntologyExportFormat.JSON:
            write_text(self.file_path, '[')
        elif self.export_format == OntologyExportFormat.MARKDOWN:
            # Markdown头部在第一页数据时写入（需要字段名）
            pass
        elif self.export_format == OntologyExportFormat.EXCEL:
            from openpyxl import Workbook
            self._excel_wb = Workbook(write_only=True)
            self._excel_ws = self._excel_wb.active
            self._excel_ws.title = '数据抽取结果'

    def write_page(self, rows: list, is_first_page: bool):
        """写入一页数据到结果文件

        Args:
            rows: 本页数据行（字典列表）
            is_first_page: 是否为第一页
        """
        if not rows:
            return

        if self.export_format == OntologyExportFormat.JSON:
            self._write_json_page(rows)
        elif self.export_format == OntologyExportFormat.MARKDOWN:
            self._write_markdown_page(rows, is_first_page)
        elif self.export_format == OntologyExportFormat.EXCEL:
            self._write_excel_page(rows, is_first_page)

    def _write_json_page(self, rows: list):
        """写入JSON格式的一页数据"""
        parts = []
        for row in rows:
            if self._first_row_written:
                parts.append(',')
            parts.append('\n  ')
            parts.append(json.dumps(row, ensure_ascii=False))
            self._first_row_written = True
        if parts:
            append_text(self.file_path, ''.join(parts))

    def _write_markdown_page(self, rows: list, is_first_page: bool):
        """写入Markdown格式的一页数据"""
        if is_first_page:
            # 第一页：写入表头
            self._headers = list(rows[0].keys())
            header_line = '| ' + ' | '.join(self._headers) + ' |\n'
            separator_line = '| ' + ' | '.join(['---'] * len(self._headers)) + ' |\n'
            write_text(self.file_path, header_line + separator_line)
        elif not self._headers:
            # 兜底：之前没有数据，这是第一页
            self._headers = list(rows[0].keys())
            header_line = '| ' + ' | '.join(self._headers) + ' |\n'
            separator_line = '| ' + ' | '.join(['---'] * len(self._headers)) + ' |\n'
            write_text(self.file_path, header_line + separator_line)

        # 写入数据行
        parts = []
        for row in rows:
            values = [str(row.get(h, '')) for h in (self._headers or [])]
            parts.append('| ' + ' | '.join(values) + ' |\n')
        if parts:
            append_text(self.file_path, ''.join(parts))

    def _write_excel_page(self, rows: list, is_first_page: bool):
        """写入Excel格式的一页数据（使用write_only模式）"""
        if is_first_page:
            # 第一页：写入表头
            self._headers = list(rows[0].keys())
            self._excel_ws.append(self._headers)
        elif not self._headers:
            self._headers = list(rows[0].keys())
            self._excel_ws.append(self._headers)

        # 写入数据行
        for row in rows:
            row_values = [row.get(h, '') for h in (self._headers or [])]
            self._excel_ws.append(row_values)

    def finalize(self, total_rows: int):
        """完成结果文件（写入尾部内容并关闭）"""
        if self.export_format == OntologyExportFormat.JSON:
            append_text(self.file_path, '\n]')
        elif self.export_format == OntologyExportFormat.EXCEL:
            if self._excel_wb:
                self._excel_wb.save(self.file_path)
                self._excel_wb = None
                self._excel_ws = None

    def abort(self):
        """异常终止写入（清理资源）"""
        if self.export_format == OntologyExportFormat.EXCEL:
            self._excel_wb = None
            self._excel_ws = None
        # 删除不完整的文件
        delete_file(self.file_path)
