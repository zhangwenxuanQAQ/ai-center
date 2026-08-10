"""
HOOK机制模块

提供工具调用的钩子机制，支持在被勾的方法执行前、执行过程中、执行后插入工具调用。
    - BaseHook: 基础Hook类，定义before/ongoing/after三个钩子方法
    - ToolHook: 工具Hook类，继承自BaseHook，封装工具调用的前置、后置和过程中钩子
"""

from app.core.hooks.base_hook import BaseHook
from app.core.hooks.tool_hook import ToolHook

__all__ = ["BaseHook", "ToolHook"]
