"""
知识库常量
"""

# 文档chunk方法
DOCUMENT_CHUNK_METHOD = {
    "naive": "Naive",
    "qa": "QA",
    "resume": "Resume",
    "manual": "Manual",
    "table": "Table",
    "paper": "Paper",
    "book": "Book",
    "laws": "Laws",
    "presentation": "Presentation",
    "picture": "Picture",
    "one": "One",
    "audio": "Audio",
    "email": "Email",
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