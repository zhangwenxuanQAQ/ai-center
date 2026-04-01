"""
MCP工具转换工具类

提供MCP工具相关的转换功能
"""

import json
from typing import Dict, Any, List


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
        return {
            'type': 'function',
            'function': {
                'name': db_tool.name,
                'description': db_tool.description or '',
                'parameters': {
                    'type': 'object',
                    'properties': {},
                    'required': []
                }
            }
        }
    
    try:
        if isinstance(config_str, str):
            config = json.loads(config_str)
        else:
            config = config_str
        
        input_schema = config.get('inputSchema', {})
        
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
        return {
            'type': 'function',
            'function': {
                'name': db_tool.name,
                'description': db_tool.description or '',
                'parameters': {
                    'type': 'object',
                    'properties': {},
                    'required': []
                }
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
