"""
LLM模型服务类，提供LLM模型和分类相关的CRUD操作
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from app.database.models import LLMModel, LLMCategory
from app.services.llm_model.dto import (
    LLMModelCreate, LLMModelUpdate,
    LLMCategoryCreate, LLMCategoryUpdate
)
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError
from app.constants.llm_constants import MODEL_TYPE
from app.core.llm_model.utils.model_test import ModelTestUtils
from functools import reduce


class LLMCategoryService:
    """
    LLM分类服务类
    
    提供LLM分类的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def _get_or_create_default_category():
        """
        获取或创建默认分类
        
        Returns:
            LLMCategory: 默认分类对象
        """
        default_category = LLMCategory.select().where(LLMCategory.name == "默认分类").first()
        if not default_category:
            default_category = LLMCategory(
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
    def create_category(category: LLMCategoryCreate):
        """
        创建LLM分类
        
        Args:
            category: LLM分类创建DTO
            
        Returns:
            LLMCategory: 创建的LLM分类对象
            
        Raises:
            DuplicateResourceError: 同一父分类下名称已存在
        """
        parent_id = category.parent_id
        
        existing = LLMCategory.select().where(
            (LLMCategory.name == category.name) &
            (LLMCategory.parent_id == parent_id if parent_id else LLMCategory.parent_id.is_null()) &
            (LLMCategory.deleted == False)
        ).first()
        
        if existing:
            raise DuplicateResourceError(f"分类名称 '{category.name}' 已存在")
        
        db_category = LLMCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category
    
    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100):
        """
        获取LLM分类列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[LLMCategory]: LLM分类列表
        """
        return list(LLMCategory.select().where(LLMCategory.deleted == False).offset(skip).limit(limit))
    
    @staticmethod
    def get_category_tree():
        """
        获取LLM分类树形结构
        
        Returns:
            List[dict]: 分类树形结构
        """
        categories = list(LLMCategory.select().where(LLMCategory.deleted == False).order_by(LLMCategory.sort_order))
        
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
        获取单个LLM分类
        
        Args:
            category_id: LLM分类ID
            
        Returns:
            LLMCategory: LLM分类对象，不存在则返回None
        """
        try:
            category = LLMCategory.get_by_id(category_id)
            if category.deleted:
                return None
            return category
        except LLMCategory.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: LLMCategoryUpdate):
        """
        更新LLM分类
        
        Args:
            category_id: LLM分类ID
            category: LLM分类更新DTO
            
        Returns:
            LLMCategory: 更新后的LLM分类对象
            
        Raises:
            ResourceNotFoundError: LLM分类不存在
            DuplicateResourceError: 同一父分类下名称已存在
        """
        try:
            db_category = LLMCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"LLM分类 {category_id} 不存在")
        except LLMCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"LLM分类 {category_id} 不存在")
        
        update_data = category.model_dump(exclude_unset=True)
        
        if 'name' in update_data:
            parent_id = update_data.get('parent_id', db_category.parent_id)
            existing = LLMCategory.select().where(
                (LLMCategory.name == update_data['name']) &
                (LLMCategory.parent_id == parent_id if parent_id else LLMCategory.parent_id.is_null()) &
                (LLMCategory.id != category_id) &
                (LLMCategory.deleted == False)
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
        删除LLM分类（逻辑删除）
        
        Args:
            category_id: LLM分类ID
            
        Returns:
            LLMCategory: 被删除的LLM分类对象
            
        Raises:
            ResourceNotFoundError: LLM分类不存在
            ValueError: 分类下存在LLM模型，无法删除
        """
        try:
            db_category = LLMCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"LLM分类 {category_id} 不存在")
        except LLMCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"LLM分类 {category_id} 不存在")
        
        def get_all_child_category_ids(parent_id: str) -> list:
            child_ids = [parent_id]
            children = LLMCategory.select().where(
                (LLMCategory.parent_id == parent_id) &
                (LLMCategory.deleted == False)
            )
            for child in children:
                child_ids.extend(get_all_child_category_ids(child.id))
            return child_ids
        
        all_category_ids = get_all_child_category_ids(category_id)
        
        model_count = LLMModel.select().where(
            (LLMModel.category_id.in_(all_category_ids)) &
            (LLMModel.deleted == False)
        ).count()
        
        if model_count > 0:
            raise ValueError(f"该分类或其子分类下存在 {model_count} 个LLM模型，无法删除")
        
        db_category.deleted = True
        db_category.deleted_at = datetime.now()
        db_category.save()
        return db_category


