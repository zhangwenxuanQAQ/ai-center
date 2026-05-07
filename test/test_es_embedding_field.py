#!/usr/bin/env python3
"""
测试ES中是否正确包含 q_{vector_size}_vec 字段
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import requests
from app.core.knowledgebase.rag.settings import settings
from app.core.utils import es_utils

# 配置
BASE_URL = "http://10.9.44.5:8081"
KB_ID = "ff1c2c31128c442eb95fd821f9907eee"
DOC_ID = "8dbf925deb0a4c2c99ea8bfdf6e911bb"

def check_es_for_document():
    """检查ES中是否包含该文档的切片"""
    print(f"正在检查知识库 {KB_ID} 的索引...")
    
    if not es_utils.is_available:
        print("❌ Elasticsearch不可用")
        return False
    
    try:
        # 检查索引是否存在
        index_exists = es_utils.es.indices.exists(index=KB_ID)
        if not index_exists:
            print(f"❌ 索引 {KB_ID} 不存在")
            return False
        
        print(f"✅ 索引 {KB_ID} 存在")
        
        # 搜索属于该文档的切片
        query = {
            "query": {
                "term": {
                    "doc_id": DOC_ID
                }
            },
            "size": 100
        }
        
        response = es_utils.es.search(index=KB_ID, body=query)
        total_hits = response['hits']['total']['value']
        
        if total_hits == 0:
            print(f"❌ ES中没有找到文档 {DOC_ID} 的切片")
            return False
        
        print(f"✅ 找到 {total_hits} 个切片")
        
        # 检查每个切片是否有 q_*_vec 字段
        has_vector_field = False
        vector_field_name = None
        
        for hit in response['hits']['hits']:
            source = hit['_source']
            
            # 查找 q_*_vec 字段
            for key in source.keys():
                if key.startswith("q_") and key.endswith("_vec"):
                    has_vector_field = True
                    vector_field_name = key
                    
                    print(f"✅ 找到向量字段: {key}")
                    print(f"   维度长度: {len(source[key])}")
                    print(f"   示例值: {source[key][:3]}...")
                    break
            
            if vector_field_name:
                break
        
        if not has_vector_field:
            print(f"❌ 切片中缺少 q_{{vector_size}}_vec 字段!")
            print(f"   切片字段列表: {list(response['hits']['hits'][0]['_source'].keys())}")
            return False
        
        print(f"✅ 测试通过! 向量字段 {vector_field_name} 已正确存储")
        return True
        
    except Exception as e:
        print(f"❌ 检查ES时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def check_document_status():
    """检查文档状态"""
    print(f"\n正在检查文档 {DOC_ID} 的状态...")
    
    try:
        url = f"{BASE_URL}/aicenter/v1/knowledgebase/{KB_ID}/document/{DOC_ID}"
        response = requests.get(url)
        
        if response.status_code != 200:
            print(f"❌ 获取文档失败: {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get("code") != 0:
            print(f"❌ API返回错误: {data.get('message')}")
            return False
        
        doc = data.get("data")
        print(f"✅ 文档状态: {doc.get('running_status')}")
        print(f"   进度: {doc.get('task_progress')}")
        print(f"   切片数: {doc.get('chunk_num')}")
        print(f"   token数: {doc.get('token_num')}")
        
        return True
        
    except Exception as e:
        print(f"❌ 检查文档状态时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def run_document_task():
    """触发文档任务执行"""
    print(f"\n正在触发文档 {DOC_ID} 的任务执行...")
    
    try:
        url = f"{BASE_URL}/aicenter/v1/knowledgebase/{KB_ID}/document/{DOC_ID}/run"
        response = requests.post(url)
        
        if response.status_code != 200:
            print(f"❌ 触发任务失败: {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get("code") != 0:
            print(f"❌ API返回错误: {data.get('message')}")
            return False
        
        print(f"✅ 任务已成功触发")
        print(f"   任务ID: {data.get('data', {}).get('task_id')}")
        
        return True
        
    except Exception as e:
        print(f"❌ 触发任务时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("ES向量字段测试脚本")
    print("=" * 60)
    print(f"知识库ID: {KB_ID}")
    print(f"文档ID: {DOC_ID}")
    print()
    
    # 步骤1: 先检查当前ES中的状态
    print("步骤1: 检查ES中现有数据...")
    check_es_for_document()
    
    print("\n" + "=" * 60)
    
    # 步骤2: 检查文档状态
    print("\n步骤2: 检查文档当前状态...")
    check_document_status()
    
    print("\n" + "=" * 60)
    
    # 步骤3: 询问是否重新执行任务
    choice = input("\n是否重新执行文档任务以验证修复? (y/n): ").strip().lower()
    
    if choice == 'y':
        print("\n步骤3: 重新触发文档任务...")
        success = run_document_task()
        
        if success:
            print("\n" + "=" * 60)
            print("\n提示: 请等待任务执行完成后，再次运行此脚本检查ES数据")
            print("=" * 60)

if __name__ == "__main__":
    main()
