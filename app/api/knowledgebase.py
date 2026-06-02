"""
知识库控制器，提供知识库分类、知识库、知识库文档相关的API接口
"""

import json
import logging
from typing import List
from fastapi import APIRouter, Body, Query, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from app.database.models import KnowledgebaseDocumentCategory
from app.services.exceptions import ResourceNotFoundError
from app.services.knowledgebase.service import (
    KnowledgebaseCategoryService,
    KnowledgebaseService,
    KnowledgebaseDocumentService,
    KnowledgebaseDocumentCategoryService
)
from app.services.knowledgebase.document.service import DocumentService
from app.core.knowledgebase.retrieval_service import RetrievalService
from app.services.knowledgebase.dto import (
    KnowledgebaseCategoryCreate, KnowledgebaseCategoryUpdate, KnowledgebaseCategory as CategorySchema,
    KnowledgebaseCreate, KnowledgebaseUpdate, Knowledgebase as KbSchema,
    KnowledgebaseDocumentCreate, KnowledgebaseDocumentUpdate, KnowledgebaseDocument as DocSchema,
    KnowledgebaseDocumentCategoryCreate, KnowledgebaseDocumentCategoryUpdate, KnowledgebaseDocumentCategory as DocCategorySchema
)
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.knowledgebase_constants import FILE_NAME_LEN_LIMIT, RETRIEVAL_CONFIGS
from app.constants.knowledgebase_document_constants import (
    CHUNK_METHOD_LABELS, CHUNK_METHOD_CONFIGS, SOURCE_TYPE_LABELS, SourceType, SourceConfigDefinition,
    get_available_chunk_methods, get_default_chunk_method, DOCUMENT_RUNNING_STATUS, METADATA_FIELD_TYPES,
    KNOWLEDGE_TEMPLATES
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/document_constants", response_model=ApiResponse)
def get_document_constants():
    """
    获取文档相关常量配置

    Returns:
        ApiResponse: 包含切片方法、来源类型、切片配置的响应
    """
    chunk_methods = [
        {"key": k, "label": v} for k, v in CHUNK_METHOD_LABELS.items()
    ]
    source_types = [
        {"key": k, "label": v} for k, v in SOURCE_TYPE_LABELS.items()
    ]
    chunk_configs = {}
    for method_key, fields in CHUNK_METHOD_CONFIGS.items():
        chunk_configs[method_key] = [f.to_dict() for f in fields]
    
    # 构建来源配置定义
    source_configs = {
        "local_document": [f.to_dict() for f in SourceConfigDefinition.LOCAL_DOCUMENT_CONFIG],
        "datasource": {
            "relational_database": [f.to_dict() for f in SourceConfigDefinition.RELATIONAL_DATABASE_CONFIG],
            "file_storage": [f.to_dict() for f in SourceConfigDefinition.FILE_STORAGE_CONFIG],
        },
        "custom_template": [f.to_dict() for f in SourceConfigDefinition.CUSTOM_TEMPLATE_CONFIG],
    }
    
    return ResponseUtil.success(data={
        "chunk_methods": chunk_methods,
        "source_types": source_types,
        "chunk_configs": chunk_configs,
        "source_configs": source_configs,
        "running_status": DOCUMENT_RUNNING_STATUS,
        "metadata_field_types": METADATA_FIELD_TYPES,
        "knowledge_templates": KNOWLEDGE_TEMPLATES,
    })


@router.get("/retrieval_configs", response_model=ApiResponse)
def get_retrieval_configs():
    """
    获取检索配置常量

    Returns:
        ApiResponse: 包含检索配置项的响应，每个配置项包含key、label、type、min、max、step、default、options等字段
    """
    return ResponseUtil.success(data=RETRIEVAL_CONFIGS)


@router.get("/chunk_methods/available", response_model=ApiResponse)
def get_available_chunk_methods_api(
    file_type: str = Query(None, description="文件类型（可选）"),
    filename: str = Query(None, description="文件名（可选，用于检查后缀名）"),
    source_type: str = Query(None, description="数据来源类型（可选，用于根据来源类型过滤切片方法）")
):
    """
    获取特定文件类型和数据来源类型可用的切片方法
    
    Args:
        file_type: 文件类型
        filename: 文件名（可选，用于检查后缀名）
        source_type: 数据来源类型（可选，用于根据来源类型过滤切片方法）
    
    Returns:
        ApiResponse: 包含可用切片方法和默认切片方法的响应
    """
    available_methods = get_available_chunk_methods(file_type, filename, source_type)
    default_method = get_default_chunk_method(file_type, filename, source_type)
    
    method_list = []
    for method in available_methods:
        method_list.append({
            "key": method,
            "label": CHUNK_METHOD_LABELS.get(method, method),
            "is_default": method == default_method
        })
    
    return ResponseUtil.success(data={
        "available_methods": method_list,
        "default_method": default_method
    })


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
    code: str = Query(None, description="知识库编码（模糊查询）"),
    status: str = Query(None, description="状态")
):
    """
    获取知识库列表（分页）

    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        category_id: 分类ID（可选）
        name: 知识库名称（模糊查询，可选）
        code: 知识库编码（模糊查询，可选）
        status: 状态（可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    kbs = KnowledgebaseService.get_knowledgebases(skip, page_size, category_id, name, code, status)
    total = KnowledgebaseService.count_knowledgebases(category_id, name, code, status)
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


@router.post("/retrieval", response_model=ApiResponse)
def retrieval(
    kb_ids: List[str] = Body(..., description="知识库ID列表"),
    question: str = Body(..., description="查询文本"),
    doc_ids: List[str] = Body(None, description="文档ID列表，可选，用于限定检索范围"),
    page: int = Body(1, ge=1, description="页码，从1开始"),
    page_size: int = Body(10, ge=1, le=100, description="每页数量"),
    top_k: int = Body(1024, ge=1, description="召回数量，从ES中检索的候选数量"),
    vector_similarity_threshold: float = Body(None, ge=0, le=1, description="文本相似度阈值，为空则使用知识库配置或默认0.2"),
    keyword_similarity_threshold: float = Body(None, ge=0, le=1, description="关键词相似度阈值，为空则使用知识库配置或默认0.0"),
    vector_similarity_weight: float = Body(None, ge=0, le=1, description="向量相似度权重(0~1)，为空则使用知识库配置或默认0.7"),
    sort_by: str = Body(None, description="排序方式：sim=混合相似度，vsim=向量相似度，tsim=关键词相似度"),
    embedding_model_id: str = Body(None, description="Embedding模型ID，为空则使用知识库配置"),
    rerank_model_id: str = Body(None, description="Rerank模型ID，为空则使用知识库配置"),
    metadatas: dict = Body(None, description="元数据过滤条件，格式为{字段名: {value: 值, fuzzy: 是否模糊查询, relation: 范围关系}}"),
):
    """
    知识库检索

    基于向量+关键词的混合检索，支持Rerank模型重排序。
    如果知识库配置了Rerank模型，则使用模型重排序；否则使用本地混合相似度排序。

    检索结果包含每个切片的混合相似度、向量相似度和关键词相似度。

    Args:
        kb_ids: 知识库ID列表
        question: 查询文本（必填）
        doc_ids: 文档ID列表（可选）
        page: 页码
        page_size: 每页数量
        top_k: 召回数量
        vector_similarity_threshold: 文本相似度阈值
        keyword_similarity_threshold: 关键词相似度阈值
        vector_similarity_weight: 向量相似度权重
        sort_by: 排序方式
        embedding_model_id: Embedding模型ID
        rerank_model_id: Rerank模型ID

    Returns:
        ApiResponse: {
            "total": 符合条件的总数,
            "chunks": [
                {
                    "chunk_id": 切片ID,
                    "content_with_weight": 切片内容,
                    "doc_id": 文档ID,
                    "docnm_kwd": 文档名称,
                    "kb_id": 知识库ID,
                    "similarity": 混合相似度,
                    "vector_similarity": 向量相似度,
                    "term_similarity": 关键词相似度,
                }
            ]
        }
    """
    try:
        if not question or not question.strip():
            return ResponseUtil.error(message="查询文本不能为空")

        if sort_by and sort_by not in ("sim", "vsim", "tsim"):
            return ResponseUtil.error(message="sort_by参数必须为sim、vsim或tsim")

        result = RetrievalService.retrieval(
            kb_ids=kb_ids,
            question=question.strip(),
            doc_ids=doc_ids,
            page=page,
            page_size=page_size,
            top_k=top_k,
            vector_similarity_threshold=vector_similarity_threshold,
            keyword_similarity_threshold=keyword_similarity_threshold,
            vector_similarity_weight=vector_similarity_weight,
            sort_by=sort_by,
            embedding_model_id=embedding_model_id,
            rerank_model_id=rerank_model_id,
            metadatas=metadatas,
        )
        return ResponseUtil.success(data=result)
    except ResourceNotFoundError as e:
        return ResponseUtil.error(message=str(e))
    except Exception as e:
        logger.error(f"知识库检索失败: {e}")
        return ResponseUtil.error(message=str(e))


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
            data['chunk_config'] = {}
    else:
        data['chunk_config'] = {}
    if data.get('document_config'):
        try:
            data['document_config'] = json.loads(data['document_config'])
        except (json.JSONDecodeError, TypeError):
            data['document_config'] = {}
    else:
        data['document_config'] = {}
    return ResponseUtil.created(data=data, message="知识库文档创建成功")


@router.get("/{kb_id}/document", response_model=ApiResponse)
def get_documents(
    kb_id: str,
    page: int = Query(1, description="页码"),
    page_size: int = Query(20, description="每页数量"),
    category_id: str = Query(None, description="文档分类ID"),
    name: str = Query(None, description="文档名称（模糊查询）"),
    file_type: str = Query(None, description="文件类型"),
    running_status: List[str] = Query(None, description="解析状态"),
    status: bool = Query(None, description="文档状态"),
    chunk_method: List[str] = Query(None, description="Chunk方法")
):
    """
    获取知识库文档列表（分页）

    Args:
        kb_id: 知识库ID
        page: 页码，默认1
        page_size: 每页数量，默认20
        category_id: 文档分类ID（可选）
        name: 文档名称（模糊查询，可选）
        file_type: 文件类型（可选）
        running_status: 解析状态列表（可选）
        status: 文档状态（可选）
        chunk_method: Chunk方法列表（可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    docs = KnowledgebaseDocumentService.get_documents(
        kb_id=kb_id, 
        category_id=category_id, 
        tags=None, 
        name=name, 
        file_type=file_type, 
        running_status=running_status, 
        status=status, 
        chunk_method=chunk_method, 
        skip=skip, 
        limit=page_size
    )
    total = KnowledgebaseDocumentService.count_documents(
        kb_id=kb_id, 
        category_id=category_id, 
        tags=None, 
        name=name, 
        file_type=file_type, 
        running_status=running_status, 
        status=status, 
        chunk_method=chunk_method
    )
    return ResponseUtil.success(data={"data": docs, "total": total}, message="获取知识库文档列表成功")


