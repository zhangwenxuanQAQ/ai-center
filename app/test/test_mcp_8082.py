"""
测试MCP服务在8082端口
"""
import urllib.request
import json

print("测试MCP服务在8082端口...")
print("访问地址: http://127.0.0.1:8082/mcp")

# 测试POST请求
print("\n测试POST请求到 /mcp...")
try:
    req = urllib.request.Request(
        "http://127.0.0.1:8082/mcp",
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
        "http://127.0.0.1:8082/mcp",
        headers={
            'Accept': 'text/event-stream',
        },
        method='GET'
    )
    with urllib.request.urlopen(req, timeout=2) as response:
        data = response.read(100).decode()
        print(f"状态码: {response.status}")
        print(f"响应头: {response.headers}")
        print(f"响应内容（前100字节）: {data}")
except urllib.error.HTTPError as e:
    print(f"HTTP错误: {e.code} - {e.reason}")
    print(f"响应内容: {e.read().decode()}")
except Exception as e:
    print(f"错误: {e}")

print("\n测试后端API...")
try:
    with urllib.request.urlopen("http://127.0.0.1:8081/") as response:
        data = response.read().decode()
        print(f"状态码: {response.status}")
        print(f"响应: {data}")
except Exception as e:
    print(f"错误: {e}")
