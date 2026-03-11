"""
测试MCP服务接口 - 使用正确的HTTP方法
"""
import urllib.request
import json

print("测试MCP服务接口...")
print("访问地址: http://127.0.0.1:8081/mcp")

# MCP streamable-http需要使用POST方法
print("\n测试POST请求到 /mcp...")
try:
    req = urllib.request.Request(
        "http://127.0.0.1:8081/mcp",
        data=json.dumps({}).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
        },
        method='POST'
    )
    with urllib.request.urlopen(req) as response:
        data = response.read().decode()
        print(f"状态码: {response.status}")
        print(f"响应: {data}")
except urllib.error.HTTPError as e:
    print(f"HTTP错误: {e.code} - {e.reason}")
    print(f"响应内容: {e.read().decode()}")
except Exception as e:
    print(f"错误: {e}")

# 测试GET请求
print("\n测试GET请求到 /mcp...")
try:
    req = urllib.request.Request(
        "http://127.0.0.1:8081/mcp",
        headers={
            'Accept': 'text/event-stream',
        },
        method='GET'
    )
    with urllib.request.urlopen(req, timeout=2) as response:
        data = response.read(100).decode()  # 只读取前100字节
        print(f"状态码: {response.status}")
        print(f"响应头: {response.headers}")
        print(f"响应内容（前100字节）: {data}")
except urllib.error.HTTPError as e:
    print(f"HTTP错误: {e.code} - {e.reason}")
    print(f"响应内容: {e.read().decode()}")
except Exception as e:
    print(f"错误: {e}")