@router.post("/{kb_id}/document/upload", response_model=ApiResponse)
async def upload_documents(
    kb_id: str,
    files: List[UploadFile] = File(..., description="上传的文件列表"),
    source_type: str = Form(SourceType.LOCAL_DOCUMENT, description="来源类型：local_document/datasource/custom_template"),
    category_id: str = Form(None, description="文档分类ID"),
    chunk_method: str = Form(None, description="切片方法"),
    chunk_config: str = Form(None, description="切片配置，JSON字符串"),
    tags: str = Form(None, description="标签，JSON字符串"),
    status: bool = Form(None, description="状态：true/false"),
):
    """
    批量上传文档到知识库

    文件上传到RustFS对象存储，存储路径为：知识库id/文件名称。
    如果存在同名文件，自动在文件名后添加递增数字后缀，如test_(1).docx。

    Args:
        kb_id: 知识库ID
        files: 上传的文件列表
        source_type: 来源类型，默认document
        category_id: 文档分类ID，可选
        chunk_method: 切片方法，可选
        chunk_config: 切片配置，JSON字符串，可选
        tags: 标签，JSON字符串，可选
        status: 状态：true/false，可选

    Returns:
        ApiResponse: 统一格式的响应对象，包含成功上传的文档列表和错误信息
    """
    if not files:
        return ResponseUtil.bad_request(message="未选择文件")

    for f in files:
        if not f.filename:
            return ResponseUtil.bad_request(message="文件名不能为空")
        if len(f.filename.encode("utf-8")) > FILE_NAME_LEN_LIMIT:
            return ResponseUtil.bad_request(message=f"文件名 {f.filename} 长度超过{FILE_NAME_LEN_LIMIT}字节限制")

    if source_type not in [SourceType.LOCAL_DOCUMENT, SourceType.DATASOURCE, SourceType.CUSTOM_TEMPLATE]:
        return ResponseUtil.bad_request(message=f"不支持的来源类型: {source_type}")

    try:
        file_data_list = []
        for f in files:
            content = await f.read()
            file_data_list.append({
                "filename": f.filename,
                "content": content,
                "content_type": f.content_type,
            })
            await f.close()

        # 处理可选参数
        document_chunk_config = None
        if chunk_config:
            try:
                document_chunk_config = json.loads(chunk_config)
            except (json.JSONDecodeError, TypeError):
                return ResponseUtil.bad_request(message="切片配置格式错误")

        document_tags = None
        if tags:
            try:
                document_tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                return ResponseUtil.bad_request(message="标签格式错误")

        logger.info(f"准备上传 {len(file_data_list)} 个文件到知识库 {kb_id}")
        errors, documents = DocumentService.upload_documents(
            kb_id=kb_id,
            file_data_list=file_data_list,
            source_type=source_type,
            category_id=category_id,
            chunk_method=chunk_method,
            chunk_config=document_chunk_config,
            tags=document_tags,
            status=status,
        )

        docs_data = []
        for doc in documents:
            doc_dict = doc.__data__
            if doc_dict.get('chunk_config'):
                try:
                    doc_dict['chunk_config'] = json.loads(doc_dict['chunk_config'])
                except (json.JSONDecodeError, TypeError):
                    pass
            if doc_dict.get('tags'):
                try:
                    doc_dict['tags'] = json.loads(doc_dict['tags'])
                except (json.JSONDecodeError, TypeError):
                    pass
            docs_data.append(doc_dict)

        if errors:
            return ResponseUtil.success(
                data={"data": docs_data, "errors": errors},
                message=f"部分文件上传成功，{len(errors)}个文件上传失败"
            )

        return ResponseUtil.created(data=docs_data, message=f"成功上传{len(docs_data)}个文件")

    except Exception as e:
        import traceback
        logger.error(f"上传文档失败: {e}")
        logger.error(f"异常详情: {traceback.format_exc()}")
        logger.error(f"异常类型: {type(e)}")
        error_msg = str(e)
        if not error_msg or error_msg == "(0, '')":
            error_msg = "上传文档失败，请检查RustFS服务是否正常运行"
        return ResponseUtil.error(message=error_msg)


