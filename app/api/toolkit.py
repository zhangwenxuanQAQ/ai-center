"""
工具箱控制器，提供工具箱分类相关的API接口
"""

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from app.services.toolkit.service import ToolkitCategoryService
from app.services.toolkit.dto import ToolkitCategoryCreate, ToolkitCategoryUpdate, ToolkitCategory
from app.constants.toolkit_constants import TOOL_TYPE, TOOL_TYPE_NAME
from app.utils.response import ResponseUtil, ApiResponse
from app.core.tools.tool_registry import ToolRegistry
from app.core.tools.base_tool import ToolResult

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


# 内置工具相关接口
def _tool_to_dict(tool) -> dict:
    """将BaseTool实例转换为字典"""
    return {
        "name": tool.name,
        "title": tool.title,
        "description": tool.description,
        "created_at": getattr(tool, 'created_at', None),
        "params": [
            {
                "name": p.name,
                "type": p.type,
                "description": p.description,
                "required": p.required,
                "default": p.default,
                "enum": p.enum,
            }
            for p in tool.params
        ],
    }


@router.get("/builtin_tools", response_model=ApiResponse)
def get_builtin_tools(
    page: int = Query(1, ge=1, description="页码，从1开始"),
    page_size: int = Query(12, ge=1, le=100, description="每页数量"),
    name: str = Query(None, description="工具名称（模糊查询）"),
):
    """
    分页获取内置工具列表

    内置工具来自所有注册到ToolRegistry的工具（继承BaseTool）。

    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        name: 工具名称（模糊查询，可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    all_tools = ToolRegistry.get_all_tools()
    tool_list = list(all_tools.values())

    if name:
        tool_list = [t for t in tool_list if name.lower() in t.name.lower() or name.lower() in (t.title or "").lower()]

    tool_list.sort(key=lambda t: t.name)
    total = len(tool_list)

    start = (page - 1) * page_size
    end = start + page_size
    page_tools = tool_list[start:end]

    data = [_tool_to_dict(t) for t in page_tools]
    return ResponseUtil.success(data={"data": data, "total": total}, message="获取内置工具列表成功")


@router.get("/builtin_tools/{tool_name}", response_model=ApiResponse)
def get_builtin_tool(tool_name: str):
    """
    获取单个内置工具详情

    Args:
        tool_name: 工具名称

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    tool = ToolRegistry.get_tool(tool_name)
    if tool is None:
        return ResponseUtil.not_found(message=f"内置工具 {tool_name} 不存在")
    return ResponseUtil.success(data=_tool_to_dict(tool), message="获取内置工具成功")


@router.post("/builtin_tools/{tool_name}/run", response_model=ApiResponse)
async def run_builtin_tool(tool_name: str, request: Request):
    """
    执行内置工具

    Args:
        tool_name: 工具名称
        request: 包含工具参数的请求体

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    tool = ToolRegistry.get_tool(tool_name)
    if tool is None:
        return ResponseUtil.not_found(message=f"内置工具 {tool_name} 不存在")

    body = await request.json()
    # 校验必填参数
    error = tool.validate_params(**body)
    if error:
        return ResponseUtil.error(message=error)

    try:
        result = tool.run(**body)
        # 统一处理ToolResult
        if isinstance(result, ToolResult):
            if result.success:
                return ResponseUtil.success(
                    data=result.to_dict(),
                    message=result.message or "工具执行成功"
                )
            else:
                return ResponseUtil.error(
                    message=result.error or result.message or "工具执行失败"
                )
        return ResponseUtil.success(data=result, message="工具执行成功")
    except Exception as e:
        return ResponseUtil.error(message=f"工具执行失败: {str(e)}")
