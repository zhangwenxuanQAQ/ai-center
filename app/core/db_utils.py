"""数据库事务管理工具"""

from contextlib import contextmanager
from typing import Callable, TypeVar, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError, DatabaseError
from app.core.exceptions import (
    ResourceNotFoundError,
    DuplicateResourceError,
    DatabaseOperationError
)

T = TypeVar('T')


@contextmanager
def transaction_scope(db: Session):
    """
    事务上下文管理器，自动处理事务提交和回滚
    
    使用示例:
        with transaction_scope(db):
            db.add(obj)
            # 其他数据库操作
            # 退出上下文时自动提交，异常时自动回滚
    """
    try:
        yield db
        db.commit()
    except IntegrityError as e:
        db.rollback()
        # 判断是否是唯一约束冲突
        if 'Duplicate entry' in str(e.orig) or 'UNIQUE constraint' in str(e.orig):
            raise DuplicateResourceError(
                message="资源已存在",
                detail=str(e.orig)
            ) from e
        # 判断是否是外键约束失败
        elif 'foreign key constraint' in str(e.orig).lower():
            raise ResourceNotFoundError(
                message="关联资源不存在",
                detail=str(e.orig)
            ) from e
        else:
            raise DatabaseOperationError(
                message="数据完整性约束违反",
                detail=str(e.orig)
            ) from e
    except OperationalError as e:
        db.rollback()
        raise DatabaseOperationError(
            message="数据库操作失败",
            detail=str(e.orig)
        ) from e
    except DatabaseError as e:
        db.rollback()
        raise DatabaseOperationError(
            message="数据库错误",
            detail=str(e.orig)
        ) from e
    except Exception as e:
        db.rollback()
        # 重新抛出其他异常
        raise


def handle_transaction(func: Callable[..., T]) -> Callable[..., T]:
    """
    事务管理装饰器，自动处理事务提交和回滚
    
    使用示例:
        @handle_transaction
        def create_user(db: Session, user: UserCreate):
            db_user = User(**user.model_dump())
            db.add(db_user)
            db.refresh(db_user)
            return db_user
    """
    def wrapper(*args, **kwargs):
        db = kwargs.get('db')
        if db is None and len(args) > 0:
            # 假设第一个参数是 db
            db = args[0]
        
        if db is None:
            raise ValueError("db 参数必须提供")
        
        try:
            result = func(*args, **kwargs)
            db.commit()
            return result
        except IntegrityError as e:
            db.rollback()
            if 'Duplicate entry' in str(e.orig) or 'UNIQUE constraint' in str(e.orig):
                raise DuplicateResourceError(
                    message="资源已存在",
                    detail=str(e.orig)
                ) from e
            elif 'foreign key constraint' in str(e.orig).lower():
                raise ResourceNotFoundError(
                    message="关联资源不存在",
                    detail=str(e.orig)
                ) from e
            else:
                raise DatabaseOperationError(
                    message="数据完整性约束违反",
                    detail=str(e.orig)
                ) from e
        except OperationalError as e:
            db.rollback()
            raise DatabaseOperationError(
                message="数据库操作失败",
                detail=str(e.orig)
            ) from e
        except DatabaseError as e:
            db.rollback()
            raise DatabaseOperationError(
                message="数据库错误",
                detail=str(e.orig)
            ) from e
        except Exception:
            db.rollback()
            raise
    
    return wrapper