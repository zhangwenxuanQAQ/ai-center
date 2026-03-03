"""
统一返回格式工具类
"""

from typing import Any, Optional
from pydantic import BaseModel


class ApiResponse(BaseModel):
    """
    统一API响应格式
    
    Attributes:
        code: 返回码/错误码
        message: 描述信息
        data: 返回数据
    """
    code: int
    message: str
    data: Optional[Any] = None


class ResponseCode:
    """
    响应码枚举类
    """
    SUCCESS = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    INTERNAL_ERROR = 500


class ResponseUtil:
    """
    响应工具类，用于构建统一的API响应
    """
    
    @staticmethod
    def success(data: Any = None, message: str = "操作成功") -> ApiResponse:
        """
        构建成功响应
        
        Args:
            data: 返回的数据
            message: 描述信息
            
        Returns:
            ApiResponse: 统一格式的响应对象
        """
        return ApiResponse(
            code=ResponseCode.SUCCESS,
            message=message,
            data=data
        )
    
    @staticmethod
    def created(data: Any = None, message: str = "创建成功") -> ApiResponse:
        """
        构建创建成功响应
        
        Args:
            data: 返回的数据
            message: 描述信息
            
        Returns:
            ApiResponse: 统一格式的响应对象
        """
        return ApiResponse(
            code=ResponseCode.CREATED,
            message=message,
            data=data
        )
    
    @staticmethod
    def error(code: int = ResponseCode.INTERNAL_ERROR, message: str = "操作失败", data: Any = None) -> ApiResponse:
        """
        构建错误响应
        
        Args:
            code: 错误码
            message: 错误描述信息
            data: 返回的数据
            
        Returns:
            ApiResponse: 统一格式的响应对象
        """
        return ApiResponse(
            code=code,
            message=message,
            data=data
        )
    
    @staticmethod
    def not_found(message: str = "资源不存在") -> ApiResponse:
        """
        构建资源不存在响应
        
        Args:
            message: 错误描述信息
            
        Returns:
            ApiResponse: 统一格式的响应对象
        """
        return ApiResponse(
            code=ResponseCode.NOT_FOUND,
            message=message,
            data=None
        )
    
    @staticmethod
    def bad_request(message: str = "请求参数错误") -> ApiResponse:
        """
        构建请求参数错误响应
        
        Args:
            message: 错误描述信息
            
        Returns:
            ApiResponse: 统一格式的响应对象
        """
        return ApiResponse(
            code=ResponseCode.BAD_REQUEST,
            message=message,
            data=None
        )
