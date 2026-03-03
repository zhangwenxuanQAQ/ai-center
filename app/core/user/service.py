from sqlalchemy.orm import Session
from app.database.models import User
from app.core.user.dto import UserCreate, UserUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class UserService:
    @staticmethod
    @handle_transaction
    def create_user(db: Session, user: UserCreate):
        """创建用户"""
        db_user = User(**user.model_dump())
        db.add(db_user)
        db.refresh(db_user)
        return db_user

    @staticmethod
    def get_users(db: Session, skip: int = 0, limit: int = 100):
        """获取用户列表（只读操作，不需要事务）"""
        return db.query(User).offset(skip).limit(limit).all()

    @staticmethod
    def get_user(db: Session, user_id: int):
        """获取单个用户（只读操作，不需要事务）"""
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    @handle_transaction
    def update_user(db: Session, user_id: int, user: UserUpdate):
        """更新用户"""
        db_user = db.query(User).filter(User.id == user_id).first()
        if not db_user:
            raise ResourceNotFoundError(
                message=f"用户 {user_id} 不存在"
            )
        update_data = user.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_user, field, value)
        db.refresh(db_user)
        return db_user

    @staticmethod
    @handle_transaction
    def delete_user(db: Session, user_id: int):
        """删除用户"""
        db_user = db.query(User).filter(User.id == user_id).first()
        if not db_user:
            raise ResourceNotFoundError(
                message=f"用户 {user_id} 不存在"
            )
        db.delete(db_user)
        return db_user