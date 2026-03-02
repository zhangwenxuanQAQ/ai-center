from sqlalchemy.orm import Session
from app.database.models import Chatbot
from app.core.chatbot.dto import ChatbotCreate, ChatbotUpdate

class ChatbotService:
    @staticmethod
    def create_chatbot(db: Session, chatbot: ChatbotCreate):
        db_chatbot = Chatbot(**chatbot.model_dump())
        db.add(db_chatbot)
        db.commit()
        db.refresh(db_chatbot)
        return db_chatbot

    @staticmethod
    def get_chatbots(db: Session, skip: int = 0, limit: int = 100):
        return db.query(Chatbot).offset(skip).limit(limit).all()

    @staticmethod
    def get_chatbot(db: Session, chatbot_id: int):
        return db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()

    @staticmethod
    def update_chatbot(db: Session, chatbot_id: int, chatbot: ChatbotUpdate):
        db_chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if db_chatbot:
            update_data = chatbot.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_chatbot, field, value)
            db.commit()
            db.refresh(db_chatbot)
        return db_chatbot

    @staticmethod
    def delete_chatbot(db: Session, chatbot_id: int):
        db_chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if db_chatbot:
            db.delete(db_chatbot)
            db.commit()
        return db_chatbot