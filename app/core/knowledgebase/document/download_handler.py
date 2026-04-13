"""
文档下载处理器
负责从RustFS下载文档、生成预览URL等逻辑
"""

import logging
from io import BytesIO

from app.database.storage.rustfs_utils import rustfs_utils
from app.database.models import KnowledgebaseDocument
from app.core.exceptions import ResourceNotFoundError

logger = logging.getLogger(__name__)


class DocumentDownloadHandler:
    """
    文档下载处理器

    负责从RustFS下载文档、生成预签名URL等
    """

    @staticmethod
    def download_document(document_id):
        """
        下载文档，返回文件二进制数据和文件信息

        Args:
            document_id: 文档ID

        Returns:
            dict: 包含blob、file_name、mime_type、file_size的字典

        Raises:
            ResourceNotFoundError: 文档不存在
            RuntimeError: RustFS不可用或下载失败
        """
        if not rustfs_utils.is_available:
            raise RuntimeError("RustFS对象存储服务不可用，无法下载文件")

        try:
            doc = KnowledgebaseDocument.get_by_id(document_id)
            if doc.deleted:
                raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")

        if not doc.location:
            raise RuntimeError("文档存储路径为空")

        blob = rustfs_utils.download_object(
            bucket_name=doc.kb_id,
            object_key=doc.location,
        )
        if blob is None:
            raise RuntimeError(f"从RustFS下载文件失败: {doc.location}")

        return {
            "blob": blob,
            "file_name": doc.file_name,
            "mime_type": doc.mime_type or "application/octet-stream",
            "file_size": doc.file_size,
        }

    @staticmethod
    def get_document_preview_url(document_id, expiration=3600):
        """
        获取文档预览的预签名URL

        Args:
            document_id: 文档ID
            expiration: URL过期时间（秒），默认1小时

        Returns:
            str: 预签名URL

        Raises:
            ResourceNotFoundError: 文档不存在
            RuntimeError: RustFS不可用或生成URL失败
        """
        if not rustfs_utils.is_available:
            raise RuntimeError("RustFS对象存储服务不可用")

        try:
            doc = KnowledgebaseDocument.get_by_id(document_id)
            if doc.deleted:
                raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")

        if not doc.location:
            raise RuntimeError("文档存储路径为空")

        url = rustfs_utils.generate_presigned_url(
            bucket_name=doc.kb_id,
            object_key=doc.location,
            expiration=expiration,
            http_method='get',
        )
        if url is None:
            raise RuntimeError("生成预签名URL失败")

        return url

    @staticmethod
    def get_thumbnail(document_id):
        """
        获取文档缩略图

        Args:
            document_id: 文档ID

        Returns:
            str: base64编码的缩略图字符串

        Raises:
            ResourceNotFoundError: 文档不存在
        """
        try:
            doc = KnowledgebaseDocument.get_by_id(document_id)
            if doc.deleted:
                raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")

        return doc.thumbnail or ""
