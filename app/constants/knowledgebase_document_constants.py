"""
知识库文档常量
"""

from typing import Dict, List, Any


class FileType:
    """文件类型枚举"""
    PDF = 'pdf'
    DOC = 'doc'
    VISUAL = 'visual'
    AURAL = 'aural'
    VIRTUAL = 'virtual'
    FOLDER = 'folder'
    OTHER = "other"


class SourceType:
    """文件来源类型枚举"""
    LOCAL_DOCUMENT = 'local_document'
    DATASOURCE = 'datasource'
    CUSTOM_TEMPLATE = 'custom_template'


SOURCE_TYPE_LABELS: Dict[str, str] = {
    SourceType.LOCAL_DOCUMENT: '本地文档',
    SourceType.DATASOURCE: '数据源',
    SourceType.CUSTOM_TEMPLATE: '自定义模板',
}


class ChunkMethod:
    """切片方法枚举"""
    NAIVE = "naive"
    QA = "qa"
    RESUME = "resume"
    MANUAL = "manual"
    TABLE = "table"
    PAPER = "paper"
    BOOK = "book"
    LAWS = "laws"
    PRESENTATION = "presentation"
    PICTURE = "picture"
    ONE = "one"
    AUDIO = "audio"
    EMAIL = "email"


CHUNK_METHOD_LABELS: Dict[str, str] = {
    ChunkMethod.NAIVE: "General", # 通用
    ChunkMethod.QA: "QA", # 问答对
    ChunkMethod.RESUME: "Resume", # 简历
    ChunkMethod.MANUAL: "Manual", # 手册
    ChunkMethod.TABLE: "Table", # 表格
    ChunkMethod.PAPER: "Paper", # 论文
    ChunkMethod.BOOK: "Book", # 书籍
    ChunkMethod.LAWS: "Laws", # 法律法规
    ChunkMethod.PRESENTATION: "Presentation", # 演示文稿
    ChunkMethod.PICTURE: "Picture", # 图片/视频
    ChunkMethod.ONE: "One", # 整体
    ChunkMethod.AUDIO: "Audio", # 音频
    ChunkMethod.EMAIL: "Email", # 邮件
}


class ChunkConfigField:
    """
    切片配置字段定义
    用于描述切片方法的一个配置项
    """
    def __init__(
        self,
        key: str,
        label: str,
        field_type: str = "input",
        default: Any = None,
        description: str = "",
        required: bool = False,
        options: List[Dict[str, str]] = None,
        min_value: float = None,
        max_value: float = None,
        step: float = None,
    ):
        self.key = key
        self.label = label
        self.field_type = field_type
        self.default = default
        self.description = description
        self.required = required
        self.options = options
        self.min_value = min_value
        self.max_value = max_value
        self.step = step

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "key": self.key,
            "label": self.label,
            "field_type": self.field_type,
            "default": self.default,
            "description": self.description,
            "required": self.required,
        }
        if self.options:
            result["options"] = self.options
        if self.min_value is not None:
            result["min_value"] = self.min_value
        if self.max_value is not None:
            result["max_value"] = self.max_value
        if self.step is not None:
            result["step"] = self.step
        return result


NAIVE_CHUNK_CONFIG: List[ChunkConfigField] = [
    ChunkConfigField(
        key="chunk_token_num",
        label="分块Token数",
        field_type="slider",
        default=512,
        description="每个分块的最大Token数量",
        min_value=1,
        max_value=2048,
        step=1,
    ),
    ChunkConfigField(
        key="delimiter",
        label="分隔符",
        field_type="input",
        default="\\n!?。；！？",
        description="文本分块的分隔符集合",
    ),
    ChunkConfigField(
        key="layout_recognize",
        label="PDF布局识别",
        field_type="select",
        default="DeepDOC",
        description="PDF识别模式",
        options=[
            {"label": "DeepDOC", "value": "DeepDOC"},
            {"label": "纯文本", "value": "Plain Text"},
        ],
    ),
    ChunkConfigField(
        key="task_page_size",
        label="页面大小",
        field_type="number",
        default=12,
        description="PDF解析每页大小",
        min_value=1,
        max_value=100,
    ),
    ChunkConfigField(
        key="overlapped_percent",
        label="重叠百分比",
        field_type="slider",
        default=0.0,
        description="相邻分块之间的重叠比例",
        min_value=0.0,
        max_value=1.0,
        step=0.01,
    ),
]

QA_CHUNK_CONFIG: List[ChunkConfigField] = [
    ChunkConfigField(
        key="chunk_token_num",
        label="分块Token数",
        field_type="slider",
        default=512,
        description="每个分块的最大Token数量",
        min_value=1,
        max_value=2048,
        step=1,
    ),
    ChunkConfigField(
        key="delimiter",
        label="分隔符",
        field_type="input",
        default="\\n",
        description="文本分块的分隔符",
    ),
]

RESUME_CHUNK_CONFIG: List[ChunkConfigField] = []

