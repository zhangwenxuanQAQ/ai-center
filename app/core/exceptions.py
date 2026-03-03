"""
自定义异常类定义
"""


class BaseServiceError(Exception):
    """
    Service层基础异常
    
    Attributes:
        message: 错误消息
        detail: 错误详情
    """
    def __init__(self, message: str, detail: str = None):
        """
        初始化异常
        
        Args:
            message: 错误消息
            detail: 错误详情
        """
        self.message = message
        self.detail = detail
        super().__init__(self.message)


class ResourceNotFoundError(BaseServiceError):
    """
    资源未找到异常
    """
    pass


class DuplicateResourceError(BaseServiceError):
    """
    资源重复异常（唯一约束冲突）
    """
    pass


class DatabaseOperationError(BaseServiceError):
    """
    数据库操作异常
    """
    pass
