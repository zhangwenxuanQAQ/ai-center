"""
MCP核心工具模块

注意：SwaggerConverter已移动到app/utils/swagger_converter.py
此模块保留兼容性导入
"""

from app.utils.swagger_converter import (
    SwaggerConverter,
    convert_swagger_url_to_mcp_tools,
    convert_swagger_json_to_mcp_tools,
    convert_swagger_url_to_apis,
    convert_swagger_json_to_apis
)

__all__ = [
    'SwaggerConverter',
    'convert_swagger_url_to_mcp_tools',
    'convert_swagger_json_to_mcp_tools',
    'convert_swagger_url_to_apis',
    'convert_swagger_json_to_apis'
]