MANUAL_CHUNK_CONFIG: List[ChunkConfigField] = [
    ChunkConfigField(
        key="chunk_token_num",
        label="分块Token数",
        field_type="slider",
        default=512,
        description="每个分块的最大Token数量",
        min_value=1,
        max_value=2048,
        step=1,
    ),
    ChunkConfigField(
        key="delimiter",
        label="分隔符",
        field_type="input",
        default="\\n!?。；！？",
        description="文本分块的分隔符集合",
    ),
    ChunkConfigField(
        key="layout_recognize",
        label="布局识别",
        field_type="select",
        default="DeepDOC",
        description="PDF布局识别模式",
        options=[
            {"label": "DeepDOC", "value": "DeepDOC"},
            {"label": "纯文本", "value": "Plain Text"},
        ],
    ),
]

TABLE_CHUNK_CONFIG: List[ChunkConfigField] = [
    ChunkConfigField(
        key="chunk_token_num",
        label="分块Token数",
        field_type="slider",
        default=512,
        description="每个分块的最大Token数量",
        min_value=1,
        max_value=2048,
        step=1,
    ),
]

PAPER_CHUNK_CONFIG: List[ChunkConfigField] = [
    ChunkConfigField(
        key="chunk_token_num",
        label="分块Token数",
        field_type="slider",
        default=512,
        description="每个分块的最大Token数量",
        min_value=1,
        max_value=2048,
        step=1,
    ),
    ChunkConfigField(
        key="layout_recognize",
        label="布局识别",
        field_type="select",
        default="DeepDOC",
        description="PDF布局识别模式",
        options=[
            {"label": "DeepDOC", "value": "DeepDOC"},
            {"label": "纯文本", "value": "Plain Text"},
        ],
    ),
]

BOOK_CHUNK_CONFIG: List[ChunkConfigField] = [
    ChunkConfigField(
        key="chunk_token_num",
        label="分块Token数",
        field_type="slider",
        default=512,
        description="每个分块的最大Token数量",
        min_value=1,
        max_value=2048,
        step=1,
    ),
    ChunkConfigField(
        key="delimiter",
        label="分隔符",
        field_type="input",
        default="\\n!?。；！？",
        description="文本分块的分隔符集合",
    ),
    ChunkConfigField(
        key="layout_recognize",
        label="布局识别",
        field_type="select",
        default="DeepDOC",
        description="PDF布局识别模式",
        options=[
            {"label": "DeepDOC", "value": "DeepDOC"},
            {"label": "纯文本", "value": "Plain Text"},
        ],
    ),
]

LAWS_CHUNK_CONFIG: List[ChunkConfigField] = [
    ChunkConfigField(
        key="chunk_token_num",
        label="分块Token数",
        field_type="slider",
        default=512,
        description="每个分块的最大Token数量",
        min_value=1,
        max_value=2048,
        step=1,
    ),
    ChunkConfigField(
        key="delimiter",
        label="分隔符",
        field_type="input",
        default="\\n!?。；！？",
        description="文本分块的分隔符集合",
    ),
]

PRESENTATION_CHUNK_CONFIG: List[ChunkConfigField] = []

PICTURE_CHUNK_CONFIG: List[ChunkConfigField] = []

ONE_CHUNK_CONFIG: List[ChunkConfigField] = []

AUDIO_CHUNK_CONFIG: List[ChunkConfigField] = []

EMAIL_CHUNK_CONFIG: List[ChunkConfigField] = []


CHUNK_METHOD_CONFIGS: Dict[str, List[ChunkConfigField]] = {
    ChunkMethod.NAIVE: NAIVE_CHUNK_CONFIG,
    ChunkMethod.QA: QA_CHUNK_CONFIG,
    ChunkMethod.RESUME: RESUME_CHUNK_CONFIG,
    ChunkMethod.MANUAL: MANUAL_CHUNK_CONFIG,
    ChunkMethod.TABLE: TABLE_CHUNK_CONFIG,
    ChunkMethod.PAPER: PAPER_CHUNK_CONFIG,
    ChunkMethod.BOOK: BOOK_CHUNK_CONFIG,
    ChunkMethod.LAWS: LAWS_CHUNK_CONFIG,
    ChunkMethod.PRESENTATION: PRESENTATION_CHUNK_CONFIG,
    ChunkMethod.PICTURE: PICTURE_CHUNK_CONFIG,
    ChunkMethod.ONE: ONE_CHUNK_CONFIG,
    ChunkMethod.AUDIO: AUDIO_CHUNK_CONFIG,
    ChunkMethod.EMAIL: EMAIL_CHUNK_CONFIG,
}


class RunningStatus:
    """文档运行状态枚举"""
    PENDING = "pending" # 未开始
    RUNNING = "running" # 运行中
    CANCEL = "cancel" # 已取消
    DONE = "done" # 已完成
    FAIL = "fail" # 失败
    SCHEDULE = "schedule" # 定时调度