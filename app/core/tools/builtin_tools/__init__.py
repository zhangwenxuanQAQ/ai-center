"""
内置工具模块
"""

from app.core.tools.builtin_tools.web_search.web_search import web_search
from app.core.tools.builtin_tools.generate_ppt import generate_ppt
from app.core.tools.builtin_tools.knowledgebase_search import KnowledgebaseSearch
from app.core.tools.builtin_tools.mcp_tool import McpTool

__all__ = ["web_search", "generate_ppt", "KnowledgebaseSearch", "McpTool"]
