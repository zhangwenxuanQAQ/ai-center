"""
提示词常量
"""

# 参数引用模板，提示词中有如下格式的字符串表示参数引用，必须为类型+@ + 参数的格式
PARAMETER_TEMPLATE = {
    "prompt": "{{prompt@prompt_id}}", # 提示词引用
    "knowledgebase": "{{knowledgebase@knowledgebase_id}}", # 知识库引用
    "text": "{{text}}", # 文本引用
}