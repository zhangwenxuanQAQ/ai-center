# MCP SERVER

AI Center 项目的 MCP (Model Context Protocol) 服务实现。

## 概述

本模块使用 FastMCP 实现了一个符合 MCP 协议规范的服务端，支持以下功能：

- **SSE (Server-Sent Events)** 连接方式
- **Streamable HTTP** 连接方式
- **工具列表查询** (`tools/list`)
- **工具调用** (`tools/call`)

## 技术栈

- Python 3.10+
- FastMCP 3.1.0+

## 架构

```
app/core/mcp/
├── __init__.py      # 模块入口
├── server.py        # MCP服务核心实现（使用FastMCP）
├── tools.py         # 工具注册和执行模块
└── README.md        # 本文档
```

## 配置

MCP 服务配置位于 `configs/server_config.yaml`:

```yaml
mcp:
  host: '0.0.0.0'
  port: 8082
```

## 连接方式

### Streamable HTTP（默认）

MCP SERVER 默认使用 Streamable HTTP 传输方式：

```
http://localhost:8082/mcp
```

### SSE 连接

如需使用 SSE 传输方式，可在启动时指定：

```python
mcp.run(transport="sse", host="0.0.0.0", port=8082)
```

## 工具管理

### 工具来源

工具信息存储在数据库表 `mcp_tool` 中，每个工具关联一个 `mcp_server_id`。

### MCP TOOL 标准结构

```json
{
  "name": "string",
  "description": "string",
  "inputSchema": {
    "type": "object",
    "properties": { ... },
    "required": [ ... ]
  }
}
```

### 工具配置

工具的 `config` 字段支持以下执行器类型：

#### HTTP 执行器

```json
{
  "executor_type": "http",
  "url": "https://api.example.com/endpoint",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token"
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": {"type": "string"}
    },
    "required": ["param1"]
  }
}
```

#### 脚本执行器

```json
{
  "executor_type": "script",
  "script": "echo 'Hello World'"
}
```

## 内置工具

### echo

回显工具，用于测试连接：

```json
{
  "name": "echo",
  "arguments": {
    "message": "Hello"
  }
}
```

### get_server_info

获取服务器信息：

```json
{
  "name": "get_server_info",
  "arguments": {}
}
```

## 扩展工具

可以通过 `ToolRegistry` 注册自定义工具：

```python
from app.core.mcp.tools import ToolRegistry

# 注册内置工具
@ToolRegistry.register_builtin("my_tool")
async def my_tool_handler(arguments: dict) -> Any:
    return {"result": "success"}

# 注册HTTP工具
ToolRegistry.register_http(
    name="external_api",
    url="https://api.example.com/endpoint",
    method="POST",
    headers={"Authorization": "Bearer token"}
)
```

## 启动服务

MCP SERVER 随主应用一起启动：

```bash
python -m app.server_run
```

服务启动后会同时运行：
- FastAPI 服务：`http://0.0.0.0:8081`
- MCP SERVER (Streamable HTTP)：`http://0.0.0.0:8082/mcp`

## MCP协议方法

### initialize

初始化连接：

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {}
  },
  "id": 1
}
```

### tools/list

获取工具列表：

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

### tools/call

调用工具：

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": {"message": "Hello"}
  },
  "id": 3
}
```

## 请求头说明

| 请求头 | 说明 | 必填 |
|--------|------|------|
| X-MCP-Server-ID | MCP服务ID，用于获取该服务下的工具列表 | 是 |

## 错误处理

错误响应格式：

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "未知方法: unknown_method"
  },
  "id": null
}
```

错误码说明：

| 错误码 | 说明 |
|--------|------|
| -32700 | 无效的JSON |
| -32600 | 无效的请求 |
| -32601 | 方法不存在 |
| -32602 | 无效的参数 |
| -32603 | 内部错误 |
| -32000 | 工具执行错误 |

## 参考链接

- [FastMCP 官网](https://gofastmcp.com)
- [FastMCP GitHub](https://github.com/jlowin/fastmcp)
- [MCP 协议规范](https://modelcontextprotocol.io)
