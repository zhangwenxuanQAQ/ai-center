"""
本体工作台常量定义
"""


class OntologyTaskStatus:
    """数据抽取任务状态（参考知识库文档 RunningStatus）"""
    PENDING = "pending"      # 未开始
    WAITING = "waiting"      # 等待执行
    RUNNING = "running"       # 运行中
    CANCEL = "cancel"         # 已取消
    DONE = "done"             # 已完成
    FAIL = "fail"             # 失败
    SCHEDULE = "schedule"     # 定时调度


ONTOLOGY_TASK_STATUS_LABELS = {
    OntologyTaskStatus.PENDING: "未开始",
    OntologyTaskStatus.WAITING: "等待执行",
    OntologyTaskStatus.RUNNING: "运行中",
    OntologyTaskStatus.CANCEL: "已取消",
    OntologyTaskStatus.DONE: "已完成",
    OntologyTaskStatus.FAIL: "失败",
    OntologyTaskStatus.SCHEDULE: "定时调度",
}


class OntologyExportFormat:
    """数据导出格式"""
    JSON = "json"
    EXCEL = "excel"
    MARKDOWN = "markdown"


class OntologyQueryMode:
    """查询方式"""
    ALL = "all"            # 全量查询（一次性查出所有数据）
    PAGINATED = "paginated"  # 分页查询（按页查询，逐页写入结果文件）


ONTOLOGY_QUERY_MODE_LABELS = {
    OntologyQueryMode.ALL: "全量查询",
    OntologyQueryMode.PAGINATED: "分页查询",
}

# 分页查询默认每页行数
ONTOLOGY_PAGINATION_DEFAULT_PAGE_SIZE = 10000


ONTOLOGY_EXPORT_FORMAT_LABELS = {
    OntologyExportFormat.JSON: "JSON",
    OntologyExportFormat.EXCEL: "Excel",
    OntologyExportFormat.MARKDOWN: "Markdown",
}

ONTOLOGY_EXPORT_FORMAT_FILE_EXT = {
    OntologyExportFormat.JSON: 'json',
    OntologyExportFormat.EXCEL: 'xlsx',
    OntologyExportFormat.MARKDOWN: 'md',
}

ONTOLOGY_EXPORT_FORMAT_SAMPLES = {
    OntologyExportFormat.JSON: '[\n  {"id": 1, "name": "示例数据", "age": 25},\n  {"id": 2, "name": "示例数据2", "age": 30}\n]',
    OntologyExportFormat.EXCEL: "Excel表格格式（.xlsx），第一行为字段名表头，后续每行为对应数据",
    OntologyExportFormat.MARKDOWN: "| id | name | age |\n|----|------|-----|\n| 1  | 示例数据 | 25  |\n| 2  | 示例数据2 | 30  |",
}

# Redis键前缀
ONTOLOGY_TASK_STREAM_PREFIX = "ontology:task:stream:"
ONTOLOGY_TASK_STATUS_PREFIX = "ontology:task:status:"
ONTOLOGY_TASK_RESULT_PREFIX = "ontology:task:result:"

# 任务事件推送频道（SSE实时状态）
ONTOLOGY_TASK_EVENTS_CHANNEL = "ontology:task:events"

# 任务执行队列（Redis List，先进先出）
ONTOLOGY_TASK_QUEUE_KEY = "ontology:task:queue"

# 任务并发上限（同时最多执行的任务数，超出排队等待）
ONTOLOGY_TASK_MAX_CONCURRENT = 5

# 队列调度器轮询间隔（秒）
ONTOLOGY_TASK_QUEUE_POLL_INTERVAL = 1

# Redis过期时间（24小时）
ONTOLOGY_TASK_REDIS_EXPIRE = 86400