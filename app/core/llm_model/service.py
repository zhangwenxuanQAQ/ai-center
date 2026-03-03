from peewee import MySQLDatabase
from app.database.models import LLMModel
from app.core.llm_model.dto import LLMModelCreate, LLMModelUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class LLMModelService:
    @staticmethod
    @handle_transaction
    def create_llm_model(db: MySQLDatabase, llm_model: LLMModelCreate):
        """创建LLM模型"""
        db_llm_model = LLMModel(**llm_model.model_dump())
        db_llm_model.save()
        return db_llm_model

    @staticmethod
    def get_llm_models(db: MySQLDatabase, skip: int = 0, limit: int = 100):
        """获取LLM模型列表（只读操作，不需要事务）"""
        return list(LLMModel.select().offset(skip).limit(limit))

    @staticmethod
    def get_llm_model(db: MySQLDatabase, llm_model_id: int):
        """获取单个LLM模型（只读操作，不需要事务）"""
        try:
            return LLMModel.get_by_id(llm_model_id)
        except LLMModel.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_llm_model(db: MySQLDatabase, llm_model_id: int, llm_model: LLMModelUpdate):
        """更新LLM模型"""
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
    def delete_llm_model(db: MySQLDatabase, llm_model_id: int):
        """删除LLM模型"""
        try:
            db_llm_model = LLMModel.get_by_id(llm_model_id)
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"LLM模型 {llm_model_id} 不存在"
            )
        db_llm_model.delete_instance()
        return db_llm_model