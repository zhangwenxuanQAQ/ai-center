"""
聊天核心服务

处理聊天逻辑，包括消息转换、模型调用等
"""

import json
import uuid
import base64
from typing import List, Dict, Any, Optional, Generator, Tuple

from app.database.models import Chat, ChatMessage, LLMModel, Chatbot
from app.services.chat.dto import QueryItem
from app.services.chat.service import ChatService, ChatMessageService
from app.core.llm_model.factory import LLMFactory
from app.core.exceptions import ResourceNotFoundError


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
        has_image = any(item.type == 'file_base64' and item.mime_type and item.mime_type.startswith('image/') for item in query)
        
        if has_image:
            content = []
            for item in query:
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
            text_content = ' '.join(item.content for item in query if item.type == 'text')
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
    def build_messages(
        system_prompt: Optional[str],
        history_messages: List[Dict],
        user_message: Dict
    ) -> List[Dict]:
        """
        构建完整的消息列表
        
        Args:
            system_prompt: 系统提示词
            history_messages: 历史消息
            user_message: 用户消息
            
        Returns:
            List[Dict]: 完整的消息列表
        """
        messages = []
        
        if system_prompt:
            messages.append({
                'role': 'system',
                'content': system_prompt
            })
        
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
        
        if not chat_id:
            title = user_text[:20] if len(user_text) > 20 else user_text
            chat = ChatService.create_chat(user_id, {
                'title': title,
                'model_id': model_id,
                'chatbot_id': chatbot_id,
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

        if chatbot_id and not system_prompt:
            system_prompt = ChatCoreService.get_chatbot_system_prompt(chatbot_id)
        
        if not model_id:
            if chat.model_id:
                model_id = chat.model_id
            else:
                yield {'error': '未指定模型', 'chat_id': chat_id}
                return
        
        model_config, llm_config , model_type = ChatCoreService.get_model_config(model_id)
        model = LLMFactory.create_model(model_type, model_config)
        
        messages = ChatCoreService.build_messages(system_prompt, history_messages, user_message)
        
        model_params = {}
        if llm_config:
            model_params.update(llm_config)
        if config_dict:
            model_params.update(config_dict)
        
        ChatService.update_chat_config(
            chat_id=chat_id,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config
        )
        
        ChatMessageService.create_user_message(
            chat_id=chat_id,
            user_content=user_text,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config,
            message_id=message_id
        )
        
        import time
        start_time = time.time()
        reasoning_end_time = None
        
        full_response = ''
        reasoning_content = ''
        
        for chunk in model.stream_generate_with_messages(messages, **model_params):
            if 'error' in chunk:
                yield {'error': chunk['error'], 'chat_id': chat_id}
                return
            
            if chunk.get('text'):
                if reasoning_end_time is None and reasoning_content:
                    reasoning_end_time = time.time()
                full_response += chunk['text']
            
            if chunk.get('reasoning_content'):
                reasoning_content += chunk['reasoning_content']
            
            yield {
                'text': chunk.get('text', ''),
                'reasoning_content': chunk.get('reasoning_content'),
                'finish_reason': chunk.get('finish_reason'),
                'usage': chunk.get('usage'),
                'chat_id': chat_id
            }
        
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

        chat_messages = ChatMessageService.get_messages_by_chat(chat_id) # 最新的历史消息
        updated_messages = [{"role": msg.role, "content": msg.content , "reasoning_content": msg.reasoning_content , "message_id": msg.message_id} for msg in chat_messages.items]
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
        
        if not chat_id:
            title = user_text[:20] if len(user_text) > 20 else user_text
            chat = ChatService.create_chat(user_id, {
                'title': title,
                'model_id': model_id,
                'chatbot_id': chatbot_id,
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
        
        if chatbot_id and not system_prompt:
            system_prompt = ChatCoreService.get_chatbot_system_prompt(chatbot_id)
        
        if not model_id:
            if chat.model_id:
                model_id = chat.model_id
            else:
                return {'error': '未指定模型', 'chat_id': chat_id}
        
        model_config, llm_config, model_type = ChatCoreService.get_model_config(model_id)
        model = LLMFactory.create_model(model_type, model_config)
        
        messages = ChatCoreService.build_messages(system_prompt, history_messages, user_message)
        
        model_params = {}
        if llm_config:
            model_params.update(llm_config)
        if config_dict:
            model_params.update(config_dict)
        
        ChatService.update_chat_config(
            chat_id=chat_id,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config
        )
        
        ChatMessageService.create_user_message(
            chat_id=chat_id,
            user_content=user_text,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config,
            message_id=message_id
        )
        
        import time
        start_time = time.time()
        
        result = model.generate('', messages=messages, **model_params)
        
        if 'error' in result:
            return {'error': result['error'], 'chat_id': chat_id}
        
        full_response = result.get('text', '')
        full_reasoning = result.get('reasoning_content', '')
        
        reasoning_time = None
        if full_reasoning:
            reasoning_time = int((time.time() - start_time) * 1000)
        
        assistant_message_dict = {'role': 'assistant', 'content': full_response}
        if full_reasoning:
            assistant_message_dict['reasoning_content'] = full_reasoning

        updated_messages = history_messages + [user_message, assistant_message_dict]
        ChatService.update_messages(chat_id, updated_messages)
        
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

        chat_messages = ChatMessageService.get_messages_by_chat(chat_id) # 最新的历史消息
        updated_messages = [{"role": msg.role, "content": msg.content , "reasoning_content": msg.reasoning_content , "message_id": msg.message_id} for msg in chat_messages.items]
        
        return {
            'text': full_response,
            'reasoning_content': result.get('reasoning_content'),
            'usage': result.get('usage'),
            'chat_id': chat_id
        }
