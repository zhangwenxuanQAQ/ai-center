import json
import logging
from typing import Any, Dict, List, Optional, Tuple, Type

from app.core.llm_model.builtin_tools.base_tool import BuiltinTool

logger = logging.getLogger(__name__)

_BUILTIN_TOOL_REGISTRY: Dict[str, BuiltinTool] = {}


def register_builtin_tool(tool_class: Type[BuiltinTool]) -> Type[BuiltinTool]:
    """Register a builtin tool class via decorator."""
    try:
        instance = tool_class()
        if instance.name:
            _BUILTIN_TOOL_REGISTRY[instance.name] = instance
            logger.info(f"registered builtin tool: {instance.name}")
        else:
            logger.warning(f"tool class {tool_class.__name__} has no name, skipping")
    except Exception as e:
        logger.error(f"register tool {tool_class.__name__} failed: {e}")
    return tool_class


def get_builtin_tool(name: str) -> Optional[BuiltinTool]:
    return _BUILTIN_TOOL_REGISTRY.get(name)


def get_all_builtin_tools() -> Dict[str, BuiltinTool]:
    return dict(_BUILTIN_TOOL_REGISTRY)


def builtin_tools_to_openai_tools(tool_names: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    tools = []
    if tool_names:
        for name in tool_names:
            tool = _BUILTIN_TOOL_REGISTRY.get(name)
            if tool:
                tools.append(tool.to_openai_tool())
            else:
                logger.warning(f"builtin tool '{name}' not registered")
    else:
        for tool in _BUILTIN_TOOL_REGISTRY.values():
            tools.append(tool.to_openai_tool())
    return tools


def call_builtin_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    tool = _BUILTIN_TOOL_REGISTRY.get(name)
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


def is_builtin_tool(name: str) -> bool:
    return name in _BUILTIN_TOOL_REGISTRY


def inject_builtin_tools(
    tools: Optional[List[Dict[str, Any]]] = None,
    tool_map: Optional[Dict[str, str]] = None,
    web_search_enabled: bool = False
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """
    注入内置工具到tools和tool_map中

    Args:
        tools: 已有的工具列表（可为None）
        tool_map: 已有的工具映射（可为None）
        web_search_enabled: 是否启用网络搜索功能

    Returns:
        Tuple[List[Dict[str, Any]], Dict[str, str]]: 更新后的工具列表和工具映射
    """
    if tools is None:
        tools = []
    if tool_map is None:
        tool_map = {}

    # 需要始终注入的内置工具列表
    always_inject_tools = ['generate_ppt']
    for tool_name in always_inject_tools:
        builtin_tools_list = builtin_tools_to_openai_tools([tool_name])
        if builtin_tools_list:
            # 避免重复注入
            if tool_name not in tool_map:
                tools.extend(builtin_tools_list)
                tool_map[tool_name] = 'builtin'

    # 网络搜索工具根据web_search_enabled决定是否注入
    if web_search_enabled:
        web_search_tools = builtin_tools_to_openai_tools(['web_search'])
        if web_search_tools:
            if 'web_search' not in tool_map:
                tools.extend(web_search_tools)
                tool_map['web_search'] = 'builtin'

    return tools, tool_map


def _load_builtin_tools():
    try:
        from app.core.llm_model.builtin_tools.web_search import web_search  # noqa: F401
        from app.core.llm_model.builtin_tools.generate_ppt import generate_ppt  # noqa: F401
        logger.info("builtin tools loaded")
    except Exception as e:
        logger.error(f"load builtin tools failed: {e}", exc_info=True)


_load_builtin_tools()
