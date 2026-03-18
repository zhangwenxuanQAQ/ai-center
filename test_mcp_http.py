"""测试MCP工具（使用HTTP请求）"""

import httpx
import json

async def test_mcp_tools():
    """测试MCP工具"""
    # MCP服务地址
    mcp_url = "http://127.0.0.1:8082/mcp"
    
    async with httpx.AsyncClient() as client:
        headers = {
            "Accept": "application/json, text/event-stream",
            "X-MCP-Server-ID": "test-server"
        }
        
        # 1. 获取工具列表
        list_tools_payload = {
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": 1
        }
        
        response = await client.post(mcp_url, json=list_tools_payload, headers=headers)
        print("工具列表响应:")
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        print()
        
        # 2. 测试获取当前时间工具
        get_time_payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "get_current_time",
                "arguments": {}
            },
            "id": 2
        }
        
        response = await client.post(mcp_url, json=get_time_payload, headers=headers)
        print("获取当前时间响应:")
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        print()
        
        # 3. 测试调用RESTful API工具
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
            "id": 3
        }
        
        response = await client.post(mcp_url, json=call_api_payload, headers=headers)
        print("调用RESTful API响应:")
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {response.text}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_mcp_tools())