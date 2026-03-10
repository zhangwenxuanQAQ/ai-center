"""
机器人分类控制器，提供机器人分类相关的API接口
"""

from fastapi import APIRouter
from app.services.chatbot_category.service import ChatbotCategoryService
from app.services.chatbot_category.dto import ChatbotCategoryCreate, ChatbotCategoryUpdate, ChatbotCategory as ChatbotCategorySchema
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


def format_category_data(data: dict) -> dict:
    """格式化分类数据，移除ID中的横杠"""
    if data.get('id'):
        data['id'] = str(data['id']).replace('-', '')
    if data.get('parent_id'):
        data['parent_id'] = str(data['parent_id']).replace('-', '')
    return data


def format_category_tree(tree: list) -> list:
    """格式化分类树数据，移除ID中的横杠"""
    result = []
    for node in tree:
        formatted_node = format_category_data(node.copy())
        if formatted_node.get('children'):
            formatted_node['children'] = format_category_tree(formatted_node['children'])
        result.append(formatted_node)
    return result


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
    return ResponseUtil.created(data=format_category_data(db_category.__data__.copy()), message="机器人分类创建成功")


@router.get("", response_model=ApiResponse)
def get_categories(skip: int = 0, limit: int = 100, parent_id: str = None):
    """
    获取机器人分类列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        parent_id: 父分类ID，为None时获取顶级分类
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = ChatbotCategoryService.get_categories(skip, limit, parent_id)
    categories_data = [format_category_data(category.__data__.copy()) for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取机器人分类列表成功")


@router.get("/tree", response_model=ApiResponse)
def get_category_tree():
    """
    获取分类树结构
    
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category_tree = ChatbotCategoryService.get_category_tree()
    return ResponseUtil.success(data=format_category_tree(category_tree), message="获取分类树结构成功")


@router.post("/{category_id}/order", response_model=ApiResponse)
def update_category_order(category_id: str, order_data: dict):
    """
    更新分类排序
    
    Args:
        category_id: 分类ID
        order_data: 包含新排序值的对象
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    new_order = order_data.get('sort_order', 0)
    db_category = ChatbotCategoryService.update_category_order(category_id, new_order)
    return ResponseUtil.success(data=format_category_data(db_category.__data__.copy()), message="分类排序更新成功")


@router.get("/{category_id}", response_model=ApiResponse)
def get_category(category_id: str):
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
    return ResponseUtil.success(data=format_category_data(category.__data__.copy()), message="获取机器人分类成功")


@router.post("/{category_id}", response_model=ApiResponse)
def update_category(category_id: str, category: ChatbotCategoryUpdate):
    """
    更新机器人分类
    
    Args:
        category_id: 机器人分类ID
        category: 机器人分类更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ChatbotCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=format_category_data(db_category.__data__.copy()), message="机器人分类更新成功")


@router.post("/{category_id}/delete", response_model=ApiResponse)
def delete_category(category_id: str):
    """
    删除机器人分类
    
    Args:
        category_id: 机器人分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ChatbotCategoryService.delete_category(category_id)
    return ResponseUtil.success(data=format_category_data(db_category.__data__.copy()), message="机器人分类删除成功")
