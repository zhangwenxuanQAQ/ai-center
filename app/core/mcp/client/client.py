"""
MCP CLIENT核心服务实现
支持SSE、Streamable HTTP和Stdio三种连接方式
"""

import json
import logging
from typing import Any, Optional, Dict, List, Tuple
from contextlib import asynccontextmanager
from datetime import timedelta

from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream

from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamable_http_client
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession
from mcp.types import (
    InitializeResult,
    Tool,
    CallToolResult,
    Implementation,
    ClientCapabilities,
)

from app.configs.config import config
from app.database.models import MCPTool, MCPServer
from app.core.mcp.server.tools import ToolRegistry, execute_tool

logger = logging.getLogger(__name__)


class MCPClientError(Exception):
    """MCP客户端异常"""
    pass


class MCPClientBase:
    """
    MCP客户端基类
    提供通用的客户端操作方法
    """
    
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self._initialized: bool = False
    
    async def _initialize_session(self, session: ClientSession) -> InitializeResult:
        """
        初始化客户端会话
        
        Args:
            session: MCP客户端会话
            
        Returns:
            InitializeResult: 初始化结果
        """
        result = await session.initialize()
        self.session = session
        self._initialized = True
        logger.info(f"MCP客户端初始化成功: {result.serverInfo}")
        return result
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        测试连接
        
        Returns:
            Dict: 连接测试结果
        """
        raise NotImplementedError("子类需要实现此方法")
    
    async def list_tools(self) -> List[Tool]:
        """
        获取工具列表
        
        Returns:
            List[Tool]: 工具列表
        """
        if not self.session or not self._initialized:
            raise MCPClientError("客户端未初始化")
        
        result = await self.session.list_tools()
        return result.tools
    
    async def call_tool(self, name: str, arguments: Dict[str, Any] = None) -> CallToolResult:
        """
        调用工具
        
        Args:
            name: 工具名称
            arguments: 工具参数
            
        Returns:
            CallToolResult: 工具调用结果
        """
        if not self.session or not self._initialized:
            raise MCPClientError("客户端未初始化")
        
        result = await self.session.call_tool(name, arguments or {})
        return result


class SSEClient(MCPClientBase):
    """
    SSE传输类型的MCP客户端
    """
    
    def __init__(self, url: str, headers: Dict[str, Any] = None, timeout: float = 5, sse_read_timeout: float = 300):
        """
        初始化SSE客户端
        
        Args:
            url: SSE服务端点URL
            headers: 请求头
            timeout: HTTP超时时间
            sse_read_timeout: SSE读取超时时间
        """
        super().__init__()
        self.url = url
        self.headers = headers or {}
        self.timeout = timeout
        self.sse_read_timeout = sse_read_timeout
    
    @asynccontextmanager
    async def connect(self):
        """
        建立SSE连接
        """
        async with sse_client(
            url=self.url,
            headers=self.headers,
            timeout=self.timeout,
            sse_read_timeout=self.sse_read_timeout
        ) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await self._initialize_session(session)
                yield self
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        测试SSE连接
        
        Returns:
            Dict: 连接测试结果
        """
        try:
            async with self.connect():
                return {
                    "success": True,
                    "message": "SSE连接成功",
                    "url": self.url
                }
        except Exception as e:
            logger.error(f"SSE连接测试失败: {e}")
            return {
                "success": False,
                "message": f"SSE连接失败: {str(e)}",
                "url": self.url
            }


