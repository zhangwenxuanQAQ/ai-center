"""
基础Hook类

定义Hook机制的基础抽象类，提供在被勾的方法执行前、执行过程中、执行后
插入工具调用的能力。

子类需要实现 before、ongoing、after 三个方法：
    - before: 在被勾的方法执行前调用，可修改入参
    - ongoing: 在被勾的方法执行过程中调用，处理中间结果
    - after: 在被勾的方法执行后调用，可修改出参
"""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from app.core.tools.base_tool import BaseTool


class BaseHook(ABC):
    """
    基础Hook类

    通过 before_tools、after_tools、ongoing_tools 三个列表，
    分别存储在被勾的方法执行前、执行后、执行过程中需要调用的工具。

    Attributes:
        before_tools: 在被勾的方法执行前调用的工具列表
        after_tools: 在被勾的方法执行后调用的工具列表
        ongoing_tools: 在被勾的方法执行过程中调用的工具列表
    """

    def __init__(
        self,
        before_tools: Optional[List["BaseTool"]] = None,
        after_tools: Optional[List["BaseTool"]] = None,
        ongoing_tools: Optional[List["BaseTool"]] = None
    ):
        """
        初始化基础Hook

        Args:
            before_tools: 在被勾的方法执行前调用的工具列表
            after_tools: 在被勾的方法执行后调用的工具列表
            ongoing_tools: 在被勾的方法执行过程中调用的工具列表
        """
        self.before_tools: List["BaseTool"] = before_tools or []
        self.after_tools: List["BaseTool"] = after_tools or []
        self.ongoing_tools: List["BaseTool"] = ongoing_tools or []

    @abstractmethod
    def before(self, **kwargs) -> Dict[str, Any]:
        """
        在被勾的方法执行前调用

        子类需实现此方法，按照 before_tools 顺序执行工具，
        入参和出参均为工具调用的参数。支持动态入参，所有关键字参数
        均会作为动态入参透传给 before_tools 中的工具。

        Args:
            **kwargs: 工具调用参数（动态入参）

        Returns:
            Dict[str, Any]: （可能已修改的）工具调用参数
        """
        raise NotImplementedError("Subclass must implement before()")

    @abstractmethod
    def ongoing(self, intermediate_result: Any, **kwargs) -> Any:
        """
        在被勾的方法执行过程中调用

        子类需实现此方法，按照 ongoing_tools 顺序执行工具，
        入参为执行过程中的中间结果。支持动态入参，所有关键字参数
        均会作为动态入参透传给 ongoing_tools 中的工具。

        Args:
            intermediate_result: 执行过程中的中间结果
            **kwargs: 动态入参

        Returns:
            Any: （可能已修改的）中间结果
        """
        raise NotImplementedError("Subclass must implement ongoing()")

    @abstractmethod
    def after(self, result: Any) -> Any:
        """
        在被勾的方法执行后调用

        子类需实现此方法，按照 after_tools 顺序执行工具，
        入参为工具执行结果。

        Args:
            result: 工具执行结果

        Returns:
            Any: （可能已修改的）工具执行结果
        """
        raise NotImplementedError("Subclass must implement after()")
