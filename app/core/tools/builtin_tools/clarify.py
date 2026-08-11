"""
澄清工具 - 向用户提出澄清问题

允许智能体在继续执行之前向用户提出结构化的选择题或开放式问题。
支持单选、多选和开放式问答三种模式。

工具返回包含问题和选项的结构化结果，前端据此渲染交互式 UI，
用户的选择/回答将作为下一条消息进入对话，智能体据此继续处理。
"""

import logging
from typing import Any

from app.core.tools import BaseTool, BaseToolParam, ToolRegistry

logger = logging.getLogger(__name__)

# 最多预设选项数量，UI 会自动追加'其他（自定义输入）'选项
MAX_CHOICES = 5


def _flatten_choice(c) -> str:
    """将单个选项规整为用户可见的展示文本。

    schema 声明 choices 为纯字符串列表，但 LLM 有时会输出 dict 形态
    （如 [{"description": "..."}]）。直接 str(c) 会把整个 dict 转为
    Python repr，导致各渲染面显示原始字典内容。在此统一展开。

    dict 取值优先级：label → description → text → title。
    name 和 value 被排除，因为它们通常携带枚举值或短标识符，
    不是人类可读的标签。
    """
    if c is None:
        return ""
    if isinstance(c, str):
        return c.strip()
    if isinstance(c, dict):
        for key in ("label", "description", "text", "title"):
            v = c.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
        return ""
    if isinstance(c, (list, tuple)):
        return " ".join(_flatten_choice(x) for x in c).strip()
    return str(c).strip()


@ToolRegistry.register
class clarify(BaseTool):
    """向用户提出澄清问题，获取用户的选择或回答。"""

    name = "clarify"
    title = "澄清问题"
    description = (
        f"当你需要澄清、反馈或决策时，向用户提出问题，获取用户的选择或回答时优先使用该工具。支持三种模式：\n\n"
        f"1. **单选题** — 提供最多 {MAX_CHOICES} 个选项，用户选择一个或通过第 {MAX_CHOICES + 1} 个'其他'选项自行输入。\n"
        "2. **多选题** — 设置 multi_select=true，用户可多选，user_response 将返回选中的选项列表。\n"
        "3. **开放式问题** — 不提供 choices，用户自由输入文本回答。\n\n"
        "重要：当你提供选项时，请将每个选项仅放在 `choices` 数组中，"
        "不要将选项写入 `question` 文本中。UI 会将 `choices` 渲染为可选项。"
        "正确示例：question='使用哪种部署方式？', choices=['本地部署', '云端部署']。"
        "错误示例：question='使用哪种部署方式？1) 本地 2) 云端', choices=[]。\n\n"
        "适用场景：\n"
        "- 任务不明确，需要用户选择方案时\n"
        "- 想要获取任务完成后的反馈时\n"
        "- 想要提议保存技能或更新记忆时\n"
        "- 决策有重大权衡需要用户参与时\n\n"
        "不要用此工具做危险命令的 yes/no 确认。低风险决策请自行做出合理默认选择。"
    )
    params = [
        BaseToolParam(
            name="question",
            type="string",
            description="问题文本本身，仅包含问题（如'使用哪种部署方式？'）。不要在问题中嵌入选项，选项应放在 choices 数组中。",
            required=True
        ),
        BaseToolParam(
            name="choices",
            type="array",
            description=(
                f"可选择的选项数组，每个选项为独立的字符串元素，最多 {MAX_CHOICES} 个。"
                "UI 会将这些渲染为可选项，并自动追加'其他（自定义输入）'选项。"
                "仅在开放式自由文本问题时才省略此参数。"
            ),
            required=False
        ),
        BaseToolParam(
            name="multi_select",
            type="boolean",
            description=(
                "是否允许多选。true 时用户可多选（复选框），user_response 返回选项列表。"
                "false（默认）时单选（单选框）。不提供 choices 时无效果。"
            ),
            required=False,
            default=False
        ),
    ]

    def _run(self, **kwargs) -> Any:
        """执行澄清工具，返回包含问题和选项的结构化结果。

        前端根据返回结果中的 type='clarify' 渲染交互式 UI，
        用户的选择/回答将作为下一条消息进入对话。
        """
        question = kwargs.get("question", "")
        choices = kwargs.get("choices")
        multi_select = kwargs.get("multi_select", False)

        # 校验问题文本
        if not question or not question.strip():
            return {"error": "问题文本不能为空"}

        question = question.strip()

        # 清洗和校验选项
        if choices is not None:
            if not isinstance(choices, list):
                return {"error": "choices 必须是字符串列表"}
            # 将 LLM 可能输出的 dict 形态选项展开为纯文本
            choices = [s for s in (_flatten_choice(c) for c in choices) if s]
            if len(choices) > MAX_CHOICES:
                choices = choices[:MAX_CHOICES]
            if not choices:
                choices = None  # 空列表视为开放式问题

        result = {
            "type": "clarify",
            "question": question,
            "choices": choices,
            "multi_select": bool(multi_select) if choices is not None else False,
            "message": "已向用户提出澄清问题，等待用户回复..."
        }

        logger.info(f"澄清工具触发 - 问题: {question}, 选项数: {len(choices) if choices else 0}, 多选: {multi_select}")
        return result
