"""
Hermes 智能体历史消息查询工具

查询指定智能体（profile）下某个会话的历史消息记录。
"""

import logging
from typing import Generator

from app.core.tools import BaseTool, BaseToolParam, ToolRegistry, ToolResult
from app.core.agent.hermes_agent import HermesAgentService

logger = logging.getLogger(__name__)

# 服务实例（无状态，可全局复用）
hermes_service = HermesAgentService()


@ToolRegistry.register
class hermes_agent_messages(BaseTool):
    """查询 hermes 智能体会话的历史消息。"""

    name = "hermes_agent_messages"
    title = "智能体历史消息"
    description = (
        "查询指定 hermes 智能体（profile）下某个会话的历史消息记录，"
        "按时间顺序返回用户与助手的对话内容。"
        "可先用智能体会话列表工具获取会话 id。"
    )
    category = "hermes-agent"
    params = [
        BaseToolParam(name="agent", type="string", description="智能体名称（profile），默认 default", required=False, default="default"),
        BaseToolParam(name="session_id", type="string", description="会话 id", required=True),
        BaseToolParam(name="limit", type="integer", description="返回的最大消息数，不传则返回全部", required=False, default=0),
        BaseToolParam(name="offset", type="integer", description="偏移量（分页用）", required=False, default=0),
    ]

    def _run_stream(self, **kwargs) -> Generator[ToolResult, None, None]:
        """流式执行工具，直接复用非流式的_run结果作为唯一分片"""
        yield self._run(**kwargs)

    def _run(self, **kwargs) -> ToolResult:
        agent = kwargs.get("agent") or "default"
        session_id = kwargs.get("session_id", "")
        limit = int(kwargs.get("limit", 0) or 0) or None
        offset = int(kwargs.get("offset", 0) or 0)
        if not session_id:
            return self._error(message="会话 id 不能为空", error="session_id is required")
        try:
            data = hermes_service.get_conversation_messages(agent, session_id, limit=limit, offset=offset)
        except Exception as e:
            logger.error(f"查询智能体历史消息失败: {e}", exc_info=True)
            return self._error(message=f"查询智能体历史消息失败: {e}", error=str(e))
        return self._success(
            result=data.get("data", []),
            message=f"共查询到 {data.get('total', 0)} 条消息",
            total=data.get("total", 0),
        )
