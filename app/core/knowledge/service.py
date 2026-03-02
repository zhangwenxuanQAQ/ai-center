from sqlalchemy.orm import Session
from app.database.models import Knowledge
from app.core.knowledge.dto import KnowledgeCreate, KnowledgeUpdate

class KnowledgeService:
    @staticmethod
    def create_knowledge(db: Session, knowledge: KnowledgeCreate):
        db_knowledge = Knowledge(**knowledge.model_dump())
        db.add(db_knowledge)
        db.commit()
        db.refresh(db_knowledge)
        return db_knowledge

    @staticmethod
    def get_knowledges(db: Session, skip: int = 0, limit: int = 100):
        return db.query(Knowledge).offset(skip).limit(limit).all()

    @staticmethod
    def get_knowledge(db: Session, knowledge_id: int):
        return db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()

    @staticmethod
    def update_knowledge(db: Session, knowledge_id: int, knowledge: KnowledgeUpdate):
        db_knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
        if db_knowledge:
            update_data = knowledge.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_knowledge, field, value)
            db.commit()
            db.refresh(db_knowledge)
        return db_knowledge

    @staticmethod
    def delete_knowledge(db: Session, knowledge_id: int):
        db_knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
        if db_knowledge:
            db.delete(db_knowledge)
            db.commit()
        return db_knowledge