"""
代码脚本控制器，提供代码脚本相关的API接口
"""

import logging

import black
from fastapi import APIRouter, Body, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from app.services.code_script.service import (
    CodeScriptService,
    CodeScriptCategoryService,
    _script_to_data,
)
from app.services.code_script.dto import (
    CodeScriptCreate,
    CodeScriptUpdate,
    CodeScript,
    CodeScriptCategoryCreate,
    CodeScriptCategoryUpdate,
)
from app.utils.response import ResponseUtil, ApiResponse
from app.core.tools import ToolResult

logger = logging.getLogger(__name__)

router = APIRouter()


class TestScriptRequest(BaseModel):
    """
    测试执行代码脚本请求DTO

    Attributes:
        content: 代码内容（未保存时直接测试，可选）
        timeout: 执行超时时间（秒）
        params: main函数入参值字典（键与入参定义name对应）
        param_definitions: 入参定义列表（未保存代码测试时由前端传入）
    """
    content: Optional[str] = Field(None, description="代码内容，未保存时直接测试")
    timeout: int = Field(default=30, ge=1, le=300, description="执行超时时间（秒），1-300秒")
    params: Optional[Dict[str, Any]] = Field(None, description="main函数入参值字典，键与入参定义name对应")
    param_definitions: Optional[List[Dict[str, Any]]] = Field(None, description="入参定义列表，未保存代码测试时使用")


class FormatCodeRequest(BaseModel):
    """
    格式化代码请求DTO

    Attributes:
        content: 代码内容
        line_length: 每行最大字符数，默认88（black规范）
    """
    content: str = Field(..., description="待格式化的Python代码内容")
    line_length: int = Field(default=88, ge=40, le=200, description="每行最大字符数")


# ==================== 分类相关接口 ====================

@router.post("/category", response_model=ApiResponse)
def create_code_script_category(category: CodeScriptCategoryCreate):
    """
    创建代码脚本分类

    Args:
        category: 代码脚本分类创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = CodeScriptCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="代码脚本分类创建成功")


@router.get("/category", response_model=ApiResponse)
def get_code_script_categories(
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(100, description="返回的最大记录数")
):
    """
    获取代码脚本分类列表

    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = CodeScriptCategoryService.get_categories(skip, limit)
    data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=data, message="获取代码脚本分类列表成功")


@router.get("/category/tree", response_model=ApiResponse)
def get_code_script_category_tree():
    """
    获取代码脚本分类树形结构

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    tree = CodeScriptCategoryService.get_category_tree()
    return ResponseUtil.success(data=tree, message="获取代码脚本分类树结构成功")


@router.get("/category/{category_id}", response_model=ApiResponse)
def get_code_script_category(category_id: str):
    """
    获取单个代码脚本分类

    Args:
        category_id: 分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = CodeScriptCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"代码脚本分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取代码脚本分类成功")


@router.post("/category/{category_id}", response_model=ApiResponse)
def update_code_script_category(category_id: str, category: CodeScriptCategoryUpdate):
    """
    更新代码脚本分类

    Args:
        category_id: 分类ID
        category: 代码脚本分类更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = CodeScriptCategoryService.update_category(category_id, category)
        return ResponseUtil.success(data=db_category.__data__, message="代码脚本分类更新成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/category/{category_id}/delete", response_model=ApiResponse)
def delete_code_script_category(category_id: str):
    """
    删除代码脚本分类

    Args:
        category_id: 分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = CodeScriptCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="代码脚本分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# ==================== 脚本相关接口 ====================

@router.post("/script", response_model=ApiResponse)
def create_code_script(script: CodeScriptCreate):
    """
    创建代码脚本

    Args:
        script: 代码脚本创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_script = CodeScriptService.create_script(script)
        return ResponseUtil.created(data=_script_to_data(db_script), message="代码脚本创建成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.get("/script", response_model=ApiResponse)
def get_code_scripts(
    page: int = Query(1, description="页码，从1开始"),
    page_size: int = Query(12, description="每页数量"),
    category_id: str = Query(None, description="分类ID"),
    name: str = Query(None, description="脚本名称（模糊查询）"),
    status: str = Query(None, description="状态（true/false）"),
    description: str = Query(None, description="脚本描述（模糊查询）")
):
    """
    获取代码脚本列表（分页）

    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        category_id: 分类ID（可选）
        name: 脚本名称（模糊查询，可选）
        status: 状态（true/false，可选）
        description: 脚本描述（模糊查询，可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    scripts = CodeScriptService.get_scripts(skip, page_size, category_id, name, status, description)
    total = CodeScriptService.count_scripts(category_id, name, status, description)
    scripts_data = [_script_to_data(script) for script in scripts]
    return ResponseUtil.success(data={"data": scripts_data, "total": total}, message="获取代码脚本列表成功")


