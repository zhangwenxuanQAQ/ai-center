"""
知识库控制器，提供知识库分类、知识库、知识库文档相关的API接口
"""

import json
import logging
from typing import List
from fastapi import APIRouter, Body, Query, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from app.services.knowledgebase.service import (
    KnowledgebaseCategoryService,
    KnowledgebaseService,
    KnowledgebaseDocumentService,
    KnowledgebaseDocumentCategoryService
)
from app.services.knowledgebase.document.service import DocumentService
from app.services.knowledgebase.dto import (
    KnowledgebaseCategoryCreate, KnowledgebaseCategoryUpdate, KnowledgebaseCategory as CategorySchema,
    KnowledgebaseCreate, KnowledgebaseUpdate, Knowledgebase as KbSchema,
    KnowledgebaseDocumentCreate, KnowledgebaseDocumentUpdate, KnowledgebaseDocument as DocSchema,
    KnowledgebaseDocumentCategoryCreate, KnowledgebaseDocumentCategoryUpdate, KnowledgebaseDocumentCategory as DocCategorySchema
)
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.knowledgebase_constants import FILE_NAME_LEN_LIMIT
from app.constants.knowledgebase_document_constants import (
    CHUNK_METHOD_LABELS, CHUNK_METHOD_CONFIGS, SOURCE_TYPE_LABELS, SourceType
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
    return ResponseUtil.success(data={
        "chunk_methods": chunk_methods,
        "source_types": source_types,
        "chunk_configs": chunk_configs,
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
    return ResponseUtil.created(data=db_category.__data__, message="知识库文档分类创建成功")


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
    categories_data = [category.__data__ for category in categories]
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
    return ResponseUtil.success(data=category.__data__, message="获取知识库文档分类成功")


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
    return ResponseUtil.success(data=db_category.__data__, message="知识库文档分类更新成功")


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
