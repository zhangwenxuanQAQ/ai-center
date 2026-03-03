from sqlalchemy.orm import Session
from app.database.models import Chat
from app.core.chat.dto import ChatCreate, ChatUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class ChatService:
    @staticmethod
    @handle_transaction
    def create_chat(db: Session, chat: ChatCreate):
        """创建聊天会话"""
        db_chat = Chat(**chat.model_dump())
        db.add(db_chat)
        db.refresh(db_chat)
        return db_chat

    @staticmethod
    def get_chats(db: Session, skip: int = 0, limit: int = 100):
        """获取聊天会话列表（只读操作，不需要事务）"""
        return db.query(Chat).offset(skip).limit(limit).all()

    @staticmethod
    def get_chat(db: Session, chat_id: int):
        """获取单个聊天会话（只读操作，不需要事务）"""
        return db.query(Chat).filter(Chat.id == chat_id).first()

    @staticmethod
    @handle_transaction
    def update_chat(db: Session, chat_id: int, chat: ChatUpdate):
        """更新聊天会话"""
        db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not db_chat:
            raise ResourceNotFoundError(
                message=f"聊天会话 {chat_id} 不存在"
            )
        update_data = chat.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_chat, field, value)
        db.refresh(db_chat)
        return db_chat

    @staticmethod
    @handle_transaction
    def delete_chat(db: Session, chat_id: int):
        """删除聊天会话"""
        db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not db_chat:
            raise ResourceNotFoundError(
                message=f"聊天会话 {chat_id} 不存在"
            )
        db.delete(db_chat)
        return db_chat