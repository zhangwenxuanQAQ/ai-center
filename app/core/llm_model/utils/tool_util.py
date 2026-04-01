"""
模型工具调用处理工具类

提供工具调用相关的处理功能
"""

import json
import asyncio
from typing import Dict, Any, List, Generator


def process_tool_calls(tool_calls: List[Dict], tool_map: Dict[str, str]) -> Generator[Dict[str, Any], None, None]:
    """
    处理工具调用
    
    Args:
        tool_calls: 工具调用列表
        tool_map: 工具名称到工具ID的映射
        
    Yields:
        Dict: 工具调用结果
    """
    from app.services.mcp.service import MCPToolService
    
    for tool_call in tool_calls:
        function_name = tool_call.get('function', {}).get('name', '')
        function_args_str = tool_call.get('function', {}).get('arguments', '{}')
        tool_call_id = tool_call.get('id', '')
        
        try:
            function_args = json.loads(function_args_str)
        except json.JSONDecodeError:
            yield {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'error': f'工具参数解析失败: {function_args_str}'
            }
            continue
        
        tool_id = tool_map.get(function_name)
        if not tool_id:
            yield {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'error': f'工具 {function_name} 不存在'
            }
            continue
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(MCPToolService.call_tool(tool_id, function_args))
            loop.close()
            
            if result:
                if result.get('isError'):
                    yield {
                        'tool_call_id': tool_call_id,
                        'tool_name': function_name,
                        'error': f'工具调用失败: {result.get("content", [{}])[0].get("text", "未知错误")}'
                    }
                else:
                    # 提取content中的text内容作为结果
                    content_items = result.get('content', [])
                    if content_items:
                        tool_result = content_items[0].get('text', '')
                    else:
                        tool_result = str(result)
                    
                    yield {
                        'tool_call_id': tool_call_id,
                        'tool_name': function_name,
                        'result': tool_result
                    }
            else:
                yield {
                    'tool_call_id': tool_call_id,
                    'tool_name': function_name,
                    'error': '工具调用返回空结果'
                }
        except Exception as e:
            yield {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'error': str(e)
            }
