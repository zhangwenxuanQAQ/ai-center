"""
测试分类树查询过滤已删除数据
"""
import urllib.request
import json

print("测试分类树查询...")
try:
    with urllib.request.urlopen("http://127.0.0.1:8081/aicenter/v1/chatbot_category/tree") as response:
        data = json.loads(response.read().decode())
        print(f"状态码: {response.status}")
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        # 检查返回的分类数量
        if data.get('code') == 200:
            categories = data.get('data', [])
            print(f"\n返回的分类数量: {len(categories)}")
            
            # 检查是否有已删除的分类
            def check_deleted(categories):
                for cat in categories:
                    if cat.get('deleted', False):
                        print(f"错误: 发现已删除的分类: {cat['name']}")
                        return True
                    if cat.get('children'):
                        if check_deleted(cat['children']):
                            return True
                return False
            
            if not check_deleted(categories):
                print("✓ 所有返回的分类都是未删除的")
        else:
            print(f"错误: {data.get('message')}")
except Exception as e:
    print(f"错误: {e}")
