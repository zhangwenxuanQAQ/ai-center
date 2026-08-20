from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from app.core.hooks.base_hook import BaseHook


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

    def run(self, **kwargs) -> Any:
        """
        执行工具（模板方法）

        按照以下顺序执行：
        1. 调用所有hooks的before方法，处理并可能修改工具调用参数
        2. 调用_run方法执行实际工具逻辑
        3. 调用所有hooks的after方法，处理并可能修改工具执行结果

        Args:
            **kwargs: 工具调用参数

        Returns:
            Any: 工具执行结果
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

    @abstractmethod
    def _run(self, **kwargs) -> Any:
        """
        执行实际工具逻辑（由子类实现）

        Args:
            **kwargs: 工具调用参数

        Returns:
            Any: 工具执行结果
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
