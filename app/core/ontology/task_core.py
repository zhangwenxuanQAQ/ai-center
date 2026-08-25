"""
本体工作台核心逻辑 - 数据抽取任务
包含任务执行、流式进度推送、结果管理等核心业务逻辑
"""

import json
import base64
import logging
import re
import time
import io
from datetime import datetime, date, timedelta, time as dt_time
from threading import Thread, Lock
from typing import Optional, Dict, Any

from app.database.models import OntologyTask, OntologyObject
from app.services.datasource.service import DatasourceService
from app.database.redis_utils import redis_utils
from app.constants.ontology_constants import (
    OntologyTaskStatus, OntologyExportFormat,
    ONTOLOGY_TASK_STREAM_PREFIX, ONTOLOGY_TASK_STATUS_PREFIX,
    ONTOLOGY_TASK_RESULT_PREFIX, ONTOLOGY_TASK_REDIS_EXPIRE,
    ONTOLOGY_TASK_EVENTS_CHANNEL,
    ONTOLOGY_TASK_QUEUE_KEY,
    ONTOLOGY_TASK_MAX_CONCURRENT, ONTOLOGY_TASK_QUEUE_POLL_INTERVAL,
    ONTOLOGY_EXPORT_FORMAT_FILE_EXT,
)
from app.core.ontology.utils import ontology_object_to_dict, task_to_dict
from app.core.hooks.ontology_task_hook import OntologyTaskHook

logger = logging.getLogger(__name__)


