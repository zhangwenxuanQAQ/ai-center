"""
知识库控制器，提供知识库相关的API接口
"""

from fastapi import APIRouter
from app.services.knowledge.service import KnowledgeService
from app.services.knowledge.dto import KnowledgeCreate, KnowledgeUpdate, Knowledge as KnowledgeSchema
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


@router.post("", response_model=ApiResponse)
def create_knowledge(knowledge: KnowledgeCreate):
    """
    创建知识库
    
    Args:
        knowledge: 知识库创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_knowledge = KnowledgeService.create_knowledge(knowledge)
    return ResponseUtil.created(data=db_knowledge.__data__, message="知识库创建成功")


@router.get("", response_model=ApiResponse)
def get_knowledges(skip: int = 0, limit: int = 100):
    """
    获取知识库列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    knowledges = KnowledgeService.get_knowledges(skip, limit)
    knowledges_data = [knowledge.__data__ for knowledge in knowledges]
    return ResponseUtil.success(data=knowledges_data, message="获取知识库列表成功")


@router.get("/{knowledge_id}", response_model=ApiResponse)
def get_knowledge(knowledge_id: int):
    """
    获取单个知识库
    
    Args:
        knowledge_id: 知识库ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    knowledge = KnowledgeService.get_knowledge(knowledge_id)
    if knowledge is None:
        return ResponseUtil.not_found(message=f"知识库 {knowledge_id} 不存在")
    return ResponseUtil.success(data=knowledge.__data__, message="获取知识库成功")


@router.post("/{knowledge_id}", response_model=ApiResponse)
def update_knowledge(knowledge_id: int, knowledge: KnowledgeUpdate):
    """
    更新知识库
    
    Args:
        knowledge_id: 知识库ID
        knowledge: 知识库更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_knowledge = KnowledgeService.update_knowledge(knowledge_id, knowledge)
    return ResponseUtil.success(data=db_knowledge.__data__, message="知识库更新成功")


@router.post("/{knowledge_id}/delete", response_model=ApiResponse)
def delete_knowledge(knowledge_id: int):
    """
    删除知识库
    
    Args:
        knowledge_id: 知识库ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_knowledge = KnowledgeService.delete_knowledge(knowledge_id)
    return ResponseUtil.success(data=db_knowledge.__data__, message="知识库删除成功")
