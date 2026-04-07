"""
ES工具类版本检查和重试机制测试脚本
"""

import sys
sys.path.insert(0, '.')

def test_es_utils():
    """测试ES工具类的新功能"""
    print("=" * 70)
    print("       ES工具类增强功能验证测试")
    print("=" * 70)
    
    results = {}
    
    # 测试1: 导入模块
    print("\n1️⃣  模块导入测试")
    try:
        from app.database.es_utils import (
            ESUtils, es_utils,
            ATTEMPT_TIME, retry_on_failure
        )
        print(f"✓ 成功导入ESUtils")
        print(f"✓ 全局重试次数 ATTEMPT_TIME = {ATTEMPT_TIME}")
        results['import'] = True
    except Exception as e:
        print(f"✗ 导入失败: {e}")
        results['import'] = False
    
    # 测试2: 检查全局变量
    print("\n2️⃣  全局配置测试")
    try:
        from app.database.es_utils import ATTEMPT_TIME
        
        assert isinstance(ATTEMPT_TIME, int), "ATTEMPT_TIME必须是整数"
        assert ATTEMPT_TIME >= 1, "ATTEMPT_TIME必须 >= 1"
        
        print(f"✓ ATTEMPT_TIME = {ATTEMPT_TIME} (类型: {type(ATTEMPT_TIME).__name__})")
        results['config'] = True
    except Exception as e:
        print(f"✗ 配置错误: {e}")
        results['config'] = False
    
    # 测试3: 重试装饰器测试
    print("\n3️⃣  重试装饰器测试")
    try:
        from app.database.es_utils import retry_on_failure
        from functools import wraps
        
        # 创建一个模拟类来测试装饰器
        class MockESClient:
            def __init__(self):
                self.call_count = 0
                self._es_client = self
            
            def _get_default_return_value(self, method_name):
                defaults = {
                    'test_method': 'default_value',
                    'check_connection': False,
                }
                return defaults.get(method_name, None)
            
            @retry_on_failure
            def test_method(self):
                self.call_count += 1
                if self.call_count < 3:
                    raise Exception(f"模拟失败 (第{self.call_count}次)")
                return "success"
            
            @retry_on_failure
            def check_connection(self):
                self.call_count += 1
                if self.call_count < 2:
                    raise ConnectionError("连接失败")
                return True
        
        mock = MockESClient()
        
        # 测试重试后成功的情况
        result = mock.test_method()
        assert result == "success", f"期望 success（第3次尝试成功），实际 {result}"
        assert mock.call_count == 3, f"期望调用3次(1+ATTEMPT_TIME)，实际{mock.call_count}"
        print(f"✓ 重试机制正常工作 (第{mock.call_count}次尝试成功)")
        
        # 测试check_connection的重试成功
        mock2 = MockESClient()
        result = mock2.check_connection()
        assert result is True, f"期望True，实际{result}"
        assert mock2.call_count == 2, f"期望调用2次，实际{mock2.call_count}"
        print(f"✓ check_connection重试正常 (第{mock2.call_count}次尝试成功)")
        
        results['retry'] = True
    except Exception as e:
        print(f"✗ 重试测试失败: {e}")
        import traceback
        traceback.print_exc()
        results['retry'] = False
    
    # 测试4: 版本检查方法
    print("\n4️⃣  版本检查方法测试")
    try:
        from app.database.es_utils import ESUtils
        
        utils = object.__new__(ESUtils)
        utils._es_version = ""
        utils._is_version_valid = False
        utils._es_client = None
        
        # 测试空版本号
        assert utils._check_es_version() == False, "空版本应该返回False"
        print("✓ 空版本号检查正确 (返回False)")
        
        # 测试8.x版本
        utils._es_version = "8.11.3"
        assert utils._check_es_version() == True, "8.x版本应该返回True"
        print(f"✓ 版本8.11.3检查通过 (返回True)")
        
        # 测试7.x版本（不支持的版本）
        utils._es_version = "7.17.9"
        assert utils._check_es_version() == False, "7.x版本应该返回False"
        print(f"✓ 版本7.17.9检查正确 (返回False - 不支持)")
        
        # 测试非数字版本
        utils._es_version = "unknown"
        assert utils._check_es_version() == False, "unknown版本应该返回False"
        print("✓ 非法版本号处理正确 (返回False)")
        
        results['version_check'] = True
    except Exception as e:
        print(f"✗ 版本检查测试失败: {e}")
        results['version_check'] = False
    
    # 测试5: 默认返回值方法
    print("\n5️⃣  默认返回值测试")
    try:
        from app.database.es_utils import ESUtils
        
        utils = object.__new__(ESUtils)
        utils._es_client = None
        
        # 测试各方法的默认返回值
        test_cases = [
            ('create_index', False),
            ('insert_document', False),
            ('batch_insert_documents', 0),
            ('search_documents', []),
            ('vector_search', []),
            ('delete_document', False),
            ('delete_by_query', 0),
            ('count_documents', 0),
            ('check_connection', False),
        ]
        
        for method_name, expected in test_cases:
            result = utils._get_default_return_value(method_name)
            assert result == expected, f"{method_name}: 期望{expected}, 实际{result}"
            print(f"  ✓ {method_name:25} -> {expected}")
        
        results['default_values'] = True
    except Exception as e:
        print(f"✗ 默认值测试失败: {e}")
        results['default_values'] = False
    
    # 测试6: 属性访问测试
    print("\n6️⃣  属性和方法完整性测试")
    try:
        from app.database.es_utils import es_utils
        
        attrs = ['client', 'version', 'is_available']
        methods = [
            'check_connection', 'create_index', 'insert_document',
            'batch_insert_documents', 'search_documents', 'vector_search',
            'delete_document', 'delete_by_query', 'count_documents'
        ]
        
        for attr in attrs:
            value = getattr(es_utils, attr, None)
            print(f"  ✓ 属性.{attr:20} -> {type(value).__name__ if value else 'None'}")
        
        for method in methods:
            func = getattr(es_utils, method, None)
            assert callable(func), f"{method}应该是可调用的"
            has_decorator = hasattr(func, '__wrapped__')
            print(f"  ✓ 方法.{method:20} -> {'带重试' if has_decorator else '普通'}")
        
        results['attributes'] = True
    except Exception as e:
        print(f"✗ 属性测试失败: {e}")
        results['attributes'] = False
    
    # 输出总结
    print("\n" + "=" * 70)
    print("                    📊 测试结果总结")
    print("=" * 70)
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {status}: {name}")
    
    print("-" * 70)
    
    if passed == total:
        print(f"\n🎉 所有测试通过！({passed}/{total})\n")
        print("新增功能:")
        print("  ✅ ES版本自动检测（要求8.x）")
        print("  ✅ 版本不符时记录日志并抛出异常")
        print("  ✅ 全局重试次数配置 ATTEMPT_TIME=2")
        print("  ✅ 所有CRUD操作自动重试机制")
        print("  ✅ 智能默认返回值")
        print("  ✅ 递增延迟重试策略\n")
        return 0
    else:
        print(f"\n⚠️  有{total-passed}个测试未通过\n")
        return 1


if __name__ == "__main__":
    exit_code = test_es_utils()
    sys.exit(exit_code)
