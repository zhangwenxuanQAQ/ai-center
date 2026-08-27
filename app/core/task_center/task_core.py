"""
任务中心核心逻辑 - 任务执行
按任务类型分发执行：
    - 接口调用(api)：调用内置工具api_call的run方法发起HTTP请求执行
    - 数据抽取(data_extract)：委托本体工作台任务队列执行
    - 文档切片(doc_chunk)：委托知识库文档切片执行器执行
并负责任务进度更新、日志生成、结果管理
"""

import json
import logging
import time
from datetime import datetime
from threading import Thread, Lock
from typing import Optional, Dict, Any, List, Tuple

from app.database.models import TaskInfo, TaskLog, KnowledgebaseDocument
from app.database.redis_utils import redis_utils
from app.constants.task_center_constants import (
    TaskStatus, TaskType, TASK_TYPE_NAME, TaskSourceType,
    TASK_CENTER_EVENTS_CHANNEL, TASK_CENTER_PROGRESS_INTERVAL,
)
from app.core.task_center.utils import task_info_to_dict, task_log_to_dict

logger = logging.getLogger(__name__)


class TaskCenterCore:
    """任务中心任务执行核心服务"""

    # 运行中任务注册表：task_id -> {"log_id": 日志ID, "cancel": 是否请求取消}
    _running_tasks: Dict[str, dict] = {}
    _running_tasks_lock = Lock()

    @staticmethod
    def _publish_task_event(task_id: str, log_id: str, task: TaskInfo) -> None:
        """推送任务实时状态事件到Redis频道（供前端SSE订阅）"""
        try:
            redis_utils.publish(TASK_CENTER_EVENTS_CHANNEL, {
                'task_id': task_id,
                'log_id': log_id,
                'task_status': task.task_status,
                'task_progress': task.task_progress or 0,
                'task_progress_message': task.task_progress_message or '',
            })
        except Exception as e:
            logger.warning(f"推送任务事件失败: task_id={task_id}, error={e}")

    # ==================== 任务执行（按类型分发） ====================

    @staticmethod
    def execute_task(task_id: str) -> bool:
        """
        执行任务：按任务类型分发执行

        - 接口调用任务：生成执行日志并启动后台线程，调用内置工具api_call执行
        - 数据抽取任务：委托本体工作台任务队列执行（状态由task_info_hook同步）
        - 文档切片任务：委托知识库文档切片执行器执行（状态由task_info_hook同步）

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否成功启动执行
        """
        task = TaskInfo.select().where(
            TaskInfo.id == task_id,
            TaskInfo.deleted == False
        ).first()
        if not task:
            return False
        # 运行中的任务不可重复执行
        if task.task_status == TaskStatus.RUNNING:
            return False

        # 数据抽取任务：委托本体任务队列
        if task.task_type == TaskType.DATA_EXTRACT:
            if not (task.source_type == TaskSourceType.ONTOLOGY_TASK and task.source_id):
                logger.warning(f"数据抽取任务缺少来源关联，无法执行: task_id={task_id}")
                return False
            from app.core.ontology.task_core import OntologyTaskCore
            return OntologyTaskCore.execute_task(task.source_id)

        # 文档切片任务：委托知识库切片执行器
        if task.task_type == TaskType.DOC_CHUNK:
            if not (task.source_type == TaskSourceType.KNOWLEDGEBASE_DOCUMENT and task.source_id):
                logger.warning(f"文档切片任务缺少来源关联，无法执行: task_id={task_id}")
                return False
            from app.core.knowledgebase.server import task_executor
            return task_executor.run_document_task(task.source_id) is not None

        # 接口调用任务：本地线程执行
        with TaskCenterCore._running_tasks_lock:
            if task_id in TaskCenterCore._running_tasks:
                return False
            # 每次执行生成一条任务日志，记录该次执行的状态、进度、进度消息
            begin_at = datetime.now()
            log = TaskLog(
                task_id=task_id,
                name=task.name,
                task_status=TaskStatus.RUNNING,
                task_type=task.task_type,
                task_configs=task.task_configs,
                task_progress=0,
                task_progress_message=None,
                task_begin_at=begin_at,
                task_end_at=None,
                task_duration=0,
            )
            log.save(force_insert=True)

            # 任务信息同步进入执行状态
            task.task_status = TaskStatus.RUNNING
            task.task_progress = 0
            task.task_progress_message = None
            task.task_begin_at = begin_at
            task.task_end_at = None
            task.task_duration = 0
            task.save()

            TaskCenterCore._running_tasks[task_id] = {"log_id": log.id, "cancel": False}

        TaskCenterCore._publish_task_event(task_id, log.id, task)

        thread = Thread(target=TaskCenterCore._execute, args=(task_id, log.id), daemon=True)
        thread.start()
        logger.info(f"任务开始执行: task_id={task_id}, log_id={log.id}, type={task.task_type}")
        return True

    @staticmethod
    def stop_task(task_id: str) -> bool:
        """
        停止任务：按任务类型分发停止

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否成功发送停止指令
        """
        task = TaskInfo.select().where(
            TaskInfo.id == task_id,
            TaskInfo.deleted == False
        ).first()
        if not task:
            return False

        # 数据抽取任务：委托本体任务停止
        if task.task_type == TaskType.DATA_EXTRACT and task.source_type == TaskSourceType.ONTOLOGY_TASK and task.source_id:
            from app.core.ontology.task_core import OntologyTaskCore
            return OntologyTaskCore.stop_task(task.source_id)

        # 文档切片任务：委托知识库任务取消
        if task.task_type == TaskType.DOC_CHUNK and task.source_type == TaskSourceType.KNOWLEDGEBASE_DOCUMENT and task.source_id:
            from app.core.knowledgebase.server import task_executor
            return task_executor.cancel_task(task.source_id)

        # 接口调用任务：设置取消标志，执行线程检测到后终止
        with TaskCenterCore._running_tasks_lock:
            entry = TaskCenterCore._running_tasks.get(task_id)
            if not entry:
                return False
            entry["cancel"] = True
        logger.info(f"任务停止指令已发送: task_id={task_id}")
        return True

    @staticmethod
    def _is_cancelled(task_id: str) -> bool:
        """检查任务是否请求了取消"""
        with TaskCenterCore._running_tasks_lock:
            entry = TaskCenterCore._running_tasks.get(task_id)
            return bool(entry and entry["cancel"])

    @staticmethod
    def _cleanup_running(task_id: str) -> None:
        """清理运行中任务注册表"""
        with TaskCenterCore._running_tasks_lock:
            TaskCenterCore._running_tasks.pop(task_id, None)

    @staticmethod
    def _update_progress(task_id: str, log_id: str, progress: float, message: str = '') -> None:
        """更新任务进度与进度消息（同步更新task_info与task_log）"""
        now = datetime.now()
        append_message = None
        if message:
            timestamp = now.strftime('%H:%M:%S')
            append_message = f"[{timestamp}] {message}"

        task = TaskInfo.select().where(TaskInfo.id == task_id).first()
        if task:
            task.task_progress = progress
            if append_message:
                existing = task.task_progress_message or ''
                task.task_progress_message = f"{existing}\n{append_message}".strip()
            task.save()

        log = TaskLog.select().where(TaskLog.id == log_id).first()
        if log:
            log.task_progress = progress
            if append_message:
                existing = log.task_progress_message or ''
                log.task_progress_message = f"{existing}\n{append_message}".strip()
            log.save()

        if task:
            TaskCenterCore._publish_task_event(task_id, log_id, task)

    @staticmethod
    def _finish_task(task_id: str, log_id: str, status: str) -> None:
        """任务结束：更新最终状态、结束时间与耗时（同步更新task_info与task_log）"""
        end_at = datetime.now()
        begin_at = None

        task = TaskInfo.select().where(TaskInfo.id == task_id).first()
        if task:
            begin_at = task.task_begin_at
            task.task_status = status
            task.task_end_at = end_at
            task.task_progress = 1 if status == TaskStatus.DONE else (task.task_progress or 0)
            if begin_at:
                task.task_duration = int((end_at - begin_at).total_seconds() * 1000)
            task.save()

        log = TaskLog.select().where(TaskLog.id == log_id).first()
        if log:
            log.task_status = status
            log.task_end_at = end_at
            log.task_progress = task.task_progress if task else (log.task_progress or 0)
            if log.task_begin_at:
                log.task_duration = int((end_at - log.task_begin_at).total_seconds() * 1000)
            log.save()

        TaskCenterCore._cleanup_running(task_id)
        if task:
            TaskCenterCore._publish_task_event(task_id, log_id, task)

    @staticmethod
    def _execute(task_id: str, log_id: str) -> None:
        """任务执行线程入口：按任务类型分发到对应的执行器"""
        try:
            task = TaskInfo.select().where(TaskInfo.id == task_id).first()
            if not task:
                TaskCenterCore._cleanup_running(task_id)
                return
            configs = json.loads(task.task_configs) if task.task_configs else {}
            executor = TaskCenterCore._EXECUTORS.get(task.task_type)
            if executor:
                executor(task, log_id, configs)
            else:
                TaskCenterCore._update_progress(task_id, log_id, 0, f"不支持的任务类型: {task.task_type}")
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
        except Exception as e:
            logger.error(f"任务执行异常: task_id={task_id}, error={e}", exc_info=True)
            TaskCenterCore._update_progress(task_id, log_id, 1, f"任务执行异常: {e}")
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)

    # ==================== 接口调用任务执行器 ====================

    @staticmethod
    def _execute_api_task(task: TaskInfo, log_id: str, configs: dict) -> None:
        """
        接口调用任务执行器：调用内置工具api_call的run方法发起HTTP请求并记录响应结果

        支持两种配置模式：
        - 关联模式（configs含server_id/api_id）：执行时读取服务与接口的最新配置，
          任务保存的参数值覆盖接口默认参数，请求头按 服务级->接口级->任务级 顺序合并
        - 直接模式（configs含url）：直接使用url/method/headers/body发起请求（兼容旧配置）

        configs: 关联模式 {server_id, api_id, parameters, headers, timeout}
                 直接模式 {url, method, headers, body, timeout}
        """
        task_id = task.id
        if configs.get('server_id') and configs.get('api_id'):
            TaskCenterCore._execute_api_task_linked(task_id, log_id, configs)
        else:
            TaskCenterCore._execute_api_task_direct(task_id, log_id, configs)

    @staticmethod
    def _execute_api_task_linked(task_id: str, log_id: str, configs: dict) -> None:
        """接口调用任务执行器（服务/接口关联模式）：读取最新接口配置并执行"""
        from app.core.tools.builtin_tools.api_call import normalize_headers, split_params
        from app.database.models import ApiServer, Api

        server_id = configs.get('server_id')
        api_id = configs.get('api_id')
        timeout = configs.get('timeout') or 30

        server = ApiServer.select().where(
            ApiServer.id == server_id, ApiServer.deleted == False
        ).first()
        api = Api.select().where(
            Api.id == api_id, Api.deleted == False
        ).first()
        if not server or not api:
            TaskCenterCore._update_progress(task_id, log_id, 0.2, "关联的服务或接口不存在，无法执行")
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
            return

        api_configs = json.loads(api.configs) if isinstance(api.configs, str) and api.configs else (api.configs or {})
        method = (api_configs.get('method') or 'GET').upper()
        path = api_configs.get('path') or ''

        TaskCenterCore._update_progress(
            task_id, log_id, 0.1,
            f"开始执行接口调用任务: {method} {path} @ {server.name}"
        )

        try:
            # 获取内置工具api_call实例
            from app.core.tools import ToolRegistry
            api_call_tool = ToolRegistry.get_tool('api_call')
            if not api_call_tool:
                TaskCenterCore._update_progress(task_id, log_id, 0.2, "内置工具api_call未注册")
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
                return

            # 合并请求头：服务级 -> 接口级 -> 任务级覆盖
            headers: Dict[str, Any] = {}
            headers.update(normalize_headers(server.headers))
            headers.update(normalize_headers(api_configs.get('headers', [])))
            headers.update(normalize_headers(configs.get('headers')))

            # 合并参数：接口配置默认值 -> 任务保存值覆盖
            query_params, path_params = split_params(api_configs.get('parameters', []), value_key='default')
            override_query, override_path = split_params(configs.get('parameters', []), value_key='value')
            query_params.update(override_query)
            path_params.update(override_path)

            # 组装请求体：任务保存的body参数转为JSON对象
            body = {p.get('name'): p.get('value') for p in (configs.get('parameters') or [])
                    if isinstance(p, dict) and p.get('in') == 'body' and p.get('name')}
            body = body or None

            TaskCenterCore._update_progress(task_id, log_id, 0.5, "正在通过内置工具api_call请求API接口...")
            tool_result = api_call_tool.run(
                server_url=server.url or '',
                path=path,
                method=method,
                headers=headers,
                query_params=query_params,
                path_params=path_params,
                body=body,
                timeout=timeout,
            )
            TaskCenterCore._finish_api_result(task_id, log_id, tool_result)
        except Exception as e:
            logger.error(f"接口调用任务执行异常: task_id={task_id}, error={e}", exc_info=True)
            TaskCenterCore._update_progress(task_id, log_id, 0.9, f"API请求异常: {e}")
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)

    @staticmethod
    def _execute_api_task_direct(task_id: str, log_id: str, configs: dict) -> None:
        """接口调用任务执行器（直接URL模式，兼容旧配置）：直接使用url发起请求"""
        url = configs.get('url')
        method = (configs.get('method') or 'GET').upper()
        headers = configs.get('headers') or {}
        body = configs.get('body')
        timeout = configs.get('timeout') or 30

        TaskCenterCore._update_progress(task_id, log_id, 0.1, f"开始执行接口调用任务: {method} {url}")

        if not url:
            TaskCenterCore._update_progress(task_id, log_id, 0.2, "任务配置缺少url参数")
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
            return

        try:
            # 获取内置工具api_call实例
            from app.core.tools import ToolRegistry
            api_call_tool = ToolRegistry.get_tool('api_call')
            if not api_call_tool:
                TaskCenterCore._update_progress(task_id, log_id, 0.2, "内置工具api_call未注册")
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
                return

            TaskCenterCore._update_progress(task_id, log_id, 0.5, "正在通过内置工具api_call请求API接口...")
            tool_result = api_call_tool.run(
                server_url=url,
                path='',
                method=method,
                headers=headers,
                body=body,
                timeout=timeout,
            )
            TaskCenterCore._finish_api_result(task_id, log_id, tool_result)
        except Exception as e:
            logger.error(f"接口调用任务执行异常: task_id={task_id}, error={e}", exc_info=True)
            TaskCenterCore._update_progress(task_id, log_id, 0.9, f"API请求异常: {e}")
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)

    @staticmethod
    def _finish_api_result(task_id: str, log_id: str, tool_result) -> None:
        """解析内置工具api_call的执行结果，更新任务进度与终态"""
        try:
            # 从工具结果解析响应信息
            resp = tool_result.result if isinstance(tool_result.result, dict) else {}
            status_code = resp.get('status_code') or tool_result.metadata.get('status_code')
            resp_headers = resp.get('headers') or {}
            content_type = ''
            if isinstance(resp_headers, dict):
                # 部分服务器header为小写，做大小写兼容处理
                for k, v in resp_headers.items():
                    if str(k).lower() == 'content-type':
                        content_type = str(v)
                        break
            resp_body = resp.get('body')
            if not isinstance(resp_body, str):
                try:
                    resp_body = json.dumps(resp_body, ensure_ascii=False)
                except Exception:
                    resp_body = str(resp_body)
            resp_body = str(resp_body)[:2000]
            elapsed = resp.get('elapsed')

            if tool_result.success:
                # 请求成功：按HTTP状态码判定任务终态（2xx/3xx为成功）
                TaskCenterCore._update_progress(
                    task_id, log_id, 0.9,
                    f"API响应: 状态码={status_code}, Content-Type={content_type or '未知'}, 耗时={elapsed}秒\n响应内容: {resp_body}"
                )
                if isinstance(status_code, int) and 200 <= status_code < 400:
                    TaskCenterCore._finish_task(task_id, log_id, TaskStatus.DONE)
                else:
                    TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
            else:
                # 请求失败（连接异常/超时等）：工具返回错误信息
                TaskCenterCore._update_progress(
                    task_id, log_id, 0.9,
                    f"API请求失败: {tool_result.message}\n错误详情: {tool_result.error or '无'}"
                )
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
        except Exception as e:
            logger.error(f"解析接口调用任务结果异常: task_id={task_id}, error={e}", exc_info=True)
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)

    # 类型执行器注册表（接口调用任务直接执行；数据抽取/文档切片任务委托业务模块执行）
    _EXECUTORS = {
        TaskType.API: _execute_api_task,
    }

    # ==================== 结果与历史 ====================

    @staticmethod
    def get_task_result(task_id: str) -> Optional[dict]:
        """
        获取任务执行结果（不同任务类型结果内容不同）

        - 接口调用：任务信息 + 最近一次执行日志
        - 数据抽取：委托本体任务结果（含结果文件数据）
        - 文档切片：任务信息 + 文档切片统计信息

        Args:
            task_id: 任务ID

        Returns:
            dict: 任务结果
        """
        task = TaskInfo.select().where(
            TaskInfo.id == task_id,
            TaskInfo.deleted == False
        ).first()
        if not task:
            return None

        # 数据抽取任务：返回本体任务结果
        if task.task_type == TaskType.DATA_EXTRACT and task.source_type == TaskSourceType.ONTOLOGY_TASK and task.source_id:
            from app.core.ontology.task_core import OntologyTaskCore
            source_result = OntologyTaskCore.get_task_result(task.source_id)
            log = TaskLog.select().where(
                TaskLog.task_id == task_id,
                TaskLog.deleted == False
            ).order_by(TaskLog.created_at.desc()).first()
            return {
                'task': task_info_to_dict(task),
                'log': task_log_to_dict(log) if log else None,
                'source_result': source_result,
            }

        # 文档切片任务：返回文档切片统计
        if task.task_type == TaskType.DOC_CHUNK and task.source_type == TaskSourceType.KNOWLEDGEBASE_DOCUMENT and task.source_id:
            doc = KnowledgebaseDocument.select().where(
                KnowledgebaseDocument.id == task.source_id,
                KnowledgebaseDocument.deleted == False
            ).first()
            log = TaskLog.select().where(
                TaskLog.task_id == task_id,
                TaskLog.deleted == False
            ).order_by(TaskLog.created_at.desc()).first()
            doc_stats = None
            if doc:
                doc_stats = {
                    'title': doc.title or '',
                    'file_name': doc.file_name or '',
                    'chunk_method': doc.chunk_method or '',
                    'chunk_num': doc.chunk_num or 0,
                    'token_num': doc.token_num or 0,
                    'running_status': doc.running_status,
                }
            return {
                'task': task_info_to_dict(task),
                'log': task_log_to_dict(log) if log else None,
                'doc_stats': doc_stats,
            }

        # 接口调用任务：任务信息 + 最近一次执行日志
        log = TaskLog.select().where(
            TaskLog.task_id == task_id,
            TaskLog.deleted == False
        ).order_by(TaskLog.created_at.desc()).first()
        return {
            'task': task_info_to_dict(task),
            'log': task_log_to_dict(log) if log else None,
        }

    @staticmethod
    def get_task_logs(task_id: str, page: int = 1, page_size: int = 20) -> Tuple[List[dict], int]:
        """获取任务的执行历史日志列表（分页）"""
        query = TaskLog.select().where(
            TaskLog.task_id == task_id,
            TaskLog.deleted == False
        ).order_by(TaskLog.created_at.desc())
        total = query.count()
        logs = query.paginate(page, page_size)
        return [task_log_to_dict(log) for log in logs], total
