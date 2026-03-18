import httpx
import json

async def test_get_current_time():
    url = "http://127.0.0.1:8082/mcp"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    # 使用正确的JSON-RPC格式
    data = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "call",
        "params": {
            "name": "get_current_time",
            "arguments": {}
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        print("Status code:", response.status_code)
        print("Response:", response.text)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_get_current_time())
