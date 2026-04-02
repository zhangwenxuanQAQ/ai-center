"""
系统提示词构建工具

"""

from datetime import datetime
from typing import Optional


def build_system_prompt(original_prompt: Optional[str] = None) -> str:
    """
    构建系统提示词
    
    将当前时间等额外信息拼接到原始系统提示词中
    
    Args:
        original_prompt: 原始系统提示词
        
    Returns:
        str: 构建后的系统提示词
    """
    parts = []
    
    if original_prompt and original_prompt.strip():
        parts.append(original_prompt.strip())
    
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    time_info = f"当前系统时间为：{current_time}"
    parts.append(time_info)
    
    return "\n\n".join(parts)
