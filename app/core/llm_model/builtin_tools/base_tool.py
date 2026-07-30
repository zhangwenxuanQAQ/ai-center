from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BuiltinToolParam:
    """Tool parameter definition."""

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


class BuiltinTool(ABC):
    """Base class for all builtin tools."""

    name: str = ""
    title: str = ""
    description: str = ""
    params: List[BuiltinToolParam] = []

    @abstractmethod
    def run(self, **kwargs) -> Any:
        raise NotImplementedError("Subclass must implement run()")

    def get_required_params(self) -> List[str]:
        return [p.name for p in self.params if p.required]

    def get_default_params(self) -> Dict[str, Any]:
        return {p.name: p.default for p in self.params if p.default is not None}

    def validate_params(self, **kwargs) -> Optional[str]:
        missing = [p.name for p in self.params if p.required and p.name not in kwargs]
        if missing:
            return f"Missing required params: {",".join(missing)}"
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
