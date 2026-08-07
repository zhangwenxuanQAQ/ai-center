"""
工具箱控制器，提供工具箱分类相关的API接口
"""

from fastapi import APIRouter, Query
from app.services.toolkit.service import ToolkitCategoryService
from app.services.toolkit.dto import ToolkitCategoryCreate, ToolkitCategoryUpdate, ToolkitCategory
from app.constants.toolkit_constants import TOOL_TYPE, TOOL_TYPE_NAME
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


# 工具箱分类相关接口
@router.post("/category", response_model=ApiResponse)
def create_toolkit_category(category: ToolkitCategoryCreate):
    """
    创建工具箱分类

    Args:
        category: 工具箱分类创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ToolkitCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="工具箱分类创建成功")


@router.get("/category", response_model=ApiResponse)
def get_toolkit_categories(
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(100, description="返回的最大记录数"),
    type: str = Query(None, description="工具类型过滤")
):
    """
    获取工具箱分类列表

    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        type: 工具类型过滤（可选）

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = ToolkitCategoryService.get_categories(skip, limit, type)
    categories_data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取工具箱分类列表成功")


@router.get("/category/tree", response_model=ApiResponse)
def get_toolkit_category_tree(
    type: str = Query(None, description="工具类型过滤")
):
    """
    获取工具箱分类树形结构

    Args:
        type: 工具类型过滤（可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含分类树形结构
    """
    tree = ToolkitCategoryService.get_category_tree(type)
    return ResponseUtil.success(data=tree, message="获取工具箱分类树成功")


@router.get("/category/{category_id}", response_model=ApiResponse)
def get_toolkit_category(category_id: str):
    """
    获取单个工具箱分类

    Args:
        category_id: 分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = ToolkitCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"工具箱分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取工具箱分类成功")


@router.post("/category/{category_id}", response_model=ApiResponse)
def update_toolkit_category(category_id: str, category: ToolkitCategoryUpdate):
    """
    更新工具箱分类

    Args:
        category_id: 分类ID
        category: 分类更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ToolkitCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=db_category.__data__, message="工具箱分类更新成功")


@router.post("/category/{category_id}/delete", response_model=ApiResponse)
def delete_toolkit_category(category_id: str):
    """
    删除工具箱分类

    Args:
        category_id: 分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = ToolkitCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="工具箱分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# 工具类型相关接口
@router.get("/tool_types", response_model=ApiResponse)
def get_tool_types():
    """
    获取支持的工具类型

    Returns:
        ApiResponse: 统一格式的响应对象，包含工具类型及显示名称
    """
    return ResponseUtil.success(data=TOOL_TYPE_NAME, message="获取工具类型成功")
