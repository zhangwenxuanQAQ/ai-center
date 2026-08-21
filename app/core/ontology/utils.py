"""
本体工作台共享工具方法
"""

import json
from app.constants.ontology_constants import ONTOLOGY_TASK_STATUS_LABELS


def ontology_object_to_dict(obj) -> dict:
    """将本体对象模型转为字典"""
    return {
        'id': obj.id,
        'datasource_id': obj.datasource_id,
        'name': obj.name,
        'title': obj.title or '',
        'description': obj.description or '',
        'content': json.loads(obj.content) if obj.content else {},
        'created_at': obj.created_at.strftime('%Y-%m-%d %H:%M:%S') if obj.created_at else '',
        'updated_at': obj.updated_at.strftime('%Y-%m-%d %H:%M:%S') if obj.updated_at else '',
    }


def task_to_dict(task) -> dict:
    """将任务模型转为字典"""
    return {
        'id': task.id,
        'name': task.name,
        'datasource_id': task.datasource_id,
        'configs': json.loads(task.configs) if task.configs else {},
        'status': task.status,
        'status_label': ONTOLOGY_TASK_STATUS_LABELS.get(task.status, task.status),
        'task_progress': task.task_progress or 0,
        'task_progress_message': task.task_progress_message or '',
        'task_begin_at': task.task_begin_at.strftime('%Y-%m-%d %H:%M:%S') if task.task_begin_at else '',
        'task_end_at': task.task_end_at.strftime('%Y-%m-%d %H:%M:%S') if task.task_end_at else '',
        'task_duration': task.task_duration or 0,
        'created_at': task.created_at.strftime('%Y-%m-%d %H:%M:%S') if task.created_at else '',
        'updated_at': task.updated_at.strftime('%Y-%m-%d %H:%M:%S') if task.updated_at else '',
    }