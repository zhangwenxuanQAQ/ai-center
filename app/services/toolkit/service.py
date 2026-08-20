"""
工具箱服务类，提供工具箱分类相关的CRUD操作
"""

from datetime import datetime
from typing import List, Optional
from app.database.models import ToolkitCategory, MCPServer, MCPTool
from app.services.toolkit.dto import ToolkitCategoryCreate, ToolkitCategoryUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError
from app.constants.toolkit_constants import DEFAULT_TOOLKIT_CATEGORIES, TOOL_TYPE_NAME


class ToolkitCategoryService:
    """
    工具箱分类服务类

    提供工具箱分类的创建、查询、更新、删除等操作
    """

    @staticmethod
    def init_default_categories():
        """
        初始化默认顶级分类。

        根据 DEFAULT_TOOLKIT_CATEGORIES 创建缺失的默认顶级分类。
        已存在的默认分类不会重复创建。
        """
        for item in DEFAULT_TOOLKIT_CATEGORIES:
            existing = ToolkitCategory.select().where(
                (ToolkitCategory.type == item["type"]) &
                (ToolkitCategory.is_default == True) &
                (ToolkitCategory.deleted == False)
            ).first()
            if existing:
                continue

            category = ToolkitCategory(
                name=item["name"],
                type=item["type"],
                sort_order=item["sort_order"],
                is_default=True,
                description=f"{item['name']}分类"
            )
            category.save(force_insert=True)

    @staticmethod
    @handle_transaction
    def create_category(category: ToolkitCategoryCreate):
        """
        创建工具箱分类

        Args:
            category: 工具箱分类创建DTO

        Returns:
            ToolkitCategory: 创建的分类对象

        Raises:
            DuplicateResourceError: 同一父分类下名称已存在
        """
        parent_id = category.parent_id

        existing = ToolkitCategory.select().where(
            (ToolkitCategory.name == category.name) &
            (ToolkitCategory.parent_id == parent_id if parent_id else ToolkitCategory.parent_id.is_null()) &
            (ToolkitCategory.deleted == False)
        ).first()

        if existing:
            raise DuplicateResourceError(f"分类名称 '{category.name}' 已存在")

        db_category = ToolkitCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category

    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100, type: Optional[str] = None):
        """
        获取工具箱分类列表

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            type: 工具类型过滤（可选）

        Returns:
            List[ToolkitCategory]: 分类列表
        """
        query = ToolkitCategory.select().where(ToolkitCategory.deleted == False)
        if type:
            query = query.where(ToolkitCategory.type == type)
        return list(query.order_by(ToolkitCategory.sort_order).offset(skip).limit(limit))

    @staticmethod
    def get_category_tree(type: Optional[str] = None):
        """
        获取工具箱分类树形结构

        Args:
            type: 工具类型过滤（可选），仅返回该类型下的分类树

        Returns:
            List[dict]: 分类树形结构
        """
        query = ToolkitCategory.select().where(ToolkitCategory.deleted == False)
        if type:
            query = query.where(ToolkitCategory.type == type)
        categories = list(query.order_by(ToolkitCategory.sort_order))

        def build_tree(parent_id=None):
            tree = []
            for cat in categories:
                if cat.parent_id == parent_id:
                    node = {
                        "id": str(cat.id),
                        "name": cat.name,
                        "description": cat.description,
                        "type": cat.type,
                        "is_default": cat.is_default,
                        "parent_id": str(cat.parent_id) if cat.parent_id else None,
                        "sort_order": cat.sort_order,
                        "tool_count": ToolkitCategoryService._count_tools_by_category(cat.id, cat.type),
                        "children": build_tree(cat.id)
                    }
                    tree.append(node)
            return tree

        return build_tree()

    @staticmethod
    def _count_tools_by_category(category_id: str, tool_type: Optional[str]) -> int:
        """
        统计分类下的工具数量

        Args:
            category_id: 分类ID
            tool_type: 工具类型

        Returns:
            int: 工具数量
        """
        if not tool_type:
            return 0

        # 递归获取所有子分类ID
        def get_all_child_ids(parent_id: str) -> list:
            ids = [parent_id]
            children = ToolkitCategory.select().where(
                (ToolkitCategory.parent_id == parent_id) &
                (ToolkitCategory.deleted == False)
            )
            for child in children:
                ids.extend(get_all_child_ids(child.id))
            return ids

        all_ids = get_all_child_ids(category_id)

        if tool_type == "mcp":
            # 统计mcp服务数量
            return MCPServer.select().where(
                (MCPServer.category_id.in_(all_ids)) &
                (MCPServer.deleted == False)
            ).count()
        # 其他类型暂无对应数据表，返回0
        return 0

    @staticmethod
    def get_category(category_id: str):
        """
        获取单个工具箱分类

        Args:
            category_id: 分类ID

        Returns:
            ToolkitCategory: 分类对象，不存在则返回None
        """
        try:
            category = ToolkitCategory.get_by_id(category_id)
            if category.deleted:
                return None
            return category
        except ToolkitCategory.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: ToolkitCategoryUpdate):
        """
        更新工具箱分类

        Args:
            category_id: 分类ID
            category: 分类更新DTO

        Returns:
            ToolkitCategory: 更新后的分类对象

        Raises:
            ResourceNotFoundError: 分类不存在
            DuplicateResourceError: 同一父分类下名称已存在
        """
        try:
            db_category = ToolkitCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"工具箱分类 {category_id} 不存在")
        except ToolkitCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"工具箱分类 {category_id} 不存在")

        update_data = category.model_dump(exclude_unset=True)

        if 'name' in update_data:
            parent_id = update_data.get('parent_id', db_category.parent_id)
            existing = ToolkitCategory.select().where(
                (ToolkitCategory.name == update_data['name']) &
                (ToolkitCategory.parent_id == parent_id if parent_id else ToolkitCategory.parent_id.is_null()) &
                (ToolkitCategory.id != category_id) &
                (ToolkitCategory.deleted == False)
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
        删除工具箱分类（逻辑删除）

        Args:
            category_id: 分类ID

        Returns:
            ToolkitCategory: 被删除的分类对象

        Raises:
            ResourceNotFoundError: 分类不存在
            ValueError: 分类下存在工具，无法删除
        """
        try:
            db_category = ToolkitCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"工具箱分类 {category_id} 不存在")
        except ToolkitCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"工具箱分类 {category_id} 不存在")

        # 默认分类不允许删除
        if db_category.is_default:
            raise ValueError("默认分类不允许删除")

        # 递归获取所有子分类ID
        def get_all_child_category_ids(parent_id: str) -> list:
            child_ids = [parent_id]
            children = ToolkitCategory.select().where(
                (ToolkitCategory.parent_id == parent_id) &
                (ToolkitCategory.deleted == False)
            )
            for child in children:
                child_ids.extend(get_all_child_category_ids(child.id))
            return child_ids

        all_category_ids = get_all_child_category_ids(category_id)

        # 检查分类下是否有工具
        tool_count = ToolkitCategoryService._count_tools_by_category(category_id, db_category.type)
        if tool_count > 0:
            type_name = TOOL_TYPE_NAME.get(db_category.type, db_category.type)
            raise ValueError(f"该分类或其子分类下存在 {tool_count} 个{type_name}，无法删除")

        db_category.deleted = True
        db_category.deleted_at = datetime.now()
        db_category.save()
        return db_category
