"""
机器人分类服务类，提供机器人分类相关的CRUD操作
"""

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
        """
        db_category = ChatbotCategory(**category.model_dump())
        db_category.save()
        return db_category
    
    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100):
        """
        获取机器人分类列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[ChatbotCategory]: 机器人分类列表
        """
        return list(ChatbotCategory.select().offset(skip).limit(limit))
    
    @staticmethod
    def get_category(category_id: int):
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
    def update_category(category_id: int, category: ChatbotCategoryUpdate):
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
        for field, value in update_data.items():
            setattr(db_category, field, value)
        db_category.save()
        return db_category
    
    @staticmethod
    @handle_transaction
    def delete_category(category_id: int):
        """
        删除机器人分类
        
        Args:
            category_id: 机器人分类ID
            
        Returns:
            ChatbotCategory: 被删除的机器人分类对象
            
        Raises:
            ResourceNotFoundError: 机器人分类不存在
        """
        try:
            db_category = ChatbotCategory.get_by_id(category_id)
        except ChatbotCategory.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"机器人分类 {category_id} 不存在"
            )
        
        if db_category.is_default:
            raise ValueError("不能删除默认分类")
        
        db_category.delete_instance()
        return db_category
