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
    time_info = f"当前系统时间为：{current_time}"
    parts.append(time_info)
    
    timezone_name = now.strftime("%Z")
    timezone_offset = now.strftime("%z")
    timezone_info = f"当前时区：{timezone_name} (UTC{timezone_offset[:3]}:{timezone_offset[3:]})"
    parts.append(timezone_info)
    
    return "\n\n".join(parts)
