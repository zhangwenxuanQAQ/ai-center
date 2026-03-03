"""
用户控制器，提供用户相关的API接口
"""

from fastapi import APIRouter
from typing import List
from app.services.user.service import UserService
from app.services.user.dto import UserCreate, UserUpdate, User as UserSchema, UserLogin
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


@router.post("", response_model=ApiResponse)
def create_user(user: UserCreate):
    """
    创建用户
    
    Args:
        user: 用户创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_user = UserService.create_user(user)
    return ResponseUtil.created(data=db_user.__data__, message="用户创建成功")


@router.get("", response_model=ApiResponse)
def get_users(skip: int = 0, limit: int = 100):
    """
    获取用户列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    users = UserService.get_users(skip, limit)
    users_data = [user.__data__ for user in users]
    return ResponseUtil.success(data=users_data, message="获取用户列表成功")


@router.get("/{user_id}", response_model=ApiResponse)
def get_user(user_id: int):
    """
    获取单个用户
    
    Args:
        user_id: 用户ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    user = UserService.get_user(user_id)
    if user is None:
        return ResponseUtil.not_found(message=f"用户 {user_id} 不存在")
    return ResponseUtil.success(data=user.__data__, message="获取用户成功")


@router.post("/{user_id}", response_model=ApiResponse)
def update_user(user_id: int, user: UserUpdate):
    """
    更新用户
    
    Args:
        user_id: 用户ID
        user: 用户更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_user = UserService.update_user(user_id, user)
    return ResponseUtil.success(data=db_user.__data__, message="用户更新成功")


@router.post("/{user_id}/delete", response_model=ApiResponse)
def delete_user(user_id: int):
    """
    删除用户
    
    Args:
        user_id: 用户ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_user = UserService.delete_user(user_id)
    return ResponseUtil.success(data=db_user.__data__, message="用户删除成功")


@router.post("/login", response_model=ApiResponse)
def login(user: UserLogin):
    """
    用户登录
    
    Args:
        user: 用户登录DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    # 这里可以添加登录逻辑
    return ResponseUtil.success(data={"access_token": "token", "token_type": "bearer"}, message="登录成功")
