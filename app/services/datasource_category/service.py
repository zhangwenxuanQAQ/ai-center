"""
数据源分类服务类，提供数据源分类相关的CRUD操作
"""

from datetime import datetime
from app.database.models import DatasourceCategory
from app.services.datasource_category.dto import DatasourceCategoryCreate, DatasourceCategoryUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class DatasourceCategoryService:
    """
    数据源分类服务类
    
    提供数据源分类的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def get_default_category():
        """
        获取默认分类，如果不存在则创建
        
        Returns:
            DatasourceCategory: 默认分类对象
        """
        default_category = DatasourceCategory.select().where(DatasourceCategory.is_default == True).first()
        if not default_category:
            default_category = DatasourceCategory(
                name="默认分类",
                description="系统默认分类",
                is_default=True
            )
            default_category.save(force_insert=True)
        return default_category
    
    @staticmethod
    @handle_transaction
    def create_category(category: DatasourceCategoryCreate):
        """
        创建数据源分类
        
        Args:
            category: 数据源分类创建DTO
            
        Returns:
            DatasourceCategory: 创建的数据源分类对象
            
        Raises:
            ValueError: 同一父分类下已存在同名分类
        """
        existing_category = DatasourceCategory.select().where(
            DatasourceCategory.name == category.name,
            DatasourceCategory.parent_id == category.parent_id,
            DatasourceCategory.deleted == False
        ).first()
        
        if existing_category:
            raise ValueError(f"同一父分类下已存在名为 '{category.name}' 的分类")
        
        db_category = DatasourceCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category
    
    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100, parent_id: str = None):
        """
        获取数据源分类列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            parent_id: 父分类ID，为None时获取所有分类
            
        Returns:
            List[DatasourceCategory]: 数据源分类列表
        """
        query = DatasourceCategory.select().order_by(DatasourceCategory.sort_order.asc())
        if parent_id is not None:
            query = query.where(DatasourceCategory.parent_id == parent_id)
        return list(query.offset(skip).limit(limit))
    
    @staticmethod
    def get_category_tree():
        """
        获取分类树结构
        
        Returns:
            List[dict]: 分类树结构
        """
        all_categories = list(DatasourceCategory.select().where(
            DatasourceCategory.deleted == False
        ).order_by(DatasourceCategory.sort_order.asc()))
        
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
                except Exception as e:
                    pass
        
        def sort_tree(nodes):
            nodes.sort(key=lambda x: x['sort_order'])
            for node in nodes:
                if node['children']:
                    sort_tree(node['children'])
        
        sort_tree(tree)
        return tree
    
    @staticmethod
    @handle_transaction
    def update_category_order(category_id: str, new_order: int):
        """
        更新分类排序
        
        Args:
            category_id: 分类ID
            new_order: 新的排序值
            
        Returns:
            DatasourceCategory: 更新后的分类对象
            
        Raises:
            ResourceNotFoundError: 分类不存在
        """
        try:
            db_category = DatasourceCategory.get_by_id(category_id)
        except DatasourceCategory.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"数据源分类 {category_id} 不存在"
            )
        
        db_category.sort_order = new_order
        db_category.save()
        return db_category
    
    @staticmethod
    def get_category(category_id: str):
        """
        获取单个数据源分类
        
        Args:
            category_id: 数据源分类ID
            
        Returns:
            DatasourceCategory: 数据源分类对象，不存在则返回None
        """
        try:
            return DatasourceCategory.get_by_id(category_id)
        except DatasourceCategory.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: DatasourceCategoryUpdate):
        """
        更新数据源分类
        
        Args:
            category_id: 数据源分类ID
            category: 数据源分类更新DTO
            
        Returns:
            DatasourceCategory: 更新后的数据源分类对象
            
        Raises:
            ResourceNotFoundError: 数据源分类不存在
        """
        try:
            db_category = DatasourceCategory.get_by_id(category_id)
        except DatasourceCategory.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"数据源分类 {category_id} 不存在"
            )
        
        update_data = category.model_dump(exclude_unset=True)
        
        if 'name' in update_data or 'parent_id' in update_data:
            name = update_data.get('name', db_category.name)
            parent_id = update_data.get('parent_id', db_category.parent_id)
            
            existing_category = DatasourceCategory.select().where(
                DatasourceCategory.name == name,
                DatasourceCategory.parent_id == parent_id,
                DatasourceCategory.id != category_id
            ).first()
            
            if existing_category:
                raise ValueError(f"同一父分类下已存在名为 '{name}' 的分类")
        
        for field, value in update_data.items():
            setattr(db_category, field, value)
        db_category.updated_at = datetime.now()
        db_category.save()
        return db_category
    
    @staticmethod
    @handle_transaction
    def delete_category(category_id: str):
        """
        删除数据源分类（软删除）
        
        Args:
            category_id: 数据源分类ID
            
        Returns:
            DatasourceCategory: 被删除的数据源分类对象
            
        Raises:
            ResourceNotFoundError: 数据源分类不存在
            ValueError: 不能删除默认分类或分类下有数据
        """
        try:
            db_category = DatasourceCategory.get_by_id(category_id)
        except:
            raise ResourceNotFoundError(
                resource_type="数据源分类",
                resource_id=category_id,
                message=f"数据源分类 {category_id} 不存在"
            )
        
        if db_category.is_default:
            raise ValueError("不能删除默认分类")
        
        from app.database.models import Datasource
        datasources_in_category = Datasource.select().where(
            (Datasource.category_id == category_id) & 
            (Datasource.deleted == False)
        ).count()
        
        if datasources_in_category > 0:
            raise ValueError(f"该分类下存在 {datasources_in_category} 个数据源，无法删除")
        
        def check_subcategories(parent_id):
            subcategories = DatasourceCategory.select().where(
                (DatasourceCategory.parent_id == parent_id) &
                (DatasourceCategory.deleted == False)
            )
            
            for subcategory in subcategories:
                datasources_count = Datasource.select().where(
                    (Datasource.category_id == subcategory.id) & 
                    (Datasource.deleted == False)
                ).count()
                
                if datasources_count > 0:
                    raise ValueError(f"子分类 '{subcategory.name}' 下存在 {datasources_count} 个数据源，无法删除")
                
                check_subcategories(subcategory.id)
        
        check_subcategories(category_id)
        
        db_category.delete_instance()
        return db_category
