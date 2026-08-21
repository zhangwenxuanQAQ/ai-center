"""
本体工作台核心逻辑 - 数据抽取任务
包含任务执行、流式进度推送、结果管理等核心业务逻辑
"""

import json
import base64
import logging
import time
from datetime import datetime, timedelta
from threading import Thread
from typing import Optional, Dict, Any

from app.database.models import OntologyTask, OntologyObject
from app.services.datasource.service import DatasourceService
from app.database.redis_utils import redis_utils
from app.constants.ontology_constants import (
    OntologyTaskStatus, OntologyExportFormat,
    ONTOLOGY_TASK_STREAM_PREFIX, ONTOLOGY_TASK_STATUS_PREFIX,
    ONTOLOGY_TASK_RESULT_PREFIX, ONTOLOGY_TASK_REDIS_EXPIRE
)
from app.core.ontology.utils import ontology_object_to_dict, task_to_dict
from app.core.hooks.ontology_task_hook import OntologyTaskHook

logger = logging.getLogger(__name__)


class OntologyTaskCore:
    """数据抽取任务核心服务"""

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
        elif status in (OntologyTaskStatus.DONE, OntologyTaskStatus.FAIL, OntologyTaskStatus.CANCEL):
            task.task_end_at = datetime.now()
            if task.task_begin_at:
                task.task_duration = int((task.task_end_at - task.task_begin_at).total_seconds() * 1000)
        task.save()
        return True

    @staticmethod
    def update_task_progress(task_id: str, progress: float, message: str = '') -> bool:
        """更新任务进度"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task:
            return False
        task.task_progress = progress
        if message:
            task.task_progress_message = message
        task.save()
        return True

    @staticmethod
    def get_task(task_id: str) -> Optional[dict]:
        """获取单个任务"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        return task_to_dict(task) if task else None

    # ==================== 任务执行 ====================

    @staticmethod
    def execute_task(task_id: str) -> bool:
        """执行数据抽取任务（后台线程，流式推送进度）"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task:
            return False

        if task.status == OntologyTaskStatus.RUNNING:
            return False

        stream_key = f"{ONTOLOGY_TASK_STREAM_PREFIX}{task_id}"
        status_key = f"{ONTOLOGY_TASK_STATUS_PREFIX}{task_id}"

        def _push_progress(msg: str, progress: float = None):
            """推送进度消息到Redis流"""
            data = {'type': 'progress', 'message': msg}
            if progress is not None:
                data['progress'] = progress
            redis_utils.client.rpush(stream_key, json.dumps(data, ensure_ascii=False))

        def run():
            """后台执行任务"""
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

                # 构建SQL
                _push_progress("正在构建查询SQL", 0.1)
                if custom_sql:
                    sql = custom_sql
                elif ontology_object_id:
                    ontology_obj = OntologyTaskCore._get_ontology_object(ontology_object_id)
                    if not ontology_obj:
                        raise Exception("本体对象不存在")
                    sql = f"SELECT * FROM {ontology_obj['name']}"
                else:
                    raise Exception("任务配置缺失：请指定本体对象或自定义SQL")

                # SQL安全校验
                _push_progress("正在进行SQL安全校验", 0.2)
                hook = OntologyTaskHook()
                hook.before(sql=sql)

                _push_progress("正在执行数据查询", 0.3)
                OntologyTaskCore.update_task_progress(task_id, 0.3, "正在执行数据查询")

                # 执行查询
                result = DatasourceService.execute_query(task.datasource_id, sql)

                if not result.get('success'):
                    raise Exception(result.get('message', '查询执行失败'))

                data = result.get('data', [])
                _push_progress(f"查询完成，共获取 {len(data) if isinstance(data, list) else 0} 条数据", 0.5)

                _push_progress("正在格式化数据", 0.7)
                OntologyTaskCore.update_task_progress(task_id, 0.7, "正在格式化数据")
                file_content = OntologyTaskCore._format_data(data, export_format)

                _push_progress("正在生成结果文件", 0.85)
                # 转base64存储到Redis
                file_base64 = base64.b64encode(file_content.encode('utf-8')).decode('utf-8')
                result_key = f"{ONTOLOGY_TASK_RESULT_PREFIX}{task_id}"
                redis_utils.set_obj(result_key, {
                    'file_base64': file_base64,
                    'format': export_format,
                    'file_name': f"{task.name}.{export_format}",
                    'row_count': len(data) if isinstance(data, list) else 0,
                    'executed_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'expire_at': (datetime.now() + timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S'),
                }, exp=ONTOLOGY_TASK_REDIS_EXPIRE)

                _push_progress("任务执行完成", 1.0)
                OntologyTaskCore.update_task_progress(task_id, 1.0, "任务执行完成")
                OntologyTaskCore.update_task_status(task_id, OntologyTaskStatus.DONE)
                redis_utils.set(status_key, OntologyTaskStatus.DONE, exp=ONTOLOGY_TASK_REDIS_EXPIRE)
                redis_utils.client.rpush(stream_key, json.dumps(
                    {'type': 'done', 'message': '任务执行完成'}, ensure_ascii=False
                ))

            except Exception as e:
                logger.error(f"任务执行失败: task_id={task_id}, error={e}")
                _push_progress(f"执行失败: {str(e)}", 0)
                OntologyTaskCore.update_task_progress(task_id, 0, f"执行失败: {str(e)}")
                OntologyTaskCore.update_task_status(task_id, OntologyTaskStatus.FAIL)
                redis_utils.set(status_key, OntologyTaskStatus.FAIL, exp=ONTOLOGY_TASK_REDIS_EXPIRE)
                redis_utils.client.rpush(stream_key, json.dumps(
                    {'type': 'error', 'message': str(e)}, ensure_ascii=False
                ))

        Thread(target=run, daemon=True).start()
        return True

    @staticmethod
    def stop_task(task_id: str) -> bool:
        """停止正在运行的任务"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task or task.status != OntologyTaskStatus.RUNNING:
            return False

        OntologyTaskCore.update_task_status(task_id, OntologyTaskStatus.CANCEL)
        status_key = f"{ONTOLOGY_TASK_STATUS_PREFIX}{task_id}"
        redis_utils.set(status_key, OntologyTaskStatus.CANCEL, exp=ONTOLOGY_TASK_REDIS_EXPIRE)
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
    def _format_data(data: list, export_format: str) -> str:
        """根据导出格式转换数据"""
        if export_format == OntologyExportFormat.JSON:
            return json.dumps(data, ensure_ascii=False, indent=2)

        elif export_format == OntologyExportFormat.MARKDOWN:
            if data:
                headers = list(data[0].keys())
                lines = [
                    '| ' + ' | '.join(headers) + ' |',
                    '| ' + ' | '.join(['---'] * len(headers)) + ' |',
                ]
                for row in data:
                    lines.append('| ' + ' | '.join(str(row.get(h, '')) for h in headers) + ' |')
                return '\n'.join(lines)
            return '（无数据）'

        # 默认JSON
        return json.dumps(data, ensure_ascii=False, indent=2)