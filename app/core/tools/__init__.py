"""
工具模块
提供工具的基类、注册表、转换器和运行器
"""

from app.core.tools.base_tool import BaseTool, BaseToolParam
from app.core.tools.custom_tool import CustomTool
from app.core.tools.tool_registry import ToolRegistry
from app.core.tools.tool_convert import ToolConvert
from app.core.tools.tool_runner import ToolRunner

__all__ = [
    'BaseTool',
    'BaseToolParam',
    'CustomTool',
    'ToolRegistry',
    'ToolConvert',
    'ToolRunner',
]


def _load_builtin_tools():
    """加载所有内置工具"""
    try:
        from app.core.tools.builtin_tools.web_search import web_search  # noqa: F401
        from app.core.tools.builtin_tools.generate_ppt import generate_ppt  # noqa: F401
        import logging
        logging.getLogger(__name__).info("builtin tools loaded")
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"load builtin tools failed: {e}", exc_info=True)


_load_builtin_tools()
