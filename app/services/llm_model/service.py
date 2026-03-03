"""
LLM模型服务类，提供LLM模型相关的CRUD操作
"""

from app.database.models import LLMModel
from app.services.llm_model.dto import LLMModelCreate, LLMModelUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class LLMModelService:
    """
    LLM模型服务类
    
    提供LLM模型的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_llm_model(llm_model: LLMModelCreate):
        """
        创建LLM模型
        
        Args:
            llm_model: LLM模型创建DTO
            
        Returns:
            LLMModel: 创建的LLM模型对象
        """
        db_llm_model = LLMModel(**llm_model.model_dump())
        db_llm_model.save()
        return db_llm_model

    @staticmethod
    def get_llm_models(skip: int = 0, limit: int = 100):
        """
        获取LLM模型列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[LLMModel]: LLM模型列表
        """
        return list(LLMModel.select().offset(skip).limit(limit))

    @staticmethod
    def get_llm_model(llm_model_id: int):
        """
        获取单个LLM模型
        
        Args:
            llm_model_id: LLM模型ID
            
        Returns:
            LLMModel: LLM模型对象，不存在则返回None
        """
        try:
            return LLMModel.get_by_id(llm_model_id)
        except LLMModel.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_llm_model(llm_model_id: int, llm_model: LLMModelUpdate):
        """
        更新LLM模型
        
        Args:
            llm_model_id: LLM模型ID
            llm_model: LLM模型更新DTO
            
        Returns:
            LLMModel: 更新后的LLM模型对象
            
        Raises:
            ResourceNotFoundError: LLM模型不存在
        """
        try:
            db_llm_model = LLMModel.get_by_id(llm_model_id)
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"LLM模型 {llm_model_id} 不存在"
            )
        update_data = llm_model.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_llm_model, field, value)
        db_llm_model.save()
        return db_llm_model

    @staticmethod
    @handle_transaction
    def delete_llm_model(llm_model_id: int):
        """
        删除LLM模型
        
        Args:
            llm_model_id: LLM模型ID
            
        Returns:
            LLMModel: 被删除的LLM模型对象
            
        Raises:
            ResourceNotFoundError: LLM模型不存在
        """
        try:
            db_llm_model = LLMModel.get_by_id(llm_model_id)
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"LLM模型 {llm_model_id} 不存在"
            )
        db_llm_model.delete_instance()
        return db_llm_model
