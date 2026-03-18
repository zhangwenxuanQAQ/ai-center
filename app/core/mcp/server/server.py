"""
MCP SERVER核心服务实现
使用FastMCP实现MCP协议，支持SSE和Streamable HTTP两种连接方式
"""

import json
import logging
from typing import Any, Optional, Dict, List
from contextvars import ContextVar

from fastmcp import FastMCP

from app.configs.config import config
from app.database.models import MCPTool, MCPServer
from app.core.mcp.server.tools import execute_tool

logger = logging.getLogger(__name__)

# 使用contextvars来管理请求级别的server_id
_current_server_id: ContextVar[Optional[str]] = ContextVar('current_server_id', default=None)


def get_tools_from_db(server_id: str) -> List[Dict[str, Any]]:
    """
    从数据库获取指定MCP服务的工具列表
    
    Args:
        server_id: MCP服务ID
        
    Returns:
        List[Dict]: 工具列表，符合MCP TOOL标准结构
    """
    try:
        tools = MCPTool.select().where(
            (MCPTool.server_id == server_id) & 
            (MCPTool.status == True) &
            (MCPTool.deleted == False)
        )
        
        result = []
        for tool in tools:
            tool_info = {
                "name": tool.name,
                "description": tool.description or "",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
            
            if tool.config:
                try:
                    config_data = json.loads(tool.config)
                    if isinstance(config_data, dict):
                        input_schema = config_data.get("inputSchema", {})
                        if input_schema:
                            tool_info["inputSchema"] = input_schema
                except json.JSONDecodeError:
                    pass
            
            result.append(tool_info)
        
        return result
    except Exception as e:
        logger.error(f"获取工具列表失败: {e}")
        return []


# 创建FastMCP实例
mcp: FastMCP = FastMCP("AI-Center-MCP-Server")


# 导入工具模块，触发装饰器注册
from app.core.mcp.tool import get_current_time, call_restful_api


def create_mcp_http_app_with_middleware():
    """
    创建带有中间件的MCP HTTP应用
    中间件用于从请求头获取server_id并设置到上下文
    """
    from fastmcp import FastMCP
    
    # 获取原始的HTTP应用
    original_app = mcp.http_app(path="/mcp", transport="streamable-http")
    
    async def mcp_middleware(scope, receive, send):
        """
        MCP中间件，用于处理请求头
        """
        if scope['type'] == 'http':
            # 从请求头获取X-MCP-Server-ID
            headers = dict(scope.get('headers', []))
            server_id = None
            
            # 查找X-MCP-Server-ID请求头
            for key, value in headers.items():
                if key.lower() == b'x-mcp-server-id':
                    server_id = value.decode('utf-8')
                    break
            
            # 设置server_id到上下文
            if server_id:
                _current_server_id.set(server_id)
                logger.info(f"从请求头获取到server_id: {server_id}")
            
        try:
            await original_app(scope, receive, send)
        finally:
            # 清理上下文
            _current_server_id.set(None)
    
    return mcp_middleware


def setup_mcp_server():
    """
    初始化MCP服务，扩展工具调用逻辑
    """
    logger.info("正在初始化MCP服务...")
    
    # 保存原始的call_tool方法
    original_call_tool = mcp.call_tool
    
    async def custom_call_tool(name: str, arguments: dict[str, Any], **kwargs) -> Any:
        """
        自定义的工具调用方法
        先尝试调用内置工具，失败则从数据库查找
        
        Args:
            name: 工具名称
            arguments: 工具参数
            **kwargs: 额外参数（如version等）
        """
        try:
            return await original_call_tool(name, arguments, **kwargs)
        except Exception as e:
            # 尝试从数据库查找工具
            server_id = arguments.pop('server_id', None)
            
            if not server_id:
                server_id = _current_server_id.get()
                if server_id:
                    logger.info(f"从上下文获取到server_id: {server_id}")
            
            if not server_id:
                try:
                    tool_record = MCPTool.select().where(
                        (MCPTool.name == name) &
                        (MCPTool.status == True) &
                        (MCPTool.deleted == False)
                    ).first()
                    if tool_record:
                        server_id = tool_record.server_id
                    else:
                        raise ValueError(f"工具 {name} 不存在")
                except Exception as ex:
                    raise ValueError(f"获取工具信息失败: {ex}")
            
            result = await execute_tool(server_id, name, arguments)
            
            # 检查返回值是否为字典，如果是，转换为ToolResult对象
            if isinstance(result, dict):
                from fastmcp.tools.tool import ToolResult
                from mcp.types import TextContent
                import json
                result_str = json.dumps(result, indent=2, ensure_ascii=False)
                return ToolResult(content=[TextContent(type="text", text=result_str)])
            
            return result
    
    # 替换call_tool方法
    mcp.call_tool = custom_call_tool
    logger.info("MCP服务初始化完成")


class MCPServerRunner:
    """
    MCP SERVER运行器
    负责启动和管理MCP服务
    """
    
    def __init__(self):
        self.mcp: Optional[FastMCP] = None
        self.host: str = config.config.get('mcp', {}).get('host', '0.0.0.0')
        self.port: int = config.config.get('mcp', {}).get('port', 8082)
        self.path: str = "/mcp"
        self._running = False
    
    def setup(self):
        """
        初始化MCP SERVER
        """
        logger.info("正在初始化MCP SERVER...")
        
        setup_mcp_server()
        self.mcp = mcp
        
        logger.info(f"MCP SERVER初始化完成")
    
    def get_mcp(self) -> FastMCP:
        """
        获取FastMCP实例
        
        Returns:
            FastMCP: MCP实例
        """
        if not self._running:
            self.setup()
        return self.mcp
    
    def get_app(self):
        """
        获取ASGI应用实例（使用streamable-http传输模式）
        
        Returns:
            ASGI应用实例
        """
        if not self.mcp:
            self.setup()
        return create_mcp_http_app_with_middleware()
    
    async def start(self):
        """
        启动MCP SERVER
        """
        if self._running:
            logger.warning("MCP SERVER已在运行中")
            return
        
        self.setup()
        self._running = True
        logger.info(f"MCP SERVER已启动")
    
    async def stop(self):
        """
        停止MCP SERVER
        """
        self._running = False
        _current_server_id.set(None)
        logger.info(f"MCP SERVER已停止")


mcp_runner = MCPServerRunner()
