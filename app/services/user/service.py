"""
用户服务类，提供用户相关的CRUD操作
"""

from app.database.models import User
from app.services.user.dto import UserCreate, UserUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class UserService:
    """
    用户服务类
    
    提供用户的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_user(user: UserCreate):
        """
        创建用户
        
        Args:
            user: 用户创建DTO
            
        Returns:
            User: 创建的用户对象
        """
        db_user = User(**user.model_dump())
        db_user.save()
        return db_user

    @staticmethod
    def get_users(skip: int = 0, limit: int = 100):
        """
        获取用户列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[User]: 用户列表
        """
        return list(User.select().offset(skip).limit(limit))

    @staticmethod
    def get_user(user_id: int):
        """
        获取单个用户
        
        Args:
            user_id: 用户ID
            
        Returns:
            User: 用户对象，不存在则返回None
        """
        try:
            return User.get_by_id(user_id)
        except User.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_user(user_id: int, user: UserUpdate):
        """
        更新用户
        
        Args:
            user_id: 用户ID
            user: 用户更新DTO
            
        Returns:
            User: 更新后的用户对象
            
        Raises:
            ResourceNotFoundError: 用户不存在
        """
        try:
            db_user = User.get_by_id(user_id)
        except User.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"用户 {user_id} 不存在"
            )
        update_data = user.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_user, field, value)
        db_user.save()
        return db_user

    @staticmethod
    @handle_transaction
    def delete_user(user_id: int):
        """
        删除用户
        
        Args:
            user_id: 用户ID
            
        Returns:
            User: 被删除的用户对象
            
        Raises:
            ResourceNotFoundError: 用户不存在
        """
        try:
            db_user = User.get_by_id(user_id)
        except User.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"用户 {user_id} 不存在"
            )
        db_user.delete_instance()
        return db_user
