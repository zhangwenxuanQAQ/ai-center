from sqlalchemy.orm import Session
from app.database.models import Knowledge
from app.core.knowledge.dto import KnowledgeCreate, KnowledgeUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class KnowledgeService:
    @staticmethod
    @handle_transaction
    def create_knowledge(db: Session, knowledge: KnowledgeCreate):
        """创建知识库"""
        db_knowledge = Knowledge(**knowledge.model_dump())
        db.add(db_knowledge)
        db.refresh(db_knowledge)
        return db_knowledge

    @staticmethod
    def get_knowledges(db: Session, skip: int = 0, limit: int = 100):
        """获取知识库列表（只读操作，不需要事务）"""
        return db.query(Knowledge).offset(skip).limit(limit).all()

    @staticmethod
    def get_knowledge(db: Session, knowledge_id: int):
        """获取单个知识库（只读操作，不需要事务）"""
        return db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()

    @staticmethod
    @handle_transaction
    def update_knowledge(db: Session, knowledge_id: int, knowledge: KnowledgeUpdate):
        """更新知识库"""
        db_knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
        if not db_knowledge:
            raise ResourceNotFoundError(
                message=f"知识库 {knowledge_id} 不存在"
            )
        update_data = knowledge.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_knowledge, field, value)
        db.refresh(db_knowledge)
        return db_knowledge

    @staticmethod
    @handle_transaction
    def delete_knowledge(db: Session, knowledge_id: int):
        """删除知识库"""
        db_knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
        if not db_knowledge:
            raise ResourceNotFoundError(
                message=f"知识库 {knowledge_id} 不存在"
            )
        db.delete(db_knowledge)
        return db_knowledge