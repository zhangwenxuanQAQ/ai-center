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


ONTOLOGY_EXPORT_FORMAT_LABELS = {
    OntologyExportFormat.JSON: "JSON",
    OntologyExportFormat.EXCEL: "Excel",
    OntologyExportFormat.MARKDOWN: "Markdown",
}

ONTOLOGY_EXPORT_FORMAT_SAMPLES = {
    OntologyExportFormat.JSON: '[\n  {"id": 1, "name": "示例数据", "age": 25},\n  {"id": 2, "name": "示例数据2", "age": 30}\n]',
    OntologyExportFormat.EXCEL: "Excel表格格式，每行一条记录，列名为字段名",
    OntologyExportFormat.MARKDOWN: "| id | name | age |\n|----|------|-----|\n| 1  | 示例数据 | 25  |\n| 2  | 示例数据2 | 30  |",
}

# Redis键前缀
ONTOLOGY_TASK_STREAM_PREFIX = "ontology:task:stream:"
ONTOLOGY_TASK_STATUS_PREFIX = "ontology:task:status:"
ONTOLOGY_TASK_RESULT_PREFIX = "ontology:task:result:"

# Redis过期时间（24小时）
ONTOLOGY_TASK_REDIS_EXPIRE = 86400