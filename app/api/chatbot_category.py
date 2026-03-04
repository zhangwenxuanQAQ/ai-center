"""
机器人分类控制器，提供机器人分类相关的API接口
"""

from fastapi import APIRouter
from app.services.chatbot_category.service import ChatbotCategoryService
from app.services.chatbot_category.dto import ChatbotCategoryCreate, ChatbotCategoryUpdate, ChatbotCategory as ChatbotCategorySchema
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


@router.post("", response_model=ApiResponse)
def create_category(category: ChatbotCategoryCreate):
    """
    创建机器人分类
    
    Args:
        category: 机器人分类创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ChatbotCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="机器人分类创建成功")


@router.get("", response_model=ApiResponse)
def get_categories(skip: int = 0, limit: int = 100):
    """
    获取机器人分类列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = ChatbotCategoryService.get_categories(skip, limit)
    categories_data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取机器人分类列表成功")


@router.get("/{category_id}", response_model=ApiResponse)
def get_category(category_id: int):
    """
    获取单个机器人分类
    
    Args:
        category_id: 机器人分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = ChatbotCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"机器人分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取机器人分类成功")


@router.post("/{category_id}", response_model=ApiResponse)
def update_category(category_id: int, category: ChatbotCategoryUpdate):
    """
    更新机器人分类
    
    Args:
        category_id: 机器人分类ID
        category: 机器人分类更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ChatbotCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=db_category.__data__, message="机器人分类更新成功")


@router.post("/{category_id}/delete", response_model=ApiResponse)
def delete_category(category_id: int):
    """
    删除机器人分类
    
    Args:
        category_id: 机器人分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ChatbotCategoryService.delete_category(category_id)
    return ResponseUtil.success(data=db_category.__data__, message="机器人分类删除成功")
