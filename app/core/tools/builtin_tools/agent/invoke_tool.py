"""
Hermes 智能体工具调用（直接执行单个工具）

供工具箱运维 / Agent 内部使用：根据指定智能体 profile 启用的 toolset，
直接调用其注册的某个工具（绕过会话与模型，进程内 dispatch）。
"""

import json
import logging
from typing import Generator

from app.core.tools import BaseTool, BaseToolParam, ToolRegistry, ToolResult
from app.core.agent.hermes_agent import HermesAgentService

logger = logging.getLogger(__name__)

# 服务实例（无状态，可全局复用）
hermes_service = HermesAgentService()


@ToolRegistry.register
class hermes_agent_tool_call(BaseTool):
    """直接调用指定 hermes 智能体的某个内置工具并返回结果。"""

    name = "hermes_agent_tool_call"
    title = "智能体工具调用"
    description = (
        "直接调用指定 hermes 智能体（profile）启用的某个内置工具并返回执行结果。"
        "参数：agent（智能体名）/ tool（工具名，如 web_search、terminal 等）/"
        "args（JSON 字符串或 null，对应工具的入参 dict）。"
        "调用时会自动加载该智能体的 toolset 并 dispatch，"
        "便于运维调试或让上层 agent 调度一个具体工具。"
    )
    category = "hermes-agent"
    params = [
        BaseToolParam(name="agent", type="string", description="智能体名称（profile），默认 default", required=False, default="default"),
        BaseToolParam(name="tool", type="string", description="要直接调用的工具名（来自该智能体启用的工具集，如 web_search、terminal、read_file 等）", required=True, default=""),
        BaseToolParam(
            name="args", type="string",
            description="传给该工具的参数，JSON 字符串（如 {\"query\": \"天气\"}），无参数时传空字符串或省略",
            required=False, default="",
        ),
    ]

    def _run_stream(self, **kwargs) -> Generator[ToolResult, None, None]:
        """流式执行工具，直接复用非流式 _run 结果作为唯一分片"""
        yield self._run(**kwargs)

    def _run(self, **kwargs) -> ToolResult:
        agent = kwargs.get("agent") or "default"
        tool = (kwargs.get("tool") or "").strip()
        args_raw = kwargs.get("args") or ""

        if not tool:
            return self._error(message="必须指定工具名（tool 参数）", error="tool is required")

        # 解析入参
        args: dict = {}
        if isinstance(args_raw, str) and args_raw.strip():
            try:
                parsed = json.loads(args_raw)
                if isinstance(parsed, dict):
                    args = parsed
                else:
                    return self._error(message="args 必须是 JSON 对象（dict）", error="args must be a JSON object")
            except json.JSONDecodeError as e:
                return self._error(message=f"args 不是合法 JSON: {e}", error=f"invalid json: {e}")
        elif isinstance(args_raw, dict):
            args = args_raw

        try:
            with hermes_service._with_agent_home(hermes_service.get_agent_dir(agent)):
                from tools.registry import registry as _registry
                from tools.registry import discover_builtin_tools
                from hermes_cli.config import load_config
                from hermes_cli.tools_config import _get_platform_tools
                from hermes_cli.plugins import discover_plugins

                try:
                    load_config()
                    discover_builtin_tools()
                    discover_plugins(force=True)
                except Exception:
                    # 容错：即使插件异常也不要阻断已知内置工具调用
                    pass

                entry = _registry.get_entry(tool)
                if entry is None:
                    return self._error(
                        message=f"工具 {tool} 未在智能体 {agent} 注册，请确认该工具属于其启用的工具集",
                        error=f"unknown tool: {tool}",
                    )
                # 校验工具所属 toolset 是否启用，避免调用被禁用的工具
                try:
                    cfg = load_config()
                    enabled = _get_platform_tools(cfg, "cli")
                    if entry.toolset not in enabled:
                        return self._error(
                            message=f"工具 {tool} 所属工具集 {entry.toolset} 未在智能体 {agent} 中启用",
                            error=f"toolset {entry.toolset} not enabled",
                        )
                except Exception:
                    # 校验失败时放行（仅在 list_tools 可用时才校验）
                    pass

                result = _registry.dispatch(tool, args)
                # 截断过长内容
                if isinstance(result, str) and len(result) > 8000:
                    result = result[:8000] + f"\n...（已截断 {len(result) - 8000} 字符）"
                # 把 JSON 字符串结果解析成 dict 返回，方便前端展示
                if isinstance(result, str):
                    try:
                        result = json.loads(result)
                    except (json.JSONDecodeError, TypeError):
                        pass
            return self._success(
                result=result,
                message=f"工具 {tool} 执行完成",
                tool=tool,
                toolset=entry.toolset,
            )
        except Exception as e:
            logger.error(f"调用智能体工具失败: {e}", exc_info=True)
            return self._error(message=f"调用智能体工具失败: {e}", error=str(e))
