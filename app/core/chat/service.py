from sqlalchemy.orm import Session
from app.database.models import Chat
from app.core.chat.dto import ChatCreate, ChatUpdate

class ChatService:
    @staticmethod
    def create_chat(db: Session, chat: ChatCreate):
        db_chat = Chat(**chat.model_dump())
        db.add(db_chat)
        db.commit()
        db.refresh(db_chat)
        return db_chat

    @staticmethod
    def get_chats(db: Session, skip: int = 0, limit: int = 100):
        return db.query(Chat).offset(skip).limit(limit).all()

    @staticmethod
    def get_chat(db: Session, chat_id: int):
        return db.query(Chat).filter(Chat.id == chat_id).first()

    @staticmethod
    def update_chat(db: Session, chat_id: int, chat: ChatUpdate):
        db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if db_chat:
            update_data = chat.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_chat, field, value)
            db.commit()
            db.refresh(db_chat)
        return db_chat

    @staticmethod
    def delete_chat(db: Session, chat_id: int):
        db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if db_chat:
            db.delete(db_chat)
            db.commit()
        return db_chat