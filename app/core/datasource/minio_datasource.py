"""
MinIO数据源实现类

提供MinIO文件服务的连接测试和文件操作功能
"""

from typing import Any, Dict, Optional
from app.core.datasource.base import DatasourceBase


class MinIODatasource(DatasourceBase):
    """
    MinIO数据源实现类
    
    实现MinIO文件服务的连接测试、文件列表查询和Bucket信息获取
    """

    def test_connection(self) -> Dict[str, Any]:
        """
        测试MinIO连接
        """
        try:
            from minio import Minio
            secure = self.config.get('secure', False)
            client = Minio(
                endpoint=self.config.get('endpoint_url', ''),
                access_key=self.config.get('access_key', ''),
                secret_key=self.config.get('secret_key', ''),
                secure=secure,
            )
            client.list_buckets()
            return {"success": True, "message": "MinIO服务连接成功"}
        except ImportError:
            return {"success": False, "message": "缺少minio依赖，请执行: pip install minio"}
        except Exception as e:
            return {"success": False, "message": f"MinIO服务连接失败: {str(e)}"}

    def execute_query(self, query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        执行MinIO查询（列出文件）
        
        Args:
            query: 查询语句，格式为JSON: {"bucket": "xxx", "prefix": "xxx", "max_keys": 100}
        """
        try:
            from minio import Minio
            import json
            secure = self.config.get('secure', False)
            client = Minio(
                endpoint=self.config.get('endpoint_url', ''),
                access_key=self.config.get('access_key', ''),
                secret_key=self.config.get('secret_key', ''),
                secure=secure,
            )
            query_params = json.loads(query) if isinstance(query, str) else query
            bucket = query_params.get('bucket', self.config.get('bucket', ''))
            prefix = query_params.get('prefix', '')
            max_keys = query_params.get('max_keys', 100)
            objects = client.list_objects(bucket, prefix=prefix, recursive=True)
            rows = []
            count = 0
            for obj in objects:
                if count >= max_keys:
                    break
                rows.append({
                    "object_name": obj.object_name,
                    "size": obj.size,
                    "last_modified": str(obj.last_modified) if obj.last_modified else '',
                    "etag": obj.etag,
                    "content_type": obj.content_type,
                })
                count += 1
            return {
                "success": True,
                "message": "查询执行成功",
                "data": {
                    "columns": ["object_name", "size", "last_modified", "etag", "content_type"],
                    "rows": rows,
                    "total": len(rows),
                }
            }
        except ImportError:
            return {"success": False, "message": "缺少minio依赖，请执行: pip install minio"}
        except Exception as e:
            return {"success": False, "message": f"查询执行失败: {str(e)}"}

    def get_schema_info(self) -> Dict[str, Any]:
        """
        获取MinIO Bucket信息
        """
        try:
            from minio import Minio
            secure = self.config.get('secure', False)
            client = Minio(
                endpoint=self.config.get('endpoint_url', ''),
                access_key=self.config.get('access_key', ''),
                secret_key=self.config.get('secret_key', ''),
                secure=secure,
            )
            buckets = client.list_buckets()
            bucket_list = []
            for bucket in buckets:
                bucket_list.append({
                    "name": bucket.name,
                    "creation_date": str(bucket.creation_date),
                })
            return {
                "success": True,
                "message": "获取Bucket信息成功",
                "data": {"buckets": bucket_list}
            }
        except ImportError:
            return {"success": False, "message": "缺少minio依赖，请执行: pip install minio"}
        except Exception as e:
            return {"success": False, "message": f"获取Bucket信息失败: {str(e)}"}

    def list_files(self, bucket: Optional[str] = None, prefix: Optional[str] = None, max_keys: int = 100) -> Dict[str, Any]:
        """
        列出文件
        
        Args:
            bucket: Bucket名称（可选，不指定则使用配置中的默认bucket）
            prefix: 文件前缀/目录（可选）
            max_keys: 最大返回数量
            
        Returns:
            Dict[str, Any]: 包含文件列表的字典
        """
        try:
            from minio import Minio
            secure = self.config.get('secure', False)
            client = Minio(
                endpoint=self.config.get('endpoint_url', ''),
                access_key=self.config.get('access_key', ''),
                secret_key=self.config.get('secret_key', ''),
                secure=secure,
            )
            target_bucket = bucket or self.config.get('bucket', '')
            if not target_bucket:
                return {"success": False, "message": "Bucket名称不能为空", "data": None}
            
            objects = client.list_objects(target_bucket, prefix=prefix or '', recursive=False)
            files = []
            directories = []
            count = 0
            
            for obj in objects:
                if count >= max_keys:
                    break
                if obj.is_dir:
                    directories.append({
                        "name": obj.object_name.rstrip('/'),
                        "type": "directory",
                        "path": obj.object_name,
                    })
                else:
                    files.append({
                        "name": obj.object_name.split('/')[-1],
                        "type": "file",
                        "path": obj.object_name,
                        "size": obj.size,
                        "last_modified": str(obj.last_modified) if obj.last_modified else '',
                        "etag": obj.etag,
                        "content_type": obj.content_type,
                    })
                count += 1
            
            return {
                "success": True,
                "message": "获取文件列表成功",
                "data": {
                    "bucket": target_bucket,
                    "prefix": prefix or '',
                    "directories": directories,
                    "files": files,
                    "total": len(directories) + len(files),
                }
            }
        except ImportError:
            return {"success": False, "message": "缺少minio依赖，请执行: pip install minio"}
        except Exception as e:
            return {"success": False, "message": f"获取文件列表失败: {str(e)}"}

    def download_file(self, bucket: Optional[str] = None, object_name: str = "") -> Dict[str, Any]:
        """
        下载文件
        
        Args:
            bucket: Bucket名称（可选，不指定则使用配置中的默认bucket）
            object_name: 对象名称/文件路径
            
        Returns:
            Dict[str, Any]: 包含文件内容的字典
        """
        try:
            from minio import Minio
            import io
            secure = self.config.get('secure', False)
            client = Minio(
                endpoint=self.config.get('endpoint_url', ''),
                access_key=self.config.get('access_key', ''),
                secret_key=self.config.get('secret_key', ''),
                secure=secure,
            )
            target_bucket = bucket or self.config.get('bucket', '')
            if not target_bucket:
                return {"success": False, "message": "Bucket名称不能为空", "data": None}
            if not object_name:
                return {"success": False, "message": "文件路径不能为空", "data": None}
            
            response = client.get_object(target_bucket, object_name)
            file_content = response.read()
            response.close()
            response.release_conn()
            
            return {
                "success": True,
                "message": "文件下载成功",
                "data": {
                    "bucket": target_bucket,
                    "object_name": object_name,
                    "file_name": object_name.split('/')[-1],
                    "file_content": file_content,
                    "file_size": len(file_content),
                }
            }
        except ImportError:
            return {"success": False, "message": "缺少minio依赖，请执行: pip install minio"}
        except Exception as e:
            return {"success": False, "message": f"文件下载失败: {str(e)}"}
