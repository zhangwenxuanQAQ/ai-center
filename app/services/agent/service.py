"""
智能体服务类，提供智能体相关的CRUD操作
"""

from datetime import datetime
import json
from app.database.models import AgentCategory, AgentComponent, AgentInstance
from app.services.agent.dto import (
    AgentCategoryCreate, AgentCategoryUpdate,
    AgentComponentCreate, AgentComponentUpdate,
    AgentInstanceCreate, AgentInstanceUpdate
)
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class AgentCategoryService:
    """
    智能体分类服务类
    
    提供智能体分类的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def get_default_category():
        """
        获取默认分类，如果不存在则创建
        
        Returns:
            AgentCategory: 默认分类对象
        """
        default_category = AgentCategory.select().where(AgentCategory.is_default == True).first()
        if not default_category:
            default_category = AgentCategory(
                name="默认分类",
                description="系统默认分类",
                is_default=True
            )
            default_category.save(force_insert=True)
        return default_category
    
    @staticmethod
    @handle_transaction
    def create_category(category: AgentCategoryCreate):
        """
        创建智能体分类
        
        Args:
            category: 智能体分类创建DTO
            
        Returns:
            AgentCategory: 创建的智能体分类对象
        """
        existing_category = AgentCategory.select().where(
            AgentCategory.name == category.name,
            AgentCategory.parent_id == category.parent_id,
            AgentCategory.deleted == False
        ).first()
        
        if existing_category:
            raise ValueError(f"同一父分类下已存在名为 '{category.name}' 的分类")
        
        # 如果设置为默认选中，先将其他分类的is_default_select设置为False
        if category.is_default_select:
            AgentCategory.update(is_default_select=False).where(
                AgentCategory.deleted == False
            ).execute()
        
        db_category = AgentCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category
    
    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100, parent_id: str = None):
        """
        获取智能体分类列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            parent_id: 父分类ID
            
        Returns:
            List[AgentCategory]: 智能体分类列表
        """
        query = AgentCategory.select().order_by(AgentCategory.sort_order.asc())
        if parent_id is not None:
            query = query.where(AgentCategory.parent_id == parent_id)
        return list(query.offset(skip).limit(limit))
    
    @staticmethod
    def get_category_tree():
        """
        获取分类树结构
        
        Returns:
            List[dict]: 分类树结构
        """
        all_categories = list(AgentCategory.select().where(
            AgentCategory.deleted == False
        ).order_by(AgentCategory.sort_order.asc()))
        
        def remove_hyphens(id_str):
            return str(id_str).replace('-', '')
        
        node_map = {}
        for category in all_categories:
            node_id = remove_hyphens(category.id)
            parent_id = remove_hyphens(category.parent_id) if category.parent_id else None
            node_map[node_id] = {
                'id': node_id,
                'name': category.name,
                'description': category.description,
                'is_default': category.is_default,
                'is_default_select': category.is_default_select,
                'parent_id': parent_id,
                'sort_order': category.sort_order,
                'children': []
            }
        
        tree = []
        for category in all_categories:
            node_id = remove_hyphens(category.id)
            node = node_map[node_id]
            
            if not category.parent_id:
                tree.append(node)
            else:
                try:
                    parent_id = remove_hyphens(str(category.parent_id))
                    if parent_id in node_map:
                        node_map[parent_id]['children'].append(node)
                except Exception:
                    pass
        
        def sort_tree(nodes):
            nodes.sort(key=lambda x: x['sort_order'])
            for node in nodes:
                if node['children']:
                    sort_tree(node['children'])
        
        sort_tree(tree)
        return tree
    
    @staticmethod
    def get_category(category_id: str):
        """
        获取单个智能体分类
        
        Args:
            category_id: 智能体分类ID
            
        Returns:
            AgentCategory: 智能体分类对象
        """
        try:
            return AgentCategory.get_by_id(category_id)
        except AgentCategory.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: AgentCategoryUpdate):
        """
        更新智能体分类
        
        Args:
            category_id: 智能体分类ID
            category: 智能体分类更新DTO
            
        Returns:
            AgentCategory: 更新后的智能体分类对象
        """
        try:
            db_category = AgentCategory.get_by_id(category_id)
        except AgentCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"智能体分类 {category_id} 不存在")
        
        update_data = category.model_dump(exclude_none=True)
        
        # 调试日志
        print(f"[DEBUG] update_category - category_id: {category_id}")
        print(f"[DEBUG] update_data: {update_data}")
        print(f"[DEBUG] is_default_select in update_data: {'is_default_select' in update_data}")
        if 'is_default_select' in update_data:
            print(f"[DEBUG] is_default_select value: {update_data['is_default_select']}")
        
        # 如果设置为默认选中，先将其他分类的is_default_select设置为False
        if 'is_default_select' in update_data:
            if update_data['is_default_select']:
                # 设置为默认选中，先将所有分类的is_default_select设置为False
                AgentCategory.update(is_default_select=False).where(
                    AgentCategory.deleted == False
                ).execute()
            # 如果取消默认选中，不需要特殊处理，直接更新即可
        
        for field, value in update_data.items():
            setattr(db_category, field, value)
        db_category.updated_at = datetime.now()
        db_category.save()
        return db_category
    
    @staticmethod
    @handle_transaction
    def delete_category(category_id: str):
        """
        删除智能体分类（软删除）
        
        Args:
            category_id: 智能体分类ID
            
        Returns:
            AgentCategory: 被删除的智能体分类对象
        """
        try:
            db_category = AgentCategory.get_by_id(category_id)
        except:
            raise ResourceNotFoundError(message=f"智能体分类 {category_id} 不存在")
        
        if db_category.is_default:
            raise ValueError("不能删除默认分类")
        
        db_category.delete_instance()
        return db_category


class AgentComponentService:
    """
    智能体组件服务类
    """
    
    @staticmethod
    @handle_transaction
    def create_component(component: AgentComponentCreate):
        """
        创建智能体组件
        """
        db_component = AgentComponent(**component.model_dump())
        db_component.save(force_insert=True)
        return db_component
    
    @staticmethod
    def get_components(skip: int = 0, limit: int = 100, component_type: str = None, category: str = None):
        """
        获取智能体组件列表
        """
        query = AgentComponent.select()
        if component_type:
            query = query.where(AgentComponent.component_type == component_type)
        if category:
            query = query.where(AgentComponent.category == category)
        return list(query.offset(skip).limit(limit))
    
    @staticmethod
    def get_component(component_id: str):
        """
        获取单个智能体组件
        """
        try:
            return AgentComponent.get_by_id(component_id)
        except AgentComponent.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_component(component_id: str, component: AgentComponentUpdate):
        """
        更新智能体组件
        """
        try:
            db_component = AgentComponent.get_by_id(component_id)
        except AgentComponent.DoesNotExist:
            raise ResourceNotFoundError(message=f"智能体组件 {component_id} 不存在")
        
        update_data = component.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_component, field, value)
        db_component.updated_at = datetime.now()
        db_component.save()
        return db_component
    
    @staticmethod
    @handle_transaction
    def delete_component(component_id: str):
        """
        删除智能体组件
        """
        try:
            db_component = AgentComponent.get_by_id(component_id)
        except:
            raise ResourceNotFoundError(message=f"智能体组件 {component_id} 不存在")
        
        db_component.delete_instance()
        return db_component


class AgentInstanceService:
    """
    智能体实例服务类
    """
    
    @staticmethod
    @handle_transaction
    def create_instance(instance: AgentInstanceCreate):
        """
        创建智能体实例
        """
        db_instance = AgentInstance(**instance.model_dump())
        if instance.dsl:
            db_instance.dsl = json.dumps(instance.dsl, ensure_ascii=False)
        db_instance.save(force_insert=True)
        return db_instance
    
    @staticmethod
    def get_instances(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, code: str = None, status: str = None):
        """
        获取智能体实例列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID
            name: 智能体名称（模糊查询）
            code: 智能体编码（模糊查询）
            status: 状态
            
        Returns:
            List[AgentInstance]: 智能体实例列表
        """
        query = AgentInstance.select().where(AgentInstance.deleted == False)
        if category_id:
            query = query.where(AgentInstance.category_id == category_id)
        if name:
            query = query.where(AgentInstance.name.contains(name))
        if code:
            query = query.where(AgentInstance.code.contains(code))
        if status is not None and status != '':
            if status.lower() == 'true':
                query = query.where(AgentInstance.status == True)
            elif status.lower() == 'false':
                query = query.where(AgentInstance.status == False)
        return list(query.offset(skip).limit(limit))
    
    @staticmethod
    def count_instances(category_id: str = None, name: str = None, code: str = None, status: str = None):
        """
        统计智能体实例数量
        
        Args:
            category_id: 分类ID
            name: 智能体名称（模糊查询）
            code: 智能体编码（模糊查询）
            status: 状态
            
        Returns:
            int: 智能体实例数量
        """
        query = AgentInstance.select().where(AgentInstance.deleted == False)
        if category_id:
            query = query.where(AgentInstance.category_id == category_id)
        if name:
            query = query.where(AgentInstance.name.contains(name))
        if code:
            query = query.where(AgentInstance.code.contains(code))
        if status is not None and status != '':
            if status.lower() == 'true':
                query = query.where(AgentInstance.status == True)
            elif status.lower() == 'false':
                query = query.where(AgentInstance.status == False)
        return query.count()
    
    @staticmethod
    def get_instance(instance_id: str):
        """
        获取单个智能体实例
        """
        try:
            instance = AgentInstance.get_by_id(instance_id)
            if instance.dsl:
                instance.dsl = json.loads(instance.dsl)
            return instance
        except AgentInstance.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_instance(instance_id: str, instance: AgentInstanceUpdate):
        """
        更新智能体实例
        """
        try:
            db_instance = AgentInstance.get_by_id(instance_id)
        except AgentInstance.DoesNotExist:
            raise ResourceNotFoundError(message=f"智能体实例 {instance_id} 不存在")
        
        update_data = instance.model_dump(exclude_unset=True)
        if 'dsl' in update_data and update_data['dsl']:
            update_data['dsl'] = json.dumps(update_data['dsl'], ensure_ascii=False)
        
        for field, value in update_data.items():
            setattr(db_instance, field, value)
        db_instance.updated_at = datetime.now()
        db_instance.save()
        return db_instance
    
    @staticmethod
    @handle_transaction
    def delete_instance(instance_id: str):
        """
        删除智能体实例
        """
        try:
            db_instance = AgentInstance.get_by_id(instance_id)
        except:
            raise ResourceNotFoundError(message=f"智能体实例 {instance_id} 不存在")
        
        db_instance.delete_instance()
        return db_instance
    
    @staticmethod
    @handle_transaction
    def publish_instance(instance_id: str):
        """
        发布智能体实例（版本号+1）
        """
        try:
            db_instance = AgentInstance.get_by_id(instance_id)
        except AgentInstance.DoesNotExist:
            raise ResourceNotFoundError(message=f"智能体实例 {instance_id} 不存在")
        
        db_instance.version += 1
        db_instance.updated_at = datetime.now()
        db_instance.save()
        return db_instance
