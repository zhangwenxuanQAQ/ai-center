"""
Hermes 智能体会话列表查询工具

查询指定智能体（profile）下的历史会话列表。
"""

import logging
from typing import Generator

from app.core.tools import BaseTool, BaseToolParam, ToolRegistry, ToolResult
from app.core.agent.hermes_agent import HermesAgentService

logger = logging.getLogger(__name__)

# 服务实例（无状态，可全局复用）
hermes_service = HermesAgentService()


@ToolRegistry.register
class hermes_agent_conversations(BaseTool):
    """查询 hermes 智能体的会话列表。"""

    name = "hermes_agent_conversations"
    title = "智能体会话列表"
    description = (
        "查询指定 hermes 智能体（profile）的历史会话列表，"
        "按最近活跃时间倒序返回会话 id、标题、消息数与预览内容。"
        "可用于查找需要继续的历史会话。"
    )
    category = "hermes-agent"
    params = [
        BaseToolParam(name="agent", type="string", description="智能体名称（profile），默认 default", required=False, default="default"),
        BaseToolParam(name="limit", type="integer", description="返回的最大会话数", required=False, default=20),
        BaseToolParam(name="offset", type="integer", description="偏移量（分页用）", required=False, default=0),
        BaseToolParam(name="search", type="string", description="标题或会话 id 模糊查询关键字", required=False, default=""),
    ]

    def _run_stream(self, **kwargs) -> Generator[ToolResult, None, None]:
        """流式执行工具，直接复用非流式的_run结果作为唯一分片"""
        yield self._run(**kwargs)

    def _run(self, **kwargs) -> ToolResult:
        agent = kwargs.get("agent") or "default"
        limit = int(kwargs.get("limit", 20) or 20)
        offset = int(kwargs.get("offset", 0) or 0)
        search = kwargs.get("search") or None
        try:
            data = hermes_service.list_conversations(agent, limit=limit, offset=offset, search=search)
        except Exception as e:
            logger.error(f"查询智能体会话列表失败: {e}", exc_info=True)
            return self._error(message=f"查询智能体会话列表失败: {e}", error=str(e))
        return self._success(
            result=data.get("data", []),
            message=f"共查询到 {data.get('total', 0)} 个会话",
            total=data.get("total", 0),
        )
