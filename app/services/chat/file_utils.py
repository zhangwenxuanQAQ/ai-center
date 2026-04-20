"""
聊天文件工具类

提供文件处理相关功能，包括从数据源获取文件、文件转换为base64等
"""

import base64
import json
from typing import Dict, Any, Optional
from app.services.datasource.service import DatasourceService
from app.core.datasource.factory import DatasourceFactory


def get_file_from_datasource(content: Dict[str, Any]) -> Dict[str, Any]:
    """
    从数据源获取文件内容
    
    Args:
        content: 包含数据源信息的字典，格式为:
            {
                "datasource_id": "数据源ID",
                "bucket": "桶名称（可选）",
                "object_name": "文件路径",
                "file_name": "文件名"
            }
    
    Returns:
        Dict: 包含文件信息的字典
            {
                "success": 是否成功,
                "message": 消息,
                "data": {
                    "file_name": 文件名,
                    "file_content": 文件内容(bytes),
                    "mime_type": MIME类型,
                    "base64_content": base64编码内容
                }
            }
    """
    try:
        datasource_id = content.get("datasource_id")
        bucket = content.get("bucket")
        object_name = content.get("object_name")
        file_name = content.get("file_name", object_name.split("/")[-1] if object_name else "")
        
        if not datasource_id:
            return {"success": False, "message": "数据源ID不能为空", "data": None}
        
        if not object_name:
            return {"success": False, "message": "文件路径不能为空", "data": None}
        
        # 获取数据源信息
        datasource = DatasourceService.get_datasource(datasource_id)
        if not datasource:
            return {"success": False, "message": "数据源不存在", "data": None}
        
        # 创建数据源实例
        datasource_type = datasource.get("type")
        config = datasource.get("config", {})
        
        # 解密配置
        from app.services.datasource.service import DatasourceService as DsService
        decrypted_config = DsService._decrypt_sensitive_config(config, datasource_type)
        
        ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
        
        # 下载文件
        download_result = ds_instance.download_file(bucket=bucket, object_name=object_name)
        
        if not download_result.get("success"):
            return download_result
        
        file_data = download_result.get("data", {})
        file_content = file_data.get("file_content")
        
        if not file_content:
            return {"success": False, "message": "文件内容为空", "data": None}
        
        # 转换为base64
        base64_content = base64.b64encode(file_content).decode("utf-8")
        
        # 获取MIME类型
        mime_type = get_mime_type(file_name)
        
        return {
            "success": True,
            "message": "文件获取成功",
            "data": {
                "file_name": file_name,
                "file_content": file_content,
                "mime_type": mime_type,
                "base64_content": base64_content,
                "datasource_id": datasource_id,
                "bucket": bucket,
                "object_name": object_name
            }
        }
    except Exception as e:
        return {"success": False, "message": f"获取文件失败: {str(e)}", "data": None}


def get_mime_type(file_name: str) -> str:
    """
    根据文件名获取MIME类型
    
    Args:
        file_name: 文件名
    
    Returns:
        str: MIME类型
    """
    import mimetypes
    mime_type, _ = mimetypes.guess_type(file_name)
    return mime_type or "application/octet-stream"


def extract_file_info_from_query(query_items: list) -> list:
    """
    从QueryItem列表中提取文件信息
    
    Args:
        query_items: QueryItem列表
    
    Returns:
        list: 文件信息列表
    """
    files_info = []
    
    for item in query_items:
        if item.type == "file_base64":
            # 本地上传的文件
            files_info.append({
                "type": "local",
                "file_name": getattr(item, "file_name", "unknown"),
                "mime_type": item.mime_type,
                "base64_content": item.content if isinstance(item.content, str) else ""
            })
        elif item.type == "document":
            # 数据源文件
            content_dict = item.content if isinstance(item.content, dict) else {}
            files_info.append({
                "type": "datasource",
                "datasource_id": content_dict.get("datasource_id"),
                "bucket": content_dict.get("bucket"),
                "object_name": content_dict.get("object_name"),
                "file_name": content_dict.get("file_name", content_dict.get("object_name", "unknown").split("/")[-1])
            })
    
    return files_info


def build_extra_content(query_items: list) -> Optional[dict]:
    """
    构建extra_content，用于保存到数据库
    
    Args:
        query_items: QueryItem列表
    
    Returns:
        dict: extra_content字典
    """
    files_info = extract_file_info_from_query(query_items)
    
    if not files_info:
        return None
    
    return {
        "files": files_info
    }
