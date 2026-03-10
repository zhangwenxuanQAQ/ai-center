"""
提示词服务类，提供提示词相关的CRUD操作
"""

from datetime import datetime
from app.database.models import Prompt
from app.services.prompt.dto import PromptCreate, PromptUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class PromptService:
    """
    提示词服务类
    
    提供提示词的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_prompt(prompt: PromptCreate):
        """
        创建提示词
        
        Args:
            prompt: 提示词创建DTO
            
        Returns:
            Prompt: 创建的提示词对象
        """
        db_prompt = Prompt(**prompt.model_dump())
        db_prompt.save()
        return db_prompt

    @staticmethod
    def get_prompts(skip: int = 0, limit: int = 100):
        """
        获取提示词列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[Prompt]: 提示词列表
        """
        return list(Prompt.select().offset(skip).limit(limit))

    @staticmethod
    def get_prompt(prompt_id: int):
        """
        获取单个提示词
        
        Args:
            prompt_id: 提示词ID
            
        Returns:
            Prompt: 提示词对象，不存在则返回None
        """
        try:
            return Prompt.get_by_id(prompt_id)
        except Prompt.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_prompt(prompt_id: int, prompt: PromptUpdate):
        """
        更新提示词
        
        Args:
            prompt_id: 提示词ID
            prompt: 提示词更新DTO
            
        Returns:
            Prompt: 更新后的提示词对象
            
        Raises:
            ResourceNotFoundError: 提示词不存在
        """
        try:
            db_prompt = Prompt.get_by_id(prompt_id)
        except Prompt.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"提示词 {prompt_id} 不存在"
            )
        update_data = prompt.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_prompt, field, value)
        db_prompt.updated_at = datetime.now()
        db_prompt.save()
        return db_prompt

    @staticmethod
    @handle_transaction
    def delete_prompt(prompt_id: int):
        """
        删除提示词
        
        Args:
            prompt_id: 提示词ID
            
        Returns:
            Prompt: 被删除的提示词对象
            
        Raises:
            ResourceNotFoundError: 提示词不存在
        """
        try:
            db_prompt = Prompt.get_by_id(prompt_id)
        except Prompt.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"提示词 {prompt_id} 不存在"
            )
        db_prompt.delete_instance()
        return db_prompt
