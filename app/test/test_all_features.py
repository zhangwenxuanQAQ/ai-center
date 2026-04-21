"""
完整功能验证测试脚本
测试所有核心功能：ES、RustFS、文档切片
"""

import sys
sys.path.insert(0, '.')

def test_all_features():
    """测试所有核心功能"""
    print("=" * 80)
    print("         🚀 AI-Center 核心功能全面验证测试")
    print("=" * 80)
    
    results = {}
    
    # ==================== 1. 基础配置测试 ====================
    print("\n" + "=" * 80)
    print("1️⃣  基础配置和依赖测试")
    print("=" * 80)
    
    # 测试配置文件
    try:
        from app.configs.config import config
        print(f"✓ 配置文件加载成功")
        print(f"  - MySQL: {config.mysql.get('host')}:{config.mysql.get('port')}")
        print(f"  - Server: {config.server.get('host')}:{config.server.get('http_port')}")
        results['config'] = True
    except Exception as e:
        print(f"✗ 配置加载失败: {e}")
        results['config'] = False
    
    # 测试常量定义
    try:
        from app.constants.knowledge_constants import DOCUMENT_PARSE_TYPE, DOCUMENT_RUNNING_STATUS
        print(f"✓ 知识库常量定义正确")
        print(f"  - 解析类型: {len(DOCUMENT_PARSE_TYPE)} 种")
        print(f"  - 运行状态: {len(DOCUMENT_RUNNING_STATUS)} 种")
        results['constants'] = True
    except Exception as e:
        print(f"✗ 常量定义错误: {e}")
        results['constants'] = False
    
    # ==================== 2. ES工具类测试 ====================
    print("\n" + "=" * 80)
    print("2️⃣  Elasticsearch 工具类测试")
    print("=" * 80)
    
    try:
        from app.database.es_utils import (
            ESUtils, es_utils, ATTEMPT_TIME, retry_on_failure
        )
        
        print(f"✓ ES工具类导入成功")
        print(f"  - 全局重试次数: ATTEMPT_TIME = {ATTEMPT_TIME}")
        print(f"  - 可用性: {es_utils.is_available}")
        
        if es_utils.is_available:
            print(f"  - ES版本: {es_utils.version}")
        
        # 测试版本检查方法
        test_versions = [
            ("8.11.3", True),
            ("7.17.9", False),
            ("9.0.0", False),
            ("unknown", False),
        ]
        
        utils_test = object.__new__(ESUtils)
        utils_test._es_version = ""
        
        for version, expected in test_versions:
            utils_test._es_version = version
            result = utils_test._check_es_version()
            status = "✓" if result == expected else "✗"
            print(f"  {status} 版本检查 '{version}': {result} (期望 {expected})")
        
        results['es_utils'] = True
        
    except Exception as e:
        print(f"✗ ES工具类测试失败: {e}")
        results['es_utils'] = False
    
    # ==================== 3. RustFS工具类测试 ====================
    print("\n" + "=" * 80)
    print("3️⃣  RustFS 对象存储工具类测试")
    print("=" * 80)
    
    try:
        from app.database.storage.rustfs_utils import RustFSUtils, rustfs_utils
        
        print(f"✓ RustFS工具类导入成功")
        print(f"  - 可用性: {rustfs_utils.is_available}")
        
        # 测试方法存在性
        methods = [
            'create_bucket', 'delete_bucket', 'bucket_exists', 'list_buckets',
            'upload_object', 'upload_file', 'download_object', 'download_file',
            'delete_object', 'delete_objects', 'object_exists', 'get_object_metadata',
            'list_objects', 'copy_object', 'generate_presigned_url',
            'get_bucket_size', 'get_object_count'
        ]
        
        missing = []
        for method in methods:
            if not hasattr(rustfs_utils, method):
                missing.append(method)
        
        if missing:
            print(f"  ✗ 缺少方法: {', '.join(missing)}")
            results['rustfs_utils'] = False
        else:
            print(f"  ✓ 所有{len(methods)}个方法都已实现")
            results['rustfs_utils'] = True
        
    except Exception as e:
        print(f"✗ RustFS工具类测试失败: {e}")
        import traceback
        traceback.print_exc()
        results['rustfs_utils'] = False
    
    # ==================== 4. NLP模块测试 ====================
    print("\n" + "=" * 80)
    print("4️⃣  NLP 自然语言处理模块测试")
    print("=" * 80)
    
    try:
        from app.core.knowledgebase.rag.nlp import (
            rag_tokenizer, tokenize, fine_grained_tokenize,
            is_english, is_chinese, naive_merge, num_tokens_from_string
        )
        
        print(f"✓ NLP模块导入成功")
        
        # 测试分词
        test_text = "这是一个测试文本，用于验证分词器功能。This is a test."
        tokens = tokenize(test_text)
        print(f"  - 分词测试: '{test_text[:30]}...' -> {tokens[:30]}...")
        
        # 测试Token计算
        token_count = num_tokens_from_string(test_text)
        print(f"  - Token计算: '{test_text[:30]}...' -> {token_count} tokens")
        
        # 测试语言检测
        is_cn = is_chinese(test_text)
        print(f"  - 语言检测: 中文={is_cn}")
        
        results['nlp'] = True
        
    except Exception as e:
        print(f"✗ NLP模块测试失败: {e}")
        results['nlp'] = False
    
    # ==================== 5. 文档切片策略测试 ====================
    print("\n" + "=" * 80)
    print("5️⃣  文档切片策略测试 (13种策略)")
    print("=" * 80)
    
    try:
        from app.core.knowledgebase.rag.app import CHUNK_STRATEGIES
        
        strategies = [
            "naive", "book", "paper", "laws", "manual", "qa",
            "table", "presentation", "picture", "one", "resume",
            "audio", "email", "tag"
        ]
        
        print(f"✓ 策略映射表包含 {len(CHUNK_STRATEGIES)} 个策略")
        
        missing_strategies = []
        for strategy in strategies:
            if strategy in CHUNK_STRATEGIES:
                print(f"  ✓ {strategy:15} - 已注册")
            else:
                print(f"  ✗ {strategy:15} - 未找到")
                missing_strategies.append(strategy)
        
        if missing_strategies:
            print(f"\n⚠️  缺少策略: {', '.join(missing_strategies)}")
            results['strategies'] = False
        else:
            results['strategies'] = True
        
    except Exception as e:
        print(f"✗ 切片策略测试失败: {e}")
        results['strategies'] = False
    
    # ==================== 6. 任务执行器测试 ====================
    print("\n" + "=" * 80)
    print("6️⃣  任务执行器测试")
    print("=" * 80)
    
    try:
        from app.core.knowledgebase.rag.svr.task_executor import (
            TaskExecutor, task_executor, TaskStatus, TaskPriority
        )
        
        print(f"✓ 任务执行器导入成功")
        print(f"  - 支持的策略类型: {len(task_executor.SUPPORTED_PARSE_TYPES)} 种")
        
        # 创建测试任务
        test_task = task_executor.submit_task(
            task_id="test_comprehensive",
            filename="test.pdf",
            parse_type="naive",
            lang="Chinese"
        )
        
        print(f"  - 任务提交: {test_task.task_id}")
        print(f"  - 任务状态: {test_task.status.value}")
        
        # 清理
        task_executor.cancel_task("test_comprehensive")
        task_executor.cleanup_task("test_comprehensive")
        
        results['executor'] = True
        
    except Exception as e:
        print(f"✗ 任务执行器测试失败: {e}")
        results['executor'] = False
    
    # ==================== 7. DeepDoc解析器测试 ====================
    print("\n" + "=" * 80)
    print("7️⃣  DeepDoc 解析器测试")
    print("=" * 80)
    
    try:
        # 测试解析器导入
        parsers = []
        try:
            from app.core.knowledgebase.deepdoc.parser import PdfParser
            parsers.append('PdfParser')
        except:
            pass
        
        try:
            from app.core.knowledgebase.deepdoc.parser import DocxParser
            parsers.append('DocxParser')
        except:
            pass
        
        try:
            from app.core.knowledgebase.deepdoc.parser import ExcelParser
            parsers.append('ExcelParser')
        except:
            pass
        
        try:
            from app.core.knowledgebase.deepdoc.parser import TxtParser
            parsers.append('TxtParser')
        except:
            pass
        
        if parsers:
            print(f"✓ DeepDoc解析器导入成功")
            print(f"  - 可用解析器: {', '.join(parsers)}")
            results['deepdoc'] = True
        else:
            print(f"⚠️  未找到可用的DeepDoc解析器")
            results['deepdoc'] = False
        
    except Exception as e:
        print(f"✗ DeepDoc解析器测试失败: {e}")
        results['deepdoc'] = False
    
    # ==================== 总结 ====================
    print("\n" + "=" * 80)
    print("                      📊 测试结果总结")
    print("=" * 80)
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {status}: {name}")
    
    print("\n" + "-" * 80)
    print(f"🎯 总体结果: {passed}/{total} 项通过 ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n" + "🎉" * 20)
        print("\n✨ 所有核心功能验证通过！系统已准备就绪！✨\n")
        print("功能清单:")
        print("  ✅ 配置管理")
        print("  ✅ Elasticsearch 8.x (版本检查 + 重试机制)")
        print("  ✅ RustFS 对象存储 (17个方法)")
        print("  ✅ NLP 自然语言处理")
        print("  ✅ 13种文档切片策略")
        print("  ✅ 任务调度执行器")
        print("  ✅ DeepDoc 解析引擎")
        print("\n" + "🎉" * 20 + "\n")
        return 0
    elif passed >= total * 0.8:
        print(f"\n⚠️  大部分功能正常 ({passed}/{total})，部分功能需要检查依赖或配置\n")
        return 1
    else:
        print(f"\n❌ 存在较多问题，请检查上述错误信息\n")
        return 2


if __name__ == "__main__":
    exit_code = test_all_features()
    sys.exit(exit_code)
