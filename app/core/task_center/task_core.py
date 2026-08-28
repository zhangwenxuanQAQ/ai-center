"""
任务中心核心逻辑 - 任务执行
按任务类型分发执行：
    - 接口调用(api)：调用内置工具api_call的run方法发起HTTP请求执行
    - 数据抽取(data_extract)：委托本体工作台任务队列执行
    - 文档切片(doc_chunk)：委托知识库文档切片执行器执行
并负责任务进度更新、日志生成、结果管理
"""

import json
import base64
import logging
import time
from datetime import datetime, timedelta
from threading import Thread, Lock
from typing import Optional, Dict, Any, List, Tuple

from app.database.models import TaskInfo, TaskLog, KnowledgebaseDocument
from app.database.redis_utils import redis_utils
from app.constants.ontology_constants import ONTOLOGY_TASK_EVENTS_CHANNEL
from app.constants.task_center_constants import (
    TaskStatus, TaskType, TASK_TYPE_NAME, TASK_STATUS_LABELS, TaskSourceType,
    TASK_CENTER_EVENTS_CHANNEL, TASK_CENTER_PROGRESS_INTERVAL,
    API_TASK_RESULT_PREFIX, API_TASK_RESULT_REDIS_EXPIRE, API_EXPORT_FORMAT_FILE_EXT,
)
from app.core.task_center.utils import task_info_to_dict, task_log_to_dict
from app.core.task_center.task_output import (
    TaskOutput, ApiTaskOutput, create_task_output, format_duration_ms,
)

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
    def _finish_task(task_id: str, log_id: str, status: str, output: TaskOutput = None) -> None:
        """任务结束：更新最终状态、结束时间与耗时，并保存任务输出结果（同步更新task_info与task_log）

        Args:
            task_id: 任务ID
            log_id: 任务日志ID
            status: 最终任务状态
            output: 任务输出结果实例（可选），公共字段（状态/起止时间/耗时）在此处统一填充
        """
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

            # 构建并保存任务输出结果（公共字段统一填充）
            task_output = output if output is not None else create_task_output(task.task_type)
            task_output.set_common(
                status='success' if status == TaskStatus.DONE else ('fail' if status == TaskStatus.FAIL else status),
                error=task_output.get('error'),
                start_time=begin_at.strftime('%Y-%m-%d %H:%M:%S') if begin_at else '',
                end_time=end_at.strftime('%Y-%m-%d %H:%M:%S'),
                duration=format_duration_ms(task.task_duration),
                executed_at=end_at.strftime('%Y-%m-%d %H:%M:%S'),
            )
            task.task_output = task_output.to_json()
            task.save()

        log = TaskLog.select().where(TaskLog.id == log_id).first()
        if log:
            log.task_status = status
            log.task_end_at = end_at
            log.task_progress = task.task_progress if task else (log.task_progress or 0)
            if log.task_begin_at:
                log.task_duration = int((end_at - log.task_begin_at).total_seconds() * 1000)
            if task:
                log.task_output = task.task_output
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
    def _resolve_parameters(params: list, api_param_defs: list) -> list:
        """将前端提交的参数解析为完整参数（从接口配置中补充in/type信息并转换值类型）

        支持两种前端提交格式：
        1. 新格式：[{param_name: param_value}, ...] — 键值对对象数组
        2. 旧格式：[{name, value}] — 扁平列表
        3. 兼容旧格式：[[{name, value}]] — 嵌套列表（多参数模式）

        从接口配置中查找：
        - in: 参数位置（query/path/body）
        - type: 参数类型（string/integer/number/boolean/array/object）
        并根据type将value转换为对应类型。
        """
        if not params:
            return []

        def convert_value(value, type_str: str):
            """根据类型字符串转换值"""
            if value is None or value == '':
                return value
            type_str = (type_str or 'string').lower()
            try:
                if type_str in ('integer', 'int'):
                    return int(value)
                if type_str in ('number', 'float', 'double'):
                    return float(value)
                if type_str == 'boolean':
                    if isinstance(value, bool):
                        return value
                    return str(value).lower() in ('true', '1', 'yes')
                if type_str in ('array', 'object'):
                    if isinstance(value, (list, dict)):
                        return value
                    if isinstance(value, str):
                        return json.loads(value)
                    return value
                return str(value) if not isinstance(value, str) else value
            except (ValueError, TypeError, json.JSONDecodeError):
                return value

        # 构建接口参数定义查找表
        def_map = {}
        for d in (api_param_defs or []):
            if isinstance(d, dict) and d.get('name'):
                def_map[d['name']] = d

        resolved = []
        for p in params:
            if not isinstance(p, dict):
                continue

            # 旧格式：{name, value} 或 {name, in, type, value}
            if p.get('name'):
                # 若已包含in/type（旧格式已解析），直接使用
                if p.get('in') is not None:
                    resolved.append(p)
                    continue
                name = p['name']
                def_info = def_map.get(name, {})
                in_pos = def_info.get('in', 'query')
                param_type = def_info.get('type', 'string')
                value = convert_value(p.get('value'), param_type)
                resolved.append({
                    'name': name,
                    'in': in_pos,
                    'type': param_type,
                    'value': value,
                })
                continue

            # 新格式：{key: value} — 参数名为key，参数值为value
            # 排除特殊键（如status/error等元数据）
            skip_keys = {'status', 'error', 'path', 'response', 'params', 'group', 'status_code', 'elapsed'}
            for key, val in p.items():
                if key in skip_keys or key.startswith('_'):
                    continue
                def_info = def_map.get(key, {})
                in_pos = def_info.get('in', 'query')
                param_type = def_info.get('type', 'string')
                value = convert_value(val, param_type)
                resolved.append({
                    'name': key,
                    'in': in_pos,
                    'type': param_type,
                    'value': value,
                })
        return resolved

    @staticmethod
    def _execute_api_task_linked(task_id: str, log_id: str, configs: dict) -> None:
        """接口调用任务执行器（服务/接口关联模式）：读取最新接口配置并执行

        支持单参数和多参数两种模式：
        - 单参数模式（param_mode=single 或 parameters为扁平列表）：执行一次API调用
        - 多参数模式（param_mode=multi 或 parameters为列表的列表）：循环执行多次API调用
        """
        from app.core.tools.builtin_tools.api_call import normalize_headers, split_params
        from app.database.models import ApiServer, Api

        server_id = configs.get('server_id')
        api_id = configs.get('api_id')
        timeout = configs.get('timeout') or 30
        param_mode = configs.get('param_mode', 'single')
        export_format = configs.get('export_format', 'json')
        export_contents = configs.get('export_contents') or ['path', 'params', 'response']

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

        # 判断是否为多参数模式
        parameters = configs.get('parameters') or []
        is_multi = param_mode == 'multi' or (
            isinstance(parameters, list) and len(parameters) > 0 and (
                isinstance(parameters[0], list) or
                (isinstance(parameters[0], dict) and not parameters[0].get('name'))
            )
        )

        if is_multi and isinstance(parameters, list):
            # 多参数模式：循环执行
            TaskCenterCore._execute_api_task_multi(
                task_id, log_id, configs, server, api, api_configs,
                method, path, timeout, parameters, export_format, export_contents
            )
        else:
            # 单参数模式：单次执行
            TaskCenterCore._execute_api_task_single(
                task_id, log_id, configs, server, api, api_configs,
                method, path, timeout, parameters, export_format, export_contents
            )

    @staticmethod
    def _execute_api_task_single(
        task_id: str, log_id: str, configs: dict,
        server, api, api_configs: dict,
        method: str, path: str, timeout: int,
        parameters: list, export_format: str, export_contents: list
    ) -> None:
        """单参数模式：执行一次API调用"""
        from app.core.tools.builtin_tools.api_call import normalize_headers, split_params
        from app.core.tools import ToolRegistry

        TaskCenterCore._update_progress(
            task_id, log_id, 0.1,
            f"开始执行接口调用任务: {method} {path} @ {server.name}"
        )

        try:
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
            resolved_params = TaskCenterCore._resolve_parameters(parameters, api_configs.get('parameters', []))
            query_params, path_params = split_params(api_configs.get('parameters', []), value_key='default')
            override_query, override_path = split_params(resolved_params, value_key='value')
            query_params.update(override_query)
            path_params.update(override_path)

            # 组装请求体
            body = {p.get('name'): p.get('value') for p in resolved_params
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
            TaskCenterCore._finish_api_result(
                task_id, log_id, tool_result,
                path=path, method=method, server_name=server.name,
                parameters=parameters, export_format=export_format, export_contents=export_contents,
            )
        except Exception as e:
            logger.error(f"接口调用任务执行异常: task_id={task_id}, error={e}", exc_info=True)
            TaskCenterCore._update_progress(task_id, log_id, 0.9, f"API请求异常: {e}")
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)

    @staticmethod
    def _execute_api_task_multi(
        task_id: str, log_id: str, configs: dict,
        server, api, api_configs: dict,
        method: str, path: str, timeout: int,
        parameter_groups: list, export_format: str, export_contents: list
    ) -> None:
        """多参数模式：循环执行多次API调用，汇总结果"""
        from app.core.tools.builtin_tools.api_call import normalize_headers, split_params
        from app.core.tools import ToolRegistry

        total_groups = len(parameter_groups)
        TaskCenterCore._update_progress(
            task_id, log_id, 0.05,
            f"开始执行接口调用任务（多参数模式，共{total_groups}组）: {method} {path} @ {server.name}"
        )

        try:
            api_call_tool = ToolRegistry.get_tool('api_call')
            if not api_call_tool:
                TaskCenterCore._update_progress(task_id, log_id, 0.1, "内置工具api_call未注册")
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
                return

            # 合并请求头：服务级 -> 接口级 -> 任务级覆盖
            base_headers: Dict[str, Any] = {}
            base_headers.update(normalize_headers(server.headers))
            base_headers.update(normalize_headers(api_configs.get('headers', [])))
            base_headers.update(normalize_headers(configs.get('headers')))

            all_results = []
            success_count = 0
            fail_count = 0

            for idx, group_params in enumerate(parameter_groups):
                if not isinstance(group_params, dict):
                    continue

                progress = 0.1 + (idx / max(total_groups, 1)) * 0.7
                TaskCenterCore._update_progress(
                    task_id, log_id, progress,
                    f"正在执行第 {idx + 1}/{total_groups} 组参数..."
                )

                # 合并当前组参数（从接口配置解析in/type并转换值类型）
                # group_params 为 {key: value} 格式，_resolve_parameters 会自动解析
                resolved_group = TaskCenterCore._resolve_parameters([group_params], api_configs.get('parameters', []))
                query_params, path_params = split_params(api_configs.get('parameters', []), value_key='default')
                group_query, group_path = split_params(resolved_group, value_key='value')
                query_params.update(group_query)
                path_params.update(group_path)

                body = {p.get('name'): p.get('value') for p in resolved_group
                        if isinstance(p, dict) and p.get('in') == 'body' and p.get('name')}
                body = body or None

                try:
                    tool_result = api_call_tool.run(
                        server_url=server.url or '',
                        path=path,
                        method=method,
                        headers=base_headers,
                        query_params=query_params,
                        path_params=path_params,
                        body=body,
                        timeout=timeout,
                    )
                    resp = tool_result.result if isinstance(tool_result.result, dict) else {}
                    status_code = resp.get('status_code')
                    resp_body = resp.get('body')
                    if not isinstance(resp_body, str):
                        try:
                            resp_body = json.dumps(resp_body, ensure_ascii=False)
                        except Exception:
                            resp_body = str(resp_body)
                    resp_body = str(resp_body)[:1000]
                    elapsed = resp.get('elapsed')

                    if tool_result.success and isinstance(status_code, int) and 200 <= status_code < 400:
                        success_count += 1
                        all_results.append({
                            'group': idx + 1,
                            'status': 'success',
                            'status_code': status_code,
                            'elapsed': elapsed,
                            'params': group_params,
                            'response': resp_body,
                        })
                    else:
                        fail_count += 1
                        all_results.append({
                            'group': idx + 1,
                            'status': 'fail',
                            'status_code': status_code,
                            'elapsed': elapsed,
                            'params': group_params,
                            'response': resp_body,
                            'error': tool_result.message if not tool_result.success else None,
                        })
                except Exception as e:
                    fail_count += 1
                    all_results.append({
                        'group': idx + 1,
                        'status': 'error',
                        'params': group_params,
                        'error': str(e),
                    })

            # 汇总结果
            progress = 0.9
            summary_msg = f"多参数执行完成: 共{total_groups}组，成功{success_count}组，失败{fail_count}组"
            TaskCenterCore._update_progress(task_id, log_id, progress, summary_msg)

            # 构建最终结果消息（不包含接口结果，仅摘要信息）
            result_msg_parts = [summary_msg]
            result_msg_parts.append(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            for r in all_results:
                status_icon = '✓' if r['status'] == 'success' else '✗'
                result_msg_parts.append(
                    f"  [{status_icon}] 第{r['group']}组: 状态码={r.get('status_code', '-')}, 耗时={r.get('elapsed', '-')}秒"
                )
                if r.get('error'):
                    result_msg_parts.append(f"    错误: {r['error']}")

            result_msg = '\n'.join(result_msg_parts)
            TaskCenterCore._update_progress(task_id, log_id, 0.95, result_msg[:2000])

            # 保存多参数结果为文件
            multi_result_data = {
                'summary': {
                    'total': total_groups,
                    'success': success_count,
                    'fail': fail_count,
                },
                'results': all_results,
            }
            file_name = f"api_multi_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            file_info = TaskCenterCore._save_api_result_file(task_id, multi_result_data, export_format, file_name)

            # 构建任务输出结果并保存
            output = ApiTaskOutput()
            output.set('param_mode', 'multi')
            output.set('param_count', total_groups)
            output.set('success_count', success_count)
            output.set('fail_count', fail_count)
            if fail_count > 0 and success_count == 0:
                first_error = next((r.get('error') for r in all_results if r.get('error')), None)
                output.set('error', first_error or '全部参数组执行失败')
            if file_info:
                output.set('result_file', file_info.get('file_name', ''))
                output.set('file_format', file_info.get('format', ''))
                output.set('expire_at', file_info.get('expire_at', ''))

            if success_count > 0:
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.DONE, output)
            else:
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL, output)
        except Exception as e:
            logger.error(f"多参数接口调用任务执行异常: task_id={task_id}, error={e}", exc_info=True)
            TaskCenterCore._update_progress(task_id, log_id, 0.9, f"API请求异常: {e}")
            output = ApiTaskOutput()
            output.set('param_mode', 'multi')
            output.set('error', str(e))
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL, output)

    @staticmethod
    def _execute_api_task_direct(task_id: str, log_id: str, configs: dict) -> None:
        """接口调用任务执行器（直接URL模式，兼容旧配置）：直接使用url发起请求"""
        url = configs.get('url')
        method = (configs.get('method') or 'GET').upper()
        headers = configs.get('headers') or {}
        body = configs.get('body')
        timeout = configs.get('timeout') or 30
        export_format = configs.get('export_format', 'json')
        export_contents = configs.get('export_contents') or ['path', 'params', 'response']

        TaskCenterCore._update_progress(task_id, log_id, 0.1, f"开始执行接口调用任务: {method} {url}")

        if not url:
            TaskCenterCore._update_progress(task_id, log_id, 0.2, "任务配置缺少url参数")
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)
            return

        try:
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
            TaskCenterCore._finish_api_result(
                task_id, log_id, tool_result,
                path=url, method=method,
                parameters=[], export_format=export_format, export_contents=export_contents,
            )
        except Exception as e:
            logger.error(f"接口调用任务执行异常: task_id={task_id}, error={e}", exc_info=True)
            TaskCenterCore._update_progress(task_id, log_id, 0.9, f"API请求异常: {e}")
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL)

    @staticmethod
    def _finish_api_result(
        task_id: str, log_id: str, tool_result,
        path: str = '', method: str = '', server_name: str = '',
        parameters: list = None, export_format: str = 'json',
        export_contents: list = None
    ) -> None:
        """解析内置工具api_call的执行结果，更新任务进度与终态

        根据export_format格式化输出内容，export_contents控制包含的内容部分。
        """
        if parameters is None:
            parameters = []
        if export_contents is None:
            export_contents = ['path', 'params', 'response']

        try:
            resp = tool_result.result if isinstance(tool_result.result, dict) else {}
            status_code = resp.get('status_code') or tool_result.metadata.get('status_code')
            resp_headers = resp.get('headers') or {}
            content_type = ''
            if isinstance(resp_headers, dict):
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

            # 判断执行状态
            is_success = tool_result.success and isinstance(status_code, int) and 200 <= status_code < 400
            status = 'success' if is_success else 'fail'
            error_msg = None
            if not tool_result.success:
                error_msg = tool_result.message or tool_result.error or 'API请求失败'
            elif not is_success:
                error_msg = f'HTTP {status_code}' if status_code else None

            # 构建进度消息（不包含接口结果，仅摘要信息）
            msg_parts = []

            # 执行状态与错误（始终输出）
            msg_parts.append(f"执行状态: {status}")
            if error_msg:
                msg_parts.append(f"错误消息: {error_msg}")

            if 'path' in export_contents:
                msg_parts.append(f"接口路径: {method} {path}")
                if server_name:
                    msg_parts[-1] += f" @ {server_name}"

            if 'params' in export_contents and parameters:
                # 兼容新格式 [{key: value}] 和旧格式 [{name, value}]
                if isinstance(parameters, list) and parameters and isinstance(parameters[0], dict) and not parameters[0].get('name'):
                    # 新格式：从第一个对象提取key-value
                    first_param = parameters[0]
                    params_desc = ', '.join(f"{k}={v}" for k, v in first_param.items() if not k.startswith('_'))
                else:
                    params_desc = ', '.join(
                        f"{p.get('name')}={p.get('value')}"
                        for p in parameters
                        if isinstance(p, dict) and p.get('name')
                    )
                if params_desc:
                    msg_parts.append(f"接口参数: {params_desc}")

            # 摘要信息（不包含响应内容）
            msg_parts.append(f"状态码: {status_code}, 耗时: {elapsed}秒")
            msg_parts.append(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

            result_msg = '\n'.join(msg_parts)

            # 按导出格式格式化
            if export_format == 'markdown':
                md_parts = []
                if 'path' in export_contents:
                    md_parts.append(f"## 接口路径\n```\n{method} {path}")
                    if server_name:
                        md_parts[-1] += f" @ {server_name}"
                    md_parts[-1] += "```"
                # 状态与错误
                md_parts.append(f"## 执行状态: {status}")
                if error_msg:
                    md_parts.append(f"**错误消息**: {error_msg}")
                if 'params' in export_contents and parameters:
                    md_parts.append("## 接口参数")
                    if isinstance(parameters, list) and parameters and isinstance(parameters[0], dict) and not parameters[0].get('name'):
                        for k, v in parameters[0].items():
                            if not k.startswith('_'):
                                md_parts.append(f"- **{k}**: `{v}`")
                    else:
                        for p in parameters:
                            if isinstance(p, dict) and p.get('name'):
                                md_parts.append(f"- **{p.get('name')}** ({p.get('in', 'query')}): `{p.get('value')}`")
                if 'response' in export_contents:
                    md_parts.append(f"## 接口返回结果\n- **状态码**: {status_code}")
                    md_parts.append(f"- **Content-Type**: {content_type or '未知'}")
                    md_parts.append(f"- **耗时**: {elapsed}秒")
                    md_parts.append(f"```\n{resp_body}\n```")
                result_msg = '\n\n'.join(md_parts)

            TaskCenterCore._update_progress(task_id, log_id, 0.9, result_msg[:2000])

            # 保存结果为文件
            result_data = {
                'status': status,
                'error': error_msg,
                'path': f"{method} {path}" if method else path,
                'params': {},
                'status_code': status_code,
                'response': resp_body,
            }
            if isinstance(parameters, list) and parameters:
                if isinstance(parameters[0], dict) and not parameters[0].get('name'):
                    result_data['params'] = {k: v for k, v in parameters[0].items() if not k.startswith('_')}
                else:
                    result_data['params'] = {
                        p.get('name'): p.get('value')
                        for p in parameters
                        if isinstance(p, dict) and p.get('name')
                    }
            file_name = f"api_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            file_info = TaskCenterCore._save_api_result_file(task_id, result_data, export_format, file_name)

            # 构建任务输出结果并保存
            output = ApiTaskOutput()
            output.set('param_mode', 'single')
            output.set('error', error_msg)
            if file_info:
                output.set('result_file', file_info.get('file_name', ''))
                output.set('file_format', file_info.get('format', ''))
                output.set('expire_at', file_info.get('expire_at', ''))

            if is_success:
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.DONE, output)
            else:
                TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL, output)
        except Exception as e:
            logger.error(f"解析接口调用任务结果异常: task_id={task_id}, error={e}", exc_info=True)
            output = ApiTaskOutput()
            output.set('error', str(e))
            TaskCenterCore._finish_task(task_id, log_id, TaskStatus.FAIL, output)

    @staticmethod
    def _save_api_result_file(task_id: str, result_data: dict, export_format: str, file_name: str) -> Optional[dict]:
        """将接口调用任务结果保存为文件（存Redis，base64编码，24小时过期）

        result_data: 包含 status, error, path, params, response 等字段
        export_format: json/excel/markdown
        file_name: 结果文件名

        Returns:
            dict: 保存的文件信息（file_name/format/executed_at/expire_at），失败返回None
        """
        try:
            # 生成文件内容
            content = ''
            ext = API_EXPORT_FORMAT_FILE_EXT.get(export_format, 'json')

            if export_format == 'json':
                content = json.dumps(result_data, ensure_ascii=False, indent=2)
            elif export_format == 'markdown':
                md_parts = [f"# 接口调用结果\n"]
                md_parts.append(f"## 执行状态: {result_data.get('status', 'unknown')}")
                if result_data.get('error'):
                    md_parts.append(f"\n**错误消息**: {result_data['error']}")
                if result_data.get('path'):
                    md_parts.append(f"\n## 接口路径\n```\n{result_data['path']}\n```")
                if result_data.get('params'):
                    md_parts.append(f"\n## 接口参数")
                    if isinstance(result_data['params'], dict):
                        for k, v in result_data['params'].items():
                            md_parts.append(f"- **{k}**: `{v}`")
                if result_data.get('response'):
                    md_parts.append(f"\n## 接口返回结果")
                    resp = result_data.get('response', '')
                    md_parts.append(f"```json\n{resp}\n```")
                content = '\n'.join(md_parts)
            elif export_format == 'excel':
                # Excel格式使用CSV兼容性格式（后续可扩展为xlsx）
                headers = ['执行状态', '错误消息', '接口路径', '参数', '状态码', '响应']
                row = [
                    result_data.get('status', ''),
                    result_data.get('error', '') or '',
                    result_data.get('path', '') or '',
                    json.dumps(result_data.get('params', {}), ensure_ascii=False) if result_data.get('params') else '',
                    str(result_data.get('status_code', '')),
                    str(result_data.get('response', ''))[:1000],
                ]
                content = ','.join(headers) + '\n' + ','.join(
                    f'"{str(v).replace(chr(34), chr(34)+chr(34))}"' for v in row
                )
                ext = 'csv'
            else:
                content = json.dumps(result_data, ensure_ascii=False, indent=2)

            # 编码为base64存Redis
            file_base64 = base64.b64encode(content.encode('utf-8')).decode('utf-8')
            result_key = f"{API_TASK_RESULT_PREFIX}{task_id}"
            now = datetime.now()
            file_info = {
                'file_name': f"{file_name}.{ext}",
                'format': export_format,
                'executed_at': now.strftime('%Y-%m-%d %H:%M:%S'),
                'expire_at': (now + timedelta(seconds=API_TASK_RESULT_REDIS_EXPIRE)).strftime('%Y-%m-%d %H:%M:%S'),
            }
            redis_utils.set_obj(result_key, {
                'file_base64': file_base64,
                'result_data': result_data,
                **file_info,
            }, exp=API_TASK_RESULT_REDIS_EXPIRE)
            return file_info
        except Exception as e:
            logger.error(f"保存接口调用结果文件失败: task_id={task_id}, error={e}")
            return None

    @staticmethod
    def _get_api_result_file(task_id: str) -> Optional[dict]:
        """获取接口调用任务结果文件（从Redis读取）"""
        try:
            result_key = f"{API_TASK_RESULT_PREFIX}{task_id}"
            result = redis_utils.get_obj(result_key) if redis_utils.is_available else None
            return result
        except Exception:
            return None

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

        # 接口调用任务：任务信息 + 最近一次执行日志 + 结果文件
        log = TaskLog.select().where(
            TaskLog.task_id == task_id,
            TaskLog.deleted == False
        ).order_by(TaskLog.created_at.desc()).first()
        api_result_file = TaskCenterCore._get_api_result_file(task_id)
        source_result = None
        if api_result_file:
            source_result = {
                'status': task.task_status,
                'status_label': TASK_STATUS_LABELS.get(task.task_status, task.task_status),
                'has_result': True,
                'file_name': api_result_file.get('file_name', ''),
                'format': api_result_file.get('format', ''),
                'file_base64': api_result_file.get('file_base64', ''),
                'row_count': 1,
                'executed_at': api_result_file.get('executed_at', ''),
                'expire_at': api_result_file.get('expire_at', ''),
            }
        else:
            source_result = {
                'status': task.task_status,
                'status_label': TASK_STATUS_LABELS.get(task.task_status, task.task_status),
                'has_result': False,
                'message': '暂无结果文件（可能已过期或未执行）',
            }
        return {
            'task': task_info_to_dict(task),
            'log': task_log_to_dict(log) if log else None,
            'source_result': source_result,
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
