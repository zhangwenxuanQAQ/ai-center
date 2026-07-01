"""
MCP工具转换工具类

提供MCP工具相关的转换功能
"""

import json
from typing import Dict, Any, List


def _add_action_to_parameters(parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    向工具参数中添加action和task_name字段，标识为mcp_tool类型

    Args:
        parameters: 原始参数schema

    Returns:
        Dict[str, Any]: 添加了action和task_name字段的参数schema
    """
    if not parameters:
        parameters = {
            'type': 'object',
            'properties': {},
            'required': []
        }

    if 'properties' not in parameters:
        parameters['properties'] = {}

    parameters['properties']['action'] = {
        'type': 'string',
        'enum': ['mcp_tool'],
        'description': '操作类型，必须为 mcp_tool , 表示MCP工具调用'
    }

    parameters['properties']['task_name'] = {
        'type': 'string',
        'description': '给本次操作起一个简短的任务名称，例如"查询xxx今天的天气"'
    }

    parameters['properties']['reasoning_content'] = {
        'type': 'string',
        'description': '为何选择并使用本工具，返回思考过程'
    }

    if 'required' not in parameters:
        parameters['required'] = []
    if 'action' not in parameters.get('required', []):
        parameters['required'].append('action')
    if 'task_name' not in parameters.get('required', []):
        parameters['required'].append('task_name')

    return parameters


def convert_mcp_tool_to_openai_tool(mcp_tool_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    将MCP工具配置转换为OpenAI tool格式

    Args:
        mcp_tool_config: MCP工具配置，包含name、description、inputSchema等字段

    Returns:
        Dict[str, Any]: OpenAI tool格式的工具定义
    """
    tool_name = mcp_tool_config.get('name', '')
    tool_description = mcp_tool_config.get('description', '')
    input_schema = mcp_tool_config.get('inputSchema', {})

    input_schema = _add_action_to_parameters(input_schema)

    func = {
        'type': 'function',
        'function': {
            'name': tool_name,
            'description': tool_description,
            'parameters': input_schema
        }
    }

    res = json.loads(json.dumps(func, ensure_ascii=False))
    return res


def convert_mcp_tools_to_openai_tools(mcp_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    批量将MCP工具配置转换为OpenAI tool格式

    Args:
        mcp_tools: MCP工具配置列表

    Returns:
        List[Dict[str, Any]]: OpenAI tool格式的工具定义列表
    """
    openai_tools = []
    for mcp_tool in mcp_tools:
        openai_tool = convert_mcp_tool_to_openai_tool(mcp_tool)
        openai_tools.append(openai_tool)
    return openai_tools


def convert_db_tool_to_openai_tool(db_tool) -> Dict[str, Any]:
    """
    将数据库中的MCP工具对象转换为OpenAI tool格式

    Args:
        db_tool: MCPTool数据库对象

    Returns:
        Dict[str, Any]: OpenAI tool格式的工具定义
    """
    config_str = db_tool.config
    if not config_str:
        parameters = _add_action_to_parameters({
            'type': 'object',
            'properties': {},
            'required': []
        })
        return {
            'type': 'function',
            'function': {
                'name': db_tool.name,
                'description': db_tool.description or '',
                'parameters': parameters
            }
        }

    try:
        if isinstance(config_str, str):
            config = json.loads(config_str)
        else:
            config = config_str

        input_schema = config.get('inputSchema', {})
        input_schema = _add_action_to_parameters(input_schema)

        func = {
            'type': 'function',
            'function': {
                'name': db_tool.name,
                'description': db_tool.description or '',
                'parameters': input_schema
            }
        }

        res = json.loads(json.dumps(func, ensure_ascii=False))
        return res

    except json.JSONDecodeError:
        parameters = _add_action_to_parameters({
            'type': 'object',
            'properties': {},
            'required': []
        })
        return {
            'type': 'function',
            'function': {
                'name': db_tool.name,
                'description': db_tool.description or '',
                'parameters': parameters
            }
        }


def convert_db_tools_to_openai_tools(db_tools: List) -> List[Dict[str, Any]]:
    """
    批量将数据库中的MCP工具对象转换为OpenAI tool格式

    Args:
        db_tools: MCPTool数据库对象列表

    Returns:
        List[Dict[str, Any]]: OpenAI tool格式的工具定义列表
    """
    openai_tools = []
    for db_tool in db_tools:
        openai_tool = convert_db_tool_to_openai_tool(db_tool)
        openai_tools.append(openai_tool)
    return openai_tools
