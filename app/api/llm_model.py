"""
LLM模型控制器，提供LLM模型相关的API接口
"""

from fastapi import APIRouter, Query
from app.services.llm_model.service import LLMModelService, LLMCategoryService
from app.services.llm_model.dto import (
    LLMModelCreate, LLMModelUpdate, LLMModel as LLMModelSchema,
    LLMCategoryCreate, LLMCategoryUpdate, LLMCategory as LLMCategorySchema
)
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.llm_constants import MODEL_TYPE, MODEL_CONFIG_PARAMS

router = APIRouter()


@router.get("/tags", response_model=ApiResponse)
def get_model_tags(model_type: str = Query(None, description="模型类型")):
    """
    获取模型标签
    
    Args:
        model_type: 模型类型（可选）
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含标签列表
    """
    tags = LLMModelService.get_model_tags(model_type)
    return ResponseUtil.success(data=tags, message="获取模型标签成功")


@router.get("/model_types", response_model=ApiResponse)
def get_model_types():
    """
    获取LLM模型类型
    
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    return ResponseUtil.success(data=MODEL_TYPE, message="获取模型类型成功")


@router.get("/config_params", response_model=ApiResponse)
def get_config_params():
    """
    获取LLM模型配置参数
    
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    return ResponseUtil.success(data=MODEL_CONFIG_PARAMS, message="获取模型配置参数成功")


@router.post("/category", response_model=ApiResponse)
def create_llm_category(category: LLMCategoryCreate):
    """
    创建LLM分类
    
    Args:
        category: LLM分类创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = LLMCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="LLM分类创建成功")


@router.get("/category", response_model=ApiResponse)
def get_llm_categories(skip: int = 0, limit: int = 100):
    """
    获取LLM分类列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = LLMCategoryService.get_categories(skip, limit)
    categories_data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取LLM分类列表成功")


@router.get("/category/tree", response_model=ApiResponse)
def get_llm_category_tree():
    """
    获取LLM分类树形结构
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类树形结构
    """
    tree = LLMCategoryService.get_category_tree()
    return ResponseUtil.success(data=tree, message="获取LLM分类树成功")


@router.get("/category/{category_id}", response_model=ApiResponse)
def get_llm_category(category_id: str):
    """
    获取单个LLM分类
    
    Args:
        category_id: LLM分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = LLMCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"LLM分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取LLM分类成功")


@router.post("/category/{category_id}", response_model=ApiResponse)
def update_llm_category(category_id: str, category: LLMCategoryUpdate):
    """
    更新LLM分类
    
    Args:
        category_id: LLM分类ID
        category: LLM分类更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = LLMCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=db_category.__data__, message="LLM分类更新成功")


@router.post("/category/{category_id}/delete", response_model=ApiResponse)
def delete_llm_category(category_id: str):
    """
    删除LLM分类
    
    Args:
        category_id: LLM分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = LLMCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="LLM分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


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
def get_llm_models(
    page: int = Query(1, description="页码"),
    page_size: int = Query(12, description="每页数量"),
    category_id: str = Query(None, description="分类ID"),
    name: str = Query(None, description="模型名称（模糊查询）"),
    model_type: str = Query(None, description="模型类型"),
    status: str = Query(None, description="状态（true/false）"),
    tags: str = Query(None, description="标签过滤，多个标签用逗号分隔")
):
    """
    获取LLM模型列表（分页）
    
    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        category_id: 分类ID（可选）
        name: 模型名称（模糊查询，可选）
        model_type: 模型类型（可选）
        status: 状态（true/false，可选）
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    # 处理tags参数，转换为列表
    tag_list = tags.split(',') if tags else None
    llm_models = LLMModelService.get_llm_models(skip, page_size, category_id, name, model_type, status, tag_list)
    total = LLMModelService.count_llm_models(category_id, name, model_type, status, tag_list)
    llm_models_data = [llm_model.__data__ for llm_model in llm_models]
    return ResponseUtil.success(data={"data": llm_models_data, "total": total}, message="获取LLM模型列表成功")


@router.get("/model/{llm_model_id}", response_model=ApiResponse)
def get_llm_model(llm_model_id: str):
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


@router.post("/model/{llm_model_id}", response_model=ApiResponse)
def update_llm_model(llm_model_id: str, llm_model: LLMModelUpdate):
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


@router.post("/model/{llm_model_id}/delete", response_model=ApiResponse)
def delete_llm_model(llm_model_id: str):
    """
    删除LLM模型
    
    Args:
        llm_model_id: LLM模型ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_llm_model = LLMModelService.delete_llm_model(llm_model_id)
    return ResponseUtil.success(data=db_llm_model.__data__, message="LLM模型删除成功")


@router.post("/model/{llm_model_id}/test", response_model=ApiResponse)
def test_model_connection(llm_model_id: str):
    """
    测试模型连接
    
    Args:
        llm_model_id: LLM模型ID
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含测试结果
    """
    try:
        result = LLMModelService.test_model_connection(llm_model_id)
        if result['success']:
            return ResponseUtil.success(data=result, message="模型连接测试成功")
        else:
            return ResponseUtil.error(data=result, message=result['message'])
    except Exception as e:
        return ResponseUtil.error(message=str(e))
