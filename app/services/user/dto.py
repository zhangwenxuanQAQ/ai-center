"""
用户数据传输对象（DTO）
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from app.services.base_dto import BaseDTO


class UserBase(BaseModel):
    """
    用户基础DTO
    
    Attributes:
        username: 用户名
        email: 邮箱地址
        is_admin: 是否为管理员
    """
    username: str = Field(..., min_length=3, max_length=50, description="用户名，长度3-50个字符")
    email: EmailStr = Field(..., description="邮箱地址")
    is_admin: bool = Field(default=False, description="是否为管理员")


class UserCreate(UserBase):
    """
    用户创建DTO
    
    Attributes:
        password: 密码
    """
    password: str = Field(..., min_length=6, max_length=100, description="密码，长度6-100个字符")


class UserUpdate(BaseModel):
    """
    用户更新DTO
    
    Attributes:
        username: 用户名
        email: 邮箱地址
        password: 密码
        is_admin: 是否为管理员
    """
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="用户名，长度3-50个字符")
    email: Optional[EmailStr] = Field(None, description="邮箱地址")
    password: Optional[str] = Field(None, min_length=6, max_length=100, description="密码，长度6-100个字符")
    is_admin: Optional[bool] = Field(None, description="是否为管理员")


class User(UserBase, BaseDTO):
    """
    用户响应DTO
    
    继承自UserBase和BaseDTO，包含用户基本信息和公共字段
    """
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """
    用户登录DTO
    
    Attributes:
        username: 用户名
        password: 密码
    """
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    password: str = Field(..., min_length=6, max_length=100, description="密码")
