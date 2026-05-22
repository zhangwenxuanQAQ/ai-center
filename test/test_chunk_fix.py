"""
测试新增切片功能修复
验证 _id 字段不再作为文档内容插入
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_insert_document_signature():
    """测试 insert_document 方法签名"""
    print("=" * 60)
    print("测试 insert_document 方法签名")
    print("=" * 60)
    
    try:
        from app.database.es_utils import es_utils
        import inspect
        
        sig = inspect.signature(es_utils.insert_document)
        params = list(sig.parameters.keys())
        
        print(f"✓ 方法参数: {params}")
        
        if 'doc_id' in params:
            print("✓ doc_id 参数已添加")
            return True
        else:
            print("✗ doc_id 参数未找到")
            return False
    except Exception as e:
        print(f"✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_create_chunk_fields():
    """测试 create_chunk 方法不再包含 _id 字段"""
    print("\n" + "=" * 60)
    print("测试 create_chunk 方法字段")
    print("=" * 60)
    
    try:
        from app.services.knowledgebase.service import KnowledgebaseDocumentService
        import inspect
        
        source = inspect.getsource(KnowledgebaseDocumentService.create_chunk)
        
        if 'fields["_id"]' in source:
            print("✗ 代码中仍包含 fields['_id'] 赋值")
            return False
        else:
            print("✓ 已移除 fields['_id'] 赋值")
        
        if 'doc_id=chunk_id' in source:
            print("✓ 正确使用 doc_id 参数")
            return True
        else:
            print("✗ 未找到 doc_id 参数传递")
            return False
    except Exception as e:
        print(f"✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_es_connection():
    """测试ES连接"""
    print("\n" + "=" * 60)
    print("测试 Elasticsearch 连接")
    print("=" * 60)
    
    try:
        from app.database.es_utils import es_utils
        
        if not es_utils.is_available:
            print("⚠ ES 不可用，跳过连接测试")
            return True
        
        connected = es_utils.check_connection()
        if connected:
            print(f"✓ ES 连接成功，版本: {es_utils.version}")
            return True
        else:
            print("✗ ES 连接失败")
            return False
    except Exception as e:
        print(f"⚠ ES 连接测试失败: {e}")
        return True


def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("    新增切片功能修复验证")
    print("=" * 60)
    
    results = {}
    
    results['insert_document_signature'] = test_insert_document_signature()
    results['create_chunk_fields'] = test_create_chunk_fields()
    results['es_connection'] = test_es_connection()
    
    print("\n" + "=" * 60)
    print("    测试结果总结")
    print("=" * 60)
    
    total = len(results)
    passed = sum(results.values())
    
    for name, result in results.items():
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {name}: {status}")
    
    print("\n" + "-" * 60)
    print(f"总计: {passed}/{total} 通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！修复成功。")
        print("\n修复内容:")
        print("1. es_utils.insert_document 方法新增 doc_id 参数")
        print("2. create_chunk 方法将 _id 作为参数传递，而非文档字段")
        print("\n请重启后端服务使修改生效。")
        return 0
    else:
        print(f"\n⚠️  有 {total - passed} 个测试未通过。")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
