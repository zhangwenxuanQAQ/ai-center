"""获取当前时间工具

提供获取当前时间的MCP工具
"""

from datetime import datetime
from typing import Dict, Any

from mcp.types import CallToolResult, TextContent
from app.core.mcp.server.server import mcp


@mcp.tool()
def get_current_time() -> dict:
    """获取当前时间"""
    current_time = datetime.now()
    
    time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
    iso_time = current_time.isoformat()
    
    result = {
        "current_time": time_str,
        "iso_time": iso_time,
        "year": current_time.year,
        "month": current_time.month,
        "day": current_time.day,
        "hour": current_time.hour,
        "minute": current_time.minute,
        "second": current_time.second
    }
    
    return result
