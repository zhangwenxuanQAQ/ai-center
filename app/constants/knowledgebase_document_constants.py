"""
知识库文档常量
"""

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
    LOCAL_DOCUMENT = 'local_document' # 本地文档
    DATASOURCE = 'datasource' # 数据源
    CUSTOM_TEMPLATE = 'custom_template' # 自定义模板


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


class RunningStatus:
    """文档运行状态枚举"""
    PENDING = "pending" # 未开始
    RUNNING = "running" # 运行中
    CANCEL = "cancel" # 已取消
    DONE = "done" # 已完成
    FAIL = "fail" # 失败
    SCHEDULE = "schedule" # 定时调度