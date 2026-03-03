from peewee import MySQLDatabase
from app.database.models import User
from app.core.user.dto import UserCreate, UserUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class UserService:
    @staticmethod
    @handle_transaction
    def create_user(db: MySQLDatabase, user: UserCreate):
        """创建用户"""
        db_user = User(**user.model_dump())
        db_user.save()
        return db_user

    @staticmethod
    def get_users(db: MySQLDatabase, skip: int = 0, limit: int = 100):
        """获取用户列表（只读操作，不需要事务）"""
        return list(User.select().offset(skip).limit(limit))

    @staticmethod
    def get_user(db: MySQLDatabase, user_id: int):
        """获取单个用户（只读操作，不需要事务）"""
        try:
            return User.get_by_id(user_id)
        except User.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_user(db: MySQLDatabase, user_id: int, user: UserUpdate):
        """更新用户"""
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
    def delete_user(db: MySQLDatabase, user_id: int):
        """删除用户"""
        try:
            db_user = User.get_by_id(user_id)
        except User.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"用户 {user_id} 不存在"
            )
        db_user.delete_instance()
        return db_user