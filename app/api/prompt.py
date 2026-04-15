"""
提示词控制器，提供提示词相关的API接口
"""

import json
from fastapi import APIRouter, Body, Query, Request
from app.services.prompt.service import PromptCategoryService, PromptService
from app.services.prompt.dto import (
    PromptCategoryCreate, PromptCategoryUpdate, PromptCategory, 
    PromptCreate, PromptUpdate, Prompt
)
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


# 提示词分类相关接口
@router.post("/category", response_model=ApiResponse)
def create_prompt_category(category: PromptCategoryCreate):
    """
    创建提示词分类
    
    Args:
        category: 提示词分类创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = PromptCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="提示词分类创建成功")


@router.get("/category", response_model=ApiResponse)
def get_prompt_categories(skip: int = 0, limit: int = 100):
    """
    获取提示词分类列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = PromptCategoryService.get_categories(skip, limit)
    categories_data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取提示词分类列表成功")


@router.get("/category/tree", response_model=ApiResponse)
def get_prompt_category_tree():
    """
    获取提示词分类树形结构
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类树形结构
    """
    tree = PromptCategoryService.get_category_tree()
    return ResponseUtil.success(data=tree, message="获取提示词分类树成功")


@router.get("/category/{category_id}", response_model=ApiResponse)
def get_prompt_category(category_id: str):
    """
    获取单个提示词分类
    
    Args:
        category_id: 提示词分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = PromptCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"提示词分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取提示词分类成功")


@router.post("/category/{category_id}", response_model=ApiResponse)
def update_prompt_category(category_id: str, category: PromptCategoryUpdate):
    """
    更新提示词分类
    
    Args:
        category_id: 提示词分类ID
        category: 提示词分类更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = PromptCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=db_category.__data__, message="提示词分类更新成功")


@router.post("/category/{category_id}/delete", response_model=ApiResponse)
def delete_prompt_category(category_id: str):
    """
    删除提示词分类
    
    Args:
        category_id: 提示词分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = PromptCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="提示词分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# 提示词相关接口
@router.post("", response_model=ApiResponse)
def create_prompt(prompt: PromptCreate):
    """
    创建提示词
    
    Args:
        prompt: 提示词创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_prompt = PromptService.create_prompt(prompt)
    return ResponseUtil.created(data=db_prompt.__data__, message="提示词创建成功")


@router.get("", response_model=ApiResponse)
def get_prompts(
    page: int = Query(1, description="页码"),
    page_size: int = Query(12, description="每页数量"),
    category_id: str = Query(None, description="分类ID"),
    name: str = Query(None, description="提示词名称（模糊查询）"),
    status: str = Query(None, description="状态")
):
    """
    获取提示词列表
    
    Args:
        page: 页码
        page_size: 每页数量
        category_id: 分类ID（可选）
        name: 提示词名称（模糊查询，可选）
        status: 状态（可选）
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    skip = (page - 1) * page_size
    prompts = PromptService.get_prompts(skip, page_size, category_id, name, status)
    total = PromptService.count_prompts(category_id, name, status)
    
    prompts_data = []
    for prompt in prompts:
        prompt_dict = prompt.__data__
        if prompt_dict.get('tags') and isinstance(prompt_dict['tags'], str):
            try:
                prompt_dict['tags'] = json.loads(prompt_dict['tags'])
            except json.JSONDecodeError:
                prompt_dict['tags'] = []
        prompts_data.append(prompt_dict)
    
    return ResponseUtil.success(data={
        "data": prompts_data,
        "total": total,
        "page": page,
        "page_size": page_size
    }, message="获取提示词列表成功")


@router.post("/batch_delete", response_model=ApiResponse)
async def batch_delete_prompts(request: Request):
    """
    批量删除提示词
    
    Args:
        request: 请求对象，包含提示词ID列表
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        prompt_ids = await request.json()
        if not isinstance(prompt_ids, list):
            return ResponseUtil.error(message="请求体必须是提示词ID列表")
        deleted_count = PromptService.batch_delete_prompts(prompt_ids)
        return ResponseUtil.success(data={"deleted_count": deleted_count}, message=f"成功删除{deleted_count}个提示词")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))
    except Exception as e:
        return ResponseUtil.error(message=f"批量删除失败: {str(e)}")


@router.get("/{prompt_id}", response_model=ApiResponse)
def get_prompt(prompt_id: str):
    """
    获取单个提示词
    
    Args:
        prompt_id: 提示词ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    prompt = PromptService.get_prompt(prompt_id)
    if prompt is None:
        return ResponseUtil.not_found(message=f"提示词 {prompt_id} 不存在")
    
    prompt_dict = prompt.__data__
    if prompt_dict.get('tags') and isinstance(prompt_dict['tags'], str):
        try:
            prompt_dict['tags'] = json.loads(prompt_dict['tags'])
        except json.JSONDecodeError:
            prompt_dict['tags'] = []
    
    return ResponseUtil.success(data=prompt_dict, message="获取提示词成功")


@router.post("/{prompt_id}", response_model=ApiResponse)
def update_prompt(prompt_id: str, prompt: PromptUpdate):
    """
    更新提示词
    
    Args:
        prompt_id: 提示词ID
        prompt: 提示词更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_prompt = PromptService.update_prompt(prompt_id, prompt)
    
    prompt_dict = db_prompt.__data__
    if prompt_dict.get('tags') and isinstance(prompt_dict['tags'], str):
        try:
            prompt_dict['tags'] = json.loads(prompt_dict['tags'])
        except json.JSONDecodeError:
            prompt_dict['tags'] = []
    
    return ResponseUtil.success(data=prompt_dict, message="提示词更新成功")


@router.post("/{prompt_id}/delete", response_model=ApiResponse)
def delete_prompt(prompt_id: str):
    """
    删除提示词
    
    Args:
        prompt_id: 提示词ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_prompt = PromptService.delete_prompt(prompt_id)
    return ResponseUtil.success(data=db_prompt.__data__, message="提示词删除成功")


@router.post("/{prompt_id}/status", response_model=ApiResponse)
def update_prompt_status(prompt_id: str, status_data: dict):
    """
    更新提示词状态
    
    Args:
        prompt_id: 提示词ID
        status_data: 状态数据，包含status字段
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    status = status_data.get('status')
    if status is None:
        return ResponseUtil.error(message="状态不能为空")
    
    db_prompt = PromptService.update_prompt_status(prompt_id, status)
    
    prompt_dict = db_prompt.__data__
    if prompt_dict.get('tags') and isinstance(prompt_dict['tags'], str):
        try:
            prompt_dict['tags'] = json.loads(prompt_dict['tags'])
        except json.JSONDecodeError:
            prompt_dict['tags'] = []
    
    return ResponseUtil.success(data=prompt_dict, message="提示词状态更新成功")
