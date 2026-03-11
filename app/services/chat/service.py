"""
聊天服务类，提供聊天相关的CRUD操作
"""

from app.database.models import Chat
from app.services.chat.dto import ChatCreate, ChatUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class ChatService:
    """
    聊天服务类
    
    提供聊天记录的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_chat(chat: ChatCreate):
        """
        创建聊天记录
        
        Args:
            chat: 聊天创建DTO
            
        Returns:
            Chat: 创建的聊天对象
        """
        db_chat = Chat(**chat.model_dump())
        db_chat.save(force_insert=True)
        return db_chat

    @staticmethod
    def get_chats(skip: int = 0, limit: int = 100):
        """
        获取聊天记录列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[Chat]: 聊天记录列表
        """
        return list(Chat.select().offset(skip).limit(limit))

    @staticmethod
    def get_chat(chat_id: int):
        """
        获取单个聊天记录
        
        Args:
            chat_id: 聊天ID
            
        Returns:
            Chat: 聊天对象，不存在则返回None
        """
        try:
            return Chat.get_by_id(chat_id)
        except Chat.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_chat(chat_id: int, chat: ChatUpdate):
        """
        更新聊天记录
        
        Args:
            chat_id: 聊天ID
            chat: 聊天更新DTO
            
        Returns:
            Chat: 更新后的聊天对象
            
        Raises:
            ResourceNotFoundError: 聊天记录不存在
        """
        try:
            db_chat = Chat.get_by_id(chat_id)
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"聊天记录 {chat_id} 不存在"
            )
        
        update_data = chat.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_chat, field, value)
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat

    @staticmethod
    @handle_transaction
    def delete_chat(chat_id: int):
        """
        删除聊天记录
        
        Args:
            chat_id: 聊天ID
            
        Returns:
            Chat: 被删除的聊天对象
            
        Raises:
            ResourceNotFoundError: 聊天记录不存在
        """
        try:
            db_chat = Chat.get_by_id(chat_id)
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"聊天记录 {chat_id} 不存在"
            )
        db_chat.delete_instance()
        return db_chat
