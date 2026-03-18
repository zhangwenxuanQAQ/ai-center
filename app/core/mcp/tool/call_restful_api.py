"""调用RESTful API接口工具

提供调用RESTful API接口的MCP工具
"""

import httpx
import json
from typing import Dict, Any, Optional

from mcp.types import CallToolResult, TextContent
from app.core.mcp.server.server import mcp


@mcp.tool()
def call_restful_api(
    url: str,
    method: str = "GET",
    headers: Dict[str, str] = None,
    params: Dict[str, Any] = None,
    data: Any = None,
    json: Dict[str, Any] = None
) -> dict:
    """调用RESTful API接口
    
    Args:
        url: API接口URL
        method: 请求方法（GET, POST, PUT, DELETE等）
        headers: 请求头
        params: 查询参数
        data: 请求数据
        json: JSON请求数据
    """
    headers = headers or {}
    params = params or {}
    
    if not url:
        return {"error": "缺少url参数"}
    
    method = method.upper()
    
    try:
        with httpx.Client() as client:
            if method == "GET":
                response = client.get(url, headers=headers, params=params)
            elif method == "POST":
                response = client.post(url, headers=headers, params=params, data=data, json=json)
            elif method == "PUT":
                response = client.put(url, headers=headers, params=params, data=data, json=json)
            elif method == "DELETE":
                response = client.delete(url, headers=headers, params=params)
            else:
                return {"error": f"不支持的请求方法: {method}"}
        
        try:
            response_json = response.json()
        except ValueError:
            response_json = {"text": response.text}
        
        return response_json
    except Exception as e:
        return {"error": str(e)}
