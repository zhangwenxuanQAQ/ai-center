"""
Hermes 智能体对话工具

将 hermes 智能体的流式对话封装为内置工具：调用官方 SDK 运行智能体，
收集流式增量文本后返回完整回复。
"""

import logging
from typing import Generator

from app.core.tools import BaseTool, BaseToolParam, ToolRegistry, ToolResult
from app.core.agent.hermes_agent import HermesAgentService

logger = logging.getLogger(__name__)

# 服务实例（无状态，可全局复用）
hermes_service = HermesAgentService()


@ToolRegistry.register
class hermes_agent_chat(BaseTool):
    """与指定的 hermes 智能体对话。"""

    name = "hermes_agent_chat"
    title = "智能体对话"
    description = (
        "与指定的 hermes 智能体进行对话。可以指定智能体（profile）与会话 id，"
        "返回智能体的完整回复内容。未指定会话 id 时会自动新建一个会话。"
        "适用于需要调度其他智能体完成子任务的场景。"
    )
    category = "hermes-agent"
    params = [
        BaseToolParam(name="agent", type="string", description="智能体名称（profile），默认 default", required=False, default="default"),
        BaseToolParam(name="message", type="string", description="发送给智能体的消息内容", required=True),
        BaseToolParam(name="session_id", type="string", description="会话 id，不传则自动新建会话", required=False, default=""),
    ]

    def _run_stream(self, **kwargs) -> Generator[ToolResult, None, None]:
        """流式执行工具，将对话增量文本逐段产出"""
        agent = kwargs.get("agent") or "default"
        message = kwargs.get("message", "")
        session_id = kwargs.get("session_id") or ""
        if not message or not message.strip():
            yield self._error(message="消息内容不能为空", error="message is required")
            return
        try:
            if not session_id:
                session_id = hermes_service.create_conversation(agent)["session_id"]
            for chunk in hermes_service.chat_stream(agent, session_id, message):
                yield self._success(result=chunk, message="", session_id=session_id)
        except Exception as e:
            logger.error(f"智能体对话失败: {e}", exc_info=True)
            yield self._error(message=f"智能体对话失败: {e}", error=str(e), session_id=session_id)

    def _run(self, **kwargs) -> ToolResult:
        """执行对话，聚合所有流式分片为完整回复"""
        parts = []
        session_id = kwargs.get("session_id") or ""
        for chunk in self._run_stream(**kwargs):
            if not chunk.success:
                return chunk
            if isinstance(chunk.result, str):
                parts.append(chunk.result)
            session_id = chunk.metadata.get("session_id", session_id)
        return self._success(
            result="".join(parts),
            message="智能体对话完成",
            session_id=session_id,
        )
