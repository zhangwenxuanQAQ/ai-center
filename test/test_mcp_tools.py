"""测试MCP工具"""

import asyncio
from app.core.mcp.client.client import StreamableHttpClient

async def test_mcp_tools():
    """测试MCP工具"""
    # 创建MCP客户端
    client = StreamableHttpClient("http://127.0.0.1:8082/mcp")
    
    async with client.connect():
        # 获取工具列表
        tools = await client.list_tools()
        print("工具列表:")
        for tool in tools:
            print(f"- {tool.name}: {tool.description}")
        
        # 测试获取当前时间工具
        print("\n测试获取当前时间工具:")
        time_result = await client.call_tool("get_current_time", {})
        print(f"结果: {time_result}")

if __name__ == "__main__":
    asyncio.run(test_mcp_tools())