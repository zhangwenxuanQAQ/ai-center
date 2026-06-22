"""
模型工具调用处理工具类

提供工具调用相关的处理功能，支持MCP工具和知识库检索的并行调用
"""

import json
import time
import asyncio
import nest_asyncio
import concurrent.futures
from typing import Dict, Any, List, Generator


def _call_mcp_tool(tool_id: str, function_args: Dict[str, Any]) -> Dict[str, Any]:
    """
    调用MCP工具

    Args:
        tool_id: MCP工具ID
        function_args: 工具调用参数

    Returns:
        Dict[str, Any]: 工具调用结果
    """
    from app.services.mcp.service import MCPToolService

    nest_asyncio.apply()
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(MCPToolService.call_tool(tool_id, function_args))
    return result


def _call_knowledgebase_search(kb_id: str, query: str) -> Dict[str, Any]:
    """
    调用知识库检索

    Args:
        kb_id: 知识库ID
        query: 检索内容

    Returns:
        Dict[str, Any]: 检索结果
    """
    from app.core.knowledgebase.retrieval_service import RetrievalService

    kb_config = RetrievalService._get_kb_config(kb_id)
    retrieval_config = kb_config.get("retrieval_config", {})

    top_k = retrieval_config.get("top_k", 10)
    page_size = top_k

    result = RetrievalService.retrieval(
        kb_ids=[kb_id],
        question=query,
        top_k=top_k,
        page_size=page_size,
        vector_similarity_threshold=retrieval_config.get("vector_similarity"),
        keyword_similarity_threshold=retrieval_config.get("keyword_similarity"),
        vector_similarity_weight=retrieval_config.get("vector_similarity_weight"),
        sort_by=retrieval_config.get("sort_by"),
        embedding_model_id=kb_config.get("embedding_model_id"),
        rerank_model_id=kb_config.get("rerank_model_id"),
    )
    return result


def _execute_single_tool(tool_call: Dict, tool_map: Dict[str, str]) -> Dict[str, Any]:
    """
    执行单个工具调用，根据action类型分发到不同的处理逻辑

    Args:
        tool_call: 工具调用信息
        tool_map: 工具名称到工具ID的映射

    Returns:
        Dict[str, Any]: 工具调用结果，包含tool_call_id、tool_name、task_name、耗时等信息
    """
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
    action = function_args.get('action', '')

    if action == 'knowledgebase_search':
        kb_id = function_args.get('kb_id', '')
        query = function_args.get('query', '')

        if not kb_id or not query:
            elapsed = int((time.time() - start_time) * 1000)
            return {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'task_name': task_name,
                'elapsed_ms': elapsed,
                'error': '知识库检索缺少kb_id或query参数'
            }

        try:
            result = _call_knowledgebase_search(kb_id, query)
            elapsed = int((time.time() - start_time) * 1000)

            chunks = result.get('chunks', [])
            if chunks:
                search_results = []
                for chunk in chunks:
                    search_results.append({
                        'content': chunk.get('content_with_weight', ''),
                        'doc_name': chunk.get('docnm_kwd', ''),
                        'similarity': chunk.get('similarity', 0),
                    })
                return {
                    'tool_call_id': tool_call_id,
                    'tool_name': function_name,
                    'task_name': task_name,
                    'elapsed_ms': elapsed,
                    'action': 'knowledgebase_search',
                    'result': json.dumps(search_results, ensure_ascii=False)
                }
            else:
                return {
                    'tool_call_id': tool_call_id,
                    'tool_name': function_name,
                    'task_name': task_name,
                    'elapsed_ms': elapsed,
                    'action': 'knowledgebase_search',
                    'result': '未检索到相关内容'
                }
        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            return {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'task_name': task_name,
                'elapsed_ms': elapsed,
                'action': 'knowledgebase_search',
                'error': f'知识库检索失败: {str(e)}'
            }

    elif action == 'mcp_tool':
        tool_id = tool_map.get(function_name)
        if not tool_id:
            elapsed = int((time.time() - start_time) * 1000)
            return {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'task_name': task_name,
                'elapsed_ms': elapsed,
                'error': f'工具 {function_name} 不存在'
            }

        try:
            mcp_args = {k: v for k, v in function_args.items() if k not in ('action', 'task_name')}
            result = _call_mcp_tool(tool_id, mcp_args)
            elapsed = int((time.time() - start_time) * 1000)

            if result:
                if result.get('isError'):
                    return {
                        'tool_call_id': tool_call_id,
                        'tool_name': function_name,
                        'task_name': task_name,
                        'elapsed_ms': elapsed,
                        'action': 'mcp_tool',
                        'error': f'工具调用失败: {result.get("content", [{}])[0].get("text", "未知错误")}'
                    }
                else:
                    content_items = result.get('content', [])
                    if content_items:
                        tool_result = content_items[0].get('text', '')
                    else:
                        tool_result = str(result)

                    return {
                        'tool_call_id': tool_call_id,
                        'tool_name': function_name,
                        'task_name': task_name,
                        'elapsed_ms': elapsed,
                        'action': 'mcp_tool',
                        'result': tool_result
                    }
            else:
                return {
                    'tool_call_id': tool_call_id,
                    'tool_name': function_name,
                    'task_name': task_name,
                    'elapsed_ms': elapsed,
                    'action': 'mcp_tool',
                    'error': '工具调用返回空结果'
                }
        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            return {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'task_name': task_name,
                'elapsed_ms': elapsed,
                'action': 'mcp_tool',
                'error': str(e)
            }

    else:
        tool_id = tool_map.get(function_name)
        if tool_id:
            try:
                result = _call_mcp_tool(tool_id, function_args)
                elapsed = int((time.time() - start_time) * 1000)

                if result:
                    if result.get('isError'):
                        return {
                            'tool_call_id': tool_call_id,
                            'tool_name': function_name,
                            'task_name': task_name,
                            'elapsed_ms': elapsed,
                            'error': f'工具调用失败: {result.get("content", [{}])[0].get("text", "未知错误")}'
                        }
                    else:
                        content_items = result.get('content', [])
                        if content_items:
                            tool_result = content_items[0].get('text', '')
                        else:
                            tool_result = str(result)

                        return {
                            'tool_call_id': tool_call_id,
                            'tool_name': function_name,
                            'task_name': task_name,
                            'elapsed_ms': elapsed,
                            'result': tool_result
                        }
                else:
                    elapsed = int((time.time() - start_time) * 1000)
                    return {
                        'tool_call_id': tool_call_id,
                        'tool_name': function_name,
                        'task_name': task_name,
                        'elapsed_ms': elapsed,
                        'error': '工具调用返回空结果'
                    }
            except Exception as e:
                elapsed = int((time.time() - start_time) * 1000)
                return {
                    'tool_call_id': tool_call_id,
                    'tool_name': function_name,
                    'task_name': task_name,
                    'elapsed_ms': elapsed,
                    'error': str(e)
                }
        else:
            elapsed = int((time.time() - start_time) * 1000)
            return {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'task_name': task_name,
                'elapsed_ms': elapsed,
                'error': f'工具 {function_name} 不存在'
            }


