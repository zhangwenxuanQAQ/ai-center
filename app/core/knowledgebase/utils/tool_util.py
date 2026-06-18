"""
知识库-大模型工具类

提供知识库接入模型的工具类（包括转换为openai tool格式，知识库检索等功能）
"""

import json
from typing import Dict, Any, List

from app.database.models import Knowledgebase


def convert_kb_to_openai_tool(kb: Knowledgebase) -> Dict[str, Any]:
    """
    将知识库对象转换为OpenAI tool格式

    Args:
        kb: Knowledgebase数据库对象

    Returns:
        Dict[str, Any]: OpenAI tool格式的工具定义
    """
    kb_id = str(kb.id)
    kb_name = kb.name
    kb_description = kb.description or f'知识库: {kb_name}'

    tool = {
        'type': 'function',
        'function': {
            'name': kb_name,
            'description': kb_description,
            'parameters': {
                'type': 'object',
                'properties': {
                    'action': {
                        'type': 'string',
                        'enum': ['knowledgebase_search'],
                        'description': '操作类型，必须为 knowledgebase_search , 表示知识库检索'
                    },
                    'task_name': {
                        'type': 'string',
                        'description': '给本次操作起一个简短的任务名称，例如"查询xxx今天的天气"'
                    },
                    'kb_id': {
                        'type': 'string',
                        'enum': [kb_id],
                        'description': '知识库id'
                    },
                    'query': {
                        'type': 'string',
                        'description': '搜索内容'
                    },
                    'reasoning_content': {
                        'type': 'string',
                        'description': '为何选择并使用本工具，返回思考过程'
                    }
                },
                'required': ['task_name', 'kb_id', 'query']
            }
        }
    }

    return json.loads(json.dumps(tool, ensure_ascii=False))


def convert_kbs_to_openai_tools(kbs: List[Knowledgebase]) -> List[Dict[str, Any]]:
    """
    批量将知识库对象转换为OpenAI tool格式

    Args:
        kbs: Knowledgebase数据库对象列表

    Returns:
        List[Dict[str, Any]]: OpenAI tool格式的工具定义列表
    """
    openai_tools = []
    for kb in kbs:
        openai_tool = convert_kb_to_openai_tool(kb)
        openai_tools.append(openai_tool)
    return openai_tools
