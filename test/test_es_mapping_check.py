#!/usr/bin/env python3
"""
检查ES索引映射和数据
"""
import sys
sys.path.insert(0, 'e:\\project_git\\ai-center-zwx\\ai-center')

from app.database.es_utils import es_utils

def check_es_mapping_and_data():
    """检查ES索引映射和数据"""
    
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
                    print(f"  - {field_name}: {field_props}")
            else:
                print("\n使用动态模板")
                if 'dynamic_templates' in mappings:
                    for template in mappings['dynamic_templates']:
                        print(f"  - {template}")
        else:
            print(f"索引 {kb_id} 不存在")
            return False
    except Exception as e:
        print(f"❌ 获取映射失败: {e}")
        return False
    
    print("\n" + "=" * 80)
    print("2. 检查ES中的数据")
    print("=" * 80)
    
    try:
        query = {
            "query": {
                "term": {"doc_id": doc_id}
            },
            "size": 1
        }
        
        response = es_utils.client.search(index=kb_id, body=query)
        
        if response['hits']['hits']:
            hit = response['hits']['hits'][0]
            source = hit['_source']
            
            print(f"\n找到文档: {hit['_id']}")
            print(f"\n文档字段列表:")
            for key in sorted(source.keys()):
                value = source[key]
                if isinstance(value, list) and len(value) > 10:
                    print(f"  - {key}: [数组, 长度={len(value)}]")
                elif isinstance(value, str) and len(value) > 100:
                    print(f"  - {key}: {value[:100]}...")
                else:
                    print(f"  - {key}: {value}")
            
            print("\n" + "=" * 80)
            print("3. 检查向量字段")
            print("=" * 80)
            
            vector_fields = [key for key in source.keys() if key.startswith("q_") and key.endswith("_vec")]
            
            if vector_fields:
                print(f"\n✅ 找到向量字段: {vector_fields}")
                for field in vector_fields:
                    vector = source[field]
                    print(f"  - {field}: 长度={len(vector)}, 前5个值={vector[:5]}")
            else:
                print(f"\n❌ 未找到向量字段 (q_*_vec)")
                print(f"   所有字段: {list(source.keys())}")
        else:
            print(f"\n❌ 未找到文档: {doc_id}")
            return False
            
    except Exception as e:
        print(f"❌ 查询数据失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    check_es_mapping_and_data()
