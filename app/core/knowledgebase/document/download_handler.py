"""
文档下载处理器
负责从RustFS下载文档、生成预览URL等逻辑
"""

import logging
import json
from io import BytesIO

from app.database.storage.rustfs_utils import rustfs_utils
from app.database.models import KnowledgebaseDocument, Datasource
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
            RuntimeError: 下载失败
        """
        try:
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == document_id)
            if doc.deleted:
                raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")

        if not doc.location:
            raise RuntimeError("文档存储路径为空")

        # 获取 source_config
        source_config = None
        if doc.source_config:
            try:
                source_config = json.loads(doc.source_config) if isinstance(doc.source_config, str) else doc.source_config
            except:
                source_config = {}

        # 判断文档来源类型
        if doc.source_type == 'local_document':
            # 本地文档：从 RustFS 下载
            if not rustfs_utils.is_available:
                raise RuntimeError("RustFS对象存储服务不可用，无法下载文件")

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

        elif doc.source_type == 'datasource' and source_config:
            # 数据源文档：根据 source_config 连接数据源下载
            datasource_id = source_config.get('datasource_id')
            bucket_name = source_config.get('bucket_name')
            object_key = source_config.get('location')  # 文件在数据源中的路径

            if not datasource_id:
                raise RuntimeError("数据源配置缺少 datasource_id")

            if not object_key:
                raise RuntimeError("数据源配置缺少 location")

            # 获取数据源信息
            try:
                datasource = Datasource.get_by_id(datasource_id)
                if datasource.deleted:
                    raise RuntimeError(f"数据源 {datasource_id} 不存在")
            except Datasource.DoesNotExist:
                raise RuntimeError(f"数据源 {datasource_id} 不存在")

            datasource_type = datasource.type
            # 解析 datasource.config 为字典
            datasource_config = datasource.config or {}
            if isinstance(datasource_config, str):
                try:
                    import json
                    datasource_config = json.loads(datasource_config)
                except (json.JSONDecodeError, TypeError):
                    datasource_config = {}

            # 根据数据源类型调用相应的下载方法
            if datasource_type in ['s3', 'minio', 'rustfs']:
                # 文件存储类数据源
                return DocumentDownloadHandler._download_from_file_storage(
                    datasource_type, datasource_config, bucket_name, object_key, doc
                )
            else:
                raise RuntimeError(f"不支持的数据源类型: {datasource_type}")

        else:
            # 兜底：从 RustFS 下载
            if not rustfs_utils.is_available:
                raise RuntimeError("RustFS对象存储服务不可用，无法下载文件")

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
    def download_document_stream(document_id, chunk_size=8192):
        """
        流式下载文档,返回数据块迭代器和文件信息(适合大文件)

        Args:
            document_id: 文档ID
            chunk_size: 每次读取的块大小(字节),默认8KB

        Returns:
            tuple: (iterable, file_name, mime_type, file_size)

        Raises:
            ResourceNotFoundError: 文档不存在
            RuntimeError: 下载失败
        """
        try:
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == document_id)
            if doc.deleted:
                raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")

        if not doc.location:
            raise RuntimeError("文档存储路径为空")

        # 获取 source_config
        source_config = None
        if doc.source_config:
            try:
                source_config = json.loads(doc.source_config) if isinstance(doc.source_config, str) else doc.source_config
            except:
                source_config = {}

        file_name = doc.file_name
        mime_type = doc.mime_type or "application/octet-stream"

        # 判断文档来源类型
        if doc.source_type == 'local_document':
            # 本地文档:从 RustFS 流式下载
            if not rustfs_utils.is_available:
                raise RuntimeError("RustFS对象存储服务不可用,无法下载文件")

            iterable, content_length = rustfs_utils.download_object_stream(
                bucket_name=doc.kb_id,
                object_key=doc.location,
                chunk_size=chunk_size,
            )
            return iterable, file_name, mime_type, content_length

        elif doc.source_type == 'datasource' and source_config:
            # 数据源文档:流式下载
            datasource_id = source_config.get('datasource_id')
            bucket_name = source_config.get('bucket_name')
            object_key = source_config.get('location')

            if not datasource_id:
                raise RuntimeError("数据源配置缺少 datasource_id")

            if not object_key:
                raise RuntimeError("数据源配置缺少 location")

            # 获取数据源信息
            try:
                datasource = Datasource.get_by_id(datasource_id)
                if datasource.deleted:
                    raise RuntimeError(f"数据源 {datasource_id} 不存在")
            except Datasource.DoesNotExist:
                raise RuntimeError(f"数据源 {datasource_id} 不存在")

            datasource_type = datasource.type
            datasource_config = datasource.config or {}
            if isinstance(datasource_config, str):
                try:
                    import json
                    datasource_config = json.loads(datasource_config)
                except (json.JSONDecodeError, TypeError):
                    datasource_config = {}

            # 流式下载
            if datasource_type in ['s3', 'minio', 'rustfs']:
                iterable, content_length = DocumentDownloadHandler._download_from_file_storage_stream(
                    datasource_type, datasource_config, bucket_name, object_key, chunk_size
                )
                return iterable, file_name, mime_type, content_length
            else:
                raise RuntimeError(f"不支持的数据源类型: {datasource_type}")

        else:
            # 兜底:从 RustFS 流式下载
            if not rustfs_utils.is_available:
                raise RuntimeError("RustFS对象存储服务不可用,无法下载文件")

            iterable, content_length = rustfs_utils.download_object_stream(
                bucket_name=doc.kb_id,
                object_key=doc.location,
                chunk_size=chunk_size,
            )
            return iterable, file_name, mime_type, content_length

    @staticmethod
    def _download_from_file_storage(datasource_type, datasource_config, bucket_name, object_key, doc):
        """
        从文件存储类型数据源下载文件

        Args:
            datasource_type: 数据源类型 (s3, minio, rustfs)
            datasource_config: 数据源配置
            bucket_name: 存储桶名称
            object_key: 对象键（文件路径）
            doc: 文档对象

        Returns:
            dict: 包含blob、file_name、mime_type、file_size的字典
        """
        try:
            if datasource_type == 's3':
                import boto3
                client = boto3.client(
                    's3',
                    endpoint_url=datasource_config.get('endpoint_url'),
                    aws_access_key_id=datasource_config.get('access_key', ''),
                    aws_secret_access_key=datasource_config.get('secret_key', ''),
                    region_name=datasource_config.get('region', 'us-east-1'),
                )
                response = client.get_object(Bucket=bucket_name, Key=object_key)
                blob = response['Body'].read()

            elif datasource_type == 'minio':
                from minio import Minio
                secure = datasource_config.get('secure', False)
                client = Minio(
                    endpoint=datasource_config.get('endpoint_url', ''),
                    access_key=datasource_config.get('access_key', ''),
                    secret_key=datasource_config.get('secret_key', ''),
                    secure=secure,
                )
                response = client.get_object(bucket_name, object_key)
                blob = response.read()
                response.close()
                response.release_conn()

            elif datasource_type == 'rustfs':
                import boto3
                client = boto3.client(
                    's3',
                    endpoint_url=datasource_config.get('endpoint_url'),
                    aws_access_key_id=datasource_config.get('access_key', ''),
                    aws_secret_access_key=datasource_config.get('secret_key', ''),
                    region_name='us-east-1',
                )
                response = client.get_object(Bucket=bucket_name, Key=object_key)
                blob = response['Body'].read()

            else:
                raise RuntimeError(f"不支持的文件存储类型: {datasource_type}")

            return {
                "blob": blob,
                "file_name": doc.file_name,
                "mime_type": doc.mime_type or "application/octet-stream",
                "file_size": len(blob),
            }

        except ImportError as e:
            module_name = 'boto3' if datasource_type in ['s3', 'rustfs'] else 'minio'
            raise RuntimeError(f"缺少{module_name}依赖，请执行: pip install {module_name}")
        except Exception as e:
            raise RuntimeError(f"从{datasource_type}数据源下载文件失败: {str(e)}")

    @staticmethod
    def _download_from_file_storage_stream(datasource_type, datasource_config, bucket_name, object_key, chunk_size=8192):
        """
        从文件存储类型数据源流式下载文件(适合大文件)

        Args:
            datasource_type: 数据源类型 (s3, minio, rustfs)
            datasource_config: 数据源配置
            bucket_name: 存储桶名称
            object_key: 对象键(文件路径)
            chunk_size: 每次读取的块大小(字节),默认8KB

        Returns:
            tuple: (iterable, content_length)
        """
        try:
            if datasource_type in ['s3', 'rustfs']:
                import boto3
                client = boto3.client(
                    's3',
                    endpoint_url=datasource_config.get('endpoint_url'),
                    aws_access_key_id=datasource_config.get('access_key', ''),
                    aws_secret_access_key=datasource_config.get('secret_key', ''),
                    region_name=datasource_config.get('region', 'us-east-1') if datasource_type == 's3' else 'us-east-1',
                )
                response = client.get_object(Bucket=bucket_name, Key=object_key)
                body = response['Body']
                content_length = response.get('ContentLength', 0)

                # 创建迭代器包装类
                class StreamIterator:
                    """流式迭代器包装类,确保资源正确管理"""
                    def __init__(self, body_stream, chunk_size):
                        self.body_stream = body_stream
                        self.chunk_size = chunk_size
                        self._closed = False

                    def __iter__(self):
                        return self

                    def __next__(self):
                        if self._closed:
                            raise StopIteration

                        chunk = self.body_stream.read(self.chunk_size)
                        if not chunk:
                            self.close()
                            raise StopIteration
                        return chunk

                    def close(self):
                        if not self._closed:
                            self._closed = True
                            try:
                                self.body_stream.close()
                            except Exception:
                                pass

                    def __del__(self):
                        self.close()

                return StreamIterator(body, chunk_size), content_length

            elif datasource_type == 'minio':
                from minio import Minio
                secure = datasource_config.get('secure', False)
                client = Minio(
                    endpoint=datasource_config.get('endpoint_url', ''),
                    access_key=datasource_config.get('access_key', ''),
                    secret_key=datasource_config.get('secret_key', ''),
                    secure=secure,
                )
                response = client.get_object(bucket_name, object_key)
                # Minio的response对象有stat()方法可以获取文件大小
                stat = client.stat_object(bucket_name, object_key)
                content_length = stat.size if stat else 0

                # 创建迭代器包装类
                class StreamIterator:
                    """流式迭代器包装类,确保资源正确管理"""
                    def __init__(self, response_obj, chunk_size):
                        self.response_obj = response_obj
                        self.chunk_size = chunk_size
                        self._closed = False

                    def __iter__(self):
                        return self

                    def __next__(self):
                        if self._closed:
                            raise StopIteration

                        chunk = self.response_obj.read(self.chunk_size)
                        if not chunk:
                            self.close()
                            raise StopIteration
                        return chunk

                    def close(self):
                        if not self._closed:
                            self._closed = True
                            try:
                                self.response_obj.close()
                                self.response_obj.release_conn()
                            except Exception:
                                pass

                    def __del__(self):
                        self.close()

                return StreamIterator(response, chunk_size), content_length

            else:
                raise RuntimeError(f"不支持的文件存储类型: {datasource_type}")

        except ImportError as e:
            module_name = 'boto3' if datasource_type in ['s3', 'rustfs'] else 'minio'
            raise RuntimeError(f"缺少{module_name}依赖,请执行: pip install {module_name}")
        except Exception as e:
            raise RuntimeError(f"从{datasource_type}数据源流式下载文件失败: {str(e)}")

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
            RuntimeError: 生成URL失败
        """
        if not rustfs_utils.is_available:
            raise RuntimeError("RustFS对象存储服务不可用")

        try:
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == document_id)
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
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == document_id)
            if doc.deleted:
                raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")

        return doc.thumbnail or ""
