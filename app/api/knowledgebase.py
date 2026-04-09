"""
知识库控制器，提供知识库分类、知识库、知识库文档相关的API接口
"""

import json
from fastapi import APIRouter, Body, Query
from app.services.knowledgebase.service import (
    KnowledgebaseCategoryService,
    KnowledgebaseService,
    KnowledgebaseDocumentService
)
from app.services.knowledgebase.dto import (
    KnowledgebaseCategoryCreate, KnowledgebaseCategoryUpdate, KnowledgebaseCategory as CategorySchema,
    KnowledgebaseCreate, KnowledgebaseUpdate, Knowledgebase as KbSchema,
    KnowledgebaseDocumentCreate, KnowledgebaseDocumentUpdate, KnowledgebaseDocument as DocSchema
)
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


# 知识库分类相关接口
@router.post("/category", response_model=ApiResponse)
def create_kb_category(category: KnowledgebaseCategoryCreate):
    """
    创建知识库分类

    Args:
        category: 知识库分类创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = KnowledgebaseCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="知识库分类创建成功")


@router.get("/category", response_model=ApiResponse)
def get_kb_categories(skip: int = 0, limit: int = 100):
    """
    获取知识库分类列表

    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = KnowledgebaseCategoryService.get_categories(skip, limit)
    categories_data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取知识库分类列表成功")


@router.get("/category/tree", response_model=ApiResponse)
def get_kb_category_tree():
    """
    获取知识库分类树形结构

    Returns:
        ApiResponse: 统一格式的响应对象，包含分类树形结构
    """
    tree = KnowledgebaseCategoryService.get_category_tree()
    return ResponseUtil.success(data=tree, message="获取知识库分类树成功")


@router.get("/category/{category_id}", response_model=ApiResponse)
def get_kb_category(category_id: str):
    """
    获取单个知识库分类

    Args:
        category_id: 知识库分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = KnowledgebaseCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"知识库分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取知识库分类成功")


@router.post("/category/{category_id}", response_model=ApiResponse)
def update_kb_category(category_id: str, category: KnowledgebaseCategoryUpdate):
    """
    更新知识库分类

    Args:
        category_id: 知识库分类ID
        category: 知识库分类更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = KnowledgebaseCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=db_category.__data__, message="知识库分类更新成功")


@router.post("/category/{category_id}/delete", response_model=ApiResponse)
def delete_kb_category(category_id: str):
    """
    删除知识库分类

    Args:
        category_id: 知识库分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = KnowledgebaseCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="知识库分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# 知识库相关接口
@router.get("/check_code", response_model=ApiResponse)
def check_knowledgebase_code(code: str = Query(..., description="知识库编码")):
    """
    检查知识库编码是否唯一

    Args:
        code: 知识库编码

    Returns:
        ApiResponse: 统一格式的响应对象，包含编码是否唯一的布尔值
    """
    is_unique = KnowledgebaseService.check_code_unique(code)
    return ResponseUtil.success(data=is_unique, message="检查编码唯一性成功")


@router.post("", response_model=ApiResponse)
def create_knowledgebase(kb: KnowledgebaseCreate):
    """
    创建知识库

    Args:
        kb: 知识库创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_kb = KnowledgebaseService.create_knowledgebase(kb)
    data = db_kb.__data__
    if data.get('retrieval_config'):
        try:
            data['retrieval_config'] = json.loads(data['retrieval_config'])
        except (json.JSONDecodeError, TypeError):
            pass
    return ResponseUtil.created(data=data, message="知识库创建成功")


@router.get("", response_model=ApiResponse)
def get_knowledgebases(
    page: int = Query(1, description="页码"),
    page_size: int = Query(12, description="每页数量"),
    category_id: str = Query(None, description="分类ID"),
    name: str = Query(None, description="知识库名称（模糊查询）"),
    code: str = Query(None, description="知识库编码（模糊查询）")
):
    """
    获取知识库列表（分页）

    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        category_id: 分类ID（可选）
        name: 知识库名称（模糊查询，可选）
        code: 知识库编码（模糊查询，可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    kbs = KnowledgebaseService.get_knowledgebases(skip, page_size, category_id, name, code)
    total = KnowledgebaseService.count_knowledgebases(category_id, name, code)
    kbs_data = []
    for kb in kbs:
        kb_dict = kb.__data__
        if kb_dict.get('retrieval_config'):
            try:
                kb_dict['retrieval_config'] = json.loads(kb_dict['retrieval_config'])
            except (json.JSONDecodeError, TypeError):
                pass
        kbs_data.append(kb_dict)
    return ResponseUtil.success(data={"data": kbs_data, "total": total}, message="获取知识库列表成功")


@router.get("/{kb_id}", response_model=ApiResponse)
def get_knowledgebase(kb_id: str):
    """
    获取单个知识库

    Args:
        kb_id: 知识库ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    kb = KnowledgebaseService.get_knowledgebase(kb_id)
    if kb is None:
        return ResponseUtil.not_found(message=f"知识库 {kb_id} 不存在")
    data = kb.__data__
    if data.get('retrieval_config'):
        try:
            data['retrieval_config'] = json.loads(data['retrieval_config'])
        except (json.JSONDecodeError, TypeError):
            pass
    return ResponseUtil.success(data=data, message="获取知识库成功")


