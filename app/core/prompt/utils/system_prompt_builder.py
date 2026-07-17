"""
系统提示词构建工具

"""

import os
from datetime import datetime
from typing import Optional


def _load_prompt_file(filename: str) -> str:
    """
    加载指定文件内容，支持从builtin_prompts及其子文件夹中查找
    
    Args:
        filename: 文件名（可以是相对路径，如knowledgebase/knowledge_template_extract.md）
        
    Returns:
        str: 文件内容，文件不存在时返回空字符串
    """
    builtin_prompts_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'builtin_prompts'
    )
    
    def find_file_in_directory(directory: str, target_filename: str) -> Optional[str]:
        """
        在目录及其子目录中递归查找文件
        
        Args:
            directory: 搜索的根目录
            target_filename: 目标文件名
            
        Returns:
            Optional[str]: 文件完整路径，未找到返回None
        """
        for root, dirs, files in os.walk(directory):
            if target_filename in files:
                return os.path.join(root, target_filename)
        return None
    
    file_path = find_file_in_directory(builtin_prompts_dir, filename)
    
    if file_path and os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    
    return ''


def load_react_system_prompt() -> str:
    """
    加载react_system_prompt.md文件内容

    Returns:
        str: react系统提示词内容
    """
    return _load_prompt_file('react_system_prompt.md')


def load_task_planner_prompt() -> str:
    """
    加载task_planner.md文件内容（任务规划提示词）

    Returns:
        str: 任务规划提示词内容
    """
    return _load_prompt_file('task_planner.md')


def load_if_need_task_prompt() -> str:
    """
    加载if_need_task.md文件内容（判断是否需要子任务的提示词）

    Returns:
        str: 判断是否需要子任务的提示词内容
    """
    return _load_prompt_file('if_need_task.md')


def load_result_summary_prompt() -> str:
    """
    加载result_summary.md文件内容（结果汇总提示词）

    Returns:
        str: 结果汇总提示词内容
    """
    return _load_prompt_file('result_summary.md')


def load_thinking_answer_rule_prompt() -> str:
    """
    加载thinking_answer_rule.md文件内容（思考回答规则提示词）

    Returns:
        str: 思考回答规则提示词内容
    """
    return _load_prompt_file('thinking_answer_rule.md')


def load_mermaid_prompt() -> str:
    """
    加载ui_system_prompt.md文件内容（UI组件生成规则提示词）

    Returns:
        str: UI组件生成规则提示词内容
    """
    return _load_prompt_file('ui_system_prompt.md')


def load_markdown_ui_grammar() -> str:
    """
    加载markdown_ui_grammar.md文件内容（Markdown-UI组件语法参考）

    Returns:
        str: Markdown-UI组件语法参考内容
    """
    return _load_prompt_file('markdown_ui_grammar.md')


def load_mermaid_ui_grammar() -> str:
    """
    加载mermaid_ui_grammar.md文件内容（Mermaid图表语法参考）

    Returns:
        str: Mermaid图表语法参考内容
    """
    return _load_prompt_file('mermaid_ui_grammar.md')


def build_system_prompt(original_prompt: Optional[str] = None, include_react_prompt: bool = True) -> str:
    """
    构建系统提示词

    将react_system_prompt.md内容作为顶级提示词放在最顶部，
    然后拼接原始系统提示词、当前时间、时区等额外信息

    Args:
        original_prompt: 原始系统提示词
        include_react_prompt: 是否包含react系统提示词（默认True）

    Returns:
        str: 构建后的系统提示词
    """
    parts = []

    if include_react_prompt:
        react_prompt = load_react_system_prompt()
        if react_prompt:
            parts.append(react_prompt)

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

    thinking_answer_rule = load_thinking_answer_rule_prompt()
    if thinking_answer_rule:
        parts.append(thinking_answer_rule)

    ui_system_rule = load_mermaid_prompt()
    if ui_system_rule:
        # 替换 Mermaid 图表语法占位符
        mermaid_ui_grammar = load_mermaid_ui_grammar()
        if mermaid_ui_grammar:
            ui_system_rule = ui_system_rule.replace('{{MERMAID_UI_GRAMMAR}}', mermaid_ui_grammar)
        # 替换 Markdown-UI 组件语法占位符
        markdown_ui_grammar = load_markdown_ui_grammar()
        if markdown_ui_grammar:
            ui_system_rule = ui_system_rule.replace('{{MARKDOWN_UI_GRAMMAR}}', markdown_ui_grammar)
        parts.append(ui_system_rule)

    return "  \n".join(parts)
