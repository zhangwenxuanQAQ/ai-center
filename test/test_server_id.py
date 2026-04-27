import httpx
import json

async def test_server_id_in_header():
    url = "http://127.0.0.1:8082/mcp"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "X-MCP-Server-ID": "1"  # 测试从请求头传递server_id
    }
    
    async with httpx.AsyncClient() as client:
        # 先发送初始化请求
        init_data = {
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {}
            },
            "id": 1
        }
        
        init_response = await client.post(url, json=init_data, headers=headers)
        print("Init status code:", init_response.status_code)
        print("Init response:", init_response.text)
        
        # 然后发送工具调用请求
        call_data = {
            "jsonrpc": "2.0",
            "id": "2",
            "method": "tools/call",
            "params": {
                "name": "get_current_time",
                "arguments": {}
            }
        }
        
        call_response = await client.post(url, json=call_data, headers=headers)
        print("Call status code:", call_response.status_code)
        print("Call response:", call_response.text)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_server_id_in_header())
