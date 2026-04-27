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
        sub_configs: Dict[str, List['ChunkConfigField']] = None,
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
        self.sub_configs = sub_configs

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
        if self.sub_configs:
            result["sub_configs"] = {
                k: [f.to_dict() for f in v] for k, v in self.sub_configs.items()
            }
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
        default="\\n",
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
        sub_configs={
            "DeepDOC": [
                ChunkConfigField(
                    key="need_image",
                    label="是否提取图片",
                    field_type="switch",
                    default=True,
                    description="是否从PDF中提取图片",
                ),
                ChunkConfigField(
                    key="return_html",
                    label="表格返回HTML格式",
                    field_type="switch",
                    default=True,
                    description="表格是否返回HTML格式",
                ),
            ]
        }
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
        default="\\n",
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
        default="\\n",
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
        default="\\n",
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


class SourceConfigField:
    """
    数据来源配置字段定义
    用于描述数据来源配置的一个字段
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
    ):
        self.key = key
        self.label = label
        self.field_type = field_type
        self.default = default
        self.description = description
        self.required = required
        self.options = options

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
        return result


class SourceConfigDefinition:
    """
    数据来源配置参数定义，根据数据来源类型展示不同的配置项
    如果数据来源是本地文档，配置项为空对象。
    如果数据来源是数据源则为json对象，字段如下：
        - datasource_id: 数据源ID
        如果是关系型数据库：
            - table_name: 表名
            - column_names: 所选字段列表
            - where_clause: WHERE条件
        如果是文件系统（根据具体类型可能不同，一般如下）：
            - bucket_name: 存储桶名
            - location: 文件路径
    如果是自定义模板，暂时为空对象
    """
    
    # 本地文档配置字段（空）
    LOCAL_DOCUMENT_CONFIG: List[SourceConfigField] = []
    
    # 数据源 - 关系型数据库配置字段
    RELATIONAL_DATABASE_CONFIG: List[SourceConfigField] = [
        SourceConfigField(
            key="datasource_id",
            label="数据源ID",
            field_type="input",
            description="数据源ID",
            required=True,
        ),
        SourceConfigField(
            key="table_name",
            label="表名",
            field_type="input",
            description="要查询的表名",
            required=True,
        ),
        SourceConfigField(
            key="column_names",
            label="字段列表",
            field_type="input",
            description="要查询的字段列表，多个字段用逗号分隔",
            required=False,
        ),
        SourceConfigField(
            key="where_clause",
            label="WHERE条件",
            field_type="input",
            description="查询条件，例如：id > 100",
            required=False,
        ),
    ]
    
    # 数据源 - 文件系统配置字段
    FILE_STORAGE_CONFIG: List[SourceConfigField] = [
        SourceConfigField(
            key="datasource_id",
            label="数据源ID",
            field_type="input",
            description="数据源ID",
            required=True,
        ),
        SourceConfigField(
            key="bucket_name",
            label="存储桶名",
            field_type="input",
            description="存储桶名称",
            required=True,
        ),
        SourceConfigField(
            key="location",
            label="文件路径",
            field_type="input",
            description="文件在存储桶中的路径",
            required=True,
        ),
    ]
    
    # 自定义模板配置字段（空）
    CUSTOM_TEMPLATE_CONFIG: List[SourceConfigField] = []
    
    # 根据数据源类型获取配置字段
    @classmethod
    def get_config_fields(cls, source_type: str, datasource_type: str = None) -> List[SourceConfigField]:
        """
        根据数据来源类型获取配置字段
        
        Args:
            source_type: 数据来源类型（local_document, datasource, custom_template）
            datasource_type: 数据源类型（mysql, postgresql, oracle, s3, minio, rustfs等）
            
        Returns:
            List[SourceConfigField]: 配置字段列表
        """
        if source_type == SourceType.LOCAL_DOCUMENT:
            return cls.LOCAL_DOCUMENT_CONFIG
        elif source_type == SourceType.DATASOURCE:
            # 根据数据源类型返回不同的配置字段
            if datasource_type in ['mysql', 'postgresql', 'oracle', 'sql_server']:
                return cls.RELATIONAL_DATABASE_CONFIG
            elif datasource_type in ['s3', 'minio', 'rustfs']:
                return cls.FILE_STORAGE_CONFIG
            else:
                return []
        elif source_type == SourceType.CUSTOM_TEMPLATE:
            return cls.CUSTOM_TEMPLATE_CONFIG
        else:
            return []
