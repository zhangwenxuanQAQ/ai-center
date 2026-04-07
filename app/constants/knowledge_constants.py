"""
知识库常量
"""

# 文档解析类型
DOCUMENT_PARSE_TYPE = {
    "Naive": "naive",
    "Qa": "qa",
    "Resume": "resume",
    "Manual": "manual",
    "Table": "table",
    "Paper": "paper",
    "Book": "book",
    "Laws": "laws",
    "Presentation": "presentation",
    "Picture": "picture",
    "One": "one",
    "Audio": "audio",
    "Email": "email",
}

# 文档解析状态
DOCUMENT_RUNNING_STATUS = {
    "pending": "未开始",
    "running": "运行中",
    "cancel": "已取消",
    "done": "已完成",
    "fail": "失败",
    "schedule": "定时调度",
}