"""
自定义工具基类
提供将其他自定义功能转换为工具的基础类
支持通过callback函数注入实际工具执行逻辑
"""

from typing import Any, Callable, Dict, Optional

from app.core.tools.base_tool import BaseTool, BaseToolParam


class CustomTool(BaseTool):
    """
    自定义工具基类，继承自BaseTool
    用于将其他自定义功能（如MCP工具、知识库检索等）转换为工具

    支持两种使用方式:
    1. 子类重写run方法实现工具逻辑
    2. 通过callback函数注入实际工具执行逻辑

    使用示例1 - 继承重写:
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

    使用示例2 - callback方式:
        def my_handler(**kwargs):
            return f"结果: {kwargs.get('query', '')}"

        tool = CustomTool(
            name="mcp_tool_xxx",
            description="MCP工具",
            callback=my_handler,
            params=[BaseToolParam(name="query", type="string", description="查询", required=True)]
        )
    """

    # 自定义工具类型标识
    tool_type: str = "custom"

    def __init__(
        self,
        name: str = "",
        title: str = "",
        description: str = "",
        params: Optional[list] = None,
        callback: Optional[Callable] = None,
        **extra
    ):
        """
        初始化自定义工具

        Args:
            name: 工具名称
            title: 工具标题
            description: 工具描述
            params: 工具参数列表
            callback: 工具执行回调函数，接收**kwargs参数
            **extra: 额外属性
        """
        if name:
            self.name = name
        if title:
            self.title = title
        if description:
            self.description = description
        if params:
            self.params = params
        self._callback = callback
        # 保存额外属性
        for key, value in extra.items():
            setattr(self, key, value)

    def run(self, **kwargs) -> Any:
        """
        执行工具

        如果设置了callback函数，则调用callback执行实际逻辑
        否则子类需要重写此方法

        Args:
            **kwargs: 工具参数

        Returns:
            Any: 工具执行结果
        """
        if self._callback is not None:
            return self._callback(**kwargs)
        raise NotImplementedError(
            "CustomTool must either be initialized with a callback or have run() overridden"
        )
