"""测试MCP工具（使用SSE连接）"""

import httpx
import json
import asyncio

async def test_mcp_tools():
    """测试MCP工具"""
    # MCP服务地址
    mcp_url = "http://127.0.0.1:8082/mcp"
    
    async with httpx.AsyncClient() as client:
        # 建立SSE连接
        headers = {
            "Accept": "application/json, text/event-stream",
            "X-MCP-Server-ID": "test-server"
        }
        
        # 发送初始化请求
        init_payload = {
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {}
            },
            "id": 1
        }
        
        # 使用流式请求
        async with client.stream('POST', mcp_url, json=init_payload, headers=headers) as response:
            print("初始化响应:")
            async for line in response.aiter_lines():
                if line:
                    print(line)
            print()
        
        # 发送获取工具列表请求
        list_tools_payload = {
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": 2
        }
        
        async with client.stream('POST', mcp_url, json=list_tools_payload, headers=headers) as response:
            print("工具列表响应:")
            async for line in response.aiter_lines():
                if line:
                    print(line)
            print()
        
        # 发送获取当前时间请求
        get_time_payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "get_current_time",
                "arguments": {}
            },
            "id": 3
        }
        
        async with client.stream('POST', mcp_url, json=get_time_payload, headers=headers) as response:
            print("获取当前时间响应:")
            async for line in response.aiter_lines():
                if line:
                    print(line)
            print()
        
        # 发送调用RESTful API请求
        call_api_payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "call_restful_api",
                "arguments": {
                    "url": "https://jsonplaceholder.typicode.com/todos/1",
                    "method": "GET"
                }
            },
            "id": 4
        }
        
        async with client.stream('POST', mcp_url, json=call_api_payload, headers=headers) as response:
            print("调用RESTful API响应:")
            async for line in response.aiter_lines():
                if line:
                    print(line)
            print()

if __name__ == "__main__":
    asyncio.run(test_mcp_tools())