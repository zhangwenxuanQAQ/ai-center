from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union

if TYPE_CHECKING:
    from app.core.hooks.base_hook import BaseHook


class ToolResult:
    """
    工具统一返回结果类

    所有内置工具的_run方法应返回ToolResult实例，
    用于统一工具执行结果的格式，便于前端和调用方处理。

    Attributes:
        status: 执行状态，"success" | "error"
        result: 工具执行的实际结果数据
        message: 执行结果的描述信息
        error: 错误信息（仅在status为error时使用）
        metadata: 附加元数据（如耗时、数据源ID等）
    """

    def __init__(
        self,
        status: str = "success",
        result: Any = None,
        message: str = "",
        error: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.status = status
        self.result = result
        self.message = message
        self.error = error
        self.metadata = metadata or {}

    @property
    def success(self) -> bool:
        """是否执行成功"""
        return self.status == "success"

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "status": self.status,
            "result": self.result,
            "message": self.message,
            "error": self.error,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ToolResult":
        """从字典创建实例"""
        return cls(
            status=data.get("status", "success"),
            result=data.get("result"),
            message=data.get("message", ""),
            error=data.get("error", ""),
            metadata=data.get("metadata", {}),
        )

    @classmethod
    def ok(cls, result: Any = None, message: str = "", **metadata) -> "ToolResult":
        """创建成功结果"""
        return cls(
            status="success",
            result=result,
            message=message or "执行成功",
            metadata=metadata,
        )

    @classmethod
    def error(cls, message: str, error: str = "", result: Any = None, **metadata) -> "ToolResult":
        """创建错误结果"""
        return cls(
            status="error",
            result=result,
            message=message,
            error=error or message,
            metadata=metadata,
        )

    def __repr__(self) -> str:
        return f"ToolResult(status={self.status!r}, message={self.message!r})"

    def __eq__(self, other) -> bool:
        if not isinstance(other, ToolResult):
            return NotImplemented
        return (
            self.status == other.status
            and self.result == other.result
            and self.message == other.message
            and self.error == other.error
        )


class BaseToolParam:
    """工具参数定义"""

    def __init__(self, name: str, type: str = "string", description: str = "", required: bool = False, default=None, enum=None):
        self.name = name
        self.type = type
        self.description = description
        self.required = required
        self.default = default
        self.enum = enum

    def to_json_schema(self) -> Dict[str, Any]:
        schema: Dict[str, Any] = {"type": self.type, "description": self.description}
        if self.enum:
            schema["enum"] = self.enum
        if self.default is not None:
            schema["default"] = self.default
        return schema


class BaseTool(ABC):
    """所有工具的基类"""

    name: str = ""
    title: str = ""
    description: str = ""
    params: List[BaseToolParam] = []
    hooks: List["BaseHook"] = []

    def __init__(self):
        from datetime import datetime
        self.created_at = datetime.now().isoformat()

    def run(self, **kwargs) -> Union[ToolResult, Any]:
        """
        执行工具（模板方法）

        按照以下顺序执行：
        1. 调用所有hooks的before方法，处理并可能修改工具调用参数
        2. 调用_run方法执行实际工具逻辑
        3. 调用所有hooks的after方法，处理并可能修改工具执行结果

        Args:
            **kwargs: 工具调用参数

        Returns:
            Union[ToolResult, Any]: 工具执行结果（推荐使用ToolResult）
        """
        # 1. 执行before hooks，处理入参
        for hook in self.hooks:
            try:
                kwargs = hook.before(**kwargs)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(
                    f"hook.before 执行失败: {e}", exc_info=True
                )

        # 2. 执行实际工具逻辑
        result = self._run(**kwargs)

        # 3. 执行after hooks，处理出参
        for hook in self.hooks:
            try:
                result = hook.after(result)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(
                    f"hook.after 执行失败: {e}", exc_info=True
                )

        return result

    def _success(self, result: Any = None, message: str = "", **metadata) -> ToolResult:
        """创建成功的工具执行结果（便捷方法）"""
        return ToolResult.ok(result=result, message=message, **metadata)

    def _error(self, message: str, error: str = "", result: Any = None, **metadata) -> ToolResult:
        """创建错误的工具执行结果（便捷方法）"""
        return ToolResult.error(message=message, error=error, result=result, **metadata)

    @abstractmethod
    def _run(self, **kwargs) -> Union[ToolResult, Any]:
        """
        执行实际工具逻辑（由子类实现）

        Args:
            **kwargs: 工具调用参数

        Returns:
            Union[ToolResult, Any]: 工具执行结果，推荐返回ToolResult实例
        """
        raise NotImplementedError("Subclass must implement _run()")

    def get_required_params(self) -> List[str]:
        return [p.name for p in self.params if p.required]

    def get_default_params(self) -> Dict[str, Any]:
        return {p.name: p.default for p in self.params if p.default is not None}

    def validate_params(self, **kwargs) -> Optional[str]:
        missing = [p.name for p in self.params if p.required and p.name not in kwargs]
        if missing:
            return f"Missing required params: {','.join(missing)}"
        return None

    def to_openai_tool(self) -> Dict[str, Any]:
        properties = {}
        required = []
        for param in self.params:
            properties[param.name] = param.to_json_schema()
            if param.required:
                required.append(param.name)
        # 注入公共参数，与 MCP/知识库工具保持一致
        properties['task_name'] = {
            'type': 'string',
            'description': '给本次操作起一个简短的任务名称'
        }
        properties['reasoning_content'] = {
            'type': 'string',
            'description': '为何选择并使用本工具，返回思考过程'
        }
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {"type": "object", "properties": properties, "required": required},
            },
        }
