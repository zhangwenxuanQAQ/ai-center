"""
RustFS数据源实现类

提供RustFS文件服务的连接测试和文件操作功能
"""

from typing import Any, Dict, Optional
from app.core.datasource.base import DatasourceBase


class RustFSDatasource(DatasourceBase):
    """
    RustFS数据源实现类
    
    实现RustFS文件服务的连接测试、文件列表查询和Bucket信息获取
    使用boto3库实现与S3兼容的API操作
    """

    def test_connection(self) -> Dict[str, Any]:
        """
        测试RustFS连接
        """
        try:
            import boto3
            secure = self.config.get('secure', False)
            client = boto3.client(
                's3',
                endpoint_url=self.config.get('endpoint_url'),
                aws_access_key_id=self.config.get('access_key', ''),
                aws_secret_access_key=self.config.get('secret_key', ''),
                region_name='us-east-1',
            )
            client.list_buckets()
            return {"success": True, "message": "RustFS服务连接成功"}
        except ImportError:
            return {"success": False, "message": "缺少boto3依赖，请执行: pip install boto3"}
        except Exception as e:
            return {"success": False, "message": f"RustFS服务连接失败: {str(e)}"}

    def execute_query(self, query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        执行RustFS查询（列出文件）
        
        Args:
            query: 查询语句，格式为JSON: {"bucket": "xxx", "prefix": "xxx", "max_keys": 100}
        """
        try:
            import boto3
            import json
            client = boto3.client(
                's3',
                endpoint_url=self.config.get('endpoint_url'),
                aws_access_key_id=self.config.get('access_key', ''),
                aws_secret_access_key=self.config.get('secret_key', ''),
                region_name='us-east-1',
            )
            query_params = json.loads(query) if isinstance(query, str) else query
            bucket = query_params.get('bucket', self.config.get('bucket', ''))
            prefix = query_params.get('prefix', '')
            max_keys = query_params.get('max_keys', 100)
            response = client.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
                MaxKeys=max_keys,
            )
            objects = response.get('Contents', [])
            rows = []
            for obj in objects:
                rows.append({
                    "Key": obj.get('Key', ''),
                    "Size": obj.get('Size', 0),
                    "LastModified": str(obj.get('LastModified', '')),
                    "ETag": obj.get('ETag', ''),
                    "StorageClass": obj.get('StorageClass', ''),
                })
            return {
                "success": True,
                "message": "查询执行成功",
                "data": {
                    "columns": ["Key", "Size", "LastModified", "ETag", "StorageClass"],
                    "rows": rows,
                    "total": len(rows),
                }
            }
        except ImportError:
            return {"success": False, "message": "缺少boto3依赖，请执行: pip install boto3"}
        except Exception as e:
            return {"success": False, "message": f"查询执行失败: {str(e)}"}

    def get_schema_info(self) -> Dict[str, Any]:
        """
        获取RustFS Bucket信息
        """
        try:
            import boto3
            client = boto3.client(
                's3',
                endpoint_url=self.config.get('endpoint_url'),
                aws_access_key_id=self.config.get('access_key', ''),
                aws_secret_access_key=self.config.get('secret_key', ''),
                region_name='us-east-1',
            )
            response = client.list_buckets()
            buckets = []
            for bucket in response.get('Buckets', []):
                buckets.append({
                    "name": bucket.get('Name', ''),
                    "creation_date": str(bucket.get('CreationDate', '')),
                })
            return {
                "success": True,
                "message": "获取Bucket信息成功",
                "data": {"buckets": buckets}
            }
        except ImportError:
            return {"success": False, "message": "缺少boto3依赖，请执行: pip install boto3"}
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
            import boto3
            client = boto3.client(
                's3',
                endpoint_url=self.config.get('endpoint_url'),
                aws_access_key_id=self.config.get('access_key', ''),
                aws_secret_access_key=self.config.get('secret_key', ''),
                region_name='us-east-1',
            )
            target_bucket = bucket or self.config.get('bucket', '')
            if not target_bucket:
                return {"success": False, "message": "Bucket名称不能为空", "data": None}
            
            response = client.list_objects_v2(
                Bucket=target_bucket,
                Prefix=prefix or '',
                Delimiter='/',
                MaxKeys=max_keys,
            )
            
            files = []
            directories = []
            
            for common_prefix in response.get('CommonPrefixes', []):
                dir_name = common_prefix.get('Prefix', '').rstrip('/')
                if dir_name:
                    directories.append({
                        "name": dir_name.split('/')[-1] if '/' in dir_name else dir_name,
                        "type": "directory",
                        "path": common_prefix.get('Prefix', ''),
                    })
            
            for obj in response.get('Contents', []):
                key = obj.get('Key', '')
                if not key.endswith('/'):
                    files.append({
                        "name": key.split('/')[-1] if '/' in key else key,
                        "type": "file",
                        "path": key,
                        "size": obj.get('Size', 0),
                        "last_modified": str(obj.get('LastModified', '')),
                        "etag": obj.get('ETag', ''),
                        "storage_class": obj.get('StorageClass', ''),
                    })
            
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
            return {"success": False, "message": "缺少boto3依赖，请执行: pip install boto3"}
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
            import boto3
            client = boto3.client(
                's3',
                endpoint_url=self.config.get('endpoint_url'),
                aws_access_key_id=self.config.get('access_key', ''),
                aws_secret_access_key=self.config.get('secret_key', ''),
                region_name='us-east-1',
            )
            target_bucket = bucket or self.config.get('bucket', '')
            if not target_bucket:
                return {"success": False, "message": "Bucket名称不能为空", "data": None}
            if not object_name:
                return {"success": False, "message": "文件路径不能为空", "data": None}
            
            response = client.get_object(Bucket=target_bucket, Key=object_name)
            file_content = response['Body'].read()
            
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
            return {"success": False, "message": "缺少boto3依赖，请执行: pip install boto3"}
        except Exception as e:
            return {"success": False, "message": f"文件下载失败: {str(e)}"}
