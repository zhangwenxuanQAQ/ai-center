"""
工具Hook类

继承自BaseHook，用于处理工具调用的前置、后置和过程中钩子。
按照 before_tools、ongoing_tools、after_tools 顺序执行工具，
实现工具调用前参数处理、执行过程中中间结果处理、执行后结果处理。

使用示例:
    from app.core.hooks import ToolHook

    # 创建前置和后置工具
    before_tool = SomeTool(...)
    after_tool = AnotherTool(...)

    # 创建Hook
    hook = ToolHook(before_tools=[before_tool], after_tools=[after_tool])

    # 将Hook添加到工具
    tool.hooks = [hook]
    # 之后调用 tool.run(**kwargs) 时会自动执行hook的before和after方法
"""

import logging
from typing import Any, Dict, List, Optional

from app.core.hooks.base_hook import BaseHook

logger = logging.getLogger(__name__)


class ToolHook(BaseHook):
    """
    工具Hook类，继承自BaseHook

    按照工具列表顺序执行钩子工具：
    - before: 按照 before_tools 顺序执行工具，入参和出参均为工具调用参数
    - ongoing: 按照 ongoing_tools 顺序执行工具，入参为执行过程中的中间结果
    - after: 按照 after_tools 顺序执行工具，入参为工具执行结果
    """

    def __init__(
        self,
        before_tools: Optional[List] = None,
        after_tools: Optional[List] = None,
        ongoing_tools: Optional[List] = None
    ):
        """
        初始化工具Hook

        Args:
            before_tools: 在被勾的方法执行前调用的工具列表
            after_tools: 在被勾的方法执行后调用的工具列表
            ongoing_tools: 在被勾的方法执行过程中调用的工具列表
        """
        super().__init__(before_tools, after_tools, ongoing_tools)

    def before(self, **kwargs) -> Dict[str, Any]:
        """
        在被勾的方法执行前调用

        按照 before_tools 顺序执行工具，入参和出参均为工具调用参数。
        支持动态入参，所有关键字参数会作为动态入参透传给每个工具。
        每个工具接收当前参数，若返回dict则合并到参数中，传递给下一个工具。

        Args:
            **kwargs: 工具调用参数（动态入参）

        Returns:
            Dict[str, Any]: （可能已修改的）工具调用参数
        """
        params = dict(kwargs)
        for tool in self.before_tools:
            try:
                result = tool.run(**params)
                if isinstance(result, dict):
                    params.update(result)
            except Exception as e:
                logger.error(f"before hook 工具 '{getattr(tool, 'name', tool)}' 执行失败: {e}", exc_info=True)
        return params

    def ongoing(self, intermediate_result: Any, **kwargs) -> Any:
        """
        在被勾的方法执行过程中调用

        按照 ongoing_tools 顺序执行工具，入参为执行过程中的中间结果。
        支持动态入参，所有关键字参数会作为动态入参透传给每个工具，
        与中间结果一起传递给 ongoing_tools 中的工具。

        Args:
            intermediate_result: 执行过程中的中间结果
            **kwargs: 动态入参

        Returns:
            Any: （可能已修改的）中间结果
        """
        result = intermediate_result
        for tool in self.ongoing_tools:
            try:
                result = tool.run(intermediate_result=result, **kwargs)
            except Exception as e:
                logger.error(f"ongoing hook 工具 '{getattr(tool, 'name', tool)}' 执行失败: {e}", exc_info=True)
        return result

    def after(self, result: Any) -> Any:
        """
        在被勾的方法执行后调用

        按照 after_tools 顺序执行工具，入参为工具执行结果。
        每个工具接收上一个工具的输出作为结果，依次传递。

        Args:
            result: 工具执行结果

        Returns:
            Any: （可能已修改的）工具执行结果
        """
        for tool in self.after_tools:
            try:
                result = tool.run(result=result)
            except Exception as e:
                logger.error(f"after hook 工具 '{getattr(tool, 'name', tool)}' 执行失败: {e}", exc_info=True)
        return result
