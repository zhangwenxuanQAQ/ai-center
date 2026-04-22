"""
LLM模型常量定义
"""

MODEL_TYPE = {
    "text": "文本模型",
    "audio": "音频模型",
    "vision": "视觉模型",
    "multimodal": "全模态模型",
    "embedding": "Embedding模型",
    "rerank": "Rerank模型",
    "tts": "语音合成模型"
}

MODEL_STATUS = {
    True: "启用",
    False: "禁用"
}

MODEL_PROVIDERS = {
    "Qwen": "通义千问",
    "DeepSeek": "深度求索",
    "Kimi": "月之暗面",
    "MiniMax": "MiniMax",
    "GLM": "智谱AI"
}

# 模型名称到提供商的映射
MODEL_NAME_TO_PROVIDER = {
    # Qwen 模型
    "qwen": "Qwen",
    "Qwen": "Qwen",
    # DeepSeek 模型
    "deepseek": "DeepSeek",
    "DeepSeek": "DeepSeek",
    # Kimi 模型
    "kimi": "Kimi",
    "Kimi": "Kimi",
    # MiniMax 模型
    "minimax": "MiniMax",
    "MiniMax": "MiniMax",
    # GLM 模型
    "glm": "GLM",
    "GLM": "GLM"
}

MODEL_CONFIG_PARAMS = {
    "text": [
        {
            "key": "temperature",
            "label": "温度 (Temperature)",
            "type": "slider",
            "min": 0,
            "max": 2,
            "step": 0.1,
            "default": 0.7,
            "description": "控制生成文本的随机性，值越大越随机"
        },
        {
            "key": "top_p",
            "label": "Top P",
            "type": "slider",
            "min": 0,
            "max": 1,
            "step": 0.01,
            "default": 0.1,
            "description": "核采样参数，控制候选词的概率累积阈值"
        },
        {
            "key": "max_tokens",
            "label": "最大Token数",
            "type": "number",
            "min": 1,
            "max": 200000,
            "default": 4096,
            "description": "生成文本的最大长度"
        },
        {
            "key": "presence_penalty",
            "label": "存在惩罚 (Presence Penalty)",
            "type": "slider",
            "min": -2,
            "max": 2,
            "step": 0.1,
            "default": 0,
            "description": "惩罚已出现的词，鼓励生成新话题"
        },
        {
            "key": "frequency_penalty",
            "label": "频率惩罚 (Frequency Penalty)",
            "type": "slider",
            "min": -2,
            "max": 2,
            "step": 0.1,
            "default": 0,
            "description": "根据词频惩罚，减少重复"
        },
    ],
    "audio": [
        {
            "key": "temperature",
            "label": "温度 (Temperature)",
            "type": "slider",
            "min": 0,
            "max": 2,
            "step": 0.1,
            "default": 0.7,
            "description": "控制生成音频的随机性"
        },
        {
            "key": "max_tokens",
            "label": "最大Token数",
            "type": "number",
            "min": 1,
            "max": 128000,
            "default": 4096,
            "description": "生成音频的最大长度"
        },
        {
            "key": "voice",
            "label": "声音类型",
            "type": "select",
            "options": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
            "default": "alloy",
            "description": "选择合成声音的类型"
        },
        {
            "key": "speed",
            "label": "语速",
            "type": "slider",
            "min": 0.25,
            "max": 4,
            "step": 0.25,
            "default": 1,
            "description": "音频播放速度"
        }
    ],
    "vision": [
        {
            "key": "temperature",
            "label": "温度 (Temperature)",
            "type": "slider",
            "min": 0,
            "max": 2,
            "step": 0.1,
            "default": 0.7,
            "description": "控制生成内容的随机性"
        },
        {
            "key": "top_p",
            "label": "Top P",
            "type": "slider",
            "min": 0,
            "max": 1,
            "step": 0.01,
            "default": 0.9,
            "description": "核采样参数"
        },
        {
            "key": "max_tokens",
            "label": "最大Token数",
            "type": "number",
            "min": 1,
            "max": 128000,
            "default": 4096,
            "description": "生成内容的最大长度"
        },
        {
            "key": "detail",
            "label": "图像细节",
            "type": "select",
            "options": ["low", "high", "auto"],
            "default": "auto",
            "description": "图像识别的细节程度"
        }
    ],
    "multimodal": [
        {
            "key": "temperature",
            "label": "温度 (Temperature)",
            "type": "slider",
            "min": 0,
            "max": 2,
            "step": 0.1,
            "default": 0.7,
            "description": "控制生成内容的随机性"
        },
        {
            "key": "top_p",
            "label": "Top P",
            "type": "slider",
            "min": 0,
            "max": 1,
            "step": 0.01,
            "default": 0.9,
            "description": "核采样参数"
        },
        {
            "key": "max_tokens",
            "label": "最大Token数",
            "type": "number",
            "min": 1,
            "max": 200000,
            "default": 4096,
            "description": "生成内容的最大长度"
        },
        {
            "key": "presence_penalty",
            "label": "存在惩罚 (Presence Penalty)",
            "type": "slider",
            "min": -2,
            "max": 2,
            "step": 0.1,
            "default": 0,
            "description": "惩罚已出现的词，鼓励生成新话题"
        },
        {
            "key": "frequency_penalty",
            "label": "频率惩罚 (Frequency Penalty)",
            "type": "slider",
            "min": -2,
            "max": 2,
            "step": 0.1,
            "default": 0,
            "description": "根据词频惩罚，减少重复"
        }
    ],
    "embedding": [
    ],
    "rerank": [
        {
            "key": "top_n",
            "label": "返回数量 (Top N)",
            "type": "number",
            "min": 1,
            "max": 100,
            "default": 10,
            "description": "返回的重排序结果数量"
        },
        {
            "key": "return_documents",
            "label": "返回文档内容",
            "type": "switch",
            "default": True,
            "description": "是否返回文档的完整内容"
        },
        {
            "key": "max_chunks_per_doc",
            "label": "每文档最大分块数",
            "type": "number",
            "min": 1,
            "max": 100,
            "default": 10,
            "description": "每个文档的最大分块数量"
        }
    ],
    "tts": [
        {
            "key": "temperature",
            "label": "温度 (Temperature)",
            "type": "slider",
            "min": 0,
            "max": 2,
            "step": 0.1,
            "default": 0.7,
            "description": "控制生成音频的随机性"
        },
        {
            "key": "voice",
            "label": "声音类型",
            "type": "select",
            "options": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
            "default": "alloy",
            "description": "选择合成声音的类型"
        },
        {
            "key": "speed",
            "label": "语速",
            "type": "slider",
            "min": 0.25,
            "max": 4,
            "step": 0.25,
            "default": 1,
            "description": "音频播放速度"
        },
        {
            "key": "response_format",
            "label": "响应格式",
            "type": "select",
            "options": ["mp3", "opus", "aac", "flac"],
            "default": "mp3",
            "description": "音频输出格式"
        },
        {
            "key": "model",
            "label": "TTS模型",
            "type": "select",
            "options": ["tts-1", "tts-1-hd"],
            "default": "tts-1",
            "description": "选择TTS模型"
        }
    ]
}
