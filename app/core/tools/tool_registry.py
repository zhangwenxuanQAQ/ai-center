"""
工具注册表模块
负责工具的注册、查询和管理
"""

import logging
from typing import Dict, Optional, Type

from app.core.tools.base_tool import BaseTool

logger = logging.getLogger(__name__)


class ToolRegistry:
    """工具注册表，管理所有已注册的工具"""

    _registry: Dict[str, BaseTool] = {}

    @classmethod
    def register(cls, tool_class: Type[BaseTool]) -> Type[BaseTool]:
        """注册工具类的装饰器"""
        try:
            instance = tool_class()
            if instance.name:
                cls._registry[instance.name] = instance
                logger.info(f"registered builtin tool: {instance.name}")
            else:
                logger.warning(f"tool class {tool_class.__name__} has no name, skipping")
        except Exception as e:
            logger.error(f"register tool {tool_class.__name__} failed: {e}")
        return tool_class

    @classmethod
    def get_tool(cls, name: str) -> Optional[BaseTool]:
        """根据名称获取工具"""
        return cls._registry.get(name)

    @classmethod
    def get_all_tools(cls) -> Dict[str, BaseTool]:
        """获取所有已注册的工具"""
        return dict(cls._registry)

    @classmethod
    def is_registered(cls, name: str) -> bool:
        """检查工具是否已注册"""
        return name in cls._registry

    @classmethod
    def clear(cls) -> None:
        """清空注册表"""
        cls._registry.clear()
