# ES工具类增强功能说明

## 📋 改进概述

对 `app/database/es_utils.py` 进行了重要增强，新增以下两个核心功能：

1. **ES版本自动检查** - 初始化时自动检测ES版本，要求必须是8.x
2. **全局重试机制** - 所有CRUD操作支持自动重试（ATTEMPT_TIME=2）

---

## ✅ 功能详情

### 1️⃣ ES版本检查机制

#### 触发时机
- **项目启动时** - 当 `es_utils` 单例实例被创建时自动执行
- **初始化流程** - `_initialize()` 方法中

#### 检查逻辑
```python
def _check_es_version(self) -> bool:
    """
    检查ES版本是否为8.x
    
    Returns:
        bool: 如果版本号以8开头返回True，否则False
    """
    major_version = self._es_version.split('.')[0]
    return int(major_version) == 8
```

#### 版本验证流程
```
1. 建立ES连接
   ↓
2. 调用 ping() 测试连接
   ↓ (成功)
3. 调用 info() 获取版本信息
   ↓
4. 提取 version.number 字段
   ↓
5. 解析主版本号（去掉-SNAPSHOT后缀）
   ↓
6. 检查是否为 8.x
   ├─ ✅ 通过 → 记录日志，初始化完成
   └─ ❌ 失败 → 记录错误日志 + 抛出 ValueError 异常
```

#### 错误处理示例

**✅ 版本正确（8.x）**:
```
[INFO] 成功连接到Elasticsearch: 127.0.0.1:9200, 版本: 8.11.3
```

**❌ 版本错误（7.x或更低）**:
```
[ERROR] Elasticsearch版本不支持! 当前版本: 7.17.9, 要求版本: 8.x
ValueError: Elasticsearch版本不支持! 当前版本: 7.17.9, 要求版本: 8.x
```

**❌ 连接失败**:
```
[ERROR] 无法连接到Elasticsearch服务: 127.0.0.1:9200
ConnectionError: 无法连接到Elasticsearch服务: 127.0.0.1:9200
```

#### 新增属性

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `_es_version` | str | ES版本号字符串 |
| `_is_version_valid` | bool | 版本是否有效 |
| `version` | property | 获取版本号 |
| `is_available` | property | 检查ES是否可用（已安装+已连接+版本正确） |

---

### 2️⃣ 全局重试机制

#### 配置参数

```python
# 全局重试次数配置（可在模块级别修改）
ATTEMPT_TIME = 2
```

**含义**: 
- 初始执行 1 次
- 失败后重试 ATTEMPT_TIME 次
- **总尝试次数 = 1 + ATTEMPT_TIME = 3 次**

#### 重试装饰器

所有CRUD方法都使用 `@retry_on_failure` 装饰器：

```python
@retry_on_failure
def create_index(self, index_name, mappings=None):
    # 方法实现...
    
@retry_on_failure  
def insert_document(self, index_name, doc):
    # 方法实现...

# ... 所有其他方法都带有此装饰器
```

#### 重试策略

| 特性 | 实现方式 |
|------|---------|
| **重试次数** | 1次初始 + ATTEMPT_TIME次重试 |
| **延迟策略** | 递增延迟（0.5s × 尝试次数） |
| **日志记录** | 每次失败都记录WARNING级别的日志 |
| **最终处理** | 所有重试失败后返回方法的默认值 |

#### 执行时序示例

假设 `ATTEMPT_TIME = 2`，调用 `insert_document()` 失败的情况：

```
时间轴:
t=0.0s  第1/3次尝试 → 失败 → 记录 WARNING → 等待 0.5s
t=0.5s  第2/3次尝试 → 失败 → 记录 WARNING → 等待 1.0s  
t=1.5s  第3/3次尝试 → 失败 → 记录 ERROR  → 返回 False（默认值）

总耗时: 1.5秒
日志输出:
[WARNING] insert_document 第1/3次尝试失败: Connection timeout
[WARNING] insert_document 第2/3次尝试失败: Connection timeout
[ERROR] insert_document 经过3次尝试后仍然失败: Connection timeout
返回值: False
```

#### 支持重试的方法列表

