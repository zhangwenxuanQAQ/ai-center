from peewee import MySQLDatabase
from app.database.models import Chat
from app.core.chat.dto import ChatCreate, ChatUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class ChatService:
    @staticmethod
    @handle_transaction
    def create_chat(db: MySQLDatabase, chat: ChatCreate):
        """创建聊天记录"""
        db_chat = Chat(**chat.model_dump())
        db_chat.save()
        return db_chat

    @staticmethod
    def get_chats(db: MySQLDatabase, skip: int = 0, limit: int = 100):
        """获取聊天记录列表（只读操作，不需要事务）"""
        return list(Chat.select().offset(skip).limit(limit))

    @staticmethod
    def get_chat(db: MySQLDatabase, chat_id: int):
        """获取单个聊天记录（只读操作，不需要事务）"""
        try:
            return Chat.get_by_id(chat_id)
        except Chat.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_chat(db: MySQLDatabase, chat_id: int, chat: ChatUpdate):
        """更新聊天记录"""
        try:
            db_chat = Chat.get_by_id(chat_id)
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"聊天记录 {chat_id} 不存在"
            )
        update_data = chat.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_chat, field, value)
        db_chat.save()
        return db_chat

    @staticmethod
    @handle_transaction
    def delete_chat(db: MySQLDatabase, chat_id: int):
        """删除聊天记录"""
        try:
            db_chat = Chat.get_by_id(chat_id)
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"聊天记录 {chat_id} 不存在"
            )
        db_chat.delete_instance()
        return db_chat