class StreamableHttpClient(MCPClientBase):
    """
    Streamable HTTP传输类型的MCP客户端
    """
    
    def __init__(self, url: str, headers: Dict[str, Any] = None):
        """
        初始化Streamable HTTP客户端
        
        Args:
            url: MCP服务端点URL
            headers: 请求头
        """
        super().__init__()
        self.url = url
        self.headers = headers or {}
    
    @asynccontextmanager
    async def connect(self):
        """
        建立Streamable HTTP连接
        """
        async with streamable_http_client(self.url) as (read_stream, write_stream, get_session_id):
            async with ClientSession(read_stream, write_stream) as session:
                await self._initialize_session(session)
                self._get_session_id = get_session_id
                yield self
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        测试Streamable HTTP连接
        
        Returns:
            Dict: 连接测试结果
        """
        try:
            async with self.connect():
                session_id = self._get_session_id() if hasattr(self, '_get_session_id') else None
                return {
                    "success": True,
                    "message": "Streamable HTTP连接成功",
                    "url": self.url,
                    "session_id": session_id
                }
        except Exception as e:
            logger.error(f"Streamable HTTP连接测试失败: {e}")
            return {
                "success": False,
                "message": f"Streamable HTTP连接失败: {str(e)}",
                "url": self.url
            }


class StdioClient(MCPClientBase):
    """
    Stdio传输类型的MCP客户端
    通过启动本地进程进行通信
    """
    
    def __init__(self, command: str, args: List[str] = None, env: Dict[str, str] = None, cwd: str = None):
        """
        初始化Stdio客户端
        
        Args:
            command: 要执行的命令
            args: 命令参数
            env: 环境变量
            cwd: 工作目录
        """
        super().__init__()
        self.command = command
        self.args = args or []
        self.env = env
        self.cwd = cwd
    
    @asynccontextmanager
    async def connect(self):
        """
        建立Stdio连接
        """
        server_params = StdioServerParameters(
            command=self.command,
            args=self.args,
            env=self.env,
            cwd=self.cwd
        )
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await self._initialize_session(session)
                yield self
    
    async def test_connection(self) -> Dict[str, Any]:
        """
        测试Stdio连接
        
        Returns:
            Dict: 连接测试结果
        """
        try:
            async with self.connect():
                return {
                    "success": True,
                    "message": "Stdio连接成功",
                    "command": self.command,
                    "args": self.args
                }
        except Exception as e:
            logger.error(f"Stdio连接测试失败: {e}")
            return {
                "success": False,
                "message": f"Stdio连接失败: {str(e)}",
                "command": self.command,
                "args": self.args
            }


class MCPClientFactory:
    """
    MCP客户端工厂类
    根据传输类型创建对应的客户端实例
    """
    
    @staticmethod
    def create_client(
        transport_type: str,
        url: str = None,
        headers: Dict[str, Any] = None,
        command: str = None,
        args: List[str] = None,
        env: Dict[str, str] = None,
        cwd: str = None,
        timeout: float = 5,
        sse_read_timeout: float = 300
    ) -> MCPClientBase:
        """
        创建MCP客户端
        
        Args:
            transport_type: 传输类型 (sse, streamable_http, stdio)
            url: 服务URL (用于sse和streamable_http)
            headers: 请求头 (用于sse和streamable_http)
            command: 命令 (用于stdio)
            args: 命令参数 (用于stdio)
            env: 环境变量 (用于stdio)
            cwd: 工作目录 (用于stdio)
            timeout: 超时时间
            sse_read_timeout: SSE读取超时时间
            
        Returns:
            MCPClientBase: MCP客户端实例
            
        Raises:
            MCPClientError: 不支持的传输类型
        """
        transport_type = transport_type.lower()
        
        if transport_type == "sse":
            if not url:
                raise MCPClientError("SSE传输类型需要提供URL")
            return SSEClient(url=url, headers=headers, timeout=timeout, sse_read_timeout=sse_read_timeout)
        
        elif transport_type == "streamable_http":
            if not url:
                raise MCPClientError("Streamable HTTP传输类型需要提供URL")
            return StreamableHttpClient(url=url, headers=headers)
        
        elif transport_type == "stdio":
            if not command:
                raise MCPClientError("Stdio传输类型需要提供命令")
            return StdioClient(command=command, args=args, env=env, cwd=cwd)
        
        else:
            raise MCPClientError(f"不支持的传输类型: {transport_type}")


async def test_mcp_connection(
    transport_type: str,
    url: str = None,
    headers: Dict[str, Any] = None,
    command: str = None,
    args: List[str] = None,
    env: Dict[str, str] = None,
    cwd: str = None
) -> Dict[str, Any]:
    """
    测试MCP连接
    
    Args:
        transport_type: 传输类型
        url: 服务URL
        headers: 请求头
        command: 命令
        args: 命令参数
        env: 环境变量
        cwd: 工作目录
        
    Returns:
        Dict: 连接测试结果
    """
    client = MCPClientFactory.create_client(
        transport_type=transport_type,
        url=url,
        headers=headers,
        command=command,
        args=args,
        env=env,
        cwd=cwd
    )
    return await client.test_connection()


async def get_mcp_tools(
    transport_type: str,
    url: str = None,
    headers: Dict[str, Any] = None,
    command: str = None,
    args: List[str] = None,
    env: Dict[str, str] = None,
    cwd: str = None
) -> List[Dict[str, Any]]:
    """
    获取MCP工具列表
    
    Args:
        transport_type: 传输类型
        url: 服务URL
        headers: 请求头
        command: 命令
        args: 命令参数
        env: 环境变量
        cwd: 工作目录
        
    Returns:
        List[Dict]: 工具列表
    """
    client = MCPClientFactory.create_client(
        transport_type=transport_type,
        url=url,
        headers=headers,
        command=command,
        args=args,
        env=env,
        cwd=cwd
    )
    
    tools_list = []
    
    if isinstance(client, (SSEClient, StreamableHttpClient)):
        async with client.connect():
            tools = await client.list_tools()
            for tool in tools:
                input_schema = tool.inputSchema if tool.inputSchema else {}
                if hasattr(input_schema, 'model_dump'):
                    input_schema = input_schema.model_dump()
                tools_list.append({
                    "name": tool.name,
                    "description": tool.description or "",
                    "inputSchema": input_schema
                })
    elif isinstance(client, StdioClient):
        async with client.connect():
            tools = await client.list_tools()
            for tool in tools:
                input_schema = tool.inputSchema if tool.inputSchema else {}
                if hasattr(input_schema, 'model_dump'):
                    input_schema = input_schema.model_dump()
                tools_list.append({
                    "name": tool.name,
                    "description": tool.description or "",
                    "inputSchema": input_schema
                })
    
    return tools_list


async def call_mcp_tool(
    transport_type: str,
    tool_name: str,
    arguments: Dict[str, Any] = None,
    url: str = None,
    headers: Dict[str, Any] = None,
    command: str = None,
    args: List[str] = None,
    env: Dict[str, str] = None,
    cwd: str = None
) -> Dict[str, Any]:
    """
    调用MCP工具
    
    Args:
        transport_type: 传输类型
        tool_name: 工具名称
        arguments: 工具参数
        url: 服务URL
        headers: 请求头
        command: 命令
        args: 命令参数
        env: 环境变量
        cwd: 工作目录
        
    Returns:
        Dict: 工具调用结果
    """
    client = MCPClientFactory.create_client(
        transport_type=transport_type,
        url=url,
        headers=headers,
        command=command,
        args=args,
        env=env,
        cwd=cwd
    )
    
    result = None
    
    if isinstance(client, (SSEClient, StreamableHttpClient)):
        async with client.connect():
            call_result = await client.call_tool(tool_name, arguments)
            result = {
                "content": [content.model_dump() for content in call_result.content],
                "isError": call_result.isError if hasattr(call_result, 'isError') else False
            }
    elif isinstance(client, StdioClient):
        async with client.connect():
            call_result = await client.call_tool(tool_name, arguments)
            result = {
                "content": [content.model_dump() for content in call_result.content],
                "isError": call_result.isError if hasattr(call_result, 'isError') else False
            }
    
    return result
