"""
机器人分类服务类，提供机器人分类相关的CRUD操作
"""

from datetime import datetime
from app.database.models import ChatbotCategory
from app.services.chatbot_category.dto import ChatbotCategoryCreate, ChatbotCategoryUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class ChatbotCategoryService:
    """
    机器人分类服务类
    
    提供机器人分类的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def get_default_category():
        """
        获取默认分类，如果不存在则创建
        
        Returns:
            ChatbotCategory: 默认分类对象
        """
        default_category = ChatbotCategory.select().where(ChatbotCategory.is_default == True).first()
        if not default_category:
            default_category = ChatbotCategory(
                name="默认分类",
                description="系统默认分类",
                is_default=True
            )
            default_category.save()
        return default_category
    
    @staticmethod
    @handle_transaction
    def create_category(category: ChatbotCategoryCreate):
        """
        创建机器人分类
        
        Args:
            category: 机器人分类创建DTO
            
        Returns:
            ChatbotCategory: 创建的机器人分类对象
            
        Raises:
            DuplicateResourceError: 同一父分类下已存在同名分类
        """
        # 检查同一父分类下是否已存在同名分类（排除已删除的）
        existing_category = ChatbotCategory.select().where(
            ChatbotCategory.name == category.name,
            ChatbotCategory.parent_id == category.parent_id,
            ChatbotCategory.deleted == False
        ).first()
        
        if existing_category:
            raise ValueError(f"同一父分类下已存在名为 '{category.name}' 的分类")
        
        db_category = ChatbotCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category
    
    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100, parent_id: str = None):
        """
        获取机器人分类列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            parent_id: 父分类ID，为None时获取所有分类
            
        Returns:
            List[ChatbotCategory]: 机器人分类列表
        """
        query = ChatbotCategory.select().order_by(ChatbotCategory.sort_order.asc())
        if parent_id is not None:
            query = query.where(ChatbotCategory.parent_id == parent_id)
        # 当parent_id为None时，返回所有分类，包括子分类
        return list(query.offset(skip).limit(limit))
    
    @staticmethod
    def get_category_tree():
        """
        获取分类树结构
        
        Returns:
            List[dict]: 分类树结构
        """
        # 获取所有未删除的分类
        all_categories = list(ChatbotCategory.select().where(
            ChatbotCategory.deleted == False
        ).order_by(ChatbotCategory.sort_order.asc()))
        
        # 构建分类节点映射，使用移除横杠的ID作为键
        def remove_hyphens(id_str):
            return str(id_str).replace('-', '')
        
        # 首先创建所有节点
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
        
        # 构建树结构
        tree = []
        for category in all_categories:
            node_id = remove_hyphens(category.id)
            node = node_map[node_id]
            
            # 如果是顶级分类（parent_id为None）
            if not category.parent_id:
                tree.append(node)
            else:
                # 查找父分类并添加为子节点
                try:
                    parent_id = remove_hyphens(str(category.parent_id))
                    if parent_id in node_map:
                        node_map[parent_id]['children'].append(node)
                except Exception as e:
                    pass
        
        # 按排序顺序排序
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
            ChatbotCategory: 更新后的分类对象
            
        Raises:
            ResourceNotFoundError: 分类不存在
        """
        try:
            db_category = ChatbotCategory.get_by_id(category_id)
        except ChatbotCategory.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"机器人分类 {category_id} 不存在"
            )
        
        db_category.sort_order = new_order
        db_category.save()
        return db_category
    
    @staticmethod
    def get_category(category_id: str):
        """
        获取单个机器人分类
        
        Args:
            category_id: 机器人分类ID
            
        Returns:
            ChatbotCategory: 机器人分类对象，不存在则返回None
        """
        try:
            return ChatbotCategory.get_by_id(category_id)
        except ChatbotCategory.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: ChatbotCategoryUpdate):
        """
        更新机器人分类
        
        Args:
            category_id: 机器人分类ID
            category: 机器人分类更新DTO
            
        Returns:
            ChatbotCategory: 更新后的机器人分类对象
            
        Raises:
            ResourceNotFoundError: 机器人分类不存在
        """
        try:
            db_category = ChatbotCategory.get_by_id(category_id)
        except ChatbotCategory.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"机器人分类 {category_id} 不存在"
            )
        
        update_data = category.model_dump(exclude_unset=True)
        
        # 检查同一父分类下是否已存在同名分类
        if 'name' in update_data or 'parent_id' in update_data:
            name = update_data.get('name', db_category.name)
            parent_id = update_data.get('parent_id', db_category.parent_id)
            
            existing_category = ChatbotCategory.select().where(
                ChatbotCategory.name == name,
                ChatbotCategory.parent_id == parent_id,
                ChatbotCategory.id != category_id
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
        删除机器人分类（软删除）
        
        Args:
            category_id: 机器人分类ID
            
        Returns:
            ChatbotCategory: 被删除的机器人分类对象
            
        Raises:
            ResourceNotFoundError: 机器人分类不存在
            ValueError: 不能删除默认分类或分类下有数据
        """
        try:
            db_category = ChatbotCategory.get_by_id(category_id)
        except:
            raise ResourceNotFoundError(
                resource_type="机器人分类",
                resource_id=category_id,
                message=f"机器人分类 {category_id} 不存在"
            )
        
        if db_category.is_default:
            raise ValueError("不能删除默认分类")
        
        # 检查分类下是否有机器人
        from app.database.models import Chatbot
        bots_in_category = Chatbot.select().where(
            (Chatbot.category_id == category_id) & 
            (Chatbot.deleted == False)
        ).count()
        
        if bots_in_category > 0:
            raise ValueError(f"该分类下存在 {bots_in_category} 个机器人，无法删除")
        
        # 递归检查所有子分类
        def check_subcategories(parent_id):
            """递归检查子分类下是否有机器人"""
            subcategories = ChatbotCategory.select().where(
                (ChatbotCategory.parent_id == parent_id) &
                (ChatbotCategory.deleted == False)
            )
            
            for subcategory in subcategories:
                # 检查子分类下是否有机器人
                bots_count = Chatbot.select().where(
                    (Chatbot.category_id == subcategory.id) & 
                    (Chatbot.deleted == False)
                ).count()
                
                if bots_count > 0:
                    raise ValueError(f"子分类 '{subcategory.name}' 下存在 {bots_count} 个机器人，无法删除")
                
                # 递归检查子分类的子分类
                check_subcategories(subcategory.id)
        
        # 检查所有子分类
        check_subcategories(category_id)
        
        db_category.delete_instance()
        return db_category