class OntologyTaskCore:
    """数据抽取任务核心服务"""

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

        def _push_progress(msg: str, progress: float = None):
            """推送进度消息到Redis流"""
            data = {'type': 'progress', 'message': msg}
            if progress is not None:
                data['progress'] = progress
            redis_utils.client.rpush(stream_key, json.dumps(data, ensure_ascii=False))

        def _finalize(status: str, error_msg: str = ''):
            """写入耗时（毫秒）并更新任务状态"""
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
                    OntologyTaskCore._publish_task_event(t)
            except Exception as ex:
                logger.error(f"任务结束状态写入失败: task_id={task_id}, error={ex}")
            redis_utils.set(status_key, status, exp=ONTOLOGY_TASK_REDIS_EXPIRE)

        try:
            # 更新状态为运行中
            OntologyTaskCore.update_task_status(task_id, OntologyTaskStatus.RUNNING)
            redis_utils.set(status_key, OntologyTaskStatus.RUNNING, exp=ONTOLOGY_TASK_REDIS_EXPIRE)

            _push_progress("任务开始执行", 0.0)
            OntologyTaskCore.update_task_progress(task_id, 0.0, "任务开始执行")

            # 解析configs
            configs = json.loads(task.configs) if task.configs else {}
            ontology_object_id = configs.get('ontology_object_id', '')
            custom_sql = configs.get('custom_sql', '')
            export_format = configs.get('export_format', OntologyExportFormat.JSON)
            selected_columns = configs.get('columns', [])

            # 构建SQL
            _push_progress("正在构建查询SQL", 0.1)
            if custom_sql:
                sql = custom_sql
            elif ontology_object_id:
                ontology_obj = OntologyTaskCore._get_ontology_object(ontology_object_id)
                if not ontology_obj:
                    raise Exception("本体对象不存在")
                table_name = ontology_obj['name']
                # 标识符加反引号需避免误触发SQL校验的危险关键字（如`desc`），仅含特殊字符时加引号
                def _quote_ident(ident: str) -> str:
                    return f"`{ident}`" if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', ident) else ident
                # 校验选中的字段是否存在于本体对象字段中，防止SQL注入
                if selected_columns:
                    valid_columns = {col.get('column_name', '') for col in (ontology_obj.get('content', {}).get('columns') or [])}
                    valid_selected = [c for c in selected_columns if c in valid_columns]
                    if not valid_selected:
                        raise Exception("未选择有效的抽取字段")
                    column_list = ', '.join(_quote_ident(c) for c in valid_selected)
                    sql = f"SELECT {column_list} FROM {_quote_ident(table_name)}"
                else:
                    sql = f"SELECT * FROM {_quote_ident(table_name)}"
            else:
                raise Exception("任务配置缺失：请指定本体对象或自定义SQL")

            # 日志中打印执行的SQL语句
            OntologyTaskCore.update_task_progress(task_id, 0.1, f"构建SQL完成: {sql}")

            # SQL安全校验
            _push_progress("正在进行SQL安全校验", 0.2)
            hook = OntologyTaskHook()
            hook.before(sql=sql)

            _push_progress("正在执行数据查询", 0.3)
            OntologyTaskCore.update_task_progress(task_id, 0.3, "开始执行数据查询")

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
            rows = OntologyTaskCore._normalize_rows(rows)
            _push_progress(f"查询完成，共获取 {row_count} 条数据", 0.5)
            OntologyTaskCore.update_task_progress(task_id, 0.5, f"查询完成，共获取 {row_count} 条数据")

            _push_progress("正在格式化数据", 0.7)
            OntologyTaskCore.update_task_progress(task_id, 0.7, "正在格式化数据")
            file_content = OntologyTaskCore._format_data(rows, export_format)

            _push_progress("正在生成结果文件", 0.85)
            # _format_data 现在统一返回 bytes，直接 base64 编码即可
            file_base64 = base64.b64encode(file_content).decode('utf-8')
            result_key = f"{ONTOLOGY_TASK_RESULT_PREFIX}{task_id}"
            redis_utils.set_obj(result_key, {
                'file_base64': file_base64,
                'format': export_format,
                'file_name': f"{task.name}.{ONTOLOGY_EXPORT_FORMAT_FILE_EXT.get(export_format, export_format)}",
                'row_count': row_count,
                'executed_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'expire_at': (datetime.now() + timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S'),
            }, exp=ONTOLOGY_TASK_REDIS_EXPIRE)

            _push_progress("任务执行完成", 1.0)
            OntologyTaskCore.update_task_progress(task_id, 1.0, "任务执行完成")
            _finalize(OntologyTaskStatus.DONE)
            redis_utils.client.rpush(stream_key, json.dumps(
                {'type': 'done', 'message': '任务执行完成'}, ensure_ascii=False
            ))

        except Exception as e:
            logger.error(f"任务执行失败: task_id={task_id}, error={e}")
            _push_progress(f"执行失败: {str(e)}", 0)
            OntologyTaskCore.update_task_progress(task_id, 0, f"执行失败: {str(e)}")
            _finalize(OntologyTaskStatus.FAIL, str(e))
            redis_utils.client.rpush(stream_key, json.dumps(
                {'type': 'error', 'message': str(e)}, ensure_ascii=False
            ))

    @staticmethod
    def stop_task(task_id: str) -> bool:
        """停止正在运行或排队等待的任务"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task or task.status not in (OntologyTaskStatus.RUNNING, OntologyTaskStatus.WAITING):
            return False

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
    def get_task_result(task_id: str) -> dict:
        """获取任务执行结果"""
        task = OntologyTaskCore.get_task(task_id)
        if not task:
            return None

        result_key = f"{ONTOLOGY_TASK_RESULT_PREFIX}{task_id}"
        result = redis_utils.get_obj(result_key) if redis_utils.is_available else None

        if not result:
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
            }

        return {
            'status': task['status'],
            'status_label': task['status_label'],
            'has_result': True,
            'file_name': result.get('file_name', ''),
            'format': result.get('format', ''),
            'file_base64': result.get('file_base64', ''),
            'row_count': result.get('row_count', 0),
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

    @staticmethod
    def _normalize_row_value(value: Any) -> Any:
        """
        将数据库行中的非JSON可序列化值（datetime/date/time/LOB/bytes等）转为字符串

        Args:
            value: 数据库查询结果中的原始值

        Returns:
            Any: 可JSON序列化的值
        """
        if value is None:
            return None
        if isinstance(value, dict):
            return {k: OntologyTaskCore._normalize_row_value(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [OntologyTaskCore._normalize_row_value(v) for v in value]
        if isinstance(value, (datetime, date, dt_time)):
            return value.strftime('%Y-%m-%d %H:%M:%S')
        # 处理set类型
        if isinstance(value, set):
            return str(value)
        # 处理bytes类型（BLOB、BYTEA等二进制字段）
        if isinstance(value, bytes):
            try:
                return value.decode('utf-8')
            except UnicodeDecodeError:
                # 无法解码的二进制数据，返回十六进制字符串
                return '0x' + value.hex()
        # 处理Oracle LOB对象（通过类名判断，避免强依赖oracledb）
        class_name = value.__class__.__name__
        if class_name == 'LOB':
            try:
                return value.read()
            except Exception:
                try:
                    return value.getvalue()
                except Exception:
                    return str(value)
        # 处理其他可能的大字段/特殊对象
        if hasattr(value, 'read') and callable(value.read):
            try:
                return value.read()
            except Exception:
                pass
        return value

    @staticmethod
    def _normalize_rows(rows: list) -> list:
        """批量转换查询结果行，保证可JSON序列化"""
        return [OntologyTaskCore._normalize_row_value(row) for row in rows]

    @staticmethod
    def _format_data(data: list, export_format: str) -> bytes:
        """根据导出格式转换数据，返回 bytes 类型内容（文本格式为utf-8编码的bytes，Excel为xlsx二进制bytes）"""
        if export_format == OntologyExportFormat.EXCEL:
            return OntologyTaskCore._to_excel_bytes(data)

        if export_format == OntologyExportFormat.JSON:
            content = json.dumps(data, ensure_ascii=False, indent=2)
            return content.encode('utf-8')

        if export_format == OntologyExportFormat.MARKDOWN:
            if data:
                headers = list(data[0].keys())
                lines = [
                    '| ' + ' | '.join(headers) + ' |',
                    '| ' + ' | '.join(['---'] * len(headers)) + ' |',
                ]
                for row in data:
                    lines.append('| ' + ' | '.join(str(row.get(h, '')) for h in headers) + ' |')
                return '\n'.join(lines).encode('utf-8')
            return '（无数据）'.encode('utf-8')

        # 默认JSON
        return json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')

    @staticmethod
    def _to_excel_bytes(data: list) -> bytes:
        """将数据列表转换为Excel二进制内容（字段名作为表头，每行一条数据）"""
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill

        wb = Workbook()
        ws = wb.active
        ws.title = '数据抽取结果'

        if not data:
            # 空数据时只写一个提示
            ws['A1'] = '（无数据）'
            ws['A1'].font = Font(bold=True)
        else:
            headers = list(data[0].keys())
            # 写入表头行
            header_font = Font(bold=True, color='FFFFFF')
            header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
            header_alignment = Alignment(horizontal='center', vertical='center')

            for col_idx, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col_idx, value=header)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = header_alignment

            # 写入数据行
            for row_idx, row_data in enumerate(data, 2):
                for col_idx, header in enumerate(headers, 1):
                    value = row_data.get(header)
                    # datetime/date等已在_normalize_rows中转为字符串
                    ws.cell(row=row_idx, column=col_idx, value=value)

            # 自动调整列宽（粗略估算）
            for col_idx, header in enumerate(headers, 1):
                max_len = len(str(header))
                for row_data in data:
                    cell_val = row_data.get(header)
                    cell_len = len(str(cell_val)) if cell_val is not None else 0
                    max_len = max(max_len, cell_len)
                # 中文按2倍宽度估算
                adjusted_width = min(max_len * 1.5 + 2, 50)
                ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = adjusted_width

        # 保存到内存流
        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()