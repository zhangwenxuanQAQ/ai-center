"""
聊天核心服务

处理聊天逻辑，包括消息转换、模型调用等
"""

import json
import uuid
import base64
import importlib.util
from typing import List, Dict, Any, Optional, Generator, Tuple

from app.database.models import Chat, ChatMessage, LLMModel, Chatbot, ChatbotPrompt, ChatbotTool, MCPTool
from app.services.chat.dto import QueryItem
from app.services.chat.service import ChatService, ChatMessageService
from app.core.llm_model.factory import LLMFactory
from app.core.llm_model.utils.tool_util import process_tool_calls
from app.core.exceptions import ResourceNotFoundError
from app.core.knowledgebase.utils.file_utils import filename_type
from app.constants.knowledgebase_document_constants import FileType


def _load_mcp_tool_util():
    """
    动态加载MCP工具转换模块，避免循环导入
    
    Returns:
        module: MCP工具转换模块
    """
    import os
    tool_util_path = os.path.join(os.path.dirname(__file__), '..', 'mcp', 'utils', 'tool_util.py')
    spec = importlib.util.spec_from_file_location("mcp_tool_util", tool_util_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def convert_db_tools_to_openai_tools(db_tools):
    """
    批量将数据库中的MCP工具对象转换为OpenAI tool格式
    
    Args:
        db_tools: MCPTool数据库对象列表
        
    Returns:
        List[Dict[str, Any]]: OpenAI tool格式的工具定义列表
    """
    mcp_tool_util = _load_mcp_tool_util()
    return mcp_tool_util.convert_db_tools_to_openai_tools(db_tools)


class ChatCoreService:
    """
    聊天核心服务类
    
    处理聊天逻辑，包括消息转换、模型调用等
    """
    
    @staticmethod
    def convert_query_to_message(query: List[QueryItem]) -> Dict[str, Any]:
        """
        将query数组转换为OpenAI格式的用户消息
        
        Args:
            query: 查询数组
            
        Returns:
            Dict: OpenAI格式的用户消息
        """
        from app.services.chat.file_utils import get_file_from_datasource
        from app.core.prompt.utils.user_prompt_builder import build_user_prompt_with_documents
        
        # 处理document类型的QueryItem，从数据源获取文件
        processed_query = []
        for item in query:
            if item.type == 'document':
                # 从数据源获取文件
                content_dict = item.content if isinstance(item.content, dict) else {}
                file_result = get_file_from_datasource(content_dict)
                
                if file_result.get('success'):
                    file_data = file_result.get('data', {})
                    # 转换为file_base64类型，保留file_name和file_size
                    processed_query.append(QueryItem(
                        type='file_base64',
                        content=file_data.get('base64_content', ''),
                        mime_type=file_data.get('mime_type'),
                        file_name=content_dict.get('file_name'),
                        file_size=content_dict.get('file_size') or file_data.get('file_size')
                    ))
                else:
                    # 获取失败，跳过该文件
                    pass
            else:
                processed_query.append(item)
        
        # 检查是否有图片
        has_image = any(item.type == 'file_base64' and item.mime_type and item.mime_type.startswith('image/') for item in processed_query)
        
        # 检查是否有需要文本提取的文件（非图片、非音频）
        needs_text_extraction = False
        for item in processed_query:
            if item.type == 'file_base64' and item.file_name:
                file_type = filename_type(item.file_name)
                if file_type not in (FileType.VISUAL, FileType.AURAL):
                    needs_text_extraction = True
                    break
        
        if has_image:
            content = []
            for item in processed_query:
                if item.type == 'text':
                    content.append({
                        'type': 'text',
                        'text': item.content
                    })
                elif item.type == 'file_base64' and item.mime_type and item.mime_type.startswith('image/'):
                    content.append({
                        'type': 'image_url',
                        'image_url': {
                            'url': f'data:{item.mime_type};base64,{item.content}'
                        }
                    })
            
            return {
                'role': 'user',
                'content': content
            }
        else:
            # 如果有需要文本提取的文件，提取文本并拼接到用户提示词中
            if needs_text_extraction:
                original_text = ' '.join(item.content for item in processed_query if item.type == 'text')
                document_text = build_user_prompt_with_documents(processed_query, original_text)
                return {
                    'role': 'user',
                    'content': document_text
                }
            else:
                text_content = ' '.join(item.content for item in processed_query if item.type == 'text')
                return {
                    'role': 'user',
                    'content': text_content
                }
    
    @staticmethod
    def get_model_config(model_id: str) -> Tuple[Dict[str, Any], str]:
        """
        获取模型配置
        
        Args:
            model_id: 模型ID
            
        Returns:
            Tuple[Dict, str]: 模型配置和模型类型
            
        Raises:
            ResourceNotFoundError: 模型不存在
        """
        try:
            model = LLMModel.get(LLMModel.id == model_id)
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(message=f"模型 {model_id} 不存在")
        
        config = {
            'api_key': model.api_key,
            'endpoint': model.endpoint,
            'name': model.name,
            'provider': model.provider
        }
        
        llm_config = {}
        if model.config:
            try:
                llm_config = json.loads(model.config)
            except json.JSONDecodeError:
                pass
        
        return config, llm_config, model.model_type
    
    @staticmethod
    def get_chatbot_system_prompt(chatbot_id: str) -> Optional[str]:
        """
        获取机器人的系统提示词
        
        Args:
            chatbot_id: 机器人ID
            
        Returns:
            Optional[str]: 系统提示词
        """
        try:
            chatbot = Chatbot.get(Chatbot.id == chatbot_id)
            return chatbot.greeting
        except Chatbot.DoesNotExist:
            return None
    
    @staticmethod
    def get_chatbot_config(chatbot_id: str) -> Dict[str, Any]:
        """
        获取机器人的完整配置，包括模型、提示词、工具等
        
        Args:
            chatbot_id: 机器人ID
            
        Returns:
            Dict[str, Any]: 机器人配置，包含model_id、system_prompt、user_prompts、tools等
            
        Raises:
            ResourceNotFoundError: 机器人不存在或未绑定模型
        """
        try:
            chatbot = Chatbot.get(Chatbot.id == chatbot_id)
        except Chatbot.DoesNotExist:
            raise ResourceNotFoundError(message=f"机器人不存在")
        
        from app.database.models import ChatbotModel
        model_bindings = list(ChatbotModel.select().where(
            (ChatbotModel.chatbot_id == chatbot_id) &
            (ChatbotModel.deleted == False)
        ))
        
        if not model_bindings:
            raise ResourceNotFoundError(message=f"机器人未绑定任何模型")
        
        text_model_id = None
        vision_model_id = None
        multimodal_model_id = None
        
        for binding in model_bindings:
            if binding.model_type == 'text':
                text_model_id = binding.model_id
            elif binding.model_type == 'vision':
                vision_model_id = binding.model_id
            elif binding.model_type == 'multimodal':
                multimodal_model_id = binding.model_id
        
        model_id = text_model_id or multimodal_model_id or vision_model_id
        
        if not model_id:
            raise ResourceNotFoundError(message=f"机器人未绑定有效的模型")
        
        system_prompts = list(ChatbotPrompt.select().where(
            (ChatbotPrompt.chatbot_id == chatbot_id) &
            (ChatbotPrompt.prompt_type == 'system') &
            (ChatbotPrompt.deleted == False)
        ).order_by(ChatbotPrompt.sort_order))
        
        system_prompt_parts = []
        for prompt in system_prompts:
            if prompt.prompt_source == 'library' and prompt.prompt_id:
                from app.database.models import Prompt
                try:
                    prompt_obj = Prompt.get(Prompt.id == prompt.prompt_id)
                    system_prompt_parts.append(prompt_obj.content)
                except Prompt.DoesNotExist:
                    pass
            elif prompt.prompt_source == 'manual' and prompt.prompt_content:
                system_prompt_parts.append(prompt.prompt_content)
        
        system_prompt = '\n'.join(system_prompt_parts) if system_prompt_parts else None
        
        user_prompts = list(ChatbotPrompt.select().where(
            (ChatbotPrompt.chatbot_id == chatbot_id) &
            (ChatbotPrompt.prompt_type == 'user') &
            (ChatbotPrompt.deleted == False)
        ).order_by(ChatbotPrompt.sort_order))
        
        user_prompt_messages = []
        for prompt in user_prompts:
            if prompt.prompt_source == 'library' and prompt.prompt_id:
                from app.database.models import Prompt
                try:
                    prompt_obj = Prompt.get(Prompt.id == prompt.prompt_id)
                    user_prompt_messages.append({
                        'role': 'user',
                        'content': prompt_obj.content
                    })
                except Prompt.DoesNotExist:
                    pass
            elif prompt.prompt_source == 'manual' and prompt.prompt_content:
                user_prompt_messages.append({
                    'role': 'user',
                    'content': prompt.prompt_content
                })
        
        tool_bindings = list(ChatbotTool.select().where(
            (ChatbotTool.chatbot_id == chatbot_id) &
            (ChatbotTool.deleted == False)
        ))
        
        tool_ids = [binding.mcp_tool_id for binding in tool_bindings]
        tools = list(MCPTool.select().where(
            (MCPTool.id.in_(tool_ids)) &
            (MCPTool.deleted == False)
        ))
        
        openai_tools = convert_db_tools_to_openai_tools(tools)
        
        tool_map = {}
        for tool in tools:
            tool_map[tool.name] = tool.id
        
        return {
            'model_id': model_id,
            'system_prompt': system_prompt,
            'user_prompt_messages': user_prompt_messages,
            'tools': openai_tools,
            'tool_map': tool_map
        }
    
    @staticmethod
    def build_messages(
        system_prompt: Optional[str],
        history_messages: List[Dict],
        user_message: Dict,
        user_prompt_messages: Optional[List[Dict]] = None
    ) -> List[Dict]:
        """
        构建完整的消息列表
        
        Args:
            system_prompt: 系统提示词
            history_messages: 历史消息
            user_message: 用户消息
            user_prompt_messages: 用户提示词消息列表
            
        Returns:
            List[Dict]: 完整的消息列表
        """
        from app.core.prompt.utils.system_prompt_builder import build_system_prompt
        
        messages = []
        
        built_system_prompt = build_system_prompt(system_prompt)
        messages.append({
            'role': 'system',
            'content': built_system_prompt
        })
        
        if user_prompt_messages:
            messages.extend(user_prompt_messages)
        
        messages.extend(history_messages)
        messages.append(user_message)
        
        return messages
    
    @staticmethod
    def extract_text_from_query(query: List[QueryItem]) -> str:
        """
        从query中提取文本内容
        
        Args:
            query: 查询数组
            
        Returns:
            str: 文本内容
        """
        texts = [item.content for item in query if item.type == 'text']
        return ' '.join(texts)
    
    @staticmethod
    def chat_stream(
        user_id: str,
        query: List[QueryItem],
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        chat_id: Optional[str] = None,
        config: Optional[Any] = None,
        message_id: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Generator[Dict[str, Any], None, None]:
        """
        流式聊天

        Args:
            user_id: 用户ID
            query: 查询数组
            model_id: 模型ID
            chatbot_id: 机器人ID
            chat_id: 对话ID
            config: 配置（支持字符串或字典）
            message_id: 消息ID，用于标识重新回答或编辑问题
            system_prompt: 系统提示词

        Yields:
            Dict: 流式响应数据
        """
        user_message = ChatCoreService.convert_query_to_message(query)
        user_text = ChatCoreService.extract_text_from_query(query)
        
        config_dict = {}
        if config:
            if isinstance(config, str):
                try:
                    config_dict = json.loads(config)
                except json.JSONDecodeError:
                    pass
            elif isinstance(config, dict):
                config_dict = config
        
        chatbot_config = None
        tools = None
        tool_map = None
        user_prompt_messages = None
        
        # 使用机器人聊天
        if chatbot_id:
            try:
                chatbot_config = ChatCoreService.get_chatbot_config(chatbot_id)
                model_id = chatbot_config['model_id']
                system_prompt = chatbot_config['system_prompt']
                user_prompt_messages = chatbot_config['user_prompt_messages']
                tools = chatbot_config['tools'] if chatbot_config['tools'] else None
                tool_map = chatbot_config['tool_map']
                # 获取机器人模型关联表中的模型配置
                from app.database.models import ChatbotModel
                try:
                    chatbot_model = ChatbotModel.get(
                        (ChatbotModel.chatbot_id == chatbot_id) &
                        (ChatbotModel.model_id == model_id) &
                        (ChatbotModel.deleted == False)
                    )
                    if chatbot_model.config:
                        try:
                            chatbot_model_config = json.loads(chatbot_model.config)
                            if isinstance(chatbot_model_config, dict):
                                config_dict.update(chatbot_model_config)
                        except json.JSONDecodeError:
                            pass
                except ChatbotModel.DoesNotExist:
                    pass
            except ResourceNotFoundError as e:
                yield {'error': str(e), 'chat_id': chat_id}
                return
        
        if not chat_id:
            title = user_text[:20] if len(user_text) > 20 else user_text
            # 当选择的是模型时，机器人id设为空；当选择的是机器人时，模型id设为空
            chat_model_id = model_id if not chatbot_id else None
            chat_chatbot_id = chatbot_id if not model_id else None
            chat = ChatService.create_chat(user_id, {
                'title': title,
                'model_id': chat_model_id,
                'chatbot_id': chat_chatbot_id,
                'config': json.dumps(config_dict) if config_dict else None,
                'system_prompt': system_prompt
            })
            chat_id = chat.id
            history_messages = []
        else:
            chat = ChatService.get_chat(chat_id, user_id)
            if not chat:
                raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
            
            try:
                history_messages = json.loads(chat.messages) if chat.messages else []
            except json.JSONDecodeError:
                history_messages = []
            
            if not chatbot_id:
                system_prompt = chat.system_prompt
        
        # 重新回答/编辑问题
        if message_id:
            try:
                target_message = ChatMessage.get(
                    (ChatMessage.message_id == message_id) &
                    (ChatMessage.chat_id == chat_id) &
                    (ChatMessage.deleted == False)
                )
                for i in reversed(range(len(history_messages))):
                    msg = history_messages[i]
                    if msg.get('role') == 'user' and msg.get('content') == target_message.content and msg.get('message_id') == message_id:
                        history_messages = history_messages[:i]
                        break
            except ChatMessage.DoesNotExist:
                pass

        if chatbot_id and not chatbot_config:
            system_prompt = ChatCoreService.get_chatbot_system_prompt(chatbot_id)
        
        if not model_id:
            if chat.model_id:
                model_id = chat.model_id
            else:
                yield {'error': '未指定模型', 'chat_id': chat_id}
                return
        
        model_config, llm_config , model_type = ChatCoreService.get_model_config(model_id)
        model = LLMFactory.create_model(model_type, model_config)
        
        messages = ChatCoreService.build_messages(system_prompt, history_messages, user_message, user_prompt_messages)
        
        model_params = {}
        if llm_config:
            model_params.update(llm_config)
        if config_dict:
            model_params.update(config_dict)
        if tools is not None:
            model_params['tools'] = tools
        
        ChatService.update_chat_config(
            chat_id=chat_id,
            model_id=model_id if not chatbot_id else None,
            chatbot_id=chatbot_id if not model_id else None,
            config=config
        )
        
        from app.services.chat.file_utils import build_extra_content
        extra_content = build_extra_content(query)
        
        ChatMessageService.create_user_message(
            chat_id=chat_id,
            user_content=user_text,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config,
            message_id=message_id,
            extra_content=extra_content
        )
        
        import time
        start_time = time.time()
        reasoning_end_time = None
        
        full_response = ''
        reasoning_content = ''
        is_stopped = False
        
        try:
            # 主循环：处理模型调用和工具调用
            while True:
                full_response_chunk = ''
                reasoning_content_chunk = ''
                tool_calls_list = []
                
                for chunk in model.stream_generate_with_messages(messages, **model_params):
                    if 'error' in chunk:
                        yield {'error': chunk['error'], 'chat_id': chat_id}
                        return
                    
                    if chunk.get('text'):
                        if reasoning_end_time is None and reasoning_content:
                            reasoning_end_time = time.time()
                        full_response_chunk += chunk['text']
                        full_response += chunk['text']
                    
                    if chunk.get('reasoning_content'):
                        reasoning_content_chunk += chunk['reasoning_content']
                        reasoning_content += chunk['reasoning_content']
                    
                    if chunk.get('tool_calls'):
                        tool_calls_list = chunk.get('tool_calls')
                    
                    yield {
                        'text': chunk.get('text', ''),
                        'reasoning_content': chunk.get('reasoning_content'),
                        'finish_reason': chunk.get('finish_reason'),
                        'usage': chunk.get('usage'),
                        'chat_id': chat_id
                    }
                
                # 检查是否需要调用工具
                if tool_calls_list and tool_map:
                    messages.append({
                        'role': 'assistant',
                        'content': full_response_chunk,
                        'tool_calls': tool_calls_list
                    })
                    
                    tool_responses = []
                    
                    for tool_call in tool_calls_list:
                        function_name = tool_call.get('function', {}).get('name', '')
                        function_args_str = tool_call.get('function', {}).get('arguments', '{}')
                        tool_call_id = tool_call.get('id', '')
                        
                        try:
                            function_args = json.loads(function_args_str)
                        except json.JSONDecodeError:
                            tool_message_content = f"工具 {function_name} 调用失败: 参数解析错误"
                            yield {
                                'text': '',
                                'tool_call': {
                                    'name': function_name,
                                    'status': 'error',
                                    'message': tool_message_content,
                                    'requires_input': False
                                },
                                'chat_id': chat_id
                            }
                            messages.append({
                                'role': 'tool',
                                'tool_call_id': tool_call_id,
                                'content': tool_message_content
                            })
                            continue
                        
                        # 检查工具是否存在
                        tool_id = tool_map.get(function_name)
                        if not tool_id:
                            tool_message_content = f"工具 {function_name} 不存在"
                            yield {
                                'text': '',
                                'tool_call': {
                                    'name': function_name,
                                    'status': 'error',
                                    'message': tool_message_content,
                                    'requires_input': False
                                },
                                'chat_id': chat_id
                            }
                            messages.append({
                                'role': 'tool',
                                'tool_call_id': tool_call_id,
                                'content': tool_message_content
                            })
                            continue
                        
                        # 处理工具调用
                        tool_result = None
                        for result in process_tool_calls([tool_call], tool_map):
                            tool_result = result
                            break
                        
                        if tool_result:
                            if 'error' in tool_result:
                                # 检查是否是缺少参数的错误
                                error_msg = tool_result['error']
                                if '缺少' in error_msg or '参数' in error_msg:
                                    # 等待用户输入参数
                                    yield {
                                        'text': '',
                                        'tool_call': {
                                            'name': function_name,
                                            'status': 'requires_input',
                                            'message': f"工具 {function_name} 需要输入参数",
                                            'requires_input': True,
                                            'tool_call_id': tool_call_id,
                                            'function_args': function_args
                                        },
                                        'chat_id': chat_id
                                    }
                                    
                                    # 这里需要等待用户输入参数
                                    # 注意：在实际应用中，这里需要前端配合，发送包含参数的请求
                                    # 暂时先跳过，实际实现需要根据前端交互来处理
                                    tool_message_content = f"工具 {function_name} 缺少参数，需要用户输入"
                                    messages.append({
                                        'role': 'tool',
                                        'tool_call_id': tool_call_id,
                                        'content': tool_message_content
                                    })
                                else:
                                    tool_message_content = f"工具 {function_name} 调用失败: {error_msg}"
                                    yield {
                                        'text': '',
                                        'tool_call': {
                                            'name': function_name,
                                            'status': 'error',
                                            'message': tool_message_content,
                                            'requires_input': False
                                        },
                                        'chat_id': chat_id
                                    }
                                    messages.append({
                                        'role': 'tool',
                                        'tool_call_id': tool_call_id,
                                        'content': tool_message_content
                                    })
                            else:
                                tool_message_content = json.dumps(tool_result.get('result'), ensure_ascii=False)
                                yield {
                                    'text': '',
                                    'tool_call': {
                                        'name': function_name,
                                        'status': 'success',
                                        'result': tool_result.get('result'),
                                        'requires_input': False
                                    },
                                    'chat_id': chat_id
                                }
                                # 保存工具消息到数据库
                                ChatMessageService.create_tool_message(
                                    chat_id=chat_id,
                                    tool_content=tool_message_content,
                                    model_id=model_id,
                                    chatbot_id=chatbot_id,
                                    config=config
                                )
                                messages.append({
                                    'role': 'tool',
                                    'tool_call_id': tool_call_id,
                                    'content': tool_message_content
                                })
                else:
                    # 没有工具调用，退出循环
                    break
        except GeneratorExit:
            # 客户端停止请求，保存已生成的内容
            is_stopped = True
        except Exception as e:
            # 其他异常，保存已生成的内容
            print(f"Error in stream_chat: {e}")
            pass
        finally:
            # 保存助手消息
            if full_response or reasoning_content:
                # 只有手动停止时才添加"用户停止回答"标记
                if is_stopped:
                    if full_response:
                        full_response += "\n\n【用户停止回答】"
                    else:
                        full_response = "【用户停止回答】"
                
                reasoning_time = None
                if reasoning_content and reasoning_end_time:
                    reasoning_time = int((reasoning_end_time - start_time) * 1000)
                
                assistant_message_dict = {'role': 'assistant', 'content': full_response}
                if reasoning_content:
                    assistant_message_dict['reasoning_content'] = reasoning_content

                avatar = None
                if chatbot_id:
                    try:
                        chatbot = Chatbot.get(Chatbot.id == chatbot_id)
                        avatar = chatbot.avatar
                    except Chatbot.DoesNotExist:
                        pass
                elif model_id:
                    try:
                        model = LLMModel.get(LLMModel.id == model_id)
                        if model.provider:
                            avatar = f"/src/assets/llm/{model.provider.lower()}.png"
                        else:
                            avatar = f"/src/assets/llm/default.png"
                    except LLMModel.DoesNotExist:
                        pass
                
                ChatMessageService.create_assistant_message(
                    chat_id=chat_id,
                    assistant_content=full_response,
                    model_id=model_id,
                    chatbot_id=chatbot_id,
                    config=config,
                    reasoning_content=reasoning_content if reasoning_content else None,
                    reasoning_time=reasoning_time,
                    avatar=avatar
                )

                chat_messages = ChatMessageService.get_messages_by_chat(chat_id)
                updated_messages = []
                for i in range(len(messages)):
                    if messages[i]['role'] != 'system':
                        messages[i]['message_id'] = chat_messages.items[i].message_id
                        messages[i]['reasoning_content'] = chat_messages.items[i].reasoning_content
                    updated_messages.append(messages[i])
                # updated_messages = [{"role": msg.role, "content": msg.content , "reasoning_content": msg.reasoning_content , "message_id": msg.message_id} for msg in chat_messages.items if not msg.role != 'system']
                # system_message = messages[0] if messages else None
                # if system_message:
                #     updated_messages.insert(0, system_message)
                # updated_messages.append(assistant_message_dict)
                ChatService.update_messages(chat_id, updated_messages)
    
    @staticmethod
    def chat(
        user_id: str,
        query: List[QueryItem],
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        chat_id: Optional[str] = None,
        config: Optional[Any] = None,
        message_id: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        非流式聊天

        Args:
            user_id: 用户ID
            query: 查询数组
            model_id: 模型ID
            chatbot_id: 机器人ID
            chat_id: 对话ID
            config: 配置（支持字符串或字典）
            message_id: 消息ID，用于标识重新回答或编辑问题
            system_prompt: 系统提示词

        Returns:
            Dict: 响应数据
        """
        user_message = ChatCoreService.convert_query_to_message(query)
        user_text = ChatCoreService.extract_text_from_query(query)
        
        # 处理config参数，统一转换为字典
        config_dict = {}
        if config:
            if isinstance(config, str):
                try:
                    config_dict = json.loads(config)
                except json.JSONDecodeError:
                    pass
            elif isinstance(config, dict):
                config_dict = config
        
        chatbot_config = None
        tools = None
        tool_map = None
        user_prompt_messages = None
        
        # 使用机器人聊天
        if chatbot_id:
            try:
                chatbot_config = ChatCoreService.get_chatbot_config(chatbot_id)
                model_id = chatbot_config['model_id']
                system_prompt = chatbot_config['system_prompt']
                user_prompt_messages = chatbot_config['user_prompt_messages']
                tools = chatbot_config['tools'] if chatbot_config['tools'] else None
                tool_map = chatbot_config['tool_map']
                # 获取机器人模型关联表中的模型配置
                from app.database.models import ChatbotModel
                try:
                    chatbot_model = ChatbotModel.get(
                        (ChatbotModel.chatbot_id == chatbot_id) &
                        (ChatbotModel.model_id == model_id) &
                        (ChatbotModel.deleted == False)
                    )
                    if chatbot_model.config:
                        try:
                            chatbot_model_config = json.loads(chatbot_model.config)
                            if isinstance(chatbot_model_config, dict):
                                config_dict.update(chatbot_model_config)
                        except json.JSONDecodeError:
                            pass
                except ChatbotModel.DoesNotExist:
                    pass
            except ResourceNotFoundError as e:
                return {'error': str(e), 'chat_id': chat_id}
        
        if not chat_id:
            title = user_text[:20] if len(user_text) > 20 else user_text
            # 当选择的是模型时，机器人id设为空；当选择的是机器人时，模型id设为空
            chat_model_id = model_id if not chatbot_id else None
            chat_chatbot_id = chatbot_id if not model_id else None
            chat = ChatService.create_chat(user_id, {
                'title': title,
                'model_id': chat_model_id,
                'chatbot_id': chat_chatbot_id,
                'config': json.dumps(config_dict) if config_dict else None,
                'system_prompt': system_prompt
            })
            chat_id = chat.id
            history_messages = []
        else:
            chat = ChatService.get_chat(chat_id, user_id)
            if not chat:
                raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
            
            try:
                history_messages = json.loads(chat.messages) if chat.messages else []
            except json.JSONDecodeError:
                history_messages = []
            
            if not chatbot_id:
                system_prompt = chat.system_prompt
        
        # 检查是否是重新回答（使用message_id或内容匹配）
        if message_id:
            # 使用message_id精确定位要重新回答的消息
            # 从数据库中获取消息，找到其在历史消息中的位置
            try:
                target_message = ChatMessage.get(
                    (ChatMessage.message_id == message_id) &
                    (ChatMessage.chat_id == chat_id) &
                    (ChatMessage.deleted == False)
                )
                # 查找历史消息中对应的消息
                for i in reversed(range(len(history_messages))):
                    msg = history_messages[i]
                    if msg.get('role') == 'user' and msg.get('content') == target_message.content and msg.get('message_id') == message_id:
                        # 移除从该用户消息开始的所有消息
                        history_messages = history_messages[:i]
                        break
            except ChatMessage.DoesNotExist:
                pass

        if chatbot_id and not chatbot_config:
            system_prompt = ChatCoreService.get_chatbot_system_prompt(chatbot_id)
        
        if not model_id:
            if chat.model_id:
                model_id = chat.model_id
            else:
                return {'error': '未指定模型', 'chat_id': chat_id}
        
        model_config, llm_config, model_type = ChatCoreService.get_model_config(model_id)
        model = LLMFactory.create_model(model_type, model_config)
        
        messages = ChatCoreService.build_messages(system_prompt, history_messages, user_message, user_prompt_messages)
        
        model_params = {}
        if llm_config:
            model_params.update(llm_config)
        if config_dict:
            model_params.update(config_dict)
        if tools is not None:
            model_params['tools'] = tools
        
        ChatService.update_chat_config(
            chat_id=chat_id,
            model_id=model_id if not chatbot_id else None,
            chatbot_id=chatbot_id if not model_id else None,
            config=config
        )
        
        from app.services.chat.file_utils import build_extra_content
        extra_content = build_extra_content(query)
        
        ChatMessageService.create_user_message(
            chat_id=chat_id,
            user_content=user_text,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config,
            message_id=message_id,
            extra_content=extra_content
        )
        
        import time
        start_time = time.time()
        reasoning_end_time = None
        
        # 主循环：处理模型调用和工具调用
        while True:
            result = model.generate('', messages=messages, **model_params)
            
            if 'error' in result:
                return {'error': result['error'], 'chat_id': chat_id}
            
            full_response = result.get('text', '')
            full_reasoning = result.get('reasoning_content', '')
            tool_calls_list = result.get('tool_calls', [])
            
            # 检查是否需要调用工具
            if tool_calls_list and tool_map:
                messages.append({
                    'role': 'assistant',
                    'content': full_response,
                    'tool_calls': tool_calls_list
                })
                
                for tool_call in tool_calls_list:
                    function_name = tool_call.get('function', {}).get('name', '')
                    function_args_str = tool_call.get('function', {}).get('arguments', '{}')
                    tool_call_id = tool_call.get('id', '')
                    
                    try:
                        function_args = json.loads(function_args_str)
                    except json.JSONDecodeError:
                        tool_message_content = f"工具 {function_name} 调用失败: 参数解析错误"
                        messages.append({
                            'role': 'tool',
                            'tool_call_id': tool_call_id,
                            'content': tool_message_content
                        })
                        continue
                    
                    # 检查工具是否存在
                    tool_id = tool_map.get(function_name)
                    if not tool_id:
                        tool_message_content = f"工具 {function_name} 不存在"
                        messages.append({
                            'role': 'tool',
                            'tool_call_id': tool_call_id,
                            'content': tool_message_content
                        })
                        continue
                    
                    # 处理工具调用
                    tool_result = None
                    for result in process_tool_calls([tool_call], tool_map):
                        tool_result = result
                        break
                    
                    if tool_result:
                        if 'error' in tool_result:
                            # 检查是否是缺少参数的错误
                            error_msg = tool_result['error']
                            if '缺少' in error_msg or '参数' in error_msg:
                                # 等待用户输入参数
                                return {
                                    'tool_call': {
                                        'name': function_name,
                                        'status': 'requires_input',
                                        'message': f"工具 {function_name} 需要输入参数",
                                        'requires_input': True,
                                        'tool_call_id': tool_call_id,
                                        'function_args': function_args
                                    },
                                    'chat_id': chat_id
                                }
                            else:
                                tool_message_content = f"工具 {function_name} 调用失败: {error_msg}"
                                messages.append({
                                    'role': 'tool',
                                    'tool_call_id': tool_call_id,
                                    'content': tool_message_content
                                })
                        else:
                            tool_message_content = json.dumps(tool_result.get('result'), ensure_ascii=False)
                            # 保存工具消息到数据库
                            ChatMessageService.create_tool_message(
                                chat_id=chat_id,
                                tool_content=tool_message_content,
                                model_id=model_id,
                                chatbot_id=chatbot_id,
                                config=config
                            )
                            messages.append({
                                'role': 'tool',
                                'tool_call_id': tool_call_id,
                                'content': tool_message_content
                            })
            else:
                # 没有工具调用，退出循环
                break
        
        reasoning_time = None
        if full_reasoning:
            reasoning_time = int((time.time() - start_time) * 1000)
        
        assistant_message_dict = {'role': 'assistant', 'content': full_response}
        if full_reasoning:
            assistant_message_dict['reasoning_content'] = full_reasoning

        avatar = None
        if chatbot_id:
            try:
                chatbot = Chatbot.get(Chatbot.id == chatbot_id)
                avatar = chatbot.avatar
            except Chatbot.DoesNotExist:
                pass
        elif model_id:
            try:
                model = LLMModel.get(LLMModel.id == model_id)
                if model.provider:
                    avatar = f"/src/assets/llm/{model.provider.lower()}.png"
                else:
                    avatar = f"/src/assets/llm/default.png"
            except LLMModel.DoesNotExist:
                pass
        
        ChatMessageService.create_assistant_message(
            chat_id=chat_id,
            assistant_content=full_response,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config,
            reasoning_content=full_reasoning if full_reasoning else None,
            reasoning_time=reasoning_time,
            avatar=avatar
        )

        chat_messages = ChatMessageService.get_messages_by_chat(chat_id)
        updated_messages = []
        for i in range(len(messages)):
            if messages[i]['role'] != 'system':
                messages[i]['message_id'] = chat_messages.items[i].message_id
                messages[i]['reasoning_content'] = chat_messages.items[i].reasoning_content
            updated_messages.append(messages[i])
        # updated_messages = [{"role": msg.role, "content": msg.content , "reasoning_content": msg.reasoning_content , "message_id": msg.message_id} for msg in chat_messages.items if not msg.role != 'system']
        # system_message = messages[0] if messages else None
        # if system_message:
        #     updated_messages.insert(0, system_message)
        # updated_messages.append(assistant_message_dict)
        ChatService.update_messages(chat_id, updated_messages)

        return {
            'text': full_response,
            'reasoning_content': result.get('reasoning_content'),
            'usage': result.get('usage'),
            'chat_id': chat_id
        }
