"""
任务中心共享工具方法
"""

import json

from app.constants.task_center_constants import TASK_STATUS_LABELS, TASK_TYPE_NAME


def task_info_to_dict(task) -> dict:
    """将任务信息模型转为字典"""
    return {
        'id': task.id,
        'name': task.name,
        'description': getattr(task, 'description', '') or '',
        'task_status': task.task_status,
        'task_status_label': TASK_STATUS_LABELS.get(task.task_status, task.task_status),
        'task_type': task.task_type,
        'task_type_name': TASK_TYPE_NAME.get(task.task_type, task.task_type),
        'task_configs': json.loads(task.task_configs) if task.task_configs else {},
        'task_progress': task.task_progress or 0,
        'task_progress_message': task.task_progress_message or '',
        'task_begin_at': task.task_begin_at.strftime('%Y-%m-%d %H:%M:%S') if task.task_begin_at else '',
        'task_end_at': task.task_end_at.strftime('%Y-%m-%d %H:%M:%S') if task.task_end_at else '',
        'task_duration': task.task_duration or 0,
        'source_type': getattr(task, 'source_type', '') or '',
        'source_id': getattr(task, 'source_id', '') or '',
        'created_at': task.created_at.strftime('%Y-%m-%d %H:%M:%S') if task.created_at else '',
        'updated_at': task.updated_at.strftime('%Y-%m-%d %H:%M:%S') if task.updated_at else '',
    }


def task_log_to_dict(log) -> dict:
    """将任务日志模型转为字典"""
    result = task_info_to_dict(log)
    result['task_id'] = log.task_id
    result.pop('source_type', None)
    result.pop('source_id', None)
    result.pop('description', None)
    return result
