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
            'model_name': model.name,
            'provider': model.provider
        }
        
        if model.config:
            try:
                model_config = json.loads(model.config)
                config.update(model_config)
            except json.JSONDecodeError:
                pass
        
        return config, model.model_type
    
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
        config: Optional[str] = None
    ) -> Generator[Dict[str, Any], None, None]:
        """
        流式聊天
        
        Args:
            user_id: 用户ID
            query: 查询数组
            model_id: 模型ID
            chatbot_id: 机器人ID
            chat_id: 对话ID
            config: 配置JSON
            
        Yields:
            Dict: 流式响应数据
        """
        user_message = ChatCoreService.convert_query_to_message(query)
        user_text = ChatCoreService.extract_text_from_query(query)
        
        if not chat_id:
            title = user_text[:20] if len(user_text) > 20 else user_text
            chat = ChatService.create_chat(user_id, {
                'title': title,
                'model_id': model_id,
                'chatbot_id': chatbot_id,
                'config': config
            })
            chat_id = chat.id
            history_messages = []
            system_prompt = None
        else:
            chat = ChatService.get_chat(chat_id, user_id)
            if not chat:
                raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
            
            try:
                history_messages = json.loads(chat.messages) if chat.messages else []
            except json.JSONDecodeError:
                history_messages = []
            
            system_prompt = chat.system_prompt
        
        if chatbot_id and not system_prompt:
            system_prompt = ChatCoreService.get_chatbot_system_prompt(chatbot_id)
        
        if not model_id:
            if chat.model_id:
                model_id = chat.model_id
            else:
                yield {'error': '未指定模型', 'chat_id': chat_id}
                return
        
        model_config, model_type = ChatCoreService.get_model_config(model_id)
        model = LLMFactory.create_model(model_type, model_config)
        
        messages = ChatCoreService.build_messages(system_prompt, history_messages, user_message)
        
        model_params = {}
        if config:
            try:
                config_dict = json.loads(config)
                if 'temperature' in config_dict:
                    model_params['temperature'] = config_dict['temperature']
                if 'max_tokens' in config_dict:
                    model_params['max_tokens'] = config_dict['max_tokens']
                if 'top_p' in config_dict:
                    model_params['top_p'] = config_dict['top_p']
            except json.JSONDecodeError:
                pass
        
        full_response = ''
        reasoning_content = ''
        
        for chunk in model.stream_generate_with_messages(messages, **model_params):
            if 'error' in chunk:
                yield {'error': chunk['error'], 'chat_id': chat_id}
                return
            
            if chunk.get('text'):
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
        
        updated_messages = history_messages + [user_message, {'role': 'assistant', 'content': full_response}]
        ChatService.update_messages(chat_id, updated_messages)
        
        ChatMessageService.create_user_and_assistant_messages(
            chat_id=chat_id,
            user_content=json.dumps(user_message, ensure_ascii=False),
            assistant_content=full_response,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config
        )
    
    @staticmethod
    def chat(
        user_id: str,
        query: List[QueryItem],
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        chat_id: Optional[str] = None,
        config: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        非流式聊天
        
        Args:
            user_id: 用户ID
            query: 查询数组
            model_id: 模型ID
            chatbot_id: 机器人ID
            chat_id: 对话ID
            config: 配置JSON
            
        Returns:
            Dict: 响应数据
        """
        user_message = ChatCoreService.convert_query_to_message(query)
        user_text = ChatCoreService.extract_text_from_query(query)
        
        if not chat_id:
            title = user_text[:20] if len(user_text) > 20 else user_text
            chat = ChatService.create_chat(user_id, {
                'title': title,
                'model_id': model_id,
                'chatbot_id': chatbot_id,
                'config': config
            })
            chat_id = chat.id
            history_messages = []
            system_prompt = None
        else:
            chat = ChatService.get_chat(chat_id, user_id)
            if not chat:
                raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
            
            try:
                history_messages = json.loads(chat.messages) if chat.messages else []
            except json.JSONDecodeError:
                history_messages = []
            
            system_prompt = chat.system_prompt
        
        if chatbot_id and not system_prompt:
            system_prompt = ChatCoreService.get_chatbot_system_prompt(chatbot_id)
        
        if not model_id:
            if chat.model_id:
                model_id = chat.model_id
            else:
                return {'error': '未指定模型', 'chat_id': chat_id}
        
        model_config, model_type = ChatCoreService.get_model_config(model_id)
        model = LLMFactory.create_model(model_type, model_config)
        
        messages = ChatCoreService.build_messages(system_prompt, history_messages, user_message)
        
        model_params = {}
        if config:
            try:
                config_dict = json.loads(config)
                if 'temperature' in config_dict:
                    model_params['temperature'] = config_dict['temperature']
                if 'max_tokens' in config_dict:
                    model_params['max_tokens'] = config_dict['max_tokens']
                if 'top_p' in config_dict:
                    model_params['top_p'] = config_dict['top_p']
            except json.JSONDecodeError:
                pass
        
        result = model.generate('', messages=messages, **model_params)
        
        if 'error' in result:
            return {'error': result['error'], 'chat_id': chat_id}
        
        full_response = result.get('text', '')
        
        updated_messages = history_messages + [user_message, {'role': 'assistant', 'content': full_response}]
        ChatService.update_messages(chat_id, updated_messages)
        
        ChatMessageService.create_user_and_assistant_messages(
            chat_id=chat_id,
            user_content=json.dumps(user_message, ensure_ascii=False),
            assistant_content=full_response,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config
        )
        
        return {
            'text': full_response,
            'reasoning_content': result.get('reasoning_content'),
            'usage': result.get('usage'),
            'chat_id': chat_id
        }