class LLMModelService:
    """
    LLM模型服务类
    
    提供LLM模型的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def get_model_types():
        """
        获取LLM模型类型
        
        Returns:
            dict: 模型类型字典
        """
        return MODEL_TYPE
    
    @staticmethod
    def get_model_tags(model_type: str = None) -> list:
        """
        获取模型标签
        
        Args:
            model_type: 模型类型（可选）
            
        Returns:
            list: 标签列表
        """
        query = LLMModel.select().where(LLMModel.deleted == False)
        
        if model_type:
            query = query.where(LLMModel.model_type == model_type)
        
        tags_set = set()
        for model in query:
            if model.tags:
                try:
                    import json
                    tags = json.loads(model.tags)
                    if isinstance(tags, list):
                        for tag in tags:
                            tags_set.add(tag)
                except:
                    pass
        
        return list(tags_set)
    
    @staticmethod
    @handle_transaction
    def create_llm_model(llm_model: LLMModelCreate):
        """
        创建LLM模型
        
        Args:
            llm_model: LLM模型创建DTO
            
        Returns:
            LLMModel: 创建的LLM模型对象
            
        Raises:
            DuplicateResourceError: 模型名称已存在
        """
        existing = LLMModel.select().where(
            (LLMModel.name == llm_model.name) &
            (LLMModel.deleted == False)
        ).first()
        
        if existing:
            raise DuplicateResourceError(f"模型名称 '{llm_model.name}' 已存在")
        
        model_data = llm_model.model_dump()
        
        if not model_data.get('category_id'):
            default_category = LLMCategoryService._get_or_create_default_category()
            model_data['category_id'] = default_category.id
        
        db_llm_model = LLMModel(**model_data)
        db_llm_model.save(force_insert=True)
        return db_llm_model
    
    @staticmethod
    def get_llm_models(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, model_type: str = None, status: str = None, tags: list = None):
        """
        获取LLM模型列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID（可选）
            name: 模型名称（模糊查询）
            model_type: 模型类型
            status: 状态（true/false）
            tags: 标签列表（可选）
            
        Returns:
            List[LLMModel]: LLM模型列表
        """
        query = LLMModel.select().where(LLMModel.deleted == False)
        
        if category_id:
            query = query.where(LLMModel.category_id == category_id)
        
        if name:
            query = query.where(LLMModel.name.contains(name))
        
        if model_type:
            # 支持多个模型类型，用逗号分隔
            model_types = model_type.split(',')
            query = query.where(LLMModel.model_type.in_(model_types))
        
        if status is not None and status != '':
            status_bool = status.lower() == 'true'
            query = query.where(LLMModel.status == status_bool)
        
        if tags:
            # 标签过滤，使用OR条件（满足其中一个标签即可）
            tag_conditions = []
            for tag in tags:
                if tag:
                    tag_conditions.append(LLMModel.tags.contains(tag))
            if tag_conditions:
                # 使用 | 运算符组合OR条件
                or_condition = reduce(lambda a, b: a | b, tag_conditions)
                query = query.where(or_condition)
        
        return list(query.order_by(LLMModel.created_at.desc()).offset(skip).limit(limit))
    
    @staticmethod
    def count_llm_models(category_id: str = None, name: str = None, model_type: str = None, status: str = None, tags: list = None) -> int:
        """
        统计LLM模型总数
        
        Args:
            category_id: 分类ID（可选）
            name: 模型名称（模糊查询）
            model_type: 模型类型
            status: 状态（true/false）
            tags: 标签列表（可选）
            
        Returns:
            int: LLM模型总数
        """
        query = LLMModel.select().where(LLMModel.deleted == False)
        
        if category_id:
            query = query.where(LLMModel.category_id == category_id)
        
        if name:
            query = query.where(LLMModel.name.contains(name))
        
        if model_type:
            # 支持多个模型类型，用逗号分隔
            model_types = model_type.split(',')
            query = query.where(LLMModel.model_type.in_(model_types))
        
        if status is not None and status != '':
            status_bool = status.lower() == 'true'
            query = query.where(LLMModel.status == status_bool)
        
        if tags:
            # 标签过滤，使用OR条件（满足其中一个标签即可）
            tag_conditions = []
            for tag in tags:
                if tag:
                    tag_conditions.append(LLMModel.tags.contains(tag))
            if tag_conditions:
                # 使用 | 运算符组合OR条件
                or_condition = reduce(lambda a, b: a | b, tag_conditions)
                query = query.where(or_condition)
            
        return query.count()
    
    @staticmethod
    def get_llm_model(llm_model_id: str):
        """
        获取单个LLM模型
        
        Args:
            llm_model_id: LLM模型ID
            
        Returns:
            LLMModel: LLM模型对象，不存在则返回None
        """
        try:
            llm_model = LLMModel.get_by_id(llm_model_id)
            if llm_model.deleted:
                return None
            return llm_model
        except LLMModel.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_llm_model(llm_model_id: str, llm_model: LLMModelUpdate):
        """
        更新LLM模型
        
        Args:
            llm_model_id: LLM模型ID
            llm_model: LLM模型更新DTO
            
        Returns:
            LLMModel: 更新后的LLM模型对象
            
        Raises:
            ResourceNotFoundError: LLM模型不存在
            DuplicateResourceError: 模型名称已被其他模型使用
        """
        try:
            db_llm_model = LLMModel.get_by_id(llm_model_id)
            if db_llm_model.deleted:
                raise ResourceNotFoundError(message=f"LLM模型 {llm_model_id} 不存在")
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(message=f"LLM模型 {llm_model_id} 不存在")
        
        update_data = llm_model.model_dump(exclude_unset=True)
        
        if 'name' in update_data and update_data['name'] != db_llm_model.name:
            existing = LLMModel.select().where(
                (LLMModel.name == update_data['name']) &
                (LLMModel.id != llm_model_id) &
                (LLMModel.deleted == False)
            ).first()
            
            if existing:
                raise DuplicateResourceError(f"模型名称 '{update_data['name']}' 已存在")
        
        for field, value in update_data.items():
            setattr(db_llm_model, field, value)
        db_llm_model.updated_at = datetime.now()
        db_llm_model.save()
        return db_llm_model
    
    @staticmethod
    @handle_transaction
    def delete_llm_model(llm_model_id: str):
        """
        删除LLM模型（逻辑删除）
        
        Args:
            llm_model_id: LLM模型ID
            
        Returns:
            LLMModel: 被删除的LLM模型对象
            
        Raises:
            ResourceNotFoundError: LLM模型不存在
        """
        try:
            db_llm_model = LLMModel.get_by_id(llm_model_id)
            if db_llm_model.deleted:
                raise ResourceNotFoundError(message=f"LLM模型 {llm_model_id} 不存在")
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(message=f"LLM模型 {llm_model_id} 不存在")
        
        db_llm_model.deleted = True
        db_llm_model.deleted_at = datetime.now()
        db_llm_model.save()
        return db_llm_model
    
    @staticmethod
    def test_model_connection(llm_model_id: str) -> Dict[str, Any]:
        """
        测试模型连接
        
        Args:
            llm_model_id: LLM模型ID
            
        Returns:
            Dict[str, Any]: 测试结果
            
        Raises:
            ResourceNotFoundError: LLM模型不存在
        """
        try:
            db_llm_model = LLMModel.get_by_id(llm_model_id)
            if db_llm_model.deleted:
                raise ResourceNotFoundError(message=f"LLM模型 {llm_model_id} 不存在")
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(message=f"LLM模型 {llm_model_id} 不存在")
        
        # 构建模型配置
        model_config = {
            'api_key': db_llm_model.api_key,
            'endpoint': db_llm_model.endpoint,
            'name': db_llm_model.name,
            'provider': db_llm_model.provider
        }
        
        # 测试模型
        return ModelTestUtils.test_model(db_llm_model.model_type, model_config)
    
    @staticmethod
    def test_model_config(model_test) -> Dict[str, Any]:
        """
        测试模型配置
        
        Args:
            model_test: 模型测试DTO
            
        Returns:
            Dict[str, Any]: 测试结果
        """
        # 构建模型配置
        model_config = {
            'api_key': model_test.api_key,
            'endpoint': model_test.endpoint,
            'name': model_test.name,
            'provider': model_test.provider
        }
        
        # 测试模型
        return ModelTestUtils.test_model(model_test.model_type, model_config)
