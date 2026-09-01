"""
任务中心常量定义
定义任务类型、任务状态、各任务类型所需配置字段及来源类型
"""


class TaskStatus:
    """任务状态"""
    PENDING = "pending"      # 未开始
    RUNNING = "running"      # 运行中
    CANCEL = "cancel"        # 已取消
    DONE = "done"            # 已完成
    FAIL = "fail"            # 失败


TASK_STATUS_LABELS = {
    TaskStatus.PENDING: "未开始",
    TaskStatus.RUNNING: "运行中",
    TaskStatus.CANCEL: "已取消",
    TaskStatus.DONE: "已完成",
    TaskStatus.FAIL: "失败",
}


class TaskType:
    """任务类型"""
    DATA_EXTRACT = "data_extract"  # 数据抽取
    API = "api"                    # 接口调用
    DOC_CHUNK = "doc_chunk"        # 文档切片


TASK_TYPE_NAME = {
    TaskType.DATA_EXTRACT: "数据抽取",
    TaskType.API: "接口调用",
    TaskType.DOC_CHUNK: "文档切片",
}

# 任务类型对应颜色（前端展示用）
TASK_TYPE_COLOR = {
    TaskType.DATA_EXTRACT: "blue",
    TaskType.API: "geekblue",
    TaskType.DOC_CHUNK: "green",
}

# 各任务类型所需配置字段定义（供前端动态渲染新增/编辑表单）
# type: string(输入框)/select(下拉)/text(多行文本)/number(数字)
TASK_TYPE_CONFIG_FIELDS = {
    TaskType.DATA_EXTRACT: [
        {"key": "datasource_id", "label": "数据源ID", "type": "string", "required": True,
         "description": "数据抽取使用的数据源ID"},
        {"key": "ontology_object_id", "label": "本体对象ID", "type": "string", "required": False,
         "description": "关联的本体对象ID（与自定义SQL二选一）"},
        {"key": "custom_sql", "label": "自定义SQL", "type": "text", "required": False,
         "description": "自定义查询SQL（仅允许SELECT查询）"},
        {"key": "columns", "label": "抽取字段列表", "type": "string", "required": False,
         "description": "抽取的字段列表，逗号分隔"},
        {"key": "export_format", "label": "导出格式", "type": "select", "required": False,
         "description": "结果导出格式",
         "options": [{"value": "json", "label": "JSON"}, {"value": "excel", "label": "Excel"},
                     {"value": "csv", "label": "CSV"}]},
        {"key": "query_mode", "label": "查询方式", "type": "select", "required": False,
         "description": "全量查询一次性查出所有数据；分页查询按页查询逐页写入结果文件，适合大数据量表",
         "options": [{"value": "all", "label": "全量查询"}, {"value": "paginated", "label": "分页查询"}]},
    ],
    TaskType.API: [
        {"key": "server_id", "label": "API服务ID", "type": "string", "required": True,
         "description": "关联的API服务ID（第一步选择）"},
        {"key": "api_id", "label": "接口ID", "type": "string", "required": True,
         "description": "关联的API接口ID（第一步选择）"},
        {"key": "param_mode", "label": "参数模式", "type": "select", "required": False,
         "description": "参数配置模式：single(单参数)/multi(多参数)",
         "options": [{"value": "single", "label": "单参数"}, {"value": "multi", "label": "多参数"}]},
        {"key": "parameters", "label": "参数列表", "type": "text", "required": False,
         "description": "接口参数值列表JSON，单参数为扁平列表，多参数为列表的列表"},
        {"key": "headers", "label": "请求头", "type": "text", "required": False,
         "description": "任务级请求头JSON，覆盖服务级与接口级请求头"},
        {"key": "timeout", "label": "超时时间(秒)", "type": "number", "required": False,
         "description": "请求超时时间，默认30秒"},
        {"key": "export_format", "label": "导出格式", "type": "select", "required": False,
         "description": "结果导出格式",
         "options": [{"value": "json", "label": "JSON"}, {"value": "excel", "label": "Excel"},
                     {"value": "markdown", "label": "Markdown"}]},
        {"key": "export_contents", "label": "导出内容", "type": "string", "required": False,
         "description": "导出内容项列表（逗号分隔）：path/params/response"},
    ],
    TaskType.DOC_CHUNK: [
        {"key": "kb_id", "label": "知识库ID", "type": "string", "required": True,
         "description": "文档所属知识库ID"},
        {"key": "title", "label": "知识标题", "type": "string", "required": True,
         "description": "知识标题"},
        {"key": "chunk_method", "label": "切片方法", "type": "string", "required": True,
         "description": "文档切片方法，如 naive/manual/paper等"},
        {"key": "chunk_config", "label": "切片配置", "type": "text", "required": False,
         "description": "切片配置JSON"},
        {"key": "file_name", "label": "文件名", "type": "string", "required": False,
         "description": "文档文件名"},
        {"key": "tags", "label": "标签", "type": "string", "required": False,
         "description": "文档标签，逗号分隔"},
    ],
}


class TaskSourceType:
    """任务来源类型（任务信息与业务模块记录的关联）"""
    ONTOLOGY_TASK = "ontology_task"                 # 本体工作台数据抽取任务
    KNOWLEDGEBASE_DOCUMENT = "knowledgebase_document"  # 知识库文档（知识）


# 任务事件推送频道（SSE实时状态）
TASK_CENTER_EVENTS_CHANNEL = "task_center:task:events"

# 任务进度轮询间隔（秒）
TASK_CENTER_PROGRESS_INTERVAL = 0.5

# 接口调用任务结果Redis键前缀
API_TASK_RESULT_PREFIX = "api:task:result:"

# 接口调用任务结果Redis过期时间（24小时）
API_TASK_RESULT_REDIS_EXPIRE = 86400

# 接口调用任务导出格式文件扩展名
API_EXPORT_FORMAT_FILE_EXT = {
    'json': 'json',
    'excel': 'xlsx',
    'markdown': 'md',
}
