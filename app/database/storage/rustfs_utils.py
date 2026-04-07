"""
RustFS对象存储工具类
使用boto3实现S3兼容的对象存储操作

功能特性:
- 自动连接RustFS服务
- 完整的CRUD操作（上传、下载、删除、列表）
- Bucket管理
- 预签名URL生成
- 完善的错误处理和日志记录
"""

import logging
import io
from typing import Optional, Dict, Any, List, BinaryIO
from datetime import datetime, timedelta

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    from botocore.client import Config as BotoConfig
    BOTO3_AVAILABLE = True
except ImportError:
    boto3 = None
    ClientError = Exception
    NoCredentialsError = Exception
    BotoConfig = None
    BOTO3_AVAILABLE = False

from app.configs.config import config as app_config

logger = logging.getLogger(__name__)


class RustFSUtils:
    """RustFS对象存储工具类"""

    _instance: Optional['RustFSUtils'] = None
    _s3_client: Optional[Any] = None
    _is_connected: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """
        初始化RustFS连接
        
        连接流程:
        1. 读取配置参数
        2. 创建boto3 S3客户端
        3. 测试连接
        4. 记录连接状态
        """
        if not BOTO3_AVAILABLE:
            logger.warning("boto3库未安装，RustFS功能不可用。请运行: pip install boto3")
            self._s3_client = None
            return
            
        try:
            rustfs_config = app_config.config.get('rustfs', {})

            host = rustfs_config.get('host', '127.0.0.1')
            port = rustfs_config.get('port', 9000)
            username = rustfs_config.get('username', 'rustfsadmin')
            password = rustfs_config.get('password', 'rustfsadmin')

            endpoint_url = f"http://{host}:{port}"

            self._s3_client = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=username,
                aws_secret_access_key=password,
                config=BotoConfig(
                    signature_version='s3v4',
                    retries={
                        'max_attempts': 3,
                        'mode': 'standard'
                    }
                )
            )

            # 测试连接 - 列出所有bucket
            response = self._s3_client.list_buckets()
            bucket_count = len(response.get('Buckets', []))
            
            self._is_connected = True
            
            logger.info(
                f"成功连接到RustFS: {endpoint_url}, "
                f"现有Bucket数量: {bucket_count}"
            )
            
        except NoCredentialsError as e:
            logger.error(f"RustFS认证失败: {e}")
            self._s3_client = None
            self._is_connected = False
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            logger.error(f"RustFS连接失败 (错误码: {error_code}): {e}")
            self._s3_client = None
            self._is_connected = False
        except Exception as e:
            logger.error(f"初始化RustFS连接失败: {e}")
            self._s3_client = None
            self._is_connected = False

    @property
    def is_available(self) -> bool:
        """检查RustFS功能是否可用"""
        return BOTO3_AVAILABLE and self._s3_client is not None and self._is_connected

    @property
    def client(self) -> Optional[Any]:
        """获取S3客户端实例"""
        return self._s3_client

    # ==================== Bucket操作 ====================

    def create_bucket(self, bucket_name: str, region: str = None) -> bool:
        """
        创建Bucket
        
        Args:
            bucket_name: Bucket名称
            region: 区域（可选）
            
        Returns:
            bool: 是否创建成功
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return False
            
        try:
            if region:
                self._s3_client.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': region}
                )
            else:
                self._s3_client.create_bucket(Bucket=bucket_name)
                
            logger.info(f"成功创建Bucket: {bucket_name}")
            return True
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'BucketAlreadyExists':
                logger.warning(f"Bucket已存在: {bucket_name}")
                return True
            else:
                logger.error(f"创建Bucket失败 {bucket_name}: {e}")
                return False

    def delete_bucket(self, bucket_name: str, force: bool = False) -> bool:
        """
        删除Bucket
        
        Args:
            bucket_name: Bucket名称
            force: 是否强制删除（先删除所有对象）
            
        Returns:
            bool: 是否删除成功
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return False
            
        try:
            if force:
                # 先删除所有对象
                objects = self.list_objects(bucket_name)
                for obj in objects:
                    self.delete_object(bucket_name, obj['Key'])
            
            self._s3_client.delete_bucket(Bucket=bucket_name)
            logger.info(f"成功删除Bucket: {bucket_name}")
            return True
            
        except ClientError as e:
            logger.error(f"删除Bucket失败 {bucket_name}: {e}")
            return False

    def bucket_exists(self, bucket_name: str) -> bool:
        """
        检查Bucket是否存在
        
        Args:
            bucket_name: Bucket名称
            
        Returns:
            bool: 是否存在
        """
        if not self._s3_client:
            return False
            
        try:
            self._s3_client.head_bucket(Bucket=bucket_name)
            return True
        except ClientError:
            return False

    def list_buckets(self) -> List[Dict[str, Any]]:
        """
        列出所有Bucket
        
        Returns:
            List[Dict]: Bucket列表，每个元素包含 'Name' 和 'CreationDate'
        """
        if not self._s3_client:
            return []
            
        try:
            response = self._s3_client.list_buckets()
            buckets = [
                {
                    'Name': bucket['Name'],
                    'CreationDate': bucket['CreationDate'].isoformat() if bucket.get('CreationDate') else None
                }
                for bucket in response.get('Buckets', [])
            ]
            return buckets
        except ClientError as e:
            logger.error(f"列出Bucket失败: {e}")
            return []

    # ==================== 对象操作 ====================

    def upload_object(
        self,
        bucket_name: str,
        object_key: str,
        data: BinaryIO,
        content_type: str = None,
        metadata: Dict[str, str] = None
    ) -> bool:
        """
        上传对象
        
        Args:
            bucket_name: Bucket名称
            object_key: 对象键（路径）
            data: 文件数据（二进制流）
            content_type: 内容类型（可选）
            metadata: 元数据（可选）
            
        Returns:
            bool: 是否上传成功
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return False
            
        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            if metadata:
                extra_args['Metadata'] = metadata
                
            self._s3_client.upload_fileobj(
                data,
                bucket_name,
                object_key,
                ExtraArgs=extra_args if extra_args else None
            )
            
            logger.info(f"成功上传对象: {bucket_name}/{object_key}")
            return True
            
        except ClientError as e:
            logger.error(f"上传对象失败 {bucket_name}/{object_key}: {e}")
            return False

    def upload_file(
        self,
        bucket_name: str,
        object_key: str,
        file_path: str,
        content_type: str = None,
        metadata: Dict[str, str] = None
    ) -> bool:
        """
        上传本地文件
        
        Args:
            bucket_name: Bucket名称
            object_key: 对象键（路径）
            file_path: 本地文件路径
            content_type: 内容类型（可选）
            metadata: 元数据（可选）
            
        Returns:
            bool: 是否上传成功
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return False
            
        try:
            extra_args = {}
            if content_type:
                extra_args['ContentType'] = content_type
            if metadata:
                extra_args['Metadata'] = metadata
                
            self._s3_client.upload_file(
                file_path,
                bucket_name,
                object_key,
                ExtraArgs=extra_args if extra_args else None
            )
            
            logger.info(f"成功上传文件: {file_path} -> {bucket_name}/{object_key}")
            return True
            
        except ClientError as e:
            logger.error(f"上传文件失败 {file_path}: {e}")
            return False

    def download_object(
        self,
        bucket_name: str,
        object_key: str
    ) -> Optional[bytes]:
        """
        下载对象到内存
        
        Args:
            bucket_name: Bucket名称
            object_key: 对象键（路径）
            
        Returns:
            bytes or None: 对象数据
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return None
            
        try:
            response = self._s3_client.get_object(
                Bucket=bucket_name,
                Key=object_key
            )
            
            data = response['Body'].read()
            logger.debug(f"成功下载对象: {bucket_name}/{object_key} ({len(data)} bytes)")
            return data
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchKey':
                logger.warning(f"对象不存在: {bucket_name}/{object_key}")
            else:
                logger.error(f"下载对象失败 {bucket_name}/{object_key}: {e}")
            return None

    def download_file(
        self,
        bucket_name: str,
        object_key: str,
        file_path: str
    ) -> bool:
        """
        下载对象到本地文件
        
        Args:
            bucket_name: Bucket名称
            object_key: 对象键（路径）
            file_path: 本地文件路径
            
        Returns:
            bool: 是否下载成功
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return False
            
        try:
            self._s3_client.download_file(
                bucket_name,
                object_key,
                file_path
            )
            
            logger.info(f"成功下载文件: {bucket_name}/{object_key} -> {file_path}")
            return True
            
        except ClientError as e:
            logger.error(f"下载文件失败 {bucket_name}/{object_key}: {e}")
            return False

    def delete_object(self, bucket_name: str, object_key: str) -> bool:
        """
        删除对象
        
        Args:
            bucket_name: Bucket名称
            object_key: 对象键（路径）
            
        Returns:
            bool: 是否删除成功
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return False
            
        try:
            self._s3_client.delete_object(
                Bucket=bucket_name,
                Key=object_key
            )
            
            logger.info(f"成功删除对象: {bucket_name}/{object_key}")
            return True
            
        except ClientError as e:
            logger.error(f"删除对象失败 {bucket_name}/{object_key}: {e}")
            return False

    def delete_objects(self, bucket_name: str, object_keys: List[str]) -> int:
        """
        批量删除对象
        
        Args:
            bucket_name: Bucket名称
            object_keys: 对象键列表
            
        Returns:
            int: 成功删除的数量
        """
        if not self._s3_client or not object_keys:
            return 0
            
        try:
            delete_keys = [{'Key': key} for key in object_keys]
            
            response = self._s3_client.delete_objects(
                Bucket=bucket_name,
                Delete={'Objects': delete_keys}
            )
            
            deleted_count = len(response.get('Deleted', []))
            errors = response.get('Errors', [])
            
            if errors:
                for error in errors:
                    logger.warning(f"删除失败 {error['Key']}: {error.get('Message', 'Unknown')}")
            
            logger.info(f"批量删除完成: {deleted_count}个对象")
            return deleted_count
            
        except ClientError as e:
            logger.error(f"批量删除失败: {e}")
            return 0

    def object_exists(self, bucket_name: str, object_key: str) -> bool:
        """
        检查对象是否存在
        
        Args:
            bucket_name: Bucket名称
            object_key: 对象键（路径）
            
        Returns:
            bool: 是否存在
        """
        if not self._s3_client:
            return False
            
        try:
            self._s3_client.head_object(
                Bucket=bucket_name,
                Key=object_key
            )
            return True
        except ClientError:
            return False

    def get_object_metadata(self, bucket_name: str, object_key: str) -> Optional[Dict[str, Any]]:
        """
        获取对象元数据
        
        Args:
            bucket_name: Bucket名称
            object_key: 对象键（路径）
            
        Returns:
            Dict or None: 元数据字典
        """
        if not self._s3_client:
            return None
            
        try:
            response = self._s3_client.head_object(
                Bucket=bucket_name,
                Key=object_key
            )
            
            metadata = {
                'ContentLength': response.get('ContentLength', 0),
                'ContentType': response.get('ContentType', ''),
                'LastModified': response.get('LastModified').isoformat() if response.get('LastModified') else None,
                'ETag': response.get('ETag', ''),
                'Metadata': response.get('Metadata', {})
            }
            
            return metadata
            
        except ClientError as e:
            logger.error(f"获取对象元数据失败 {bucket_name}/{object_key}: {e}")
            return None

    def list_objects(
        self,
        bucket_name: str,
        prefix: str = '',
        max_keys: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        列出Bucket中的对象
        
        Args:
            bucket_name: Bucket名称
            prefix: 对象前缀（可选）
            max_keys: 最大返回数量
            
        Returns:
            List[Dict]: 对象列表
        """
        if not self._s3_client:
            return []
            
        try:
            response = self._s3_client.list_objects_v2(
                Bucket=bucket_name,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            objects = [
                {
                    'Key': obj['Key'],
                    'Size': obj['Size'],
                    'LastModified': obj['LastModified'].isoformat() if obj.get('LastModified') else None,
                    'ETag': obj.get('ETag', ''),
                    'StorageClass': obj.get('StorageClass', 'STANDARD')
                }
                for obj in response.get('Contents', [])
            ]
            
            return objects
            
        except ClientError as e:
            logger.error(f"列出对象失败 {bucket_name}: {e}")
            return []

    def copy_object(
        self,
        source_bucket: str,
        source_key: str,
        dest_bucket: str,
        dest_key: str
    ) -> bool:
        """
        复制对象
        
        Args:
            source_bucket: 源Bucket
            source_key: 源对象键
            dest_bucket: 目标Bucket
            dest_key: 目标对象键
            
        Returns:
            bool: 是否复制成功
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return False
            
        try:
            copy_source = {
                'Bucket': source_bucket,
                'Key': source_key
            }
            
            self._s3_client.copy_object(
                CopySource=copy_source,
                Bucket=dest_bucket,
                Key=dest_key
            )
            
            logger.info(f"成功复制对象: {source_bucket}/{source_key} -> {dest_bucket}/{dest_key}")
            return True
            
        except ClientError as e:
            logger.error(f"复制对象失败: {e}")
            return False

    # ==================== 预签名URL ====================

    def generate_presigned_url(
        self,
        bucket_name: str,
        object_key: str,
        expiration: int = 3600,
        http_method: str = 'get'
    ) -> Optional[str]:
        """
        生成预签名URL
        
        Args:
            bucket_name: Bucket名称
            object_key: 对象键（路径）
            expiration: 过期时间（秒），默认1小时
            http_method: HTTP方法 ('get' 或 'put')
            
        Returns:
            str or None: 预签名URL
        """
        if not self._s3_client:
            logger.error("RustFS客户端未初始化")
            return None
            
        try:
            client_method = 'get_object' if http_method.lower() == 'get' else 'put_object'
            
            url = self._s3_client.generate_presigned_url(
                ClientMethod=client_method,
                Params={
                    'Bucket': bucket_name,
                    'Key': object_key
                },
                ExpiresIn=expiration
            )
            
            logger.debug(f"生成预签名URL: {bucket_name}/{object_key} (有效期{expiration}秒)")
            return url
            
        except ClientError as e:
            logger.error(f"生成预签名URL失败: {e}")
            return None

    # ==================== 辅助方法 ====================

    def get_bucket_size(self, bucket_name: str) -> int:
        """
        获取Bucket总大小（字节）
        
        Args:
            bucket_name: Bucket名称
            
        Returns:
            int: 总字节数
        """
        objects = self.list_objects(bucket_name)
        total_size = sum(obj.get('Size', 0) for obj in objects)
        return total_size

    def get_object_count(self, bucket_name: str, prefix: str = '') -> int:
        """
        获取对象数量
        
        Args:
            bucket_name: Bucket名称
            prefix: 对象前缀（可选）
            
        Returns:
            int: 对象数量
        """
        objects = self.list_objects(bucket_name, prefix=prefix)
        return len(objects)


# 全局单例实例
rustfs_utils = RustFSUtils()
