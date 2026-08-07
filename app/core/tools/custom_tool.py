"""
自定义工具基类
提供将其他自定义功能转换为工具的基础类
"""

from typing import Any

from app.core.tools.base_tool import BaseTool, BaseToolParam


class CustomTool(BaseTool):
    """
    自定义工具基类，继承自BaseTool
    用于将其他自定义功能转换为工具

    使用示例:
        class MyCustomTool(CustomTool):
            name = "my_custom_tool"
            title = "我的自定义工具"
            description = "这是一个自定义工具"
            params = [
                BaseToolParam(name="input", type="string", description="输入内容", required=True),
            ]

            def run(self, **kwargs) -> Any:
                input_text = kwargs.get("input", "")
                return {"result": f"处理完成: {input_text}"}
    """

    # 自定义工具类型标识
    tool_type: str = "custom"

    def run(self, **kwargs) -> Any:
        """默认实现，子类需要重写"""
        raise NotImplementedError("CustomTool subclass must implement run()")
