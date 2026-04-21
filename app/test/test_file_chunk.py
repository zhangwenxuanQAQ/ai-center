"""
文档切片功能验证脚本
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_knowledge_constants():
    """测试知识库常量"""
    print("=" * 60)
    print("1. 测试 knowledge_constants.py")
    print("=" * 60)
    
    try:
        from app.constants.knowledge_constants import DOCUMENT_PARSE_TYPE, DOCUMENT_RUNNING_STATUS
        
        print("✓ 成功导入常量")
        print(f"\n文档解析类型 ({len(DOCUMENT_PARSE_TYPE)} 种):")
        for key, value in DOCUMENT_PARSE_TYPE.items():
            print(f"  - {key}: {value}")
            
        print(f"\n文档解析状态 ({len(DOCUMENT_RUNNING_STATUS)} 种):")
        for key, value in DOCUMENT_RUNNING_STATUS.items():
            print(f"  - {key}: {value}")
            
        return True
    except Exception as e:
        print(f"✗ 导入失败: {e}")
        return False


def test_es_utils():
    """测试ES工具类"""
    print("\n" + "=" * 60)
    print("2. 测试 es_utils.py")
    print("=" * 60)
    
    try:
        from app.database.es_utils import ESUtils, es_utils
        
        print("✓ 成功导入ESUtils")
        print(f"  - 实例类型: {type(es_utils)}")
        
        # 检查连接（不强制要求ES服务启动）
        # connected = es_utils.check_connection()
        # print(f"  - 连接状态: {'已连接' if connected else '未连接'}")
        
        print("  - 主要方法:")
        methods = ['check_connection', 'create_index', 'insert_document', 
                   'batch_insert_documents', 'search_documents', 'vector_search',
                   'delete_document', 'count_documents']
        for method in methods:
            if hasattr(es_utils, method):
                print(f"    ✓ {method}()")
                
        return True
    except Exception as e:
        print(f"✗ 导入失败: {e}")
        return False


def test_rag_tokenizer():
    """测试RAG分词器"""
    print("\n" + "=" * 60)
    print("3. 测试 rag/nlp/rag_tokenizer.py")
    print("=" * 60)
    
    try:
        from app.core.knowledgebase.rag.nlp.rag_tokenizer import (
            RagTokenizer, tokenizer, tokenize, fine_grained_tokenize
        )
        
        print("✓ 成功导入RagTokenizer")
        
        # 测试分词功能
        test_text = "这是一个测试文本，用于验证分词器功能。This is a test."
        tokens = tokenize(test_text)
        fine_tokens = fine_grained_tokenize(tokens)
        
        print(f"\n  原始文本: {test_text[:50]}...")
        print(f"  分词结果: {tokens[:80]}...")
        print(f"  细粒度分词: {fine_tokens[:80]}...")
        
        # 测试中文判断
        is_cn = tokenizer.is_chinese(test_text)
        is_en = tokenizer.is_english(test_text.split())
        print(f"\n  是否中文: {is_cn}")
        print(f"  是否英文: {is_en}")
        
        return True
    except Exception as e:
        print(f"✗ 导入或执行失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_nlp_module():
    """测试NLP模块"""
    print("\n" + "=" * 60)
    print("4. 测试 rag/nlp/search.py")
    print("=" * 60)
    
    try:
        from app.core.knowledgebase.rag.nlp import (
            naive_merge, naive_merge_with_images,
            num_tokens_from_string, is_english, is_chinese,
            concat_img
        )
        
        print("✓ 成功导入NLP核心函数")
        
        # 测试naive_merge
        sections = ["这是第一段内容。", "这是第二段内容。", "这是第三段内容。"]
        chunks = naive_merge(sections, chunk_token_num=20)
        print(f"\n  naive_merge测试:")
        print(f"    输入段落数: {len(sections)}")
        print(f"    输出chunks数: {len(chunks)}")
        for i, chunk in enumerate(chunks):
            if chunk.strip():
                print(f"      chunk[{i}]: {chunk[:50]}...")
        
        # 测试token计算
        text = "这是一个测试文本"
        token_count = num_tokens_from_string(text)
        print(f"\n  num_tokens_from_string测试:")
        print(f"    文本: '{text}'")
        print(f"    Token数: {token_count}")
        
        return True
    except Exception as e:
        print(f"✗ 导入或执行失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_utils_module():
    """测试工具类模块"""
    print("\n" + "=" * 60)
    print("5. 测试 rag/utils/")
    print("=" * 60)
    
    try:
        from app.core.knowledgebase.rag.utils import (
            extract_embed_file,
            get_file_extension,
            is_supported_format,
            normalize_overlapped_percent,
            ProgressCallback
        )
        
        print("✓ 成功导入工具函数")
        
        # 测试文件扩展名获取
        ext = get_file_extension("test_document.pdf")
        print(f"\n  get_file_extension测试:")
        print(f"    'test_document.pdf' -> '{ext}'")
        
        # 测试格式支持检查
        supported = is_supported_format("document.pdf")
        unsupported = is_supported_format("file.xyz")
        print(f"\n  is_supported_format测试:")
        print(f"    'document.pdf': {'支持' if supported else '不支持'}")
        print(f"    'file.xyz': {'支持' if unsupported else '不支持'}")
        
        # 测试标准化重叠百分比
        p1 = normalize_overlapped_percent(50)
        p2 = normalize_overlapped_percent(-10)
        p3 = normalize_overlapped_percent(150)
        print(f"\n  normalize_overlapped_percent测试:")
        print(f"    50 -> {p1}")
        print(f"    -10 -> {p2}")
        print(f"    150 -> {p3}")
        
        return True
    except Exception as e:
        print(f"✗ 导入或执行失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_task_executor():
    """测试任务执行器"""
    print("\n" + "=" * 60)
    print("6. 测试 rag/svr/task_executor.py")
    print("=" * 60)
    
    try:
        from app.core.knowledgebase.rag.svr.task_executor import (
            TaskExecutor, task_executor,
            TaskStatus, TaskPriority,
            DocumentTask
        )
        
        print("✓ 成功导入TaskExecutor")
        print(f"\n  任务状态枚举:")
        for status in TaskStatus:
            print(f"    - {status.name}: {status.value}")
            
        print(f"\n  优先级枚举:")
        for priority in TaskPriority:
            print(f"    - {priority.name}: {priority.value}")
            
        print(f"\n  支持的解析类型:")
        for parse_type in task_executor.PARSE_TYPE_MAP.keys():
            print(f"    - {parse_type}")
            
        # 创建测试任务
        test_task = DocumentTask(
            task_id="test_001",
            filename="test.pdf",
            parse_type="naive"
        )
        print(f"\n  创建测试任务:")
        print(f"    ID: {test_task.task_id}")
        print(f"    文件: {test_task.filename}")
        print(f"    类型: {test_task.parse_type}")
        print(f"    状态: {test_task.status.value}")
        
        # 提交任务到执行器
        submitted = task_executor.submit_task(
            task_id="test_002",
            filename="demo.docx",
            parse_type="naive",
            lang="Chinese"
        )
        print(f"\n  提交任务到执行器:")
        print(f"    成功: {submitted is not None}")
        
        # 查询状态
        status = task_executor.get_task_status("test_002")
        print(f"\n  查询任务状态:")
        print(f"    {status}")
        
        # 列出所有任务
        tasks = task_executor.list_tasks()
        print(f"\n  当前任务数: {len(tasks)}")
        
        # 清理测试任务
        task_executor.cancel_task("test_002")
        task_executor.cleanup_task("test_001")
        task_executor.cleanup_task("test_002")
        
        return True
    except Exception as e:
        print(f"✗ 导入或执行失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("       文档切片功能验证测试")
    print("=" * 60)
    
    results = {}
    
    results['knowledge_constants'] = test_knowledge_constants()
    results['es_utils'] = test_es_utils()
    results['rag_tokenizer'] = test_rag_tokenizer()
    results['nlp'] = test_nlp_module()
    results['utils'] = test_utils_module()
    results['task_executor'] = test_task_executor()
    
    # 输出总结
    print("\n" + "=" * 60)
    print("                    测试结果总结")
    print("=" * 60)
    
    total = len(results)
    passed = sum(results.values())
    
    for name, result in results.items():
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {name}: {status}")
    
    print("\n" + "-" * 60)
    print(f"总计: {passed}/{total} 通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！文档切片功能实现成功。")
        return 0
    else:
        print(f"\n⚠️  有 {total - passed} 个测试未通过，请检查相关模块。")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
