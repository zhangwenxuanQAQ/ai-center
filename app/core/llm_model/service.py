from sqlalchemy.orm import Session
from app.database.models import LLMModel
from app.core.llm_model.dto import LLMModelCreate, LLMModelUpdate

class LLMModelService:
    @staticmethod
    def create_llm_model(db: Session, llm_model: LLMModelCreate):
        db_llm_model = LLMModel(**llm_model.model_dump())
        db.add(db_llm_model)
        db.commit()
        db.refresh(db_llm_model)
        return db_llm_model

    @staticmethod
    def get_llm_models(db: Session, skip: int = 0, limit: int = 100):
        return db.query(LLMModel).offset(skip).limit(limit).all()

    @staticmethod
    def get_llm_model(db: Session, llm_model_id: int):
        return db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()

    @staticmethod
    def update_llm_model(db: Session, llm_model_id: int, llm_model: LLMModelUpdate):
        db_llm_model = db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()
        if db_llm_model:
            update_data = llm_model.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_llm_model, field, value)
            db.commit()
            db.refresh(db_llm_model)
        return db_llm_model

    @staticmethod
    def delete_llm_model(db: Session, llm_model_id: int):
        db_llm_model = db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()
        if db_llm_model:
            db.delete(db_llm_model)
            db.commit()
        return db_llm_model