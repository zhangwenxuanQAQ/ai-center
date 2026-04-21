"""
所有文档切片策略验证脚本
测试所有13种切片策略的导入和基本功能
"""

import sys
sys.path.insert(0, '.')

def test_all_strategies():
    """测试所有切片策略"""
    print("=" * 70)
    print("       文档切片策略全面验证测试")
    print("=" * 70)
    
    results = {}
    
    # 1. 测试基础模块
    print("\n" + "=" * 70)
    print("1️⃣  基础模块导入测试")
    print("=" * 70)
    
    try:
        from app.constants.knowledge_constants import DOCUMENT_PARSE_TYPE
        print(f"✓ knowledge_constants - {len(DOCUMENT_PARSE_TYPE)} 种解析类型")
        results['constants'] = True
    except Exception as e:
        print(f"✗ knowledge_constants: {e}")
        results['constants'] = False
    
    try:
        from app.database.es_utils import ESUtils, es_utils
        print(f"✓ es_utils - ES连接工具类就绪")
        results['es_utils'] = True
    except Exception as e:
        print(f"✗ es_utils: {e}")
        results['es_utils'] = False
    
    # 2. 测试NLP模块
    print("\n" + "=" * 70)
    print("2️⃣  NLP自然语言处理模块测试")
    print("=" * 70)
    
    try:
        from app.core.knowledgebase.rag.nlp import (
            rag_tokenizer, tokenize, fine_grained_tokenize,
            is_english, is_chinese, naive_merge, 
            num_tokens_from_string, tokenize_chunks
        )
        
        test_text = "这是一个测试文本，用于验证分词器功能。This is a test."
        tokens = tokenize(test_text)
        print(f"✓ rag_tokenizer - 分词正常: {tokens[:50]}...")
        results['nlp'] = True
        
        # 测试naive_merge
        sections = ["第一段内容。", "第二段内容。", "第三段内容。"]
        chunks = naive_merge(sections, chunk_token_num=20)
        print(f"✓ naive_merge - {len(sections)}段 -> {len(chunks)}个chunks")
        
    except Exception as e:
        print(f"✗ nlp模块: {e}")
        results['nlp'] = False
    
    # 3. 测试所有13种切片策略
    print("\n" + "=" * 70)
    print("3️⃣  切片策略导入测试（共13种）")
    print("=" * 70)
    
    strategies = [
        ("naive", "通用/Naive切片"),
        ("book", "书籍切片"),
        ("paper", "论文切片"),
        ("laws", "法律法规切片"),
        ("manual", "手册/说明书切片"),
        ("qa", "问答对切片"),
        ("table", "表格数据切片"),
        ("presentation", "PPT演示文稿切片"),
        ("picture", "图片/视频切片"),
        ("one", "单一文档切片"),
        ("resume", "简历切片"),
        ("audio", "音频切片"),
        ("email", "邮件切片"),
        ("tag", "标签分类切片"),
    ]
    
    strategy_results = {}
    
    for strategy_name, description in strategies:
        try:
            module_path = f"app.core.knowledgebase.rag.app.{strategy_name}"
            if strategy_name == 'naive':
                from app.core.knowledgebase.rag.app.naive import chunk as chunk_func
            else:
                __import__(module_path)
                module = sys.modules[module_path]
                chunk_func = getattr(module, 'chunk', None)
            
            if chunk_func and callable(chunk_func):
                print(f"✓ {strategy_name:15} - {description} (函数已加载)")
                strategy_results[strategy_name] = True
            else:
                print(f"⚠ {strategy_name:15} - {description} (模块已加载但缺少chunk函数)")
                strategy_results[strategy_name] = False
                
        except ImportError as e:
            missing_dep = str(e).split("'")[-2] if "'" in str(e) else str(e)
            print(f"✗ {strategy_name:15} - {description} (依赖缺失: {missing_dep})")
            strategy_results[strategy_name] = False
        except Exception as e:
            print(f"✗ {strategy_name:15} - {description} ({e})")
            strategy_results[strategy_name] = False
    
    results['strategies'] = strategy_results
    
    # 4. 测试CHUNK_STRATEGIES映射表
    print("\n" + "=" * 70)
    print("4️⃣  策略映射表测试")
    print("=" * 70)
    
    try:
        from app.core.knowledgebase.rag.app import CHUNK_STRATEGIES
        print(f"✓ CHUNK_STRATEGIES 映射表包含 {len(CHUNK_STRATEGIES)} 个策略:")
        for name in CHUNK_STRATEGIES.keys():
            status = "✓" if strategy_results.get(name, False) else "○"
            print(f"   {status} {name}")
        results['mapping'] = True
    except Exception as e:
        print(f"✗ CHUNK_STRATEGIES: {e}")
        results['mapping'] = False
    
    # 5. 测试TaskExecutor
    print("\n" + "=" * 70)
    print("5️⃣  任务执行器测试")
    print("=" * 70)
    
    try:
        from app.core.knowledgebase.rag.svr.task_executor import (
            TaskExecutor, task_executor, TaskStatus, TaskPriority
        )
        
        print(f"✓ TaskExecutor 已初始化")
        print(f"   支持的策略类型 ({len(task_executor.SUPPORTED_PARSE_TYPES)} 种):")
        for ptype in task_executor.SUPPORTED_PARSE_TYPES:
            print(f"     - {ptype}")
        
        # 创建测试任务
        test_task = task_executor.submit_task(
            task_id="test_all_strategies",
            filename="test.pdf",
            parse_type="naive",
            lang="Chinese"
        )
        
        print(f"✓ 任务提交成功: {test_task.task_id}")
        print(f"   状态: {test_task.status.value}")
        print(f"   类型: {test_task.parse_type}")
        
        # 清理测试任务
        task_executor.cancel_task("test_all_strategies")
        task_executor.cleanup_task("test_all_strategies")
        
        results['executor'] = True
    except Exception as e:
        print(f"✗ TaskExecutor: {e}")
        results['executor'] = False
    
    # 输出总结
    print("\n" + "=" * 70)
    print("                    📊 测试结果总结")
    print("=" * 70)
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v is True)
    
    for name, result in results.items():
        if name == 'strategies':
            passed_strats = sum(1 for v in result.values() if v is True)
            total_strats = len(result)
            status = f"{passed_strats}/{total_strats}"
            icon = "✅" if passed_strats == total_strats else "⚠️"
            print(f"  {icon} 切片策略: {status} 通过")
        else:
            status = "✅ 通过" if result else "❌ 失败"
            print(f"  {status}: {name}")
    
    print("-" * 70)
    overall_passed = passed_tests + (sum(1 for v in strategy_results.values() if v) if 'strategies' in results else 0)
    overall_total = total_tests + (len(strategy_results) if 'strategies' in results else 0)
    
    print(f"\n🎯 总体结果: {overall_passed}/{overall_total} 项通过")
    
    if all(results.values()) and all(strategy_results.values()):
        print("\n🎉🎉🎉 所有测试通过！全部13种切片策略移植成功！🎉🎉🎉\n")
        return 0
    elif passed_tests >= total_tests - 2:
        failed_strats = [k for k,v in strategy_results.items() if not v]
        if failed_strats:
            print(f"\n⚠️  部分策略需要安装依赖: {', '.join(failed_strats)}")
            print("请运行: pip install pandas xpinyin python-pptx python-dateutil PyPDF2 Pillow numpy\n")
        return 1
    else:
        print("\n❌ 存在问题，请检查上述错误信息\n")
        return 1


if __name__ == "__main__":
    exit_code = test_all_strategies()
    sys.exit(exit_code)
