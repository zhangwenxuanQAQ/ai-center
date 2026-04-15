"""
知识库文档服务类
提供文档上传、下载、在线阅读等服务接口
"""

import logging
from app.core.knowledgebase.document.upload_handler import DocumentUploadHandler
from app.core.knowledgebase.document.download_handler import DocumentDownloadHandler
from app.constants.knowledgebase_document_constants import SourceType
from app.database.db_utils import handle_transaction
from app.database.models import KnowledgebaseDocument, Knowledgebase
from app.core.exceptions import ResourceNotFoundError

logger = logging.getLogger(__name__)


class DocumentService:
    """
    知识库文档服务类

    提供文档上传、下载、在线阅读等操作
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
            RuntimeError: RustFS不可用
        """
        errors, documents = DocumentUploadHandler.upload_documents(
            kb_id=kb_id,
            file_data_list=file_data_list,
            source_type=source_type,
            category_id=category_id,
            chunk_method=chunk_method,
            chunk_config=chunk_config,
            tags=tags,
            status=status,
        )
        return errors, documents

    @staticmethod
    def download_document(document_id):
        """
        下载文档

        Args:
            document_id: 文档ID

        Returns:
            dict: 包含blob、file_name、mime_type、file_size的字典

        Raises:
            ResourceNotFoundError: 文档不存在
            RuntimeError: 下载失败
        """
        return DocumentDownloadHandler.download_document(document_id)

    @staticmethod
    def get_document_preview_url(document_id, expiration=3600):
        """
        获取文档预览URL

        Args:
            document_id: 文档ID
            expiration: URL过期时间（秒）

        Returns:
            str: 预签名URL

        Raises:
            ResourceNotFoundError: 文档不存在
            RuntimeError: 生成URL失败
        """
        return DocumentDownloadHandler.get_document_preview_url(document_id, expiration)

    @staticmethod
    def get_thumbnail(document_id):
        """
        获取文档缩略图

        Args:
            document_id: 文档ID

        Returns:
            str: base64编码的缩略图

        Raises:
            ResourceNotFoundError: 文档不存在
        """
        return DocumentDownloadHandler.get_thumbnail(document_id)

    @staticmethod
    @handle_transaction
    def delete_document_with_file(document_id):
        """
        删除文档（同时删除RustFS中的文件）

        Args:
            document_id: 文档ID

        Returns:
            KnowledgebaseDocument: 被删除的文档对象

        Raises:
            ResourceNotFoundError: 文档不存在
        """
        try:
            doc = KnowledgebaseDocument.get_by_id(document_id)
            if doc.deleted:
                raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")

        from app.database.storage.rustfs_utils import rustfs_utils
        if doc.location and rustfs_utils.is_available:
            try:
                rustfs_utils.delete_object(
                    bucket_name=doc.kb_id,
                    object_key=doc.location,
                )
            except Exception as e:
                logger.warning(f"删除RustFS文件失败 {doc.kb_id}/{doc.location}: {e}")

        doc.deleted = True
        from datetime import datetime
        doc.deleted_at = datetime.now()
        doc.save()

        Knowledgebase.update(
            doc_num=Knowledgebase.doc_num - 1,
        ).where(Knowledgebase.id == doc.kb_id).execute()

        return doc
