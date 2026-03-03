"""
知识库服务类，提供知识库相关的CRUD操作
"""

from app.database.models import Knowledge
from app.services.knowledge.dto import KnowledgeCreate, KnowledgeUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class KnowledgeService:
    """
    知识库服务类
    
    提供知识库的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_knowledge(knowledge: KnowledgeCreate):
        """
        创建知识库
        
        Args:
            knowledge: 知识库创建DTO
            
        Returns:
            Knowledge: 创建的知识库对象
        """
        db_knowledge = Knowledge(**knowledge.model_dump())
        db_knowledge.save()
        return db_knowledge

    @staticmethod
    def get_knowledges(skip: int = 0, limit: int = 100):
        """
        获取知识库列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[Knowledge]: 知识库列表
        """
        return list(Knowledge.select().offset(skip).limit(limit))

    @staticmethod
    def get_knowledge(knowledge_id: int):
        """
        获取单个知识库
        
        Args:
            knowledge_id: 知识库ID
            
        Returns:
            Knowledge: 知识库对象，不存在则返回None
        """
        try:
            return Knowledge.get_by_id(knowledge_id)
        except Knowledge.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_knowledge(knowledge_id: int, knowledge: KnowledgeUpdate):
        """
        更新知识库
        
        Args:
            knowledge_id: 知识库ID
            knowledge: 知识库更新DTO
            
        Returns:
            Knowledge: 更新后的知识库对象
            
        Raises:
            ResourceNotFoundError: 知识库不存在
        """
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
    def delete_knowledge(knowledge_id: int):
        """
        删除知识库
        
        Args:
            knowledge_id: 知识库ID
            
        Returns:
            Knowledge: 被删除的知识库对象
            
        Raises:
            ResourceNotFoundError: 知识库不存在
        """
        try:
            db_knowledge = Knowledge.get_by_id(knowledge_id)
        except Knowledge.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"知识库 {knowledge_id} 不存在"
            )
        db_knowledge.delete_instance()
        return db_knowledge
