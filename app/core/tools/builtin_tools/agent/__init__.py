"""
Hermes 智能体内置工具模块

将 hermes 智能体的对话、会话列表查询、历史消息查询封装为内置工具，
工具分类统一为 hermes-agent。
"""

from app.core.tools.builtin_tools.agent.chat import hermes_agent_chat
from app.core.tools.builtin_tools.agent.list_conversations import hermes_agent_conversations
from app.core.tools.builtin_tools.agent.get_messages import hermes_agent_messages

__all__ = ["hermes_agent_chat", "hermes_agent_conversations", "hermes_agent_messages"]
