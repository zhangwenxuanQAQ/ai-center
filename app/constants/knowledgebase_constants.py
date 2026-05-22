"""
知识库常量
"""

FILE_NAME_LEN_LIMIT = 255

RETRIEVAL_CONFIGS = [
    {
        "key": "vector_similarity",
        "label": "文本相似度阈值",
        "type": "slider",
        "min": 0,
        "max": 1,
        "step": 0.01,
        "default": 0.2,
        "description": "向量检索时的文本相似度阈值，低于此值的结果将被过滤",
    },
    {
        "key": "keyword_similarity",
        "label": "关键词相似度阈值",
        "type": "slider",
        "min": 0,
        "max": 1,
        "step": 0.01,
        "default": 0.3,
        "description": "关键词匹配时的相似度阈值，低于此值的结果将被过滤",
    },
    {
        "key": "vector_similarity_weight",
        "label": "向量相似度权重",
        "type": "slider",
        "min": 0,
        "max": 1,
        "step": 0.01,
        "default": 0.7,
        "description": "混合相似度计算中向量相似度的权重，关键词相似度权重=1-此值",
    },
    {
        "key": "top_k",
        "label": "TopK",
        "type": "slider",
        "min": 1,
        "max": 20,
        "step": 1,
        "default": 5,
        "description": "从ES中召回的候选结果数量，用于后续重排序",
    },
    {
        "key": "sort_by",
        "label": "排序方式",
        "type": "select",
        "options": [
            {"value": "sim", "label": "混合相似度"},
            {"value": "vsim", "label": "向量相似度"},
            {"value": "tsim", "label": "关键词相似度"},
        ],
        "default": "sim",
        "description": "检索结果的排序方式，支持混合/向量/关键词相似度",
    },
]