@router.post("/{kb_id}/document/batch_delete", response_model=ApiResponse)
async def batch_delete_documents(kb_id: str, request: Request):
    """
    批量删除知识库文档

    Args:
        kb_id: 知识库ID
        request: 请求对象，包含文档ID列表

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        document_ids = await request.json()
        if not isinstance(document_ids, list):
            return ResponseUtil.error(message="请求体必须是文档ID列表")
        deleted_count = KnowledgebaseDocumentService.batch_delete_documents(document_ids)
        return ResponseUtil.success(data={"deleted_count": deleted_count}, message=f"成功删除{deleted_count}个文档")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))
    except Exception as e:
        return ResponseUtil.error(message=f"批量删除失败: {str(e)}")


@router.post("/{kb_id}/document/batch_run", response_model=ApiResponse)
async def batch_run_documents(kb_id: str, request: Request):
    """
    批量执行文档切片任务

    Args:
        kb_id: 知识库ID
        request: 请求对象，包含文档ID列表

    Returns:
        ApiResponse: 统一格式的响应对象，包含成功和失败的文档ID
    """
    try:
        from app.core.knowledgebase.server import task_executor

        doc_ids = await request.json()
        if not isinstance(doc_ids, list):
            return ResponseUtil.bad_request(message="请求体必须是文档ID列表")

        results = task_executor.batch_run_documents(doc_ids)
        return ResponseUtil.success(
            data=results,
            message=f"批量提交完成: 成功{len(results['success'])}个, 跳过{len(results['skipped'])}个, 失败{len(results['failed'])}个"
        )
    except Exception as e:
        logger.error(f"批量执行文档切片任务失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.post("/{kb_id}/document/batch_stop", response_model=ApiResponse)
async def batch_stop_documents(kb_id: str, request: Request):
    """
    批量停止文档切片任务

    Args:
        kb_id: 知识库ID
        request: 请求对象，包含文档ID列表

    Returns:
        ApiResponse: 统一格式的响应对象，包含成功和失败的文档ID
    """
    try:
        from app.core.knowledgebase.server import task_executor

        doc_ids = await request.json()
        if not isinstance(doc_ids, list):
            return ResponseUtil.bad_request(message="请求体必须是文档ID列表")

        results = task_executor.batch_stop_documents(doc_ids)
        return ResponseUtil.success(
            data=results,
            message=f"批量停止完成: 成功{len(results['success'])}个, 跳过{len(results['skipped'])}个, 失败{len(results['failed'])}个"
        )
    except Exception as e:
        logger.error(f"批量停止文档切片任务失败: {e}")
        return ResponseUtil.error(message=str(e))


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
            data['chunk_config'] = {}
    else:
        data['chunk_config'] = {}
    if data.get('document_config'):
        try:
            data['document_config'] = json.loads(data['document_config'])
        except (json.JSONDecodeError, TypeError):
            data['document_config'] = {}
    else:
        data['document_config'] = {}
    if data.get('tags'):
        try:
            parsed_tags = json.loads(data['tags'])
            data['tags'] = parsed_tags if isinstance(parsed_tags, list) else []
        except (json.JSONDecodeError, TypeError):
            data['tags'] = []
    else:
        data['tags'] = []
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
    
    if data.get('category_id'):
        try:
            category = KnowledgebaseDocumentCategory.get_by_id(data['category_id'])
            data['category_name'] = category.name if not category.deleted else None
        except KnowledgebaseDocumentCategory.DoesNotExist:
            data['category_name'] = None
    else:
        data['category_name'] = None
    
    if data.get('tags'):
        try:
            parsed_tags = json.loads(data['tags'])
            data['tags'] = parsed_tags if isinstance(parsed_tags, list) else []
        except:
            data['tags'] = []
    else:
        data['tags'] = []
    
    if data.get('chunk_config'):
        try:
            data['chunk_config'] = json.loads(data['chunk_config'])
        except (json.JSONDecodeError, TypeError):
            data['chunk_config'] = {}
    else:
        data['chunk_config'] = {}
    
    if data.get('document_config'):
        try:
            data['document_config'] = json.loads(data['document_config'])
        except (json.JSONDecodeError, TypeError):
            data['document_config'] = {}
    else:
        data['document_config'] = {}
    return ResponseUtil.success(data=data, message="知识库文档更新成功")


@router.post("/{kb_id}/document/{document_id}/update_metadata", response_model=ApiResponse)
async def update_document_metadata(kb_id: str, document_id: str, request: Request):
    """
    更新数据集元数据，同步更新数据库和ES索引

    Args:
        kb_id: 知识库ID
        document_id: 文档ID
        request: 请求对象，包含metadatas字段

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        body = await request.json()
        metadatas = body.get("metadatas", {})
        
        if not isinstance(metadatas, dict):
            return ResponseUtil.error(message="metadatas必须是字典类型")
        
        result = KnowledgebaseDocumentService.update_document_metadata(document_id, kb_id, metadatas)
        return ResponseUtil.success(data=result, message="元数据更新成功")
    except Exception as e:
        logger.error(f"更新元数据失败: {e}")
        return ResponseUtil.error(message=f"更新元数据失败: {str(e)}")


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


