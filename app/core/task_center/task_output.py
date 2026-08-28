"""
任务输出结果定义

定义 TaskOutput 基础类与各任务类型的输出结果类。
- 每个输出字段包含 name（字段名）、title（显示标题）、value（字段值）属性
- 公共字段（执行状态/错误消息/开始时间/结束时间/耗时/执行时间）定义在基础类中
- 各任务类型输出类继承基础类并扩展专属字段
- 任务执行结果统一转为输出类实例并序列化为JSON，保存到 task_output 字段

存储格式（JSON数组）：
[
    {"name": "status", "title": "执行状态", "value": "success"},
    {"name": "start_time", "title": "开始时间", "value": "2026-08-27 10:00:00"},
    ...
]
"""

import json
from typing import Any, Dict, List, Optional, Tuple

from app.constants.task_center_constants import TaskType


class TaskOutputField:
    """任务输出字段：包含name（字段名）、title（显示标题）、value（字段值）"""

    def __init__(self, name: str, title: str, value: Any = None):
        self.name = name
        self.title = title
        self.value = value

    def to_dict(self) -> dict:
        """序列化为字典"""
        return {
            'name': self.name,
            'title': self.title,
            'value': self.value,
        }

    @staticmethod
    def from_dict(data: dict) -> 'TaskOutputField':
        """从字典反序列化"""
        return TaskOutputField(
            name=data.get('name', ''),
            title=data.get('title', ''),
            value=data.get('value'),
        )


class TaskOutput:
    """任务输出基类：定义公共输出字段，各任务类型继承并扩展"""

    # 公共字段定义：(name, title)
    _COMMON_FIELDS: Tuple[Tuple[str, str], ...] = (
        ('status', '执行状态'),
        ('error', '错误消息'),
        ('start_time', '开始时间'),
        ('end_time', '结束时间'),
        ('duration', '耗时'),
        ('executed_at', '执行时间'),
    )

    # 子类扩展字段定义：(name, title)
    _EXTRA_FIELDS: Tuple[Tuple[str, str], ...] = ()

    def __init__(self, **values):
        self._fields: Dict[str, TaskOutputField] = {}
        for name, title in self._COMMON_FIELDS + self._EXTRA_FIELDS:
            self._fields[name] = TaskOutputField(name, title, values.get(name))

    @classmethod
    def field_defs(cls) -> List[Tuple[str, str]]:
        """获取全部字段定义（公共+扩展）"""
        return list(cls._COMMON_FIELDS) + list(cls._EXTRA_FIELDS)

    def set(self, name: str, value: Any) -> 'TaskOutput':
        """设置字段值"""
        field = self._fields.get(name)
        if field is not None:
            field.value = value
        return self

    def get(self, name: str) -> Any:
        """获取字段值"""
        field = self._fields.get(name)
        return field.value if field else None

    def set_common(
        self, status: str, error: Optional[str],
        start_time: str, end_time: str,
        duration, executed_at: str = '',
    ) -> 'TaskOutput':
        """批量设置公共字段值"""
        self.set('status', status)
        self.set('error', error)
        self.set('start_time', start_time)
        self.set('end_time', end_time)
        self.set('duration', duration)
        self.set('executed_at', executed_at or end_time)
        return self

    @property
    def fields(self) -> List[TaskOutputField]:
        """获取字段列表（按定义顺序）"""
        return list(self._fields.values())

    def to_list(self) -> List[dict]:
        """序列化为字典列表"""
        return [f.to_dict() for f in self._fields.values()]

    def to_json(self) -> str:
        """序列化为JSON字符串"""
        return json.dumps(self.to_list(), ensure_ascii=False, default=str)

    @classmethod
    def from_json(cls, json_str: Optional[str]) -> Optional[List[dict]]:
        """从JSON字符串解析为字段字典列表"""
        if not json_str:
            return None
        try:
            data = json.loads(json_str) if isinstance(json_str, str) else json_str
            if isinstance(data, list):
                return data
            return None
        except (ValueError, TypeError):
            return None


class ApiTaskOutput(TaskOutput):
    """接口调用任务输出：多参数模式保存汇总信息"""

    _EXTRA_FIELDS: Tuple[Tuple[str, str], ...] = (
        ('param_mode', '参数模式'),
        ('param_count', '参数组数'),
        ('success_count', '成功组数'),
        ('fail_count', '失败组数'),
        ('result_file', '结果文件'),
        ('file_format', '文件格式'),
        ('expire_at', '链接过期时间'),
    )


class DataExtractTaskOutput(TaskOutput):
    """数据抽取任务输出"""

    _EXTRA_FIELDS: Tuple[Tuple[str, str], ...] = (
        ('export_format', '文件格式'),
        ('row_count', '数据行数'),
        ('result_file', '结果文件'),
        ('expire_at', '链接过期时间'),
    )


class DocChunkTaskOutput(TaskOutput):
    """文档切片任务输出"""

    _EXTRA_FIELDS: Tuple[Tuple[str, str], ...] = (
        ('kb_name', '知识库'),
        ('document', '文档名称'),
        ('chunk_method', '切片方法'),
        ('chunk_count', '切片数量'),
    )


# 任务类型 -> 输出类映射
TASK_OUTPUT_CLASSES: Dict[str, type] = {
    TaskType.API: ApiTaskOutput,
    TaskType.DATA_EXTRACT: DataExtractTaskOutput,
    TaskType.DOC_CHUNK: DocChunkTaskOutput,
}


def create_task_output(task_type: str, **values) -> TaskOutput:
    """根据任务类型创建对应的输出类实例"""
    output_cls = TASK_OUTPUT_CLASSES.get(task_type, TaskOutput)
    return output_cls(**values)


def format_duration_ms(duration_ms) -> str:
    """格式化耗时（毫秒 -> 可读文本）"""
    if not duration_ms:
        return '0秒'
    seconds = duration_ms / 1000
    if seconds < 60:
        return f"{seconds:.2f}秒"
    minutes = int(seconds // 60)
    remain = seconds % 60
    return f"{minutes}分{remain:.1f}秒"
