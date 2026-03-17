"""
MCP SERVER核心服务实现
使用FastMCP实现MCP协议，支持SSE和Streamable HTTP两种连接方式
"""

import json
import logging
from typing import Any, Optional, Dict, List

from fastmcp import FastMCP

from app.configs.config import config
from app.database.models import MCPTool, MCPServer
from app.core.mcp.server.tools import ToolRegistry, execute_tool

logger = logging.getLogger(__name__)


class MCPServerContext:
    """
    MCP SERVER上下文管理类
    用于管理请求级别的上下文信息
    """
    _current_server_id: Optional[str] = None
    
    @classmethod
    def set_server_id(cls, server_id: str):
        """设置当前请求的MCP服务ID"""
        cls._current_server_id = server_id
    
    @classmethod
    def get_server_id(cls) -> Optional[str]:
        """获取当前请求的MCP服务ID"""
        return cls._current_server_id
    
    @classmethod
    def clear(cls):
        """清除上下文"""
        cls._current_server_id = None


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


def create_mcp_server() -> FastMCP:
    """
    创建FastMCP服务实例
    
    Returns:
        FastMCP: MCP服务实例
    """
    mcp = FastMCP("AI-Center-MCP-Server")
    
    def list_tools() -> List[Dict[str, Any]]:
        """
        列出所有可用的MCP工具
        
        工具来源来自表mcp_tool，mcp_server_id来自连接服务时的请求头
        
        Returns:
            List[Dict]: 工具列表
        """
        server_id = MCPServerContext.get_server_id()
        if not server_id:
            logger.warning("未设置MCP服务ID，返回空工具列表")
            return []
        
        return get_tools_from_db(server_id)
    
    async def call_tool(name: str, arguments: Dict[str, Any]) -> Any:
        """
        调用指定的MCP工具
        
        Args:
            name: 工具名称
            arguments: 工具参数
            
        Returns:
            Any: 工具执行结果
        """
        server_id = MCPServerContext.get_server_id()
        if not server_id:
            raise ValueError("未设置MCP服务ID")
        
        return await execute_tool(server_id, name, arguments)
    
    return mcp


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
        
        self.mcp = create_mcp_server()
        
        ToolRegistry.register_builtin_tools()
        
        logger.info(f"MCP SERVER初始化完成")
    
    def get_mcp(self) -> FastMCP:
        """
        获取FastMCP实例
        
        Returns:
            FastMCP: MCP实例
        """
        if not self.mcp:
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
        return self.mcp.http_app(path=self.path, transport="streamable-http")
    
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
        MCPServerContext.clear()
        logger.info("MCP SERVER已停止")


mcp_runner = MCPServerRunner()
