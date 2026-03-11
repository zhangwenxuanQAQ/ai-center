"""
测试API接口
"""
import urllib.request
import json

print("测试分类树接口...")
with urllib.request.urlopen("http://127.0.0.1:8081/aicenter/v1/chatbot_category/tree") as response:
    data = json.loads(response.read().decode())
    print(f"状态码: {response.status}")
    print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")

print("\n测试机器人列表接口...")
with urllib.request.urlopen("http://127.0.0.1:8081/aicenter/v1/chatbot?page=1&page_size=12") as response:
    data = json.loads(response.read().decode())
    print(f"状态码: {response.status}")
    print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
