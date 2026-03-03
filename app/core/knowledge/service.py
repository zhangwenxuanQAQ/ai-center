from peewee import MySQLDatabase
from app.database.models import Knowledge
from app.core.knowledge.dto import KnowledgeCreate, KnowledgeUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class KnowledgeService:
    @staticmethod
    @handle_transaction
    def create_knowledge(db: MySQLDatabase, knowledge: KnowledgeCreate):
        """创建知识库"""
        db_knowledge = Knowledge(**knowledge.model_dump())
        db_knowledge.save()
        return db_knowledge

    @staticmethod
    def get_knowledges(db: MySQLDatabase, skip: int = 0, limit: int = 100):
        """获取知识库列表（只读操作，不需要事务）"""
        return list(Knowledge.select().offset(skip).limit(limit))

    @staticmethod
    def get_knowledge(db: MySQLDatabase, knowledge_id: int):
        """获取单个知识库（只读操作，不需要事务）"""
        try:
            return Knowledge.get_by_id(knowledge_id)
        except Knowledge.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_knowledge(db: MySQLDatabase, knowledge_id: int, knowledge: KnowledgeUpdate):
        """更新知识库"""
        try:
            db_knowledge = Knowledge.get_by_id(knowledge_id)
        except Knowledge.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"知识库 {knowledge_id} 不存在"
            )
        update_data = knowledge.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_knowledge, field, value)
        db_knowledge.save()
        return db_knowledge

    @staticmethod
    @handle_transaction
    def delete_knowledge(db: MySQLDatabase, knowledge_id: int):
        """删除知识库"""
        try:
            db_knowledge = Knowledge.get_by_id(knowledge_id)
        except Knowledge.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"知识库 {knowledge_id} 不存在"
            )
        db_knowledge.delete_instance()
        return db_knowledge