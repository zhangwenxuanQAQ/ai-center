"""
Swagger/OpenAPI 转 MCP Tool 转换器

将Swagger/OpenAPI文档转换为MCP工具标准结构
"""

import json
import logging
import re
import httpx
from typing import Dict, List, Any, Optional
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


class SwaggerConverter:
    """
    Swagger/OpenAPI 转 MCP Tool 转换器
    
    将Swagger/OpenAPI文档中的API端点转换为MCP工具定义
    """
    
    def __init__(self, base_url: str = None, headers: Dict[str, str] = None):
        """
        初始化转换器
        
        Args:
            base_url: API基础URL，用于拼接相对路径
            headers: 请求头，用于调用需要认证的API
        """
        self.base_url = base_url
        self.headers = headers or {}
    
    def load_from_url(self, swagger_url: str) -> Dict[str, Any]:
        """
        从URL加载Swagger文档
        
        Args:
            swagger_url: Swagger文档URL
            
        Returns:
            Dict: Swagger文档内容
            
        Raises:
            httpx.HTTPError: HTTP请求失败
            ValueError: 文档解析失败
        """
        try:
            response = httpx.get(swagger_url, headers=self.headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"加载Swagger文档失败: {e}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"解析Swagger文档失败: {e}")
            raise ValueError(f"无效的JSON格式: {e}")
    
    def load_from_json(self, swagger_json: str) -> Dict[str, Any]:
        """
        从JSON字符串加载Swagger文档
        
        Args:
            swagger_json: Swagger文档JSON字符串
            
        Returns:
            Dict: Swagger文档内容
            
        Raises:
            ValueError: JSON解析失败
        """
        try:
            return json.loads(swagger_json)
        except json.JSONDecodeError as e:
            logger.error(f"解析Swagger JSON失败: {e}")
            raise ValueError(f"无效的JSON格式: {e}")
    
    def convert_to_mcp_tools(
        self, 
        swagger_doc: Dict[str, Any],
        server_id: str = None,
        include_patterns: List[str] = None,
        exclude_patterns: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        将Swagger文档转换为MCP工具列表
        
        Args:
            swagger_doc: Swagger文档内容
            server_id: MCP服务ID
            include_patterns: 包含的API路径模式列表（正则表达式）
            exclude_patterns: 排除的API路径模式列表（正则表达式）
            
        Returns:
            List[Dict]: MCP工具列表
        """
        tools = []
        
        openapi_version = swagger_doc.get('openapi')
        swagger_version = swagger_doc.get('swagger')
        
        if openapi_version:
            paths = swagger_doc.get('paths', {})
            base_path = ''
        elif swagger_version:
            paths = swagger_doc.get('paths', {})
            base_path = swagger_doc.get('basePath', '')
        else:
            raise ValueError("无法识别的Swagger/OpenAPI文档格式")
        
        servers = swagger_doc.get('servers', [])
        if servers and not self.base_url:
            self.base_url = servers[0].get('url', '')
        elif swagger_doc.get('host'):
            schemes = swagger_doc.get('schemes', ['http'])
            host = swagger_doc.get('host', '')
            self.base_url = f"{schemes[0]}://{host}{base_path}"
        
        for path, path_item in paths.items():
            if include_patterns:
                if not any(re.match(pattern, path) for pattern in include_patterns):
                    continue
            
            if exclude_patterns:
                if any(re.match(pattern, path) for pattern in exclude_patterns):
                    continue
            
            for method in ['get', 'post', 'put', 'delete', 'patch']:
                if method not in path_item:
                    continue
                
                operation = path_item[method]
                tool = self._convert_operation_to_tool(
                    path=path,
                    method=method,
                    operation=operation,
                    server_id=server_id,
                    swagger_doc=swagger_doc
                )
                if tool:
                    tools.append(tool)
        
        return tools
    
    def _convert_operation_to_tool(
        self,
        path: str,
        method: str,
        operation: Dict[str, Any],
        server_id: str,
        swagger_doc: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        将单个API操作转换为MCP工具
        
        Args:
            path: API路径
            method: HTTP方法
            operation: 操作定义
            server_id: MCP服务ID
            swagger_doc: 完整的Swagger文档
            
        Returns:
            Dict: MCP工具定义
        """
        operation_id = operation.get('operationId', '')
        if not operation_id:
            path_safe = re.sub(r'[{}:/]', '_', path).strip('_')
            operation_id = f"{method}_{path_safe}"
        
        operation_id = re.sub(r'[^a-zA-Z0-9_]', '_', operation_id)
        
        summary = operation.get('summary', '')
        description = operation.get('description', summary)
        
        input_schema = self._build_input_schema(operation, swagger_doc)
        
        tool_config = {
            'url': f"{self.base_url}{path}" if self.base_url else path,
            'method': method.upper(),
            'headers': self.headers,
            'path': path,
            'parameters': operation.get('parameters', []),
            'requestBody': operation.get('requestBody')
        }
        
        return {
            'name': operation_id,
            'description': description or f"{method.upper()} {path}",
            'tool_type': 'http',
            'server_id': server_id,
            'config': json.dumps(tool_config),
            'input_schema': input_schema,
            'status': True
        }
    
    def _build_input_schema(
        self,
        operation: Dict[str, Any],
        swagger_doc: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        构建工具的输入Schema
        
        Args:
            operation: 操作定义
            swagger_doc: 完整的Swagger文档
            
        Returns:
            Dict: JSON Schema格式的输入定义
        """
        properties = {}
        required = []
        
        parameters = operation.get('parameters', [])
        for param in parameters:
            param_name = param.get('name')
            param_in = param.get('in')
            param_schema = param.get('schema', {})
            param_description = param.get('description', '')
            param_required = param.get('required', False)
            
            if param_in == 'body':
                ref = param_schema.get('$ref')
                if ref:
                    param_schema = self._resolve_ref(ref, swagger_doc)
                properties.update(param_schema.get('properties', {}))
                if param_required:
                    required.extend(param_schema.get('required', []))
            else:
                prop = {
                    'type': param_schema.get('type', 'string'),
                    'description': param_description
                }
                
                if param_schema.get('enum'):
                    prop['enum'] = param_schema.get('enum')
                if param_schema.get('default'):
                    prop['default'] = param_schema.get('default')
                if param_schema.get('format'):
                    prop['format'] = param_schema.get('format')
                
                properties[param_name] = prop
                
                if param_required:
                    required.append(param_name)
        
        request_body = operation.get('requestBody')
        if request_body:
            content = request_body.get('content', {})
            json_content = content.get('application/json', {})
            schema = json_content.get('schema', {})
            
            ref = schema.get('$ref')
            if ref:
                schema = self._resolve_ref(ref, swagger_doc)
            
            body_properties = schema.get('properties', {})
            for prop_name, prop_schema in body_properties.items():
                prop = {
                    'type': prop_schema.get('type', 'string'),
                    'description': prop_schema.get('description', '')
                }
                if prop_schema.get('enum'):
                    prop['enum'] = prop_schema.get('enum')
                if prop_schema.get('default'):
                    prop['default'] = prop_schema.get('default')
                if prop_schema.get('format'):
                    prop['format'] = prop_schema.get('format')
                if prop_schema.get('items'):
                    prop['items'] = prop_schema.get('items')
                
                properties[prop_name] = prop
            
            body_required = schema.get('required', [])
            if request_body.get('required'):
                required.extend(body_required)
        
        return {
            'type': 'object',
            'properties': properties,
            'required': list(set(required))
        }
    
    def _resolve_ref(self, ref: str, swagger_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        解析$ref引用
        
        Args:
            ref: 引用路径，如 "#/components/schemas/User"
            swagger_doc: 完整的Swagger文档
            
        Returns:
            Dict: 解析后的schema定义
        """
        if not ref.startswith('#/'):
            return {}
        
        parts = ref[2:].split('/')
        current = swagger_doc
        
        for part in parts:
            if part in current:
                current = current[part]
            else:
                return {}
        
        return current


def convert_swagger_url_to_mcp_tools(
    swagger_url: str,
    server_id: str = None,
    base_url: str = None,
    headers: Dict[str, str] = None,
    include_patterns: List[str] = None,
    exclude_patterns: List[str] = None
) -> List[Dict[str, Any]]:
    """
    从Swagger URL转换为MCP工具列表
    
    Args:
        swagger_url: Swagger文档URL
        server_id: MCP服务ID
        base_url: API基础URL
        headers: 请求头
        include_patterns: 包含的API路径模式列表
        exclude_patterns: 排除的API路径模式列表
        
    Returns:
        List[Dict]: MCP工具列表
    """
    converter = SwaggerConverter(base_url=base_url, headers=headers)
    swagger_doc = converter.load_from_url(swagger_url)
    return converter.convert_to_mcp_tools(
        swagger_doc=swagger_doc,
        server_id=server_id,
        include_patterns=include_patterns,
        exclude_patterns=exclude_patterns
    )


def convert_swagger_json_to_mcp_tools(
    swagger_json: str,
    server_id: str = None,
    base_url: str = None,
    headers: Dict[str, str] = None,
    include_patterns: List[str] = None,
    exclude_patterns: List[str] = None
) -> List[Dict[str, Any]]:
    """
    从Swagger JSON字符串转换为MCP工具列表
    
    Args:
        swagger_json: Swagger文档JSON字符串
        server_id: MCP服务ID
        base_url: API基础URL
        headers: 请求头
        include_patterns: 包含的API路径模式列表
        exclude_patterns: 排除的API路径模式列表
        
    Returns:
        List[Dict]: MCP工具列表
    """
    converter = SwaggerConverter(base_url=base_url, headers=headers)
    swagger_doc = converter.load_from_json(swagger_json)
    return converter.convert_to_mcp_tools(
        swagger_doc=swagger_doc,
        server_id=server_id,
        include_patterns=include_patterns,
        exclude_patterns=exclude_patterns
    )
