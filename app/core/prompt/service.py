from sqlalchemy.orm import Session
from app.database.models import Prompt
from app.core.prompt.dto import PromptCreate, PromptUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class PromptService:
    @staticmethod
    @handle_transaction
    def create_prompt(db: Session, prompt: PromptCreate):
        """创建提示词"""
        db_prompt = Prompt(**prompt.model_dump())
        db.add(db_prompt)
        db.refresh(db_prompt)
        return db_prompt

    @staticmethod
    def get_prompts(db: Session, skip: int = 0, limit: int = 100):
        """获取提示词列表（只读操作，不需要事务）"""
        return db.query(Prompt).offset(skip).limit(limit).all()

    @staticmethod
    def get_prompt(db: Session, prompt_id: int):
        """获取单个提示词（只读操作，不需要事务）"""
        return db.query(Prompt).filter(Prompt.id == prompt_id).first()

    @staticmethod
    @handle_transaction
    def update_prompt(db: Session, prompt_id: int, prompt: PromptUpdate):
        """更新提示词"""
        db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if not db_prompt:
            raise ResourceNotFoundError(
                message=f"提示词 {prompt_id} 不存在"
            )
        update_data = prompt.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_prompt, field, value)
        db.refresh(db_prompt)
        return db_prompt

    @staticmethod
    @handle_transaction
    def delete_prompt(db: Session, prompt_id: int):
        """删除提示词"""
        db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if not db_prompt:
            raise ResourceNotFoundError(
                message=f"提示词 {prompt_id} 不存在"
            )
        db.delete(db_prompt)
        return db_prompt