@router.post("/{kb_id}", response_model=ApiResponse)
def update_knowledgebase(kb_id: str, kb: KnowledgebaseUpdate):
    """
    更新知识库

    Args:
        kb_id: 知识库ID
        kb: 知识库更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_kb = KnowledgebaseService.update_knowledgebase(kb_id, kb)
    data = db_kb.__data__
    if data.get('retrieval_config'):
        try:
            data['retrieval_config'] = json.loads(data['retrieval_config'])
        except (json.JSONDecodeError, TypeError):
            pass
    return ResponseUtil.success(data=data, message="知识库更新成功")


@router.post("/{kb_id}/delete", response_model=ApiResponse)
def delete_knowledgebase(kb_id: str):
    """
    删除知识库

    Args:
        kb_id: 知识库ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_kb = KnowledgebaseService.delete_knowledgebase(kb_id)
    return ResponseUtil.success(data=db_kb.__data__, message="知识库删除成功")


# 知识库文档相关接口
@router.post("/{kb_id}/document", response_model=ApiResponse)
def create_document(kb_id: str, document: KnowledgebaseDocumentCreate):
    """
    创建知识库文档

    Args:
        kb_id: 知识库ID
        document: 知识库文档创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    document.kb_id = kb_id
    db_doc = KnowledgebaseDocumentService.create_document(document)
    data = db_doc.__data__
    if data.get('chunk_config'):
        try:
            data['chunk_config'] = json.loads(data['chunk_config'])
        except (json.JSONDecodeError, TypeError):
            pass
    return ResponseUtil.created(data=data, message="知识库文档创建成功")


@router.get("/{kb_id}/document", response_model=ApiResponse)
def get_documents(
    kb_id: str,
    page: int = Query(1, description="页码"),
    page_size: int = Query(10, description="每页数量"),
    chunk_method: str = Query(None, description="Chunk方法")
):
    """
    获取知识库文档列表（分页）

    Args:
        kb_id: 知识库ID
        page: 页码，默认1
        page_size: 每页数量，默认10
        chunk_method: Chunk方法（可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    docs = KnowledgebaseDocumentService.get_documents(skip, page_size, kb_id, chunk_method)
    total = KnowledgebaseDocumentService.count_documents(kb_id, chunk_method)
    docs_data = []
    for doc in docs:
        doc_dict = doc.__data__
        if doc_dict.get('chunk_config'):
            try:
                doc_dict['chunk_config'] = json.loads(doc_dict['chunk_config'])
            except (json.JSONDecodeError, TypeError):
                pass
        docs_data.append(doc_dict)
    return ResponseUtil.success(data={"data": docs_data, "total": total}, message="获取知识库文档列表成功")


@router.get("/{kb_id}/document/{document_id}", response_model=ApiResponse)
def get_document(kb_id: str, document_id: str):
    """
    获取单个知识库文档

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    doc = KnowledgebaseDocumentService.get_document(document_id)
    if doc is None:
        return ResponseUtil.not_found(message=f"知识库文档 {document_id} 不存在")
    data = doc.__data__
    if data.get('chunk_config'):
        try:
            data['chunk_config'] = json.loads(data['chunk_config'])
        except (json.JSONDecodeError, TypeError):
            pass
    return ResponseUtil.success(data=data, message="获取知识库文档成功")


@router.post("/{kb_id}/document/{document_id}", response_model=ApiResponse)
def update_document(kb_id: str, document_id: str, document: KnowledgebaseDocumentUpdate):
    """
    更新知识库文档

    Args:
        kb_id: 知识库ID
        document_id: 文档ID
        document: 知识库文档更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_doc = KnowledgebaseDocumentService.update_document(document_id, document)
    data = db_doc.__data__
    if data.get('chunk_config'):
        try:
            data['chunk_config'] = json.loads(data['chunk_config'])
        except (json.JSONDecodeError, TypeError):
            pass
    return ResponseUtil.success(data=data, message="知识库文档更新成功")


@router.post("/{kb_id}/document/{document_id}/delete", response_model=ApiResponse)
def delete_document(kb_id: str, document_id: str):
    """
    删除知识库文档

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_doc = KnowledgebaseDocumentService.delete_document(document_id)
    return ResponseUtil.success(data=db_doc.__data__, message="知识库文档删除成功")