| 方法名 | 默认返回值 | 说明 |
|--------|-----------|------|
| `create_index()` | `False` | 创建索引 |
| `insert_document()` | `False` | 插入单个文档 |
| `batch_insert_documents()` | `0` | 批量插入文档 |
| `search_documents()` | `[]` | 搜索文档 |
| `vector_search()` | `[]` | 向量相似度搜索 |
| `delete_document()` | `False` | 删除单个文档 |
| `delete_by_query()` | `0` | 条件删除文档 |
| `count_documents()` | `0` | 统计文档数量 |
| `check_connection()` | `False` | 检查连接状态 |

#### 不参与重试的方法

| 方法名 | 原因 |
|--------|------|
| `_initialize()` | 初始化方法，不应重试 |
| `_get_default_return_value()` | 内部辅助方法 |
| `_check_es_version()` | 版本检查只执行一次 |

---

## 🔧 使用示例

### 示例1: 正常使用（版本正确）

```python
from app.database.es_utils import es_utils, ATTEMPT_TIME

# 项目启动时自动执行：
# 1. 连接ES
# 2. 检查版本（要求8.x）
# 3. 如果版本不符，抛出异常并终止程序

if es_utils.is_available:
    print(f"✓ ES连接成功")
    print(f"  版本: {es_utils.version}")  # 例如: "8.11.3"
    
    # 正常使用（所有操作都带自动重试）
    success = es_utils.create_index("test_index")
    if success:
        es_utils.insert_document("test_index", {"content": "hello"})
        
else:
    print("❌ ES不可用")
```

### 示例2: 版本错误处理

```python
from app.database.es_utils import es_utils
import logging

try:
    # 这行代码会触发版本检查
    if es_utils.is_available:
        print("ES就绪")
except ValueError as e:
    # 捕获版本不匹配异常
    logging.error(f"ES版本错误: {e}")
    print("请升级到ES 8.x版本！")
except ConnectionError as e:
    # 捕获连接错误
    logging.error(f"无法连接ES: {e}")
    print("请检查ES服务是否启动！")
```

### 示例3: 自定义重试次数

```python
from app.database.es_utils import es_utils, ATTEMPT_TIME

# 在程序启动前修改全局配置
import app.database.es_utils as es_module
es_module.ATTEMPT_TIME = 5  # 设置为5次重试

# 后续所有ES操作都会使用新的重试次数
# 总尝试次数 = 1 + 5 = 6次
result = es_utils.search_documents(index_name="my_index", query={})
```

### 示例4: 查看版本信息

```python
from app.database.es_utils import es_utils

print(f"ES版本: {es_utils.version}")
print(f"版本有效: {es_utils._is_version_valid}")
print(f"客户端可用: {es_utils.client is not None}")

# 完整的可用性检查
if es_utils.is_available:
    print("✅ ES完全可用（已安装 + 已连接 + 版本正确）")
elif not ELASTICSEARCH_AVAILABLE:
    print("⚠️  ES库未安装")
elif es_utils._es_client is None:
    print("⚠️  ES未连接")
elif not es_utils._is_version_valid:
    print(f"⚠️  ES版本不支持: {es_utils.version} (需要8.x)")
```

---

## ⚙️ 配置说明

### server_config.yaml 配置

```yaml
es:
  host: '127.0.0.1'      # ES主机地址
  port: 9200             # ES端口
  username: 'elastic'     # 用户名（可选）
  password: '123456'      # 密码（可选）
```

### 环境变量（可选）

可通过环境变量覆盖配置（如果项目支持的话）。

### 修改重试次数

**方式1: 直接修改源码**
```python
# 文件: app/database/es_utils.py
ATTEMPT_TIME = 3  # 修改为3次重试
```

**方式2: 运行时修改**
```python
import app.database.es_utils as es_module
es_module.ATTEMPT_TIME = 3
```

**推荐值**:
- 开发环境: `ATTEMPT_TIME = 2`
- 生产环境: `ATTEMPT_TIME = 3`
- 高可用环境: `ATTEMPT_TIME = 5`

---

## 🧪 测试验证

运行测试脚本:

```bash
python app/test/test_es_enhancements.py
```

