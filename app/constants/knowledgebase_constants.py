"""
知识库常量
"""

FILE_NAME_LEN_LIMIT = 255

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

DOCUMENT_RUNNING_STATUS = {
    "pending": "未开始",
    "running": "运行中",
    "cancel": "已取消",
    "done": "已完成",
    "fail": "失败",
    "schedule": "定时调度",
}

RETRIEVAL_CONFIGS = [{
            "key": "vector_similarity",
            "label": "文本相似度阈值",
            "type": "slider",
            "min": 0,
            "max": 1,
            "step": 0.01,
            "default": 0.2,
        },
        {
            "key": "keyword_similarity",
            "label": "关键词相似度阈值",
            "type": "slider",
            "min": 0,
            "max": 1,
            "step": 0.01,
            "default": 0.3,
        },
        {
            "key": "top_k",
            "label": "召回数量",
            "type": "slider",
            "min": 1,
            "max": 20,
            "step": 1,
            "default":5,
        },
         {
            "key": "sort_by",
            "label": "排序方式",
            "type": "select",
            "options": [{"value":"sim","label": "混合相似度"},{"value":"vsim","label": "向量相似度"},{"value":"tsim","label": "关键词相似度"}],
            "default": "sim",
        }]
