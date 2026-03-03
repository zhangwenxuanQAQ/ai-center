from sqlalchemy.orm import Session
from app.database.models import Chatbot
from app.core.chatbot.dto import ChatbotCreate, ChatbotUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class ChatbotService:
    @staticmethod
    @handle_transaction
    def create_chatbot(db: Session, chatbot: ChatbotCreate):
        """创建聊天机器人"""
        db_chatbot = Chatbot(**chatbot.model_dump())
        db.add(db_chatbot)
        db.refresh(db_chatbot)
        return db_chatbot

    @staticmethod
    def get_chatbots(db: Session, skip: int = 0, limit: int = 100):
        """获取聊天机器人列表（只读操作，不需要事务）"""
        return db.query(Chatbot).offset(skip).limit(limit).all()

    @staticmethod
    def get_chatbot(db: Session, chatbot_id: int):
        """获取单个聊天机器人（只读操作，不需要事务）"""
        return db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()

    @staticmethod
    @handle_transaction
    def update_chatbot(db: Session, chatbot_id: int, chatbot: ChatbotUpdate):
        """更新聊天机器人"""
        db_chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not db_chatbot:
            raise ResourceNotFoundError(
                message=f"聊天机器人 {chatbot_id} 不存在"
            )
        update_data = chatbot.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_chatbot, field, value)
        db.refresh(db_chatbot)
        return db_chatbot

    @staticmethod
    @handle_transaction
    def delete_chatbot(db: Session, chatbot_id: int):
        """删除聊天机器人"""
        db_chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not db_chatbot:
            raise ResourceNotFoundError(
                message=f"聊天机器人 {chatbot_id} 不存在"
            )
        db.delete(db_chatbot)
        return db_chatbot