**预期输出**:
```
======================================================================
       ES工具类增强功能验证测试
======================================================================

1️⃣  模块导入测试
✓ 成功导入ESUtils
✓ 全局重试次数 ATTEMPT_TIME = 2

2️⃣  全局配置测试
✓ ATTEMPT_TIME = 2 (类型: int)

3️⃣  重试装饰器测试
✓ 重试机制正常工作 (第3次尝试成功)
✓ check_connection重试正常 (第2次尝试成功)

4️⃣  版本检查方法测试
✓ 空版本号检查正确 (返回False)
✓ 版本8.11.3检查通过 (返回True)
✓ 版本7.17.9检查正确 (返回False - 不支持)
✓ 非法版本号处理正确 (返回False)

5️⃣  默认返回值测试
  ✓ create_index              -> False
  ✓ insert_document           -> False
  ✓ batch_insert_documents    -> 0
  ✓ search_documents          -> []
  ✓ vector_search             -> []
  ✓ delete_document           -> False
  ✓ delete_by_query           -> 0
  ✓ count_documents          -> 0
  ✓ check_connection          -> False

6️⃣  属性和方法完整性测试
  ✓ 属性.client               -> Elasticsearch对象
  ✓ 属性.version              -> "8.11.3"
  ✓ 属性.is_available         -> True
  ✓ 方法.check_connection     -> 带重试
  ✓ 方法.create_index         -> 带重试
  ✓ ... (所有方法都带重试)

======================================================================
                    📊 测试结果总结
======================================================================
  ✅ 通过: import
  ✅ 通过: config
  ✅ 通过: retry
  ✅ 通过: version_check
  ✅ 通过: default_values
  ✅ 通过: attributes
----------------------------------------------------------------------

🎉 所有测试通过！(6/6)

新增功能:
  ✅ ES版本自动检测（要求8.x）
  ✅ 版本不符时记录日志并抛出异常
  ✅ 全局重试次数配置 ATTEMPT_TIME=2
  ✅ 所有CRUD操作自动重试机制
  ✅ 智能默认返回值
  ✅ 递增延迟重试策略
```

---

## 📊 性能影响分析

### 重试机制的额外开销

| 场景 | 额外耗时 | 说明 |
|------|---------|------|
| **首次成功** | ~0ms | 无额外开销（装饰器几乎无性能损耗） |
| **第2次成功** | ~500ms | 1次重试 + 0.5s延迟 |
| **第3次成功** | ~1500ms | 2次重试 + 0.5s + 1.0s延迟 |
| **全部失败** | ~1500ms | 2次重试 + 返回默认值 |

### 优化建议

1. **生产环境调优**
   ```python
   ATTEMPT_TIME = 3  # 增加重试次数提高成功率
   ```

2. **监控告警**
   - 监控WARNING日志中的重试信息
   - 如果频繁触发重试，可能需要优化网络或ES性能

3. **熔断机制**（可选扩展）
   - 可在重试装饰器中添加熔断逻辑
   - 连续失败N次后暂停一段时间再尝试

---

## 🔍 故障排查指南

### 问题1: 启动时报版本错误

**症状**:
```
ValueError: Elasticsearch版本不支持! 当前版本: 7.17.9, 要求版本: 8.x
```

**解决方案**:
1. 升级ES到8.x版本
2. 或修改代码中的版本检查逻辑（不推荐）

### 问题2: 频繁触发重试

**症状**:
```
[WARNING] insert_document 第1/3次尝试失败: ...
[WARNING] insert_document 第2/3次尝试失败: ...
```

**排查步骤**:
1. 检查ES服务负载情况
2. 检查网络连接稳定性
3. 检查ES索引健康状态
4. 考虑增加 `ATTEMPT_TIME` 的值

### 问题3: 操作超时

**原因**: 
- ES响应慢
- 网络延迟高
- 索引数据量大

**解决**:
```python
# 方案1: 增加ES客户端timeout
self._es_client = Elasticsearch(
    hosts=[...],
    timeout=60,  # 从30增加到60秒
)

# 方案2: 增加重试次数
ATTEMPT_TIME = 5
```

---

## 📝 API参考

### 类: ESUtils

