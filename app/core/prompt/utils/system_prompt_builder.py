"""
系统提示词构建工具

"""

from datetime import datetime
from typing import Optional


def build_system_prompt(original_prompt: Optional[str] = None) -> str:
    """
    构建系统提示词
    
    将当前时间、时区等额外信息拼接到原始系统提示词中
    
    Args:
        original_prompt: 原始系统提示词
        
    Returns:
        str: 构建后的系统提示词
    """
    parts = []
    
    if original_prompt and original_prompt.strip():
        parts.append(original_prompt.strip())
    
    now = datetime.now().astimezone()
    current_time = now.strftime("%Y-%m-%d %H:%M:%S")
    time_info = f"** 当前系统时间 **：{current_time}"
    parts.append(time_info)
    
    timezone_name = now.strftime("%Z")
    timezone_offset = now.strftime("%z")
    timezone_info = f"** 当前时区 **：{timezone_name} (UTC{timezone_offset[:3]}:{timezone_offset[3:]})"
    parts.append(timezone_info)

    rule_info = "** 注意：系统时间可能和用户问题没有关联，没有关联时不要回复系统时间。当用户需要查询时间必须以当前系统时间为准，不要使用其他时间 **"
    parts.append(rule_info)
    return "\n\n".join(parts)
