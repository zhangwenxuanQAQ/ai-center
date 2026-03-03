from peewee import MySQLDatabase
from app.database.models import Prompt
from app.core.prompt.dto import PromptCreate, PromptUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class PromptService:
    @staticmethod
    @handle_transaction
    def create_prompt(db: MySQLDatabase, prompt: PromptCreate):
        """创建提示词"""
        db_prompt = Prompt(**prompt.model_dump())
        db_prompt.save()
        return db_prompt

    @staticmethod
    def get_prompts(db: MySQLDatabase, skip: int = 0, limit: int = 100):
        """获取提示词列表（只读操作，不需要事务）"""
        return list(Prompt.select().offset(skip).limit(limit))

    @staticmethod
    def get_prompt(db: MySQLDatabase, prompt_id: int):
        """获取单个提示词（只读操作，不需要事务）"""
        try:
            return Prompt.get_by_id(prompt_id)
        except Prompt.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_prompt(db: MySQLDatabase, prompt_id: int, prompt: PromptUpdate):
        """更新提示词"""
        try:
            db_prompt = Prompt.get_by_id(prompt_id)
        except Prompt.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"提示词 {prompt_id} 不存在"
            )
        update_data = prompt.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_prompt, field, value)
        db_prompt.save()
        return db_prompt

    @staticmethod
    @handle_transaction
    def delete_prompt(db: MySQLDatabase, prompt_id: int):
        """删除提示词"""
        try:
            db_prompt = Prompt.get_by_id(prompt_id)
        except Prompt.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"提示词 {prompt_id} 不存在"
            )
        db_prompt.delete_instance()
        return db_prompt