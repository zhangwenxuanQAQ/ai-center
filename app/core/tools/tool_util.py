"""
统一工具工具类

整合MCP工具、知识库检索、内置工具的转换和调用功能。
MCP工具和知识库工具的转换与执行逻辑封装在对应的内置工具类中：
    - McpTool: 封装MCP工具的转换和调用
    - KnowledgebaseSearch: 封装知识库检索的转换和调用
"""

import json
import time
import asyncio
import concurrent.futures
from typing import Dict, Any, List, AsyncGenerator

from app.core.tools.base_tool import BaseTool
from app.core.tools.builtin_tools.mcp_tool import McpTool
from app.core.tools.builtin_tools.knowledgebase_search import KnowledgebaseSearch


# ========== MCP工具转换 ==========

def convert_mcp_tool_to_openai_tool(mcp_tool_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    将MCP工具配置转换为OpenAI tool格式

    Args:
        mcp_tool_config: MCP工具配置，包含name、description、inputSchema等字段

    Returns:
        Dict[str, Any]: OpenAI tool格式的工具定义
    """
    tool = McpTool.from_mcp_tool_config(mcp_tool_config)
    return tool.to_openai_tool()


def convert_mcp_tools_to_openai_tools(mcp_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    批量将MCP工具配置转换为OpenAI tool格式

    Args:
        mcp_tools: MCP工具配置列表

    Returns:
        List[Dict[str, Any]]: OpenAI tool格式的工具定义列表
    """
    return [convert_mcp_tool_to_openai_tool(mcp_tool) for mcp_tool in mcp_tools]


def convert_db_tool_to_openai_tool(db_tool) -> Dict[str, Any]:
    """
    将数据库中的MCP工具对象转换为OpenAI tool格式

    Args:
        db_tool: MCPTool数据库对象

    Returns:
        Dict[str, Any]: OpenAI tool格式的工具定义
    """
    tool = McpTool.from_db_tool(db_tool)
    return tool.to_openai_tool()


def convert_db_tools_to_openai_tools(db_tools: List) -> List[Dict[str, Any]]:
    """
    批量将数据库中的MCP工具对象转换为OpenAI tool格式

    Args:
        db_tools: MCPTool数据库对象列表

    Returns:
        List[Dict[str, Any]]: OpenAI tool格式的工具定义列表
    """
    return [convert_db_tool_to_openai_tool(db_tool) for db_tool in db_tools]


# ========== 知识库工具转换 ==========

def convert_kb_to_openai_tool(kb) -> Dict[str, Any]:
    """
    将知识库对象转换为OpenAI tool格式

    Args:
        kb: Knowledgebase数据库对象

    Returns:
        Dict[str, Any]: OpenAI tool格式的工具定义
    """
    tool = KnowledgebaseSearch.from_kb(kb)
    return tool.to_openai_tool()


def convert_kbs_to_openai_tools(kbs: List) -> List[Dict[str, Any]]:
    """
    批量将知识库对象转换为OpenAI tool格式

    Args:
        kbs: Knowledgebase数据库对象列表

    Returns:
        List[Dict[str, Any]]: OpenAI tool格式的工具定义列表
    """
    return [convert_kb_to_openai_tool(kb) for kb in kbs]


# ========== 工具调用执行 ==========

def _execute_single_tool(tool_call: Dict, tool_map: Dict[str, BaseTool]) -> Dict[str, Any]:
    """
    执行单个工具调用，统一使用ToolRunner.call执行

    所有工具（内置工具、MCP工具、知识库检索）均通过ToolRunner.call调用，
    ToolRunner会优先从tool_map中查找工具实例，若未找到则从全局ToolRegistry中查找。

    Args:
        tool_call: 工具调用信息
        tool_map: 工具名称到工具实例的映射

    Returns:
        Dict[str, Any]: 工具调用结果，包含tool_call_id、tool_name、task_name、耗时等信息
    """
    from app.core.tools import ToolRunner

    function_name = tool_call.get('function', {}).get('name', '')
    function_args_str = tool_call.get('function', {}).get('arguments', '{}')
    tool_call_id = tool_call.get('id', '')

    start_time = time.time()

    try:
        function_args = json.loads(function_args_str)
    except json.JSONDecodeError:
        elapsed = int((time.time() - start_time) * 1000)
        return {
            'tool_call_id': tool_call_id,
            'tool_name': function_name,
            'task_name': '',
            'elapsed_ms': elapsed,
            'error': f'工具参数解析失败: {function_args_str}'
        }

    task_name = function_args.get('task_name', '')

    # 统一使用ToolRunner.call执行所有工具
    result = ToolRunner.call(function_name, function_args, tool_map=tool_map)
    elapsed = int((time.time() - start_time) * 1000)

    if result.get('success'):
        return {
            'tool_call_id': tool_call_id,
            'tool_name': function_name,
            'task_name': task_name,
            'elapsed_ms': elapsed,
            'result': result.get('result', ''),
            'message': result.get('message', ''),
            'parameters': function_args
        }
    else:
        return {
            'tool_call_id': tool_call_id,
            'tool_name': function_name,
            'task_name': task_name,
            'elapsed_ms': elapsed,
            'error': result.get('error') or result.get('message') or '工具调用失败',
            'parameters': function_args
        }


async def process_tool_calls(tool_calls: List[Dict], tool_map: Dict[str, BaseTool], chat_id: str = '') -> AsyncGenerator[Dict[str, Any], None]:
    """
    处理工具调用，支持并行执行多个工具

    先yield每个工具的start状态，然后并行执行所有工具，
    每个工具开始执行后立即yield running状态，
    每个工具完成后立即yield其结果。
    支持通过chat_id检查停止标记，在工具执行过程中如果检测到停止请求，
    会取消未完成的工具调用。

    Args:
        tool_calls: 工具调用列表
        tool_map: 工具名称到工具实例的映射
        chat_id: 对话ID，用于检查停止状态

    Yields:
        Dict: 工具调用状态或结果
    """
    from app.core.chat.chat_service import ChatStopManager

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _sync_process():
        """在后台线程中执行的同步处理函数"""
        try:
            tool_call_task_names = {}
            tool_call_reasoning_contents = {}
            tool_call_parameters = {}

            # 先yield每个工具的start状态
            for tool_call in tool_calls:
                function_name = tool_call.get('function', {}).get('name', '')
                tool_call_id = tool_call.get('id', '')
                function_args_str = tool_call.get('function', {}).get('arguments', '{}')
                task_name = ''
                reasoning_content = ''
                function_args = {}
                try:
                    function_args = json.loads(function_args_str)
                    task_name = function_args.get('task_name', '')
                    reasoning_content = function_args.get('reasoning_content', '')
                except json.JSONDecodeError:
                    pass
                tool_call_task_names[tool_call_id] = task_name
                tool_call_reasoning_contents[tool_call_id] = reasoning_content
                tool_call_parameters[tool_call_id] = function_args

                asyncio.run_coroutine_threadsafe(
                    queue.put({
                        'tool_call_id': tool_call_id,
                        'tool_name': function_name,
                        'task_name': task_name,
                        'status': 'start',
                        'elapsed_ms': 0,
                        'reasoning_content': reasoning_content,
                        'parameters': function_args
                    }),
                    loop
                )

            # 并行执行所有工具
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(tool_calls), 10)) as executor:
                future_to_tool = {}
                for tool_call in tool_calls:
                    function_name = tool_call.get('function', {}).get('name', '')
                    tool_call_id = tool_call.get('id', '')

                    future = executor.submit(_execute_single_tool, tool_call, tool_map)
                    future_to_tool[future] = tool_call

                    asyncio.run_coroutine_threadsafe(
                        queue.put({
                            'tool_call_id': tool_call_id,
                            'tool_name': function_name,
                            'task_name': tool_call_task_names.get(tool_call_id, ''),
                            'status': 'running',
                            'elapsed_ms': 0,
                            'reasoning_content': tool_call_reasoning_contents.get(tool_call_id, ''),
                            'parameters': tool_call_parameters.get(tool_call_id, {})
                        }),
                        loop
                    )

                try:
                    for future in concurrent.futures.as_completed(future_to_tool):
                        if chat_id and ChatStopManager().is_stop_requested(chat_id):
                            for pending_future in future_to_tool:
                                if not pending_future.done():
                                    pending_future.cancel()
                            break

                        try:
                            result = future.result()
                            tool_call = future_to_tool[future]
                            tool_call_id = tool_call.get('id', '')
                            result['status'] = 'error' if 'error' in result else 'success'
                            result['reasoning_content'] = tool_call_reasoning_contents.get(tool_call_id, '')

                            asyncio.run_coroutine_threadsafe(queue.put(result), loop)
                        except Exception as e:
                            tool_call = future_to_tool[future]
                            function_name = tool_call.get('function', {}).get('name', '')
                            tool_call_id = tool_call.get('id', '')

                            asyncio.run_coroutine_threadsafe(
                                queue.put({
                                    'tool_call_id': tool_call_id,
                                    'tool_name': function_name,
                                    'task_name': tool_call_task_names.get(tool_call_id, ''),
                                    'status': 'error',
                                    'elapsed_ms': 0,
                                    'error': str(e),
                                    'reasoning_content': tool_call_reasoning_contents.get(tool_call_id, '')
                                }),
                                loop
                            )
                finally:
                    for pending_future in future_to_tool:
                        if not pending_future.done():
                            pending_future.cancel()
        except Exception as e:
            print(f"Error in _sync_process: {e}")
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)

    await loop.run_in_executor(None, _sync_process)

    while True:
        msg = await queue.get()
        if msg is None:
            break
        yield msg
        await asyncio.sleep(0)