@router.post("/script/validate", response_model=ApiResponse)
def validate_code_script(content: str = Body(..., embed=True)):
    """
    校验代码内容（语法/main函数/安全检查）

    Args:
        content: Python代码内容

    Returns:
        ApiResponse: 统一格式的响应对象，包含校验结果
    """
    result = CodeScriptService.validate_script_content(content)
    if result["valid"]:
        return ResponseUtil.success(data=result, message="代码校验通过")
    return ResponseUtil.success(data=result, message=f"代码校验失败: {result['error']}")


@router.post("/script/format", response_model=ApiResponse)
def format_code_script(request: FormatCodeRequest):
    """
    格式化Python代码（black规范）

    Args:
        request: 格式化请求体（代码内容/行宽）

    Returns:
        ApiResponse: 统一格式的响应对象，包含格式化后的代码
    """
    if not request.content or not request.content.strip():
        return ResponseUtil.error(message="代码内容不能为空")
    try:
        formatted = black.format_str(request.content, mode=black.Mode(line_length=request.line_length))
        return ResponseUtil.success(data={"content": formatted}, message="代码格式化成功")
    except black.InvalidInput as e:
        return ResponseUtil.error(message=f"代码格式化失败（语法错误）: {str(e)}")
    except Exception as e:
        logger.error(f"格式化代码失败, 错误: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"代码格式化失败: {str(e)}")


@router.post("/script/test", response_model=ApiResponse)
def test_code_script_content(request: TestScriptRequest):
    """
    测试执行未保存的代码内容

    通过内置的 code_script 工具执行临时代码内容，返回执行结果。

    Args:
        request: 测试请求体（代码内容/超时时间/入参值）

    Returns:
        ApiResponse: 统一格式的响应对象，包含测试结果
    """
    try:
        if not request.content or not request.content.strip():
            return ResponseUtil.error(message="代码内容不能为空")

        params = request.params if request.params else {}
        result = CodeScriptService.test_script(
            content=request.content,
            timeout=request.timeout,
            params=params,
            param_definitions=request.param_definitions,
        )
        if isinstance(result, ToolResult):
            if not result.success:
                return ResponseUtil.error(message=result.message)
            return ResponseUtil.success(data=result.result, message="测试完成")
        # 兼容工具返回非ToolResult的情况
        return ResponseUtil.success(data=result, message="测试完成")
    except Exception as e:
        logger.error(f"测试代码内容失败, 错误: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"测试失败: {str(e)}")


@router.get("/script/{script_id}", response_model=ApiResponse)
def get_code_script(script_id: str):
    """
    获取单个代码脚本

    Args:
        script_id: 代码脚本ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    script = CodeScriptService.get_script(script_id)
    if script is None:
        return ResponseUtil.not_found(message=f"代码脚本 {script_id} 不存在")
    return ResponseUtil.success(data=_script_to_data(script), message="获取代码脚本成功")


@router.post("/script/{script_id}", response_model=ApiResponse)
def update_code_script(script_id: str, script: CodeScriptUpdate):
    """
    更新代码脚本

    Args:
        script_id: 代码脚本ID
        script: 代码脚本更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_script = CodeScriptService.update_script(script_id, script)
        return ResponseUtil.success(data=_script_to_data(db_script), message="代码脚本更新成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/script/{script_id}/delete", response_model=ApiResponse)
def delete_code_script(script_id: str):
    """
    删除代码脚本

    Args:
        script_id: 代码脚本ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_script = CodeScriptService.delete_script(script_id)
    return ResponseUtil.success(data=_script_to_data(db_script), message="代码脚本删除成功")


@router.post("/script/{script_id}/test", response_model=ApiResponse)
def test_code_script(script_id: str, request: TestScriptRequest = None):
    """
    测试执行代码脚本

    通过内置的 code_script 工具执行已保存的脚本，返回执行结果。

    Args:
        script_id: 代码脚本ID
        request: 测试请求体（超时时间/入参值等）

    Returns:
        ApiResponse: 统一格式的响应对象，包含测试结果
    """
    try:
        timeout = request.timeout if request else 30
        params = request.params if (request and request.params) else {}
        result = CodeScriptService.test_script(
            script_id=script_id,
            timeout=timeout,
            params=params,
        )
        if result is None:
            return ResponseUtil.not_found(message=f"代码脚本 {script_id} 不存在")

        if isinstance(result, ToolResult):
            if not result.success:
                return ResponseUtil.error(message=result.message)
            return ResponseUtil.success(data=result.result, message="测试完成")
        # 兼容工具返回非ToolResult的情况
        return ResponseUtil.success(data=result, message="测试完成")
    except Exception as e:
        logger.error(f"测试代码脚本失败, 脚本ID: {script_id}, 错误: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"测试失败: {str(e)}")
