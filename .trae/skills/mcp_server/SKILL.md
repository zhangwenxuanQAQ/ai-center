---
name: mcp_server
description: 根据标准的MCP协议规范搭建自己的MCP SERVER
---

## 使用场景
- 开发自己的MCP SERVER
- 设置数据库连接以及数据模型
- 数据库交互
- 实现用户管理以及登录认证
- 集成第三方服务等
- 业务逻辑编写

## 技术栈
- Python 3.10+
- FastMCP

## 需要满足如下要求
1.需要支持sse和streamable http两种连接方式
2.需要实现list_tools以及call_tool方法
3.项目启动时启动该MCP SERVER，服务端口配置在server_config.yaml
```

### 代码实现
1.在core/mcp目录下实现代码（可创建子目录）
2.生成mcp功能的README.md
3.list_tools方法中工具来源来自表 mcp_tool。mcp_server_id来自连接服务时的请求头


##MCP TOOL标准结构定义：
```
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

##服务传输类型是Stdio时，npx命令格式是(以高德地图为例)：
```
{
  "mcpServers": {
    "amap-maps": {
      "args": [
        "-y",
        "@amap/amap-maps-mcp-server"
      ],
      "command": "npx",
      "env": {
        "AMAP_MAPS_API_KEY": ""
      }
    }
  }
}
```

##stdio 连接代码示例
```
import asyncio
from fastmcp import FastMCP

async def main():
    mcp = FastMCP()
    await mcp.connect("stdio")
    await mcp.start()

if __name__ == "__main__":
    asyncio.run(main())
```