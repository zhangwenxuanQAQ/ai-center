#!/usr/bin/env python3
"""
检查ES中是否真的有向量字段
"""
import sys
sys.path.insert(0, 'e:\\project_git\\ai-center-zwx\\ai-center')

from app.database.es_utils import es_utils

def check_vector_field_in_es():
    """检查ES中的向量字段"""
    
    kb_id = "ff1c2c31128c442eb95fd821f9907eee"
    doc_id = "8dbf925deb0a4c2c99ea8bfdf6e911bb"
    
    if not es_utils.is_available:
        print("❌ ES不可用")
        return False
    
    print("=" * 80)
    print("1. 检查ES索引映射")
    print("=" * 80)
    
    try:
        mapping = es_utils.client.indices.get_mapping(index=kb_id)
        print(f"\n索引 {kb_id} 的映射:")
        
        if kb_id in mapping:
            mappings = mapping[kb_id]['mappings']
            if 'properties' in mappings:
                print("\n字段属性:")
                for field_name, field_props in mappings['properties'].items():
                    if 'dense_vector' in str(field_props) or 'vec' in field_name.lower():
                        print(f"  ✅ {field_name}: {field_props}")
                    elif field_name.startswith("q_") and field_name.endswith("_vec"):
                        print(f"  ✅ {field_name}: {field_props}")
        else:
            print(f"索引 {kb_id} 不存在")
            return False
    except Exception as e:
        print(f"❌ 获取映射失败: {e}")
        return False
    
    print("\n" + "=" * 80)
    print("2. 使用docvalue_fields查询向量字段")
    print("=" * 80)
    
    try:
        # 使用docvalue_fields来查询向量字段
        query = {
            "query": {
                "term": {"doc_id": doc_id}
            },
            "size": 1,
            "docvalue_fields": ["q_*_vec"]  # 使用通配符匹配所有向量字段
        }
        
        response = es_utils.client.search(index=kb_id, body=query)
        
        if response['hits']['hits']:
            hit = response['hits']['hits'][0]
            print(f"\n找到文档: {hit['_id']}")
            
            # 检查fields字段（docvalue_fields返回的结果）
            if 'fields' in hit:
                print(f"\nfields字段内容:")
                for field_name, field_value in hit['fields'].items():
                    print(f"  - {field_name}: {field_value}")
            else:
                print(f"\n❌ 没有fields字段")
            
            # 检查_source字段
            source = hit['_source']
            print(f"\n_source字段列表:")
            for key in sorted(source.keys()):
                if key.startswith("q_") and key.endswith("_vec"):
                    print(f"  ✅ {key}: [向量字段]")
                else:
                    print(f"  - {key}")
        else:
            print(f"\n❌ 未找到文档: {doc_id}")
            return False
            
    except Exception as e:
        print(f"❌ 查询数据失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 80)
    print("3. 使用script_fields查询向量字段")
    print("=" * 80)
    
    try:
        # 使用script_fields来查询向量字段
        query = {
            "query": {
                "term": {"doc_id": doc_id}
            },
            "size": 1,
            "script_fields": {
                "q_1024_vec": {
                    "script": {
                        "source": "doc['q_1024_vec']"
                    }
                }
            }
        }
        
        response = es_utils.client.search(index=kb_id, body=query)
        
        if response['hits']['hits']:
            hit = response['hits']['hits'][0]
            print(f"\n找到文档: {hit['_id']}")
            
            # 检查fields字段（script_fields返回的结果）
            if 'fields' in hit:
                print(f"\nscript_fields结果:")
                for field_name, field_value in hit['fields'].items():
                    if isinstance(field_value, list) and len(field_value) > 0:
                        if isinstance(field_value[0], list):
                            print(f"  ✅ {field_name}: [向量, 长度={len(field_value[0])}]")
                        else:
                            print(f"  - {field_name}: {field_value[:5]}...")
                    else:
                        print(f"  - {field_name}: {field_value}")
            else:
                print(f"\n❌ 没有fields字段")
            
    except Exception as e:
        print(f"❌ 使用script_fields查询失败: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("4. 直接查询文档（不使用_source过滤）")
    print("=" * 80)
    
    try:
        # 直接获取文档
        response = es_utils.client.get(index=kb_id, id=hit['_id'])
        
        print(f"\n文档ID: {response['_id']}")
        source = response['_source']
        
        print(f"\n_source中的所有字段:")
        for key in sorted(source.keys()):
            if key.startswith("q_") and key.endswith("_vec"):
                value = source[key]
                if isinstance(value, list):
                    print(f"  ✅ {key}: [向量, 长度={len(value)}]")
                else:
                    print(f"  - {key}: {value}")
            else:
                print(f"  - {key}")
        
    except Exception as e:
        print(f"❌ 直接查询文档失败: {e}")
        import traceback
        traceback.print_exc()
    
    return True

if __name__ == "__main__":
    check_vector_field_in_es()
