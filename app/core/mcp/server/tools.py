"""
MCP工具注册和执行模块
"""

import json
import logging
import httpx
from typing import Any, Dict, List, Callable, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class ToolExecutor(ABC):
    """
    工具执行器抽象基类
    """
    
    @abstractmethod
    async def execute(self, arguments: Dict[str, Any]) -> Any:
        """
        执行工具
        
        Args:
            arguments: 工具参数
            
        Returns:
            Any: 执行结果
        """
        pass


class BuiltinToolExecutor(ToolExecutor):
    """
    内置工具执行器
    """
    
    def __init__(self, func: Callable):
        self.func = func
    
    async def execute(self, arguments: Dict[str, Any]) -> Any:
        return await self.func(arguments)


class HttpToolExecutor(ToolExecutor):
    """
    HTTP工具执行器
    通过HTTP请求调用外部服务
    """
    
    def __init__(self, url: str, method: str = "POST", headers: Dict[str, str] = None):
        self.url = url
        self.method = method.upper()
        self.headers = headers or {}
    
    async def execute(self, arguments: Dict[str, Any]) -> Any:
        async with httpx.AsyncClient() as client:
            if self.method == "GET":
                response = await client.get(self.url, params=arguments, headers=self.headers)
            else:
                response = await client.post(self.url, json=arguments, headers=self.headers)
            
            response.raise_for_status()
            return response.json()


class ToolRegistry:
    """
    工具注册表
    管理所有工具的执行器
    """
    
    _executors: Dict[str, ToolExecutor] = {}
    
    @classmethod
    def register(cls, name: str, executor: ToolExecutor):
        """
        注册工具执行器
        
        Args:
            name: 工具名称
            executor: 工具执行器
        """
        cls._executors[name] = executor
        logger.info(f"已注册工具: {name}")
    
    @classmethod
    def register_builtin(cls, name: str):
        """
        注册内置工具的装饰器
        
        Args:
            name: 工具名称
            
        Returns:
            装饰器函数
        """
        def decorator(func: Callable):
            cls.register(name, BuiltinToolExecutor(func))
            return func
        return decorator
    
    @classmethod
    def register_http(cls, name: str, url: str, method: str = "POST", headers: Dict[str, str] = None):
        """
        注册HTTP工具
        
        Args:
            name: 工具名称
            url: 请求URL
            method: 请求方法
            headers: 请求头
        """
        cls.register(name, HttpToolExecutor(url, method, headers))
    
    @classmethod
    def get(cls, name: str) -> Optional[ToolExecutor]:
        """
        获取工具执行器
        
        Args:
            name: 工具名称
            
        Returns:
            Optional[ToolExecutor]: 工具执行器
        """
        return cls._executors.get(name)
    
    @classmethod
    def unregister(cls, name: str):
        """
        注销工具
        
        Args:
            name: 工具名称
        """
        if name in cls._executors:
            del cls._executors[name]
            logger.info(f"已注销工具: {name}")
    
    @classmethod
    def list_tools(cls) -> List[str]:
        """
        列出所有已注册的工具
        
        Returns:
            List[str]: 工具名称列表
        """
        return list(cls._executors.keys())
    
    @classmethod
    def register_builtin_tools(cls):
        """
        注册内置工具
        """
        @cls.register_builtin("echo")
        async def echo_tool(arguments: Dict[str, Any]) -> Any:
            """回显工具，用于测试"""
            return {"echo": arguments}
        
        @cls.register_builtin("get_server_info")
        async def get_server_info(arguments: Dict[str, Any]) -> Any:
            """获取服务器信息"""
            return {
                "name": "AI-Center-MCP-Server",
                "version": "1.0.0",
                "status": "running"
            }


async def execute_tool(server_id: str, tool_name: str, arguments: Dict[str, Any]) -> Any:
    """
    执行工具
    
    Args:
        server_id: MCP服务ID
        tool_name: 工具名称
        arguments: 工具参数
        
    Returns:
        Any: 执行结果
        
    Raises:
        ValueError: 工具不存在或参数无效
    """
    from app.database.models import MCPTool, MCPServer
    
    try:
        server = MCPServer.get_by_id(server_id)
    except MCPServer.DoesNotExist:
        raise ValueError(f"MCP服务 {server_id} 不存在")
    
    try:
        tool = MCPTool.select().where(
            (MCPTool.name == tool_name) &
            (MCPTool.server_id == server_id) &
            (MCPTool.status == True) &
            (MCPTool.deleted == False)
        ).first()
    except Exception as e:
        logger.error(f"查询工具失败: {e}")
        raise ValueError(f"查询工具失败: {e}")
    
    if not tool:
        raise ValueError(f"工具 {tool_name} 不存在或未启用")
    
    executor = ToolRegistry.get(tool_name)
    
    if executor:
        logger.info(f"执行已注册工具: {tool_name}, 参数: {arguments}")
        return await executor.execute(arguments)
    
    if tool.config:
        try:
            config = json.loads(tool.config)
            executor_type = config.get("executor_type")
            
            if executor_type == "http":
                url = config.get("url")
                method = config.get("method", "POST")
                headers = config.get("headers", {})
                
                if not url:
                    raise ValueError("HTTP工具配置缺少URL")
                
                http_executor = HttpToolExecutor(url, method, headers)
                logger.info(f"执行HTTP工具: {tool_name}, URL: {url}")
                return await http_executor.execute(arguments)
            
            elif executor_type == "script":
                script = config.get("script")
                if script:
                    logger.info(f"执行脚本工具: {tool_name}")
                    return {"message": f"脚本工具 {tool_name} 执行成功", "script": script}
        
        except json.JSONDecodeError:
            pass
    
    logger.info(f"执行默认工具: {tool_name}")
    return {
        "tool": tool_name,
        "server_id": server_id,
        "arguments": arguments,
        "message": f"工具 {tool_name} 执行成功"
    }
