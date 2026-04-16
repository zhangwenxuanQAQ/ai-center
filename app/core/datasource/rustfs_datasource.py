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
