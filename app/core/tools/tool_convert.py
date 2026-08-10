"""
工具转换模块
负责工具与OpenAI工具格式的转换和注入
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from app.core.tools.base_tool import BaseTool
from app.core.tools.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


class ToolConvert:
    """工具转换器，处理工具格式转换和注入"""

    @staticmethod
    def to_openai_tools(tool_names: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """将内置工具转换为OpenAI工具格式"""
        tools = []
        if tool_names:
            for name in tool_names:
                tool = ToolRegistry.get_tool(name)
                if tool:
                    tools.append(tool.to_openai_tool())
                else:
                    logger.warning(f"builtin tool '{name}' not registered")
        else:
            for tool in ToolRegistry.get_all_tools().values():
                tools.append(tool.to_openai_tool())
        return tools

    @staticmethod
    def inject_builtin_tools(
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_map: Optional[Dict[str, BaseTool]] = None,
        web_search_enabled: bool = False
    ) -> Tuple[List[Dict[str, Any]], Dict[str, BaseTool]]:
        """
        注入内置工具到tools和tool_map中

        将内置工具（generate_ppt、web_search等）的OpenAI格式定义注入tools列表，
        并将工具实例存入tool_map供ToolRunner.call调用。

        Args:
            tools: 已有的工具列表（可为None）
            tool_map: 已有的工具映射（可为None），key为工具名称，value为工具实例
            web_search_enabled: 是否启用网络搜索功能

        Returns:
            Tuple[List[Dict[str, Any]], Dict[str, BaseTool]]: 更新后的工具列表和工具映射
        """
        if tools is None:
            tools = []
        if tool_map is None:
            tool_map = {}

        # 需要始终注入的内置工具列表
        always_inject_tools = ['generate_ppt']
        for tool_name in always_inject_tools:
            tool = ToolRegistry.get_tool(tool_name)
            if tool:
                # 避免重复注入
                if tool_name not in tool_map:
                    tools.append(tool.to_openai_tool())
                    tool_map[tool_name] = tool

        # 网络搜索工具根据web_search_enabled决定是否注入
        if web_search_enabled:
            tool = ToolRegistry.get_tool('web_search')
            if tool:
                if 'web_search' not in tool_map:
                    tools.append(tool.to_openai_tool())
                    tool_map['web_search'] = tool

        return tools, tool_map
