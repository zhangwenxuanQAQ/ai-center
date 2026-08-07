"""
工具箱常量定义
定义支持的工具类型及默认分类
"""

# 工具类型
TOOL_TYPE = {
    "mcp": "mcp",
    "api": "api",
    "code_script": "code_script",
    "builtin_tool": "builtin_tool",
}

# 工具类型显示名称
TOOL_TYPE_NAME = {
    "mcp": "MCP服务",
    "api": "API接口",
    "code_script": "代码脚本",
    "builtin_tool": "内置工具",
}

# 默认顶级分类（根据工具类型生成）
DEFAULT_TOOLKIT_CATEGORIES = [
    {"name": "MCP服务", "type": "mcp", "sort_order": 1},
    {"name": "API接口", "type": "api", "sort_order": 2},
    {"name": "代码脚本", "type": "code_script", "sort_order": 3},
    {"name": "内置工具", "type": "builtin_tool", "sort_order": 4},
]
