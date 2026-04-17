"""
文档上传处理器
负责文件上传到RustFS、文件去重、缩略图生成、文档记录创建等核心逻辑
"""

import logging
import uuid
from io import BytesIO

from app.constants.knowledgebase_constants import FILE_NAME_LEN_LIMIT
from app.constants.knowledgebase_document_constants import FileType, SourceType
from app.core.knowledgebase.utils.file_utils import (
    filename_type,
    get_file_suffix,
    get_mime_type,
    thumbnail_img,
    duplicate_filename,
    get_chunk_method_by_file_type,
)
from app.database.storage.rustfs_utils import rustfs_utils
from app.database.models import KnowledgebaseDocument, Knowledgebase
from app.core.exceptions import ResourceNotFoundError

logger = logging.getLogger(__name__)


class DocumentUploadHandler:
    """
    文档上传处理器

    负责将文件上传到RustFS对象存储，并创建对应的文档数据库记录
    """

    @staticmethod
    def upload_documents(kb_id, file_data_list, source_type=SourceType.LOCAL_DOCUMENT, category_id=None, chunk_method=None, chunk_config=None, tags=None, status=None):
        """
        批量上传文档到知识库

        Args:
            kb_id: 知识库ID
            file_data_list: 文件数据列表，每个元素为dict，包含filename/content/content_type
            source_type: 来源类型，默认为document
            category_id: 文档分类ID，可选
            chunk_method: 切片方法，可选
            chunk_config: 切片配置，可选
            tags: 标签，可选
            status: 状态，可选

        Returns:
            tuple: (errors, documents) 错误列表和文档记录列表

        Raises:
            ResourceNotFoundError: 知识库不存在
            RuntimeError: RustFS不可用或不支持的文件类型
        """
        logger.info(f"开始上传文档，kb_id: {kb_id}, 文件数量: {len(file_data_list)}")
        
        if not rustfs_utils.is_available:
            logger.error("RustFS对象存储服务不可用，无法上传文件")
            raise RuntimeError("RustFS对象存储服务不可用，无法上传文件")

        try:
            logger.info(f"获取知识库信息，kb_id: {kb_id}")
            kb = Knowledgebase.get_by_id(kb_id)
            if kb.deleted:
                raise ResourceNotFoundError(message=f"知识库 {kb_id} 不存在")
        except Knowledgebase.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库 {kb_id} 不存在")

        if not rustfs_utils.bucket_exists(kb_id):
            logger.info(f"创建Bucket: {kb_id}")
            rustfs_utils.create_bucket(kb_id)

        errors = []
        documents = []

        for file_data in file_data_list:
            try:
                logger.info(f"开始处理文件: {file_data.get('filename')}")
                doc = DocumentUploadHandler._upload_single_document(
                    kb_id=kb_id,
                    kb=kb,
                    file_data=file_data,
                    source_type=source_type,
                    category_id=category_id,
                    chunk_method=chunk_method,
                    chunk_config=chunk_config,
                    tags=tags,
                    status=status,
                )
                documents.append(doc)
                logger.info(f"文件处理成功: {file_data.get('filename')}")
            except Exception as e:
                filename = file_data.get('filename', 'unknown')
                errors.append(f"{filename}: {str(e)}")
                logger.error(f"上传文件 {filename} 失败: {e}")
                import traceback
                logger.error(f"异常详情: {traceback.format_exc()}")

        return errors, documents

    @staticmethod
    def _upload_single_document(kb_id, kb, file_data, source_type, category_id, chunk_method=None, chunk_config=None, tags=None, status=None):
        """
        上传单个文档

        Args:
            kb_id: 知识库ID
            kb: 知识库模型对象
            file_data: 文件数据dict，包含filename/content/content_type
            source_type: 来源类型
            category_id: 文档分类ID
            chunk_method: 切片方法，可选
            chunk_config: 切片配置，可选
            tags: 标签，可选
            status: 状态，可选

        Returns:
            KnowledgebaseDocument: 创建的文档记录

        Raises:
            RuntimeError: 文件名校验失败或不支持的文件类型
        """
        filename = file_data.get('filename')
        if not filename:
            raise RuntimeError("文件名为空")

        if len(filename.encode("utf-8")) > FILE_NAME_LEN_LIMIT:
            raise RuntimeError(f"文件名长度超过{FILE_NAME_LEN_LIMIT}字节限制")

        file_type = filename_type(filename)
        if file_type == FileType.OTHER:
            raise RuntimeError("不支持的文件类型")

        resolved_filename = duplicate_filename(kb_id, filename)

        blob = file_data.get('content', b'')
        if not blob:
            raise RuntimeError("文件内容为空")

        from app.services.knowledgebase.service import KnowledgebaseDocumentCategoryService
        category_path = KnowledgebaseDocumentCategoryService.get_category_path(category_id) if category_id else ""
        
        if category_path:
            location = f"{category_path}/{resolved_filename}"
        else:
            location = resolved_filename
        
        upload_success = DocumentUploadHandler._upload_to_rustfs(
            kb_id, location, blob, get_mime_type(filename)
        )
        if not upload_success:
            raise RuntimeError("文件上传到RustFS失败")

        thumbnail_base64 = ""
        try:
            thumbnail_base64 = DocumentUploadHandler._generate_thumbnail(kb_id, blob, filename)
        except Exception as e:
            logger.warning(f"生成缩略图失败 {filename}: {e}")

        doc = DocumentUploadHandler._create_document_record(
            kb_id=kb_id,
            kb=kb,
            filename=resolved_filename,
            original_filename=filename,
            location=location,
            blob=blob,
            file_type=file_type,
            source_type=source_type,
            category_id=category_id,
            thumbnail=thumbnail_base64,
            chunk_method=chunk_method,
            chunk_config=chunk_config,
            tags=tags,
            status=status,
        )

        return doc

    @staticmethod
    def _upload_to_rustfs(kb_id, location, blob, content_type=None):
        """
        上传文件到RustFS

        Args:
            kb_id: 知识库ID（作为bucket名称）
            location: 对象存储路径
            blob: 文件二进制数据
            content_type: MIME类型

        Returns:
            bool: 是否上传成功
        """
        try:
            data_stream = BytesIO(blob)
            return rustfs_utils.upload_object(
                bucket_name=kb_id,
                object_key=location,
                data=data_stream,
                content_type=content_type,
            )
        except Exception as e:
            logger.error(f"上传到RustFS失败 {kb_id}/{location}: {e}")
            return False

    @staticmethod
    def _generate_thumbnail(kb_id, blob, filename):
        """
        生成缩略图

        Args:
            kb_id: 知识库ID
            blob: 文件二进制数据
            filename: 文件名

        Returns:
            str: base64编码的缩略图字符串，不支持则返回空字符串
        """
        img = thumbnail_img(filename, blob)
        if img is not None:
            import base64
            return "data:image/png;base64," + base64.b64encode(img).decode("utf-8")
        return ""

    @staticmethod
    def _create_document_record(
        kb_id, kb, filename, original_filename, location, blob,
        file_type, source_type, category_id, thumbnail, chunk_method=None, chunk_config=None, tags=None, status=None
    ):
        """
        创建文档数据库记录

        Args:
            kb_id: 知识库ID
            kb: 知识库模型对象
            filename: 处理后的文件名（可能已去重）
            original_filename: 原始文件名
            location: 对象存储路径
            blob: 文件二进制数据
            file_type: 文件类型
            source_type: 来源类型
            category_id: 文档分类ID
            thumbnail: 缩略图base64字符串
            chunk_method: 切片方法，可选
            chunk_config: 切片配置，可选
            tags: 标签，可选
            status: 状态，可选

        Returns:
            KnowledgebaseDocument: 创建的文档记录
        """
        default_chunk_method = getattr(kb, 'chunk_method', 'naive')
        document_chunk_method = chunk_method or get_chunk_method_by_file_type(file_type, filename, default_chunk_method)

        if not category_id:
            from app.services.knowledgebase.service import KnowledgebaseDocumentCategoryService
            default_category = KnowledgebaseDocumentCategoryService._get_or_create_default_category(kb_id)
            category_id = default_category.id

        # 处理切片配置
        document_chunk_config = chunk_config
        if isinstance(document_chunk_config, str):
            try:
                import json
                document_chunk_config = json.loads(document_chunk_config)
            except (json.JSONDecodeError, TypeError):
                document_chunk_config = {}

        # 处理标签
        document_tags = tags
        if isinstance(document_tags, str):
            try:
                import json
                document_tags = json.loads(document_tags)
            except (json.JSONDecodeError, TypeError):
                document_tags = []

        # 处理切片配置（转换为JSON字符串）
        import json
        if document_chunk_config and isinstance(document_chunk_config, dict):
            document_chunk_config = json.dumps(document_chunk_config, ensure_ascii=False)

        # 处理标签（转换为JSON字符串）
        if document_tags and isinstance(document_tags, list):
            document_tags = json.dumps(document_tags, ensure_ascii=False)

        # 处理状态
        document_status = status if status is not None else True

        doc = KnowledgebaseDocument(
            kb_id=kb_id,
            category_id=category_id,
            chunk_method=document_chunk_method,
            chunk_config=document_chunk_config,
            file_type=file_type,
            file_name=filename,
            location=location,
            file_size=len(blob),
            mime_type=get_mime_type(original_filename),
            source_type=source_type,
            thumbnail=thumbnail,
            running_status="pending",
            task_progress=0,
            status=document_status,
            tags=document_tags,
        )
        doc.save(force_insert=True)

        Knowledgebase.update(
            doc_num=Knowledgebase.doc_num + 1,
        ).where(Knowledgebase.id == kb_id).execute()

        return doc
