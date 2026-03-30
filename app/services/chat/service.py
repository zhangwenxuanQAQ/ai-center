"""
对话服务类，提供对话相关的CRUD操作
"""

import uuid
import json
from datetime import datetime
from typing import List, Optional, Tuple
from peewee import fn

from app.database.models import Chat, ChatMessage
from app.services.chat.dto import (
    ChatCreate, ChatUpdate, Chat as ChatDTO,
    ChatMessageCreate, ChatMessage as ChatMessageDTO,
    ChatListResponse, ChatMessageListResponse
)
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class ChatService:
    """
    对话服务类
    
    提供对话的创建、查询、更新、删除、置顶、排序等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_chat(user_id: str, chat_create: ChatCreate) -> Chat:
        """
        创建对话
        
        Args:
            user_id: 用户ID
            chat_create: 对话创建DTO
            
        Returns:
            Chat: 创建的对话对象
        """
        import json
        db_chat = Chat(
            user_id=user_id,
            title=chat_create.title,
            model_id=chat_create.model_id,
            chatbot_id=chat_create.chatbot_id,
            config=json.dumps(chat_create.config) if chat_create.config else None,
            system_prompt=chat_create.system_prompt,
            messages='[]'
        )
        db_chat.save(force_insert=True)
        return db_chat
    
    @staticmethod
    def get_chat_list(
        user_id: str,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None
    ) -> ChatListResponse:
        """
        获取用户的对话列表（分页）
        
        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页数量
            keyword: 搜索关键词
            
        Returns:
            ChatListResponse: 对话列表响应
        """
        query = Chat.select().where(
            (Chat.user_id == user_id) & 
            (Chat.deleted == False)
        )
        
        if keyword:
            query = query.where(Chat.title.contains(keyword))
        
        total = query.count()
        
        chats = query.order_by(
            Chat.is_top.desc(),
            Chat.sort_order.desc(),
            Chat.updated_at.desc()
        ).offset((page - 1) * page_size).limit(page_size)
        
        items = [ChatDTO.model_validate(chat) for chat in chats]
        
        return ChatListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size
        )
    
    @staticmethod
    def get_chat(chat_id: str, user_id: str) -> Optional[Chat]:
        """
        获取单个对话
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            
        Returns:
            Chat: 对话对象，不存在则返回None
        """
        try:
            return Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_chat(chat_id: str, user_id: str, chat_update: ChatUpdate) -> Chat:
        """
        更新对话
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            chat_update: 对话更新DTO
            
        Returns:
            Chat: 更新后的对话对象
            
        Raises:
            ResourceNotFoundError: 对话不存在
        """
        try:
            db_chat = Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        import json
        update_data = chat_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == 'config' and value:
                setattr(db_chat, field, json.dumps(value))
            else:
                setattr(db_chat, field, value)
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def delete_chat(chat_id: str, user_id: str) -> Chat:
        """
        删除对话（软删除）
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            
        Returns:
            Chat: 被删除的对话对象
            
        Raises:
            ResourceNotFoundError: 对话不存在
        """
        try:
            db_chat = Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        db_chat.deleted = True
        db_chat.deleted_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def toggle_top(chat_id: str, user_id: str) -> Chat:
        """
        切换对话置顶状态
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            
        Returns:
            Chat: 更新后的对话对象
            
        Raises:
            ResourceNotFoundError: 对话不存在
        """
        try:
            db_chat = Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        db_chat.is_top = not db_chat.is_top
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def update_sort_order(chat_id: str, user_id: str, sort_order: int) -> Chat:
        """
        更新对话排序序号
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            sort_order: 排序序号
            
        Returns:
            Chat: 更新后的对话对象
            
        Raises:
            ResourceNotFoundError: 对话不存在
        """
        try:
            db_chat = Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        db_chat.sort_order = sort_order
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def update_messages(chat_id: str, messages: List[dict]) -> Chat:
        """
        更新对话消息列表
        
        Args:
            chat_id: 对话ID
            messages: 消息列表
            
        Returns:
            Chat: 更新后的对话对象
        """
        try:
            db_chat = Chat.get(Chat.id == chat_id)
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        db_chat.messages = json.dumps(messages, ensure_ascii=False)
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat


class ChatMessageService:
    """
    对话消息服务类
    
    提供对话消息的创建、查询等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_message(message_create: ChatMessageCreate) -> ChatMessage:
        """
        创建对话消息
        
        Args:
            message_create: 消息创建DTO
            
        Returns:
            ChatMessage: 创建的消息对象
        """
        db_message = ChatMessage(**message_create.model_dump())
        db_message.save(force_insert=True)
        return db_message
    
    @staticmethod
    def get_messages_by_chat(chat_id: str) -> ChatMessageListResponse:
        """
        获取对话的消息列表
        
        Args:
            chat_id: 对话ID
            
        Returns:
            ChatMessageListResponse: 消息列表响应
        """
        messages = ChatMessage.select().where(
            (ChatMessage.chat_id == chat_id) & 
            (ChatMessage.deleted == False)
        ).order_by(ChatMessage.created_at.asc())
        
        total = messages.count()
        items = [ChatMessageDTO.model_validate(msg) for msg in messages]
        
        return ChatMessageListResponse(items=items, total=total)
    
    @staticmethod
    @handle_transaction
    def create_user_and_assistant_messages(
        chat_id: str,
        user_content: str,
        assistant_content: str,
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        config: Optional[str] = None
    ) -> Tuple[ChatMessage, ChatMessage]:
        """
        创建用户消息和助手消息
        
        Args:
            chat_id: 对话ID
            user_content: 用户消息内容
            assistant_content: 助手消息内容
            model_id: 模型ID
            chatbot_id: 机器人ID
            config: 配置JSON
            
        Returns:
            Tuple[ChatMessage, ChatMessage]: 用户消息和助手消息
        """
        user_message = ChatMessage(
            message_id=uuid.uuid4().hex,
            chat_id=chat_id,
            config=config,
            role='user',
            content=user_content,
            model_id=model_id,
            chatbot_id=chatbot_id
        )
        user_message.save(force_insert=True)
        
        assistant_message = ChatMessage(
            message_id=uuid.uuid4().hex,
            chat_id=chat_id,
            config=config,
            role='assistant',
            content=assistant_content,
            model_id=model_id,
            chatbot_id=chatbot_id
        )
        assistant_message.save(force_insert=True)
        
        return user_message, assistant_message
