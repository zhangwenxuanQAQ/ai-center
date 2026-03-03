"""
提示词控制器，提供提示词相关的API接口
"""

from fastapi import APIRouter
from app.services.prompt.service import PromptService
from app.services.prompt.dto import PromptCreate, PromptUpdate, Prompt as PromptSchema
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


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
def get_prompts(skip: int = 0, limit: int = 100):
    """
    获取提示词列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    prompts = PromptService.get_prompts(skip, limit)
    prompts_data = [prompt.__data__ for prompt in prompts]
    return ResponseUtil.success(data=prompts_data, message="获取提示词列表成功")


@router.get("/{prompt_id}", response_model=ApiResponse)
def get_prompt(prompt_id: int):
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
    return ResponseUtil.success(data=prompt.__data__, message="获取提示词成功")


@router.post("/{prompt_id}", response_model=ApiResponse)
def update_prompt(prompt_id: int, prompt: PromptUpdate):
    """
    更新提示词
    
    Args:
        prompt_id: 提示词ID
        prompt: 提示词更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_prompt = PromptService.update_prompt(prompt_id, prompt)
    return ResponseUtil.success(data=db_prompt.__data__, message="提示词更新成功")


@router.post("/{prompt_id}/delete", response_model=ApiResponse)
def delete_prompt(prompt_id: int):
    """
    删除提示词
    
    Args:
        prompt_id: 提示词ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_prompt = PromptService.delete_prompt(prompt_id)
    return ResponseUtil.success(data=db_prompt.__data__, message="提示词删除成功")