@router.get("/{kb_id}/document/{document_id}/download")
def download_document(kb_id: str, document_id: str):
    """
    下载知识库文档

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        StreamingResponse: 文件流响应
    """
    try:
        result = DocumentService.download_document(document_id)
        blob = result["blob"]
        file_name = result["file_name"]
        mime_type = result["mime_type"]

        import urllib.parse
        encoded_filename = urllib.parse.quote(file_name)

        from io import BytesIO
        file_stream = BytesIO(blob)

        return StreamingResponse(
            file_stream,
            media_type=mime_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                "Content-Length": str(len(blob)),
            }
        )
    except Exception as e:
        logger.error(f"下载文档失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.get("/{kb_id}/document/{document_id}/preview", response_model=ApiResponse)
def preview_document(kb_id: str, document_id: str):
    """
    获取知识库文档在线阅读预览URL

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        ApiResponse: 统一格式的响应对象，包含预签名URL
    """
    try:
        url = DocumentService.get_document_preview_url(document_id)
        return ResponseUtil.success(data={"url": url}, message="获取预览URL成功")
    except Exception as e:
        logger.error(f"获取预览URL失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.get("/{kb_id}/document/{document_id}/thumbnail", response_model=ApiResponse)
def get_document_thumbnail(kb_id: str, document_id: str):
    """
    获取知识库文档缩略图

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        ApiResponse: 统一格式的响应对象，包含base64编码的缩略图
    """
    try:
        thumbnail = DocumentService.get_thumbnail(document_id)
        return ResponseUtil.success(data={"thumbnail": thumbnail}, message="获取缩略图成功")
    except Exception as e:
        logger.error(f"获取缩略图失败: {e}")
        return ResponseUtil.error(message=str(e))


# 知识库文档分类相关接口
@router.post("/{kb_id}/document_category", response_model=ApiResponse)
def create_document_category(kb_id: str, category: KnowledgebaseDocumentCategoryCreate):
    """
    创建知识库文档分类

    Args:
        kb_id: 知识库ID
        category: 知识库文档分类创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category.kb_id = kb_id
    db_category = KnowledgebaseDocumentCategoryService.create_category(category)
    category_data = db_category.__data__
    if category_data.get('document_config'):
        try:
            category_data['document_config'] = json.loads(category_data['document_config'])
        except:
            category_data['document_config'] = {}
    else:
        category_data['document_config'] = {}
    if category_data.get('chunk_config'):
        try:
            category_data['chunk_config'] = json.loads(category_data['chunk_config'])
        except:
            category_data['chunk_config'] = {}
    else:
        category_data['chunk_config'] = {}
    return ResponseUtil.created(data=category_data, message="知识库文档分类创建成功")


@router.get("/{kb_id}/document_category", response_model=ApiResponse)
def get_document_categories(kb_id: str, skip: int = 0, limit: int = 100):
    """
    获取知识库文档分类列表

    Args:
        kb_id: 知识库ID
        skip: 跳过的记录数
        limit: 返回的最大记录数

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = KnowledgebaseDocumentCategoryService.get_categories(kb_id, skip, limit)
    categories_data = []
    for category in categories:
        category_dict = category.__data__
        if category_dict.get('document_config'):
            try:
                category_dict['document_config'] = json.loads(category_dict['document_config'])
            except:
                category_dict['document_config'] = {}
        else:
            category_dict['document_config'] = {}
        if category_dict.get('chunk_config'):
            try:
                category_dict['chunk_config'] = json.loads(category_dict['chunk_config'])
            except:
                category_dict['chunk_config'] = {}
        else:
            category_dict['chunk_config'] = {}
        categories_data.append(category_dict)
    return ResponseUtil.success(data=categories_data, message="获取知识库文档分类列表成功")


@router.get("/{kb_id}/document_category/tree", response_model=ApiResponse)
def get_document_category_tree(kb_id: str):
    """
    获取知识库文档分类树形结构

    Args:
        kb_id: 知识库ID

    Returns:
        ApiResponse: 统一格式的响应对象，包含分类树形结构
    """
    tree = KnowledgebaseDocumentCategoryService.get_category_tree(kb_id)
    return ResponseUtil.success(data=tree, message="获取知识库文档分类树成功")


@router.get("/{kb_id}/document_category/{category_id}", response_model=ApiResponse)
def get_document_category(kb_id: str, category_id: str):
    """
    获取单个知识库文档分类

    Args:
        kb_id: 知识库ID
        category_id: 知识库文档分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = KnowledgebaseDocumentCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"知识库文档分类 {category_id} 不存在")
    category_data = category.__data__
    if category_data.get('document_config'):
        try:
            category_data['document_config'] = json.loads(category_data['document_config'])
        except:
            category_data['document_config'] = {}
    else:
        category_data['document_config'] = {}
    if category_data.get('chunk_config'):
        try:
            category_data['chunk_config'] = json.loads(category_data['chunk_config'])
        except:
            category_data['chunk_config'] = {}
    else:
        category_data['chunk_config'] = {}
    return ResponseUtil.success(data=category_data, message="获取知识库文档分类成功")


@router.post("/{kb_id}/document_category/{category_id}", response_model=ApiResponse)
def update_document_category(kb_id: str, category_id: str, category: KnowledgebaseDocumentCategoryUpdate):
    """
    更新知识库文档分类

    Args:
        kb_id: 知识库ID
        category_id: 知识库文档分类ID
        category: 知识库文档分类更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = KnowledgebaseDocumentCategoryService.update_category(category_id, category)
    category_data = db_category.__data__
    if category_data.get('document_config'):
        try:
            category_data['document_config'] = json.loads(category_data['document_config'])
        except:
            category_data['document_config'] = {}
    else:
        category_data['document_config'] = {}
    if category_data.get('chunk_config'):
        try:
            category_data['chunk_config'] = json.loads(category_data['chunk_config'])
        except:
            category_data['chunk_config'] = {}
    else:
        category_data['chunk_config'] = {}
    return ResponseUtil.success(data=category_data, message="知识库文档分类更新成功")


@router.post("/{kb_id}/document_category/{category_id}/delete", response_model=ApiResponse)
def delete_document_category(kb_id: str, category_id: str):
    """
    删除知识库文档分类（逻辑删除）

    Args:
        kb_id: 知识库ID
        category_id: 知识库文档分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = KnowledgebaseDocumentCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="知识库文档分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# ==================== 文档切片任务相关接口 ====================

@router.post("/{kb_id}/document/{document_id}/run", response_model=ApiResponse)
def run_document_task(kb_id: str, document_id: str):
    """
    执行文档切片任务

    将文档提交到切片任务队列，执行切片、Embedding和ES存储的完整流水线。
    切片方法从文档配置中获取，向量模型从知识库配置中获取。

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        ApiResponse: 统一格式的响应对象，包含任务信息
    """
    try:
        from app.core.knowledgebase.server import task_executor

        doc = KnowledgebaseDocumentService.get_document(document_id)
        if doc is None:
            return ResponseUtil.not_found(message=f"文档 {document_id} 不存在")
        if doc.kb_id != kb_id:
            return ResponseUtil.bad_request(message="文档不属于该知识库")

        task = task_executor.run_document_task(document_id)
        if task is None:
            return ResponseUtil.error(message="提交切片任务失败，请检查文档和知识库配置")

        return ResponseUtil.success(
            data={
                "task_id": task.task_id,
                "doc_id": task.doc_id,
                "status": task.status,
                "progress": task.progress,
                "progress_message": task.progress_message,
            },
            message="切片任务已提交"
        )
    except Exception as e:
        logger.error(f"执行文档切片任务失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.post("/{kb_id}/document/{document_id}/stop", response_model=ApiResponse)
def stop_document_task(kb_id: str, document_id: str):
    """
    停止文档切片任务

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        from app.core.knowledgebase.server import task_executor

        success = task_executor.stop_document_task(document_id)
        if success:
            return ResponseUtil.success(message="停止任务请求已发送")
        else:
            return ResponseUtil.error(message="停止任务失败，任务可能不存在")
    except Exception as e:
        logger.error(f"停止文档切片任务失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.post("/{kb_id}/document/{document_id}/delete_chunks", response_model=ApiResponse)
def delete_document_chunks(kb_id: str, document_id: str):
    """
    删除文档切片数据

    删除ES中该文档的所有切片数据，并重置文档状态。

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        from app.core.knowledgebase.server import task_executor

        success = task_executor.delete_document_chunks(kb_id, document_id)
        if success:
            return ResponseUtil.success(message="切片数据已删除")
        else:
            return ResponseUtil.error(message="删除切片数据失败")
    except Exception as e:
        logger.error(f"删除文档切片数据失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.get("/{kb_id}/document/{document_id}/task_status", response_model=ApiResponse)
def get_document_task_status(kb_id: str, document_id: str):
    """
    获取文档切片任务状态

    Args:
        kb_id: 知识库ID
        document_id: 文档ID

    Returns:
        ApiResponse: 统一格式的响应对象，包含任务状态信息
    """
    try:
        from app.core.knowledgebase.server import task_executor

        task = task_executor.get_task_status(document_id)
        if task is None:
            doc = KnowledgebaseDocumentService.get_document(document_id)
            if doc is None:
                return ResponseUtil.not_found(message=f"文档 {document_id} 不存在")
            return ResponseUtil.success(
                data={
                    "task_id": document_id,
                    "status": doc.get("running_status", "pending"),
                    "progress": doc.get("task_progress", 0),
                    "progress_message": doc.get("task_progress_message", ""),
                },
                message="获取任务状态成功"
            )

        return ResponseUtil.success(
            data={
                "task_id": task.task_id,
                "doc_id": task.doc_id,
                "status": task.status,
                "progress": task.progress,
                "progress_message": task.progress_message,
                "error": task.error,
                "started_at": task.started_at.isoformat() if task.started_at else None,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            },
            message="获取任务状态成功"
        )
    except Exception as e:
        logger.error(f"获取文档任务状态失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.get("/{kb_id}/task_executor_status", response_model=ApiResponse)
def get_task_executor_status(kb_id: str):
    """
    获取任务执行器状态

    Args:
        kb_id: 知识库ID

    Returns:
        ApiResponse: 统一格式的响应对象，包含执行器状态信息
    """
    try:
        from app.database.redis_utils import redis_utils as ru
        heartbeat = ru.get_obj("chunk_executor_heartbeat")
        if heartbeat:
            return ResponseUtil.success(data=heartbeat, message="获取执行器状态成功")
        else:
            return ResponseUtil.success(
                data={"status": "no_heartbeat", "message": "执行器心跳数据不可用"},
                message="执行器可能未启动"
            )
    except Exception as e:
        logger.error(f"获取任务执行器状态失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.get("/document_events/{kb_id}")
async def document_events(kb_id: str):
    """
    SSE端点：推送文档任务状态更新事件（使用异步Redis客户端）
    
    Args:
        kb_id: 知识库ID
        
    Returns:
        StreamingResponse: SSE事件流
    """
    import asyncio
    from redis.asyncio import Redis
    from app.configs.config import config as app_config
    
    async def event_generator():
        redis_client = None
        pubsub = None
        channel = f"kb:{kb_id}:doc_events"
        
        try:
            redis_config = app_config.config.get('redis', {})
            host = redis_config.get('host', '127.0.0.1')
            port = redis_config.get('port', 6379)
            db = redis_config.get('db', 1)
            username = redis_config.get('username', '')
            password = redis_config.get('password', '')
            
            conn_params = {
                'host': host,
                'port': port,
                'db': db,
                'decode_responses': True,
            }
            
            if username:
                conn_params['username'] = username
            if password:
                conn_params['password'] = password
            
            redis_client = Redis(**conn_params)
            
            await redis_client.ping()
            
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(channel)
            
            yield f"event: connected\ndata: {{\"message\": \"Connected to knowledgebase {kb_id}\"}}\n\n"
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    yield f"event: update\ndata: {data}\n\n"
                    
        except asyncio.CancelledError:
            logger.info(f"SSE连接关闭: {kb_id}")
        except Exception as e:
            logger.error(f"SSE事件流异常: {e}")
        finally:
            if pubsub:
                try:
                    await pubsub.unsubscribe(channel)
                    await pubsub.close()
                except Exception:
                    pass
            if redis_client:
                try:
                    await redis_client.close()
                except Exception:
                    pass
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/{kb_id}/chunks", response_model=ApiResponse)
def get_chunks(
    kb_id: str,
    doc_id: str = Query(None, description="文档ID，可选，用于过滤特定文档的切片"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    available: int = Query(None, description="可用状态过滤，0=停用，1=启用，不传则不过滤"),
    keyword: str = Query(None, description="关键词搜索，可选"),
):
    """
    分页查询知识库切片列表
    
    Args:
        kb_id: 知识库ID
        doc_id: 文档ID（可选）
        page: 页码
        page_size: 每页数量
        available: 可用状态过滤
        keyword: 关键词搜索
        
    Returns:
        ApiResponse: 包含切片列表和分页信息
    """
    try:
        result = KnowledgebaseDocumentService.get_chunks(
            kb_id=kb_id,
            doc_id=doc_id,
            page=page,
            page_size=page_size,
            available=available,
            keyword=keyword
        )
        return ResponseUtil.success(data=result)
    except Exception as e:
        logger.error(f"查询切片列表失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.post("/{kb_id}/chunk/{chunk_id}/toggle_available", response_model=ApiResponse)
def toggle_chunk_available(
    kb_id: str,
    chunk_id: str,
    available_int: int = Body(..., embed=True, description="可用状态，0=停用，1=启用"),
):
    """
    切换切片的可用状态
    
    Args:
        kb_id: 知识库ID
        chunk_id: 切片ID（ES文档ID）
        available_int: 可用状态
        
    Returns:
        ApiResponse: 操作结果
    """
    try:
        if available_int not in [0, 1]:
            return ResponseUtil.error(message="available_int参数必须为0或1")
        
        success = KnowledgebaseDocumentService.toggle_chunk_available(
            kb_id=kb_id,
            chunk_id=chunk_id,
            available=available_int
        )
        if success:
            return ResponseUtil.success(message="更新成功")
        else:
            return ResponseUtil.error(message="更新失败")
    except Exception as e:
        logger.error(f"切换切片可用状态失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.post("/{kb_id}/chunk", response_model=ApiResponse)
def create_chunk(
    kb_id: str,
    doc_id: str = Body(..., description="文档ID"),
    content: str = Body(..., description="切片内容"),
    keywords: List[str] = Body(None, description="关键词数组"),
    available_int: int = Body(1, description="是否可用，0=停用，1=启用"),
):
    """
    新增切片
    
    Args:
        kb_id: 知识库ID
        doc_id: 文档ID
        content: 切片内容
        keywords: 关键词数组（可选）
        available_int: 是否可用
        
    Returns:
        ApiResponse: 包含新增切片完整数据
    """
    try:
        if available_int not in [0, 1]:
            return ResponseUtil.error(message="available_int参数必须为0或1")
        
        if not content or not content.strip():
            return ResponseUtil.error(message="切片内容不能为空")
        
        result = KnowledgebaseDocumentService.create_chunk(
            kb_id=kb_id,
            doc_id=doc_id,
            content=content,
            keywords=keywords,
            available=available_int
        )
        return ResponseUtil.success(data=result, message="切片创建成功")
    except Exception as e:
        logger.error(f"新增切片失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.post("/{kb_id}/chunk/{chunk_id}/update", response_model=ApiResponse)
def update_chunk(
    kb_id: str,
    chunk_id: str,
    content: str = Body(None, description="切片内容"),
    keywords: List[str] = Body(None, description="关键词数组"),
    available_int: int = Body(None, description="是否可用，0=停用，1=启用"),
):
    """
    更新切片
    
    Args:
        kb_id: 知识库ID
        chunk_id: 切片ID
        content: 切片内容（可选）
        keywords: 关键词数组（可选）
        available_int: 是否可用（可选）
        
    Returns:
        ApiResponse: 更新后的切片数据
    """
    try:
        if available_int is not None and available_int not in [0, 1]:
            return ResponseUtil.error(message="available_int参数必须为0或1")
        
        if content is not None and not content.strip():
            return ResponseUtil.error(message="切片内容不能为空")
        
        result = KnowledgebaseDocumentService.update_chunk(
            kb_id=kb_id,
            chunk_id=chunk_id,
            content=content,
            keywords=keywords,
            available=available_int
        )
        if result:
            return ResponseUtil.success(data=result, message="切片更新成功")
        else:
            return ResponseUtil.error(message="切片更新失败")
    except Exception as e:
        logger.error(f"更新切片失败: {e}")
        return ResponseUtil.error(message=str(e))


@router.post("/{kb_id}/chunk/{chunk_id}/delete", response_model=ApiResponse)
def delete_chunk(
    kb_id: str,
    chunk_id: str,
):
    """
    删除切片
    
    Args:
        kb_id: 知识库ID
        chunk_id: 切片ID
        
    Returns:
        ApiResponse: 操作结果
    """
    try:
        success = KnowledgebaseDocumentService.delete_chunk(
            kb_id=kb_id,
            chunk_id=chunk_id
        )
        if success:
            return ResponseUtil.success(message="切片删除成功")
        else:
            return ResponseUtil.error(message="切片删除失败")
    except Exception as e:
        logger.error(f"删除切片失败: {e}")
        return ResponseUtil.error(message=str(e))


