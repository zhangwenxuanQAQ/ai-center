"""
提示词服务类，提供提示词相关的CRUD操作
"""

import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from app.database.models import PromptCategory, Prompt
from app.services.prompt.dto import PromptCategoryCreate, PromptCategoryUpdate, PromptCreate, PromptUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError


class PromptCategoryService:
    """
    提示词分类服务类
    
    提供提示词分类的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def _get_or_create_default_category():
        """
        获取或创建默认分类
        
        Returns:
            PromptCategory: 默认分类对象
        """
        default_category = PromptCategory.select().where(PromptCategory.name == "默认分类").first()
        if not default_category:
            default_category = PromptCategory(
                name="默认分类",
                description="系统默认分类",
                is_default=True
            )
            default_category.save(force_insert=True)
        elif not default_category.is_default:
            default_category.is_default = True
            default_category.save()
        return default_category
    
    @staticmethod
    @handle_transaction
    def create_category(category: PromptCategoryCreate):
        """
        创建提示词分类
        
        Args:
            category: 提示词分类创建DTO
            
        Returns:
            PromptCategory: 创建的提示词分类对象
            
        Raises:
            DuplicateResourceError: 同一父分类下名称已存在
        """
        parent_id = category.parent_id
        
        existing = PromptCategory.select().where(
            (PromptCategory.name == category.name) &
            (PromptCategory.parent_id == parent_id if parent_id else PromptCategory.parent_id.is_null()) &
            (PromptCategory.deleted == False)
        ).first()
        
        if existing:
            raise DuplicateResourceError(f"分类名称 '{category.name}' 已存在")
        
        db_category = PromptCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category
    
    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100):
        """
        获取提示词分类列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[PromptCategory]: 提示词分类列表
        """
        return list(PromptCategory.select().where(PromptCategory.deleted == False).offset(skip).limit(limit))
    
    @staticmethod
    def get_category_tree():
        """
        获取提示词分类树形结构
        
        Returns:
            List[dict]: 分类树形结构
        """
        categories = list(PromptCategory.select().where(PromptCategory.deleted == False).order_by(PromptCategory.sort_order))
        
        def build_tree(parent_id=None):
            tree = []
            for cat in categories:
                if cat.parent_id == parent_id:
                    node = {
                        "id": str(cat.id),
                        "name": cat.name,
                        "description": cat.description,
                        'is_default': cat.is_default,
                        "parent_id": str(cat.parent_id) if cat.parent_id else None,
                        "sort_order": cat.sort_order,
                        "children": build_tree(cat.id)
                    }
                    tree.append(node)
            return tree
        
        return build_tree()
    
    @staticmethod
    def get_category(category_id: str):
        """
        获取单个提示词分类
        
        Args:
            category_id: 提示词分类ID
            
        Returns:
            PromptCategory: 提示词分类对象，不存在则返回None
        """
        try:
            category = PromptCategory.get_by_id(category_id)
            if category.deleted:
                return None
            return category
        except PromptCategory.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: PromptCategoryUpdate):
        """
        更新提示词分类
        
        Args:
            category_id: 提示词分类ID
            category: 提示词分类更新DTO
            
        Returns:
            PromptCategory: 更新后的提示词分类对象
            
        Raises:
            ResourceNotFoundError: 提示词分类不存在
            DuplicateResourceError: 同一父分类下名称已存在
        """
        try:
            db_category = PromptCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"提示词分类 {category_id} 不存在")
        except PromptCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"提示词分类 {category_id} 不存在")
        
        update_data = category.model_dump(exclude_unset=True)
        
        if 'name' in update_data:
            parent_id = update_data.get('parent_id', db_category.parent_id)
            existing = PromptCategory.select().where(
                (PromptCategory.name == update_data['name']) &
                (PromptCategory.parent_id == parent_id if parent_id else PromptCategory.parent_id.is_null()) &
                (PromptCategory.id != category_id) &
                (PromptCategory.deleted == False)
            ).first()
            
            if existing:
                raise DuplicateResourceError(f"分类名称 '{update_data['name']}' 已存在")
        
        for field, value in update_data.items():
            setattr(db_category, field, value)
        db_category.updated_at = datetime.now()
        db_category.save()
        return db_category
    
    @staticmethod
    @handle_transaction
    def delete_category(category_id: str):
        """
        删除提示词分类（逻辑删除）
        
        Args:
            category_id: 提示词分类ID
            
        Returns:
            PromptCategory: 被删除的提示词分类对象
            
        Raises:
            ResourceNotFoundError: 提示词分类不存在
            ValueError: 分类下存在提示词，无法删除
        """
        try:
            db_category = PromptCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"提示词分类 {category_id} 不存在")
        except PromptCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"提示词分类 {category_id} 不存在")
        
        def get_all_child_category_ids(parent_id: str) -> list:
            child_ids = [parent_id]
            children = PromptCategory.select().where(
                (PromptCategory.parent_id == parent_id) &
                (PromptCategory.deleted == False)
            )
            for child in children:
                child_ids.extend(get_all_child_category_ids(child.id))
            return child_ids
        
        all_category_ids = get_all_child_category_ids(category_id)
        
        prompt_count = Prompt.select().where(
            (Prompt.category_id.in_(all_category_ids)) &
            (Prompt.deleted == False)
        ).count()
        
        if prompt_count > 0:
            raise ValueError(f"该分类或其子分类下存在 {prompt_count} 个提示词，无法删除")
        
        db_category.deleted = True
        db_category.deleted_at = datetime.now()
        db_category.save()
        return db_category


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
            
        Raises:
            DuplicateResourceError: 提示词名称已存在
        """
        existing = Prompt.select().where(
            (Prompt.name == prompt.name) &
            (Prompt.deleted == False)
        ).first()
        
        if existing:
            raise DuplicateResourceError(f"提示词名称 '{prompt.name}' 已存在")
        
        prompt_data = prompt.model_dump()
        if prompt_data.get('tags') and isinstance(prompt_data['tags'], list):
            prompt_data['tags'] = json.dumps(prompt_data['tags'], ensure_ascii=False)
        
        if not prompt_data.get('category_id'):
            default_category = PromptCategoryService._get_or_create_default_category()
            prompt_data['category_id'] = default_category.id
        
        db_prompt = Prompt(**prompt_data)
        db_prompt.save(force_insert=True)
        return db_prompt
    
    @staticmethod
    def get_prompts(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, status: str = None):
        """
        获取提示词列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID（可选）
            name: 提示词名称（模糊查询，可选）
            status: 状态（可选）
            
        Returns:
            List[Prompt]: 提示词列表
        """
        query = Prompt.select().where(Prompt.deleted == False)
        
        if category_id:
            query = query.where(Prompt.category_id == category_id)
        if name:
            query = query.where(Prompt.name.contains(name))
        if status is not None:
            status_bool = status.lower() == 'true'
            query = query.where(Prompt.status == status_bool)
        
        return list(query.offset(skip).limit(limit))
    
    @staticmethod
    def count_prompts(category_id: str = None, name: str = None, status: str = None):
        """
        统计提示词数量
        
        Args:
            category_id: 分类ID（可选）
            name: 提示词名称（模糊查询，可选）
            status: 状态（可选）
            
        Returns:
            int: 提示词数量
        """
        query = Prompt.select().where(Prompt.deleted == False)
        
        if category_id:
            query = query.where(Prompt.category_id == category_id)
        if name:
            query = query.where(Prompt.name.contains(name))
        if status is not None:
            status_bool = status.lower() == 'true'
            query = query.where(Prompt.status == status_bool)
        
        return query.count()
    
    @staticmethod
    def get_prompt(prompt_id: str):
        """
        获取单个提示词
        
        Args:
            prompt_id: 提示词ID
            
        Returns:
            Prompt: 提示词对象，不存在则返回None
        """
        try:
            prompt = Prompt.get_by_id(prompt_id)
            if prompt.deleted:
                return None
            return prompt
        except Prompt.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_prompt(prompt_id: str, prompt: PromptUpdate):
        """
        更新提示词
        
        Args:
            prompt_id: 提示词ID
            prompt: 提示词更新DTO
            
        Returns:
            Prompt: 更新后的提示词对象
            
        Raises:
            ResourceNotFoundError: 提示词不存在
            DuplicateResourceError: 提示词名称已存在
        """
        try:
            db_prompt = Prompt.get_by_id(prompt_id)
            if db_prompt.deleted:
                raise ResourceNotFoundError(message=f"提示词 {prompt_id} 不存在")
        except Prompt.DoesNotExist:
            raise ResourceNotFoundError(message=f"提示词 {prompt_id} 不存在")
        
        update_data = prompt.model_dump(exclude_unset=True)
        
        if 'name' in update_data:
            existing = Prompt.select().where(
                (Prompt.name == update_data['name']) &
                (Prompt.id != prompt_id) &
                (Prompt.deleted == False)
            ).first()
            
            if existing:
                raise DuplicateResourceError(f"提示词名称 '{update_data['name']}' 已存在")
        
        if update_data.get('tags') and isinstance(update_data['tags'], list):
            update_data['tags'] = json.dumps(update_data['tags'], ensure_ascii=False)
        
        for field, value in update_data.items():
            setattr(db_prompt, field, value)
        db_prompt.updated_at = datetime.now()
        db_prompt.save()
        return db_prompt
    
    @staticmethod
    @handle_transaction
    def delete_prompt(prompt_id: str):
        """
        删除提示词（逻辑删除）
        
        Args:
            prompt_id: 提示词ID
            
        Returns:
            Prompt: 被删除的提示词对象
            
        Raises:
            ResourceNotFoundError: 提示词不存在
        """
        try:
            db_prompt = Prompt.get_by_id(prompt_id)
            if db_prompt.deleted:
                raise ResourceNotFoundError(message=f"提示词 {prompt_id} 不存在")
        except Prompt.DoesNotExist:
            raise ResourceNotFoundError(message=f"提示词 {prompt_id} 不存在")
        
        db_prompt.deleted = True
        db_prompt.deleted_at = datetime.now()
        db_prompt.save()
        return db_prompt

    @staticmethod
    @handle_transaction
    def update_prompt_status(prompt_id: str, status: bool):
        """
        更新提示词状态
        
        Args:
            prompt_id: 提示词ID
            status: 状态
            
        Returns:
            Prompt: 更新后的提示词对象
            
        Raises:
            ResourceNotFoundError: 提示词不存在
        """
        try:
            db_prompt = Prompt.get_by_id(prompt_id)
            if db_prompt.deleted:
                raise ResourceNotFoundError(message=f"提示词 {prompt_id} 不存在")
        except Prompt.DoesNotExist:
            raise ResourceNotFoundError(message=f"提示词 {prompt_id} 不存在")
        
        db_prompt.status = status
        db_prompt.updated_at = datetime.now()
        db_prompt.save()
        return db_prompt
    
    @staticmethod
    @handle_transaction
    def batch_delete_prompts(prompt_ids: List[str]):
        """
        批量删除提示词（逻辑删除）
        
        Args:
            prompt_ids: 提示词ID列表
            
        Returns:
            int: 成功删除的提示词数量
            
        Raises:
            ResourceNotFoundError: 提示词不存在
        """
        if not prompt_ids:
            return 0
        
        # 检查所有提示词是否存在且未删除
        existing_prompts = list(Prompt.select().where(
            (Prompt.id.in_(prompt_ids)) &
            (Prompt.deleted == False)
        ))
        
        existing_ids = {p.id for p in existing_prompts}
        missing_ids = set(prompt_ids) - existing_ids
        
        if missing_ids:
            raise ResourceNotFoundError(message=f"提示词 {', '.join(missing_ids)} 不存在")
        
        # 批量更新
        from datetime import datetime
        now = datetime.now()
        
        updated = Prompt.update(
            deleted=True,
            deleted_at=now
        ).where(
            (Prompt.id.in_(prompt_ids)) &
            (Prompt.deleted == False)
        ).execute()
        
        return updated
