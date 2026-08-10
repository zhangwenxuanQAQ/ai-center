"""
MCP内置工具

封装MCP工具的转换和调用逻辑，继承自CustomTool。
每个MCP工具数据库记录对应一个McpTool实例，
通过callback机制注入实际的MCP服务调用逻辑。
"""

import json
import asyncio
import nest_asyncio
from typing import Any, Dict, Optional

from app.core.tools.base_tool import BaseToolParam
from app.core.tools.custom_tool import CustomTool


def _add_action_to_parameters(parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    向工具参数中添加action和task_name字段，标识为mcp_tool类型

    Args:
        parameters: 原始参数schema

    Returns:
        Dict[str, Any]: 添加了action和task_name字段的参数schema
    """
    if not parameters:
        parameters = {
            'type': 'object',
            'properties': {},
            'required': []
        }

    if 'properties' not in parameters:
        parameters['properties'] = {}

    parameters['properties']['action'] = {
        'type': 'string',
        'enum': ['mcp_tool'],
        'description': '操作类型，必须为 mcp_tool , 表示MCP工具调用'
    }

    parameters['properties']['task_name'] = {
        'type': 'string',
        'description': '给本次操作起一个简短的任务名称，例如"查询xxx今天的天气"'
    }

    parameters['properties']['reasoning_content'] = {
        'type': 'string',
        'description': '为何选择并使用本工具，返回思考过程'
    }

    if 'required' not in parameters:
        parameters['required'] = []
    if 'action' not in parameters.get('required', []):
        parameters['required'].append('action')
    if 'task_name' not in parameters.get('required', []):
        parameters['required'].append('task_name')

    return parameters


class McpTool(CustomTool):
    """
    MCP工具类，继承自CustomTool

    封装MCP工具的OpenAI格式转换和实际调用逻辑。
    每个MCP工具数据库记录对应一个McpTool实例，
    通过callback机制将MCP服务调用注入到run方法中。

    使用示例:
        # 从数据库对象创建
        tool = McpTool.from_db_tool(db_tool)

        # 转换为OpenAI tool格式
        openai_tool = tool.to_openai_tool()

        # 执行工具
        result = tool.run(action='mcp_tool', task_name='查询', **params)
    """

    tool_type: str = "mcp"

    def __init__(
        self,
        tool_id: str = "",
        name: str = "",
        title: str = "",
        description: str = "",
        input_schema: Optional[Dict[str, Any]] = None,
        params: Optional[list] = None,
        **extra
    ):
        """
        初始化MCP工具

        Args:
            tool_id: MCP工具ID（数据库主键）
            name: 工具名称
            title: 工具标题
            description: 工具描述
            input_schema: MCP工具的原始inputSchema（JSON Schema格式）
            params: BaseToolParam参数列表（与input_schema二选一，优先使用input_schema）
            **extra: 额外属性
        """
        self.tool_id = tool_id
        self._input_schema = input_schema or {}
        # 通过callback注入MCP工具调用逻辑
        super().__init__(
            name=name,
            title=title,
            description=description,
            params=params,
            callback=self._execute_mcp_call,
            **extra
        )

    def _execute_mcp_call(self, **kwargs) -> Any:
        """
        MCP工具调用的实际执行逻辑（作为callback注入到run方法中）

        调用MCPToolService执行实际的MCP工具调用，
        并处理返回结果中的错误和内容提取。

        Args:
            **kwargs: 工具参数（包含action、task_name等内置参数和工具自身参数）

        Returns:
            Any: 工具调用的文本结果

        Raises:
            Exception: 工具调用失败或返回错误时抛出异常
        """
        from app.services.mcp.service import MCPToolService

        # 移除内置参数，只传工具自身需要的参数
        mcp_args = {
            k: v for k, v in kwargs.items()
            if k not in ('action', 'task_name', 'reasoning_content')
        }

        nest_asyncio.apply()
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(
            MCPToolService.call_tool(self.tool_id, mcp_args)
        )

        if not result:
            raise Exception("工具调用返回空结果")

        if result.get('isError'):
            error_text = result.get("content", [{}])[0].get("text", "未知错误")
            raise Exception(f"工具调用失败: {error_text}")

        content_items = result.get('content', [])
        if content_items:
            return content_items[0].get('text', '')
        return str(result)

    def to_openai_tool(self) -> Dict[str, Any]:
        """
        生成OpenAI tool格式

        基于MCP工具的inputSchema生成OpenAI tool格式，
        并自动注入action、task_name、reasoning_content等内置参数。

        Returns:
            Dict[str, Any]: OpenAI tool格式的工具定义
        """
        parameters = _add_action_to_parameters(
            json.loads(json.dumps(self._input_schema, ensure_ascii=False))
            if self._input_schema else None
        )

        func = {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.description,
                'parameters': parameters
            }
        }

        return json.loads(json.dumps(func, ensure_ascii=False))

    @classmethod
    def from_db_tool(cls, db_tool) -> 'McpTool':
        """
        从数据库MCPTool对象创建McpTool实例

        解析数据库中的MCP工具配置（包含inputSchema），
        构建对应的McpTool实例。

        Args:
            db_tool: MCPTool数据库对象

        Returns:
            McpTool: MCP工具实例
        """
        input_schema = {}
        config_str = db_tool.config
        if config_str:
            try:
                config = json.loads(config_str) if isinstance(config_str, str) else config_str
                input_schema = config.get('inputSchema', {})
            except (json.JSONDecodeError, TypeError):
                pass

        return cls(
            tool_id=str(db_tool.id),
            name=db_tool.name,
            description=db_tool.description or '',
            input_schema=input_schema
        )

    @classmethod
    def from_mcp_tool_config(cls, mcp_tool_config: Dict[str, Any]) -> 'McpTool':
        """
        从MCP工具配置字典创建McpTool实例

        Args:
            mcp_tool_config: MCP工具配置，包含name、description、inputSchema等字段

        Returns:
            McpTool: MCP工具实例
        """
        return cls(
            name=mcp_tool_config.get('name', ''),
            description=mcp_tool_config.get('description', ''),
            input_schema=mcp_tool_config.get('inputSchema', {})
        )
