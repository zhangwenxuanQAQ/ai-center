"""
工具运行器模块
负责工具的调用和执行
"""

import logging
from typing import Any, Dict, Optional, TYPE_CHECKING

from app.core.tools.tool_registry import ToolRegistry

if TYPE_CHECKING:
    from app.core.tools.base_tool import BaseTool

logger = logging.getLogger(__name__)


class ToolRunner:
    """工具运行器，负责调用和执行工具"""

    @staticmethod
    def call(
        name: str,
        arguments: Dict[str, Any],
        tool_map: Optional[Dict[str, 'BaseTool']] = None
    ) -> Dict[str, Any]:
        """
        调用工具

        优先从tool_map中查找工具实例（用于MCP工具、知识库检索等动态工具），
        若未找到则从全局ToolRegistry中查找（用于内置工具如网络搜索、PPT生成等）。

        Args:
            name: 工具名称
            arguments: 工具参数
            tool_map: 工具名称到工具实例的映射（可选，用于动态工具查找）

        Returns:
            Dict[str, Any]: 调用结果，包含success和result/error
        """
        # 优先从tool_map查找工具实例
        tool = None
        if tool_map:
            tool = tool_map.get(name)
        # 若tool_map中未找到，从全局注册表查找
        if not tool:
            tool = ToolRegistry.get_tool(name)
        if not tool:
            return {"success": False, "error": f"工具 '{name}' 不存在"}
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
            logger.error(f"调用工具 '{name}' 失败: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
