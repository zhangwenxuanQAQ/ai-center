"""
工具运行器模块
负责工具的调用和执行
"""

import logging
from typing import Any, Dict

from app.core.tools.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


class ToolRunner:
    """工具运行器，负责调用和执行工具"""

    @staticmethod
    def call(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用工具

        Args:
            name: 工具名称
            arguments: 工具参数

        Returns:
            Dict[str, Any]: 调用结果，包含success和result/error
        """
        tool = ToolRegistry.get_tool(name)
        if not tool:
            return {"success": False, "error": f"builtin tool '{name}' not registered"}
        error = tool.validate_params(**arguments)
        if error:
            return {"success": False, "error": error}
        defaults = tool.get_default_params()
        for param_name, default_value in defaults.items():
            if param_name not in arguments:
                arguments[param_name] = default_value
        try:
            result = tool.run(**arguments)
            return {"success": True, "result": result}
        except Exception as e:
            logger.error(f"call builtin tool '{name}' failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
