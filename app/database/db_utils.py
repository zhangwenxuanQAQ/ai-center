"""
数据库事务管理工具
"""

from contextlib import contextmanager
from typing import Callable, TypeVar
from peewee import IntegrityError, OperationalError, InterfaceError
from app.database.database import db, get_db_connection
from app.core.exceptions import (
    ResourceNotFoundError,
    DuplicateResourceError,
    DatabaseOperationError
)

T = TypeVar('T')


def _safe_rollback():
    """
    安全回滚事务，处理连接断开的情况
    
    当数据库连接已断开时，rollback 也会失败，需要捕获异常并尝试重新连接
    """
    try:
        db.rollback()
    except (InterfaceError, OperationalError):
        try:
            db.close()
            db.connect(reuse_if_open=True)
        except Exception:
            pass


@contextmanager
def transaction_scope():
    """
    事务上下文管理器，自动处理事务提交和回滚
    
    使用示例:
        with transaction_scope():
            obj.save()
            # 其他数据库操作
            # 退出上下文时自动提交，异常时自动回滚
    """
    try:
        db.begin()
        yield
        db.commit()
    except IntegrityError as e:
        _safe_rollback()
        if 'Duplicate entry' in str(e) or 'UNIQUE constraint' in str(e):
            raise DuplicateResourceError(
                message="资源已存在",
                detail=str(e)
            ) from e
        elif 'foreign key constraint' in str(e).lower():
            raise ResourceNotFoundError(
                message="关联资源不存在",
                detail=str(e)
            ) from e
        else:
            raise DatabaseOperationError(
                message="数据完整性约束违反",
                detail=str(e)
            ) from e
    except OperationalError as e:
        _safe_rollback()
        raise DatabaseOperationError(
            message="数据库操作失败",
            detail=str(e)
        ) from e
    except InterfaceError as e:
        _safe_rollback()
        raise DatabaseOperationError(
            message="数据库连接失败，请重试",
            detail=str(e)
        ) from e
    except Exception as e:
        _safe_rollback()
        raise


def handle_transaction(func: Callable[..., T]) -> Callable[..., T]:
    """
    事务管理装饰器，自动处理事务提交和回滚
    
    使用示例:
        @handle_transaction
        def create_user(user: UserCreate):
            db_user = User(**user.model_dump())
            db_user.save()
            return db_user
    """
    def wrapper(*args, **kwargs):
        try:
            db.begin()
            result = func(*args, **kwargs)
            db.commit()
            return result
        except IntegrityError as e:
            _safe_rollback()
            if 'Duplicate entry' in str(e) or 'UNIQUE constraint' in str(e):
                raise DuplicateResourceError(
                    message="资源已存在",
                    detail=str(e)
                ) from e
            elif 'foreign key constraint' in str(e).lower():
                raise ResourceNotFoundError(
                    message="关联资源不存在",
                    detail=str(e)
                ) from e
            else:
                raise DatabaseOperationError(
                    message="数据完整性约束违反",
                    detail=str(e)
                ) from e
        except OperationalError as e:
            _safe_rollback()
            raise DatabaseOperationError(
                message="数据库操作失败",
                detail=str(e)
            ) from e
        except InterfaceError as e:
            _safe_rollback()
            raise DatabaseOperationError(
                message="数据库连接失败，请重试",
                detail=str(e)
            ) from e
        except Exception:
            _safe_rollback()
            raise
    
    return wrapper
