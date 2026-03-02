from sqlalchemy.orm import Session
from app.database.models import Prompt
from app.core.prompt.dto import PromptCreate, PromptUpdate

class PromptService:
    @staticmethod
    def create_prompt(db: Session, prompt: PromptCreate):
        db_prompt = Prompt(**prompt.model_dump())
        db.add(db_prompt)
        db.commit()
        db.refresh(db_prompt)
        return db_prompt

    @staticmethod
    def get_prompts(db: Session, skip: int = 0, limit: int = 100):
        return db.query(Prompt).offset(skip).limit(limit).all()

    @staticmethod
    def get_prompt(db: Session, prompt_id: int):
        return db.query(Prompt).filter(Prompt.id == prompt_id).first()

    @staticmethod
    def update_prompt(db: Session, prompt_id: int, prompt: PromptUpdate):
        db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if db_prompt:
            update_data = prompt.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_prompt, field, value)
            db.commit()
            db.refresh(db_prompt)
        return db_prompt

    @staticmethod
    def delete_prompt(db: Session, prompt_id: int):
        db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if db_prompt:
            db.delete(db_prompt)
            db.commit()
        return db_prompt