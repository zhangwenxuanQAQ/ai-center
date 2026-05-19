#!/usr/bin/env python3
"""
测试知识库检索接口的相似度阈值过滤功能

验证问题：无论怎么设置similarity阈值，都返回了page_size条数据
"""

import sys
sys.path.append('.')

import json
import requests

BASE_URL = "http://10.9.44.5:8081/aicenter/v1"


def test_retrieval_with_threshold():
    """
    测试检索接口的相似度阈值过滤
    """
    kb_id = "ff1c2c31128c442eb95fd821f9907eee"
    question = "合格"
    
    test_cases = [
        {
            "name": "低阈值测试 (0.1)",
            "vector_similarity_threshold": 0.1,
            "keyword_similarity_threshold": 0.1,
        },
        {
            "name": "中阈值测试 (0.37)",
            "vector_similarity_threshold": 0.37,
            "keyword_similarity_threshold": 0.3,
        },
        {
            "name": "高阈值测试 (0.5)",
            "vector_similarity_threshold": 0.5,
            "keyword_similarity_threshold": 0.3,
        },
        {
            "name": "很高阈值测试 (0.7)",
            "vector_similarity_threshold": 0.7,
            "keyword_similarity_threshold": 0.5,
        },
        {
            "name": "极高阈值测试 (0.9)",
            "vector_similarity_threshold": 0.9,
            "keyword_similarity_threshold": 0.8,
        },
    ]
    
    print("=" * 80)
    print("知识库检索相似度阈值测试")
    print("=" * 80)
    print(f"知识库ID: {kb_id}")
    print(f"查询问题: {question}")
    print()
    
    for case in test_cases:
        print(f"\n{'='*60}")
        print(f"测试用例: {case['name']}")
        print(f"{'='*60}")
        
        request_body = {
            "kb_ids": [kb_id],
            "question": question,
            "page": 1,
            "page_size": 20,
            "top_k": 20,
            "vector_similarity_threshold": case["vector_similarity_threshold"],
            "keyword_similarity_threshold": case["keyword_similarity_threshold"],
            "vector_similarity_weight": 0.7,
            "sort_by": "sim"
        }
        
        print(f"请求参数:")
        print(f"  vector_similarity_threshold: {case['vector_similarity_threshold']}")
        print(f"  keyword_similarity_threshold: {case['keyword_similarity_threshold']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/knowledgebase/retrieval",
                json=request_body,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"接口返回: code={result.get('code')}, message={result.get('message')}")
                if result.get("code") in [0, "0", 200, "200"]:
                    data = result.get("data", {})
                    chunks = data.get("chunks", [])
                    total = data.get("total", 0)
                    
                    print(f"\n返回结果:")
                    print(f"  总数: {total}")
                    print(f"  返回切片数: {len(chunks)}")
                    
                    if chunks:
                        print(f"\n  各切片相似度详情:")
                        for i, chunk in enumerate(chunks):
                            similarity = chunk.get("similarity", 0)
                            vector_sim = chunk.get("vector_similarity", 0)
                            term_sim = chunk.get("term_similarity", 0)
                            print(f"    [{i+1:2d}] 混合相似度: {similarity:.4f}, 向量相似度: {vector_sim:.4f}, 关键词相似度: {term_sim:.4f}")
                        
                        min_vector_sim = min(c.get("vector_similarity", 0) for c in chunks)
                        max_vector_sim = max(c.get("vector_similarity", 0) for c in chunks)
                        min_keyword_sim = min(c.get("term_similarity", 0) for c in chunks)
                        max_keyword_sim = max(c.get("term_similarity", 0) for c in chunks)
                        min_mix_sim = min(c.get("similarity", 0) for c in chunks)
                        max_mix_sim = max(c.get("similarity", 0) for c in chunks)
                        
                        print(f"\n  相似度范围统计:")
                        print(f"    混合相似度: [{min_mix_sim:.4f}, {max_mix_sim:.4f}] (期望: [0, 1])")
                        print(f"    向量相似度: [{min_vector_sim:.4f}, {max_vector_sim:.4f}] (期望: [0, 1])")
                        print(f"    关键词相似度: [{min_keyword_sim:.4f}, {max_keyword_sim:.4f}] (期望: [0, 1])")
                        
                        range_issues = []
                        if min_vector_sim < 0 or max_vector_sim > 1:
                            range_issues.append(f"向量相似度超出[0,1]范围")
                        if min_keyword_sim < 0 or max_keyword_sim > 1:
                            range_issues.append(f"关键词相似度超出[0,1]范围")
                        if min_mix_sim < 0 or max_mix_sim > 1:
                            range_issues.append(f"混合相似度超出[0,1]范围")
                        
                        vector_violations = sum(1 for c in chunks if c.get("vector_similarity", 0) < case["vector_similarity_threshold"])
                        keyword_violations = sum(1 for c in chunks if c.get("term_similarity", 0) < case["keyword_similarity_threshold"])
                        
                        print(f"\n  阈值违规统计:")
                        print(f"    向量相似度低于阈值: {vector_violations} 条")
                        print(f"    关键词相似度低于阈值: {keyword_violations} 条")
                        
                        if range_issues:
                            print(f"\n  ⚠️  相似度范围问题: {', '.join(range_issues)}")
                        if vector_violations > 0 or keyword_violations > 0:
                            print(f"\n  ⚠️  阈值过滤问题: 有 {vector_violations + keyword_violations} 条数据不满足阈值条件但仍被返回!")
                        if not range_issues and vector_violations == 0 and keyword_violations == 0:
                            print(f"\n  ✓  相似度范围和阈值过滤均正常")
                else:
                    print(f"接口返回错误: {result.get('message')}")
            else:
                print(f"HTTP错误: {response.status_code}")
                print(f"响应内容: {response.text}")
                
        except Exception as e:
            print(f"请求失败: {e}")


def test_direct_es_query():
    """
    直接测试ES查询，查看原始数据
    """
    print("\n" + "=" * 80)
    print("直接查询ES索引，查看原始数据")
    print("=" * 80)
    
    kb_id = "ff1c2c31128c442eb95fd821f9907eee"
    
    try:
        from app.database.es_utils import es_utils
        from app.database.database import db
        
        db.connect()
        
        if not es_utils.is_available:
            print("ES不可用")
            return
        
        index_name = kb_id
        if not es_utils.client.indices.exists(index=index_name):
            print(f"索引 {index_name} 不存在")
            return
        
        result = es_utils.client.search(
            index=index_name,
            body={
                "query": {"match_all": {}},
                "size": 5
            }
        )
        
        hits = result.get('hits', {}).get('hits', [])
        print(f"索引 {index_name} 中有 {result.get('hits', {}).get('total', {}).get('value', 0)} 条数据")
        print(f"\n前5条数据示例:")
        for i, hit in enumerate(hits):
            source = hit.get('_source', {})
            print(f"\n[{i+1}] ID: {hit.get('_id')}")
            print(f"    content: {source.get('content', '')[:100]}...")
            print(f"    doc_id: {source.get('doc_id')}")
            print(f"    kb_id: {source.get('kb_id')}")
            
        db.close()
        
    except Exception as e:
        print(f"查询ES失败: {e}")


if __name__ == "__main__":
    test_retrieval_with_threshold()
    test_direct_es_query()