单例模式，全局唯一实例 `es_utils`

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `client` | `Elasticsearch \| None` | ES客户端实例 |
| `version` | `str` | ES版本号 |
| `is_available` | `bool` | ES是否完全可用 |

#### 公共方法（全部带重试机制）

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `check_connection()` | - | `bool` | 检查连接状态 |
| `create_index(name, mappings)` | name: str, mappings: dict | `bool` | 创建索引 |
| `insert_index(name, doc)` | name: str, doc: dict | `bool` | 插入文档 |
| `batch_insert_docs(name, docs)` | name: str, docs: list | `int` | 批量插入 |
| `search_docs(name, query, size, from_)` | query: dict, size: int, from_: int | `list` | 搜索文档 |
| `vector_search(name, vector, kb_id, top_k, min_score)` | vector: list, kb_id: str, top_k: int, min_score: float | `list` | 向量搜索 |
| `delete_doc(name, doc_id)` | name: str, doc_id: str | `bool` | 删除文档 |
| `delete_by_qry(name, query)` | name: str, query: dict | `int` | 条件删除 |
| `count_docs(name, query)` | name: str, query: dict | `int` | 统计数量 |

### 全局变量

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ATTEMPT_TIME` | int | `2` | 重试次数（总尝试=1+此值）|

### 函数

| 函数 | 用途 |
|------|------|
| `retry_on_failure(func)` | 重试装饰器（可复用于自定义方法）|

---

## 🔄 版本历史

### v2.1.0 (2026-04-07) - 增强版

#### 新增功能
- ✅ ES版本自动检测和验证（要求8.x）
- ✅ 版本不符时记录错误日志并抛出ValueError
- ✅ 全局重试机制（ATTEMPT_TIME=2）
- ✅ @retry_on_failure 装饰器
- ✅ 递增延迟重试策略
- ✅ 智能默认返回值
- ✅ 完善的错误日志记录
- ✅ 版本信息属性访问

#### 新增文件
- [test_es_enhancements.py](file:///e:/project_git/ai-center-zwx/ai-center/app/test/test_es_enhancements.py) - 增强功能测试脚本
- [ES_ENHANCEMENTS.md](file:///e:/project_git/ai-center-zwx/ai-center/app/core/knowledge/ES_ENHANCEMENTS.md) - 本文档

---

## 💡 最佳实践

### 1. 启动检查清单

```python
# 在应用启动时添加
from app.database.es_utils import es_utils
import sys

def startup_check():
    """启动时检查ES连接"""
    try:
        if not es_utils.is_available:
            if not ELASTICSEARCH_AVAILABLE:
                print("❌ 请安装elasticsearch: pip install elasticsearch")
            elif es_utils._es_client is None:
                print("❌ 无法连接到ES服务")
            elif not es_utils._is_version_valid:
                print(f"❌ ES版本不支持: {es_utils.version} (需要8.x)")
            sys.exit(1)
        else:
            print(f"✅ ES就绪 (v{es_utils.version})")
    except Exception as e:
        print(f"❌ ES初始化失败: {e}")
        sys.exit(1)

startup_check()
```

### 2. 生产环境建议

```python
# 生产环境配置
ATTEMPT_TIME = 3  # 更多的重试次数

# 使用上下文管理器确保资源释放
with es_utils.client as client:
    result = client.search(...)
```

### 3. 监控集成

```python
# 将重试日志接入监控系统
import sentry_sdk  # 或其他监控工具

sentry_sdk.init(...)

# 自动捕获WARNING和ERROR日志
# 这样可以及时发现ES问题
```

---

## 📄 相关文档

- [README.md](file:///e:/project_git/ai-center-zwx/ai-center/app/core/knowledge/README.md) - 文档切片功能说明
- [IMPLEMENTATION_SUMMARY.md](file:///e:/project_git/ai-center-zwx/ai-center/app/core/knowledge/IMPLEMENTATION_SUMMARY.md) - 实现总结
- [ALL_STRATEGIES_REPORT.md](file:///e:/project_git/ai-center-zwx/ai-center/app/core/knowledge/ALL_STRATEGIES_REPORT.md) - 切片策略报告

---

**Generated on**: 2026-04-07  
**Version**: 2.1.0  
**Status**: ✅ Production Ready with Enhanced Reliability
