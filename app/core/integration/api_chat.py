"""
插件集成聊天核心服务

处理通过API密钥调用的聊天逻辑
"""

import json
import uuid
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator

from app.database.models import ChatbotIntegration, ChatbotChat, ChatbotChatMessage, Chat
from app.services.chat.dto import QueryItem
from app.core.chat.chat_service import ChatCoreService
from app.services.chat.service import ChatService, ChatMessageService
from app.core.exceptions import ResourceNotFoundError

logger = logging.getLogger(__name__)


class IntegrationChatCoreService:
    """
    插件集成聊天核心服务
    
    处理通过API密钥调用的聊天逻辑，复用现有的ChatCoreService
    """
    
    @staticmethod
    async def chat_stream(
        query: List[QueryItem],
        chat_id: Optional[str],
        integration: ChatbotIntegration,
        stream: bool = True,
        temporary: bool = False,
        deep_thinking: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式聊天

        复用现有的ChatCoreService.chat_stream，并在完成后同步到ChatbotChat表

        Args:
            query: 查询数组
            chat_id: 对话ID（可选）
            integration: 集成配置对象
            stream: 是否流式输出
            temporary: 临时会话模式，不保存对话和消息到数据库
            deep_thinking: 是否启用深度思考

        Yields:
            Dict: 流式响应数据
        """
        chatbot_id = integration.chatbot_id

        # 临时会话模式：不保存到数据库，直接调用ChatCoreService
        if temporary:
            async for chunk in ChatCoreService.chat_stream(
                user_id=f"integration_{integration.id}",
                query=query,
                model_id=None,
                chatbot_id=chatbot_id,
                chat_id=None,
                config=None,
                message_id=None,
                system_prompt=None,
                deep_thinking=deep_thinking
            ):
                yield chunk
            return
        
        # 获取或创建ChatbotChat记录
        bot_chat = None
        if chat_id:
            # 尝试查找已有的ChatbotChat
            try:
                bot_chat = ChatbotChat.get(
                    (ChatbotChat.id == chat_id) &
                    (ChatbotChat.integration_id == integration.id) &
                    (ChatbotChat.chatbot_id == chatbot_id)
                )
            except ChatbotChat.DoesNotExist:
                bot_chat = None
        
        if not bot_chat:
            # 创建新的ChatbotChat
            bot_chat = ChatbotChat(
                integration_id=integration.id,
                chatbot_id=chatbot_id,
                messages="[]"
            )
            bot_chat.save(force_insert=True)
        
        actual_chat_id = bot_chat.id
        
        # 检查是否已有对应的Chat记录（通过chat_id关联）
        internal_chat = None
        try:
            internal_chat = Chat.get(
                (Chat.id == actual_chat_id) &
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            pass
        
        # 提取用户文本
        user_text = ""
        for q in query:
            if q.type == "text":
                user_text += str(q.content)
        
        # 保存用户消息到ChatbotChatMessage
        user_message_id = uuid.uuid4().hex
        try:
            ChatbotChatMessage(
                chatbot_id=chatbot_id,
                chat_id=actual_chat_id,
                message_id=user_message_id,
                role='user',
                content=user_text,
                model_id=None
            ).save(force_insert=True)
        except Exception as e:
            logger.error(f"保存用户消息到ChatbotChatMessage失败: {e}")
        
        # 调用现有的chat_stream
        async for chunk in ChatCoreService.chat_stream(
            user_id=f"integration_{integration.id}",
            query=query,
            model_id=None,
            chatbot_id=chatbot_id,
            chat_id=actual_chat_id if internal_chat else None,
            config=None,
            message_id=None,
            system_prompt=None,
            deep_thinking=deep_thinking
        ):
            # 确保返回的chat_id是ChatbotChat的id
            chunk['chat_id'] = actual_chat_id
            
            # 保存助手消息到ChatbotChatMessage（流式完成时）
            if chunk.get('status') == 'done' and chunk.get('content'):
                try:
                    ChatbotChatMessage(
                        chatbot_id=chatbot_id,
                        chat_id=actual_chat_id,
                        message_id=chunk.get('message_id', uuid.uuid4().hex),
                        role='assistant',
                        content=chunk['content'],
                        reasoning_content=chunk.get('reasoning_content'),
                        reasoning_time=chunk.get('reasoning_time'),
                        model_id=chunk.get('model_id')
                    ).save(force_insert=True)
                except Exception as e:
                    logger.error(f"保存助手消息到ChatbotChatMessage失败: {e}")
            
            yield chunk
        
        # 更新ChatbotChat的messages摘要
        try:
            messages = list(ChatbotChatMessage.select().where(
                ChatbotChatMessage.chat_id == actual_chat_id
            ).order_by(ChatbotChatMessage.created_at))
            
            messages_summary = []
            for msg in messages:
                messages_summary.append({
                    "role": msg.role,
                    "content": msg.content[:200] if len(msg.content) > 200 else msg.content,
                    "message_id": msg.message_id,
                    "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S") if msg.created_at else None
                })
            
            bot_chat.messages = json.dumps(messages_summary)
            bot_chat.save()
        except Exception as e:
            logger.error(f"更新ChatbotChat messages失败: {e}")
    
    @staticmethod
    async def chat(
        query: List[QueryItem],
        chat_id: Optional[str],
        integration: ChatbotIntegration,
        temporary: bool = False,
        deep_thinking: bool = False
    ) -> Dict[str, Any]:
        """
        非流式聊天

        Args:
            query: 查询数组
            chat_id: 对话ID（可选）
            integration: 集成配置对象
            temporary: 临时会话模式
            deep_thinking: 是否启用深度思考

        Returns:
            Dict: 聊天结果
        """
        result = {}
        async for chunk in IntegrationChatCoreService.chat_stream(
            query=query,
            chat_id=chat_id,
            integration=integration,
            stream=False,
            temporary=temporary,
            deep_thinking=deep_thinking
        ):
            if chunk.get('status') == 'done':
                result = chunk
            elif chunk.get('error'):
                return {"error": chunk['error']}
            # 记录chat_id
            if chunk.get('chat_id'):
                result['chat_id'] = chunk['chat_id']

        return result
    
    @staticmethod
    def get_chat_messages(chat_id: str, integration: ChatbotIntegration) -> Dict[str, Any]:
        """
        获取聊天记录
        
        Args:
            chat_id: 聊天ID
            integration: 集成配置对象
            
        Returns:
            Dict: 包含items和total的字典
        """
        # 验证chat属于当前integration
        try:
            bot_chat = ChatbotChat.get(
                (ChatbotChat.id == chat_id) &
                (ChatbotChat.integration_id == integration.id)
            )
        except ChatbotChat.DoesNotExist:
            raise ResourceNotFoundError("对话不存在")
        
        # 查询消息列表
        messages = ChatbotChatMessage.select().where(
            ChatbotChatMessage.chat_id == chat_id
        ).order_by(ChatbotChatMessage.created_at)
        
        items = []
        for msg in messages:
            items.append({
                "id": msg.id,
                "chatbot_id": msg.chatbot_id,
                "chat_id": msg.chat_id,
                "message_id": msg.message_id,
                "role": msg.role,
                "content": msg.content,
                "extra_content": msg.extra_content,
                "reasoning_content": msg.reasoning_content,
                "reasoning_time": msg.reasoning_time,
                "model_id": msg.model_id,
                "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S") if msg.created_at else None,
                "updated_at": msg.updated_at.strftime("%Y-%m-%d %H:%M:%S") if msg.updated_at else None
            })
        
        return {
            "items": items,
            "total": len(items)
        }
