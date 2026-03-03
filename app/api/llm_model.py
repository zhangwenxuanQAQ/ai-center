"""
LLM模型控制器，提供LLM模型相关的API接口
"""

from fastapi import APIRouter
from app.services.llm_model.service import LLMModelService
from app.services.llm_model.dto import LLMModelCreate, LLMModelUpdate, LLMModel as LLMModelSchema
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


@router.post("", response_model=ApiResponse)
def create_llm_model(llm_model: LLMModelCreate):
    """
    创建LLM模型
    
    Args:
        llm_model: LLM模型创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_llm_model = LLMModelService.create_llm_model(llm_model)
    return ResponseUtil.created(data=db_llm_model.__data__, message="LLM模型创建成功")


@router.get("", response_model=ApiResponse)
def get_llm_models(skip: int = 0, limit: int = 100):
    """
    获取LLM模型列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    llm_models = LLMModelService.get_llm_models(skip, limit)
    llm_models_data = [llm_model.__data__ for llm_model in llm_models]
    return ResponseUtil.success(data=llm_models_data, message="获取LLM模型列表成功")


@router.get("/{llm_model_id}", response_model=ApiResponse)
def get_llm_model(llm_model_id: int):
    """
    获取单个LLM模型
    
    Args:
        llm_model_id: LLM模型ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    llm_model = LLMModelService.get_llm_model(llm_model_id)
    if llm_model is None:
        return ResponseUtil.not_found(message=f"LLM模型 {llm_model_id} 不存在")
    return ResponseUtil.success(data=llm_model.__data__, message="获取LLM模型成功")


@router.post("/{llm_model_id}", response_model=ApiResponse)
def update_llm_model(llm_model_id: int, llm_model: LLMModelUpdate):
    """
    更新LLM模型
    
    Args:
        llm_model_id: LLM模型ID
        llm_model: LLM模型更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_llm_model = LLMModelService.update_llm_model(llm_model_id, llm_model)
    return ResponseUtil.success(data=db_llm_model.__data__, message="LLM模型更新成功")


@router.post("/{llm_model_id}/delete", response_model=ApiResponse)
def delete_llm_model(llm_model_id: int):
    """
    删除LLM模型
    
    Args:
        llm_model_id: LLM模型ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_llm_model = LLMModelService.delete_llm_model(llm_model_id)
    return ResponseUtil.success(data=db_llm_model.__data__, message="LLM模型删除成功")