def process_tool_calls(tool_calls: List[Dict], tool_map: Dict[str, str], chat_id: str = '') -> Generator[Dict[str, Any], None, None]:
    """
    处理工具调用，支持并行执行多个工具

    先yield每个工具的start状态，然后并行执行所有工具，
    每个工具开始执行后立即yield running状态，
    每个工具完成后立即yield其结果。
    支持通过chat_id检查停止标记，在工具执行过程中如果检测到停止请求，
    会取消未完成的工具调用。

    Args:
        tool_calls: 工具调用列表
        tool_map: 工具名称到工具ID的映射
        chat_id: 对话ID，用于检查停止状态

    Yields:
        Dict: 工具调用状态或结果
    """
    from app.core.chat.chat_service import ChatStopManager
    
    tool_call_task_names = {}
    tool_call_reasoning_contents = {}
    for tool_call in tool_calls:
        function_name = tool_call.get('function', {}).get('name', '')
        tool_call_id = tool_call.get('id', '')
        function_args_str = tool_call.get('function', {}).get('arguments', '{}')
        task_name = ''
        reasoning_content = ''
        try:
            function_args = json.loads(function_args_str)
            task_name = function_args.get('task_name', '')
            reasoning_content = function_args.get('reasoning_content', '')
        except json.JSONDecodeError:
            pass
        tool_call_task_names[tool_call_id] = task_name
        tool_call_reasoning_contents[tool_call_id] = reasoning_content
        yield {
            'tool_call_id': tool_call_id,
            'tool_name': function_name,
            'task_name': task_name,
            'status': 'start',
            'elapsed_ms': 0,
            'reasoning_content': reasoning_content
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(tool_calls), 10)) as executor:
        future_to_tool = {}
        for tool_call in tool_calls:
            function_name = tool_call.get('function', {}).get('name', '')
            tool_call_id = tool_call.get('id', '')
            
            future = executor.submit(_execute_single_tool, tool_call, tool_map)
            future_to_tool[future] = tool_call
            
            yield {
                'tool_call_id': tool_call_id,
                'tool_name': function_name,
                'task_name': tool_call_task_names.get(tool_call_id, ''),
                'status': 'running',
                'elapsed_ms': 0,
                'reasoning_content': tool_call_reasoning_contents.get(tool_call_id, '')
            }

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
                    yield result
                except Exception as e:
                    tool_call = future_to_tool[future]
                    function_name = tool_call.get('function', {}).get('name', '')
                    tool_call_id = tool_call.get('id', '')
                    yield {
                        'tool_call_id': tool_call_id,
                        'tool_name': function_name,
                        'task_name': tool_call_task_names.get(tool_call_id, ''),
                        'status': 'error',
                        'elapsed_ms': 0,
                        'error': str(e),
                        'reasoning_content': tool_call_reasoning_contents.get(tool_call_id, '')
                    }
        finally:
            for pending_future in future_to_tool:
                if not pending_future.done():
                    pending_future.cancel()