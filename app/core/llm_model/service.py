from sqlalchemy.orm import Session
from app.database.models import LLMModel
from app.core.llm_model.dto import LLMModelCreate, LLMModelUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class LLMModelService:
    @staticmethod
    @handle_transaction
    def create_llm_model(db: Session, llm_model: LLMModelCreate):
        """创建 LLM 模型"""
        db_llm_model = LLMModel(**llm_model.model_dump())
        db.add(db_llm_model)
        db.refresh(db_llm_model)
        return db_llm_model

    @staticmethod
    def get_llm_models(db: Session, skip: int = 0, limit: int = 100):
        """获取 LLM 模型列表（只读操作，不需要事务）"""
        return db.query(LLMModel).offset(skip).limit(limit).all()

    @staticmethod
    def get_llm_model(db: Session, llm_model_id: int):
        """获取单个 LLM 模型（只读操作，不需要事务）"""
        return db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()

    @staticmethod
    @handle_transaction
    def update_llm_model(db: Session, llm_model_id: int, llm_model: LLMModelUpdate):
        """更新 LLM 模型"""
        db_llm_model = db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()
        if not db_llm_model:
            raise ResourceNotFoundError(
                message=f"LLM 模型 {llm_model_id} 不存在"
            )
        update_data = llm_model.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_llm_model, field, value)
        db.refresh(db_llm_model)
        return db_llm_model

    @staticmethod
    @handle_transaction
    def delete_llm_model(db: Session, llm_model_id: int):
        """删除 LLM 模型"""
        db_llm_model = db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()
        if not db_llm_model:
            raise ResourceNotFoundError(
                message=f"LLM 模型 {llm_model_id} 不存在"
            )
        db.delete(db_llm_model)
        return db_llm_model