"""
模型通用工具类
"""

import re
from jinja2 import Environment


def get_output_json_content(response: str) -> str:
    """
    提取模型输出中的json内容
    
    Args:
        response: 模型回复字符串
        
    Returns:
        如果匹配到json块则返回去除前后空白的json字符串，否则返回原始输出
    """
    pattern = r"```json(.*?)```"
    match = re.search(pattern, response, re.DOTALL)
    if match:
        return match.group(1).strip()
    return response


def get_output_tag_content(response: str, tag_name: str) -> str:
    """
    提取模型输出中指定标签内容
    
    Args:
        response: 模型回复字符串
        tag_name: 标签名称
        
    Returns:
        如果匹配到标签内容则返回标签内的内容，否则返回原始输出
    """
    pattern = rf"<{tag_name}>(.*?)</{tag_name}>"
    match = re.search(pattern, response, re.DOTALL)
    if match:
        return match.group(1).strip()
    return response


def get_stream_output_tag_content(response: str, tag_name: str) -> str:
    """
    提取模型流式输出中指定标签内容
    
    Args:
        response: 本次流式输出字符串
        tag_name: 标签名称
        
    Returns:
        标签中的内容
    """
    start_tag = f"<{tag_name}>"
    end_tag = f"</{tag_name}>"
    
    start_idx = response.find(start_tag)
    if start_idx == -1:
        return ""
    
    content_start = start_idx + len(start_tag)
    end_idx = response.find(end_tag, content_start)
    
    if end_idx == -1:
        return response[content_start:]
    
    return response[content_start:end_idx]


def format_prompt(prompt: str, params: dict) -> str:
    """
    格式化提示词
    
    使用jinja2的render方法替换参数字典中的参数
    
    Args:
        prompt: 提示字符串，参数占位符为"{{参数名}}"
        params: 需要替换的参数字典
        
    Returns:
        格式化后的提示字符串
    """
    env = Environment()
    template = env.from_string(prompt)
    return template.render(params)