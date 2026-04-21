# Redis任务调度器使用文档

## 概述

本文档说明如何使用 Redis 任务调度器进行文档切片任务的处理。

---

## 功能特性

1. **Redis 工具类** - 单例模式，自动重连，完整的 CRUD 操作
2. **任务队列** - 使用 Redis Stream 进行任务调度
3. **消费者组** - 支持多消费者并行处理
4. **任务状态管理** - 完整的任务生命周期管理
5. **心跳检测** - 定时报告任务队列状态
6. **优雅关闭** - 支持 Signal 处理，安全退出
7. **进度追踪** - 实时任务进度更新
8. **任务限流** - 使用 Semaphore 限制同时执行的任务数量，防止系统过载

---

## 安装依赖

首先安装 Redis 依赖：

```bash
pip install redis>=5.0.0
```

或者从项目根目录安装所有依赖：

```bash
pip install -r requirements.txt
```

---

## 配置说明

项目使用 `configs/server_config.yaml` 中的 Redis 配置：

```yaml
redis:
  host: 127.0.0.1
  port: 6379
  db: 1
  username: ""
  password: ""
```

配置说明：
- `host`: Redis 服务器地址
- `port`: Redis 端口，默认 6379
- `db`: 数据库编号，默认 1
- `username/password`: 认证信息（可选）

---

## 任务限流配置

任务调度器使用 `threading.Semaphore` 来限制同时执行的任务数量，防止系统过载。

### 配置方式

通过环境变量 `MAX_CONCURRENT_TASKS` 配置最大并发任务数：

```bash
# Windows
set MAX_CONCURRENT_TASKS=10
python -m app.core.knowledgebase.server.task_executor

# Linux/Mac
export MAX_CONCURRENT_TASKS=10
python -m app.core.knowledgebase.server.task_executor
```

或者在代码中配置（修改 `task_executor.py`）：

```python
MAX_CONCURRENT_TASKS = int(os.environ.get('MAX_CONCURRENT_TASKS', '5'))
```

### 默认值

- 默认最大并发任务数：**5**
- 可根据服务器性能和资源情况调整

### 限流工作原理

```
[任务队列] → [获取任务] → [等待信号量] → [执行任务] → [释放信号量]
                                      ↓
                              (如果信号量已满则等待)
```

### 心跳报告中的限流信息

心跳报告中会显示当前并发任务状态：

```
------------------------------------------------------------
              📊 任务调度器状态报告
------------------------------------------------------------
  ...
  并发限制: 3/5    ← 当前活跃任务数 / 最大并发数
  ...
------------------------------------------------------------
```

---

## 快速开始

### 1. 启动任务调度器

有两种方式启动任务调度器：

#### 方式 A：独立进程（推荐）

```bash
python -m app.core.knowledgebase.server.task_executor
```

#### 方式 B：在代码中启动

```python
from app.core.knowledgebase.server.task_executor import task_executor

# 启动调度器
task_executor.start()

# 主线程保持运行
import time
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    task_executor.stop()
```

---

### 2. 提交任务

```python
from app.core.knowledgebase.server.task_executor import task_executor

# 提交文档切片任务
task = task_executor.submit_task(
    task_id="my_task_001",  # 可选，自动生成
    filename="document.pdf",
    binary=file_bytes,        # 文件二进制数据
    parse_type="naive",        # 切片策略：naive/book/paper等
    lang="Chinese",            # 语言：Chinese/English
    parser_config={            # 解析配置（可选）
        "chunk_token_num": 512,
        "delimiter": "\n!?。；！？"
    }
)

print(f"任务已提交: {task.task_id}")
```

---

### 3. 查询任务状态

```python
from app.core.knowledgebase.server.task_executor import task_executor

# 获取任务状态
task = task_executor.get_task_status("my_task_001")

if task:
    print(f"任务状态: {task.status.value}")
    print(f"进度: {task.progress:.1%}")
    print(f"消息: {task.progress_message}")
    
    if task.status == TaskStatus.COMPLETED:
        print(f"切片数量: {len(task.result)}")
    elif task.status == TaskStatus.FAILED:
        print(f"错误: {task.error}")
```

---

### 4. 取消任务

```python
from app.core.knowledgebase.server.task_executor import task_executor

# 取消任务
success = task_executor.cancel_task("my_task_001")
print(f"任务取消: {success}")
```

---

### 5. 清理任务

```python
from app.core.knowledgebase.server.task_executor import task_executor

# 清理任务（从内存和Redis中删除）
task_executor.cleanup_task("my_task_001")
```

---

## Redis 工具类使用

`redis_utils` 提供了便捷的 Redis 操作：

### 基本操作

```python
from app.database.redis_utils import redis_utils

# 检查可用性
if redis_utils.is_available:
    print("Redis可用")

# 设置值
redis_utils.set("my_key", "my_value", exp=3600)  # 1小时过期

# 获取值
value = redis_utils.get("my_key")

# 设置对象（自动JSON序列化）
redis_utils.set_obj("user", {"name": "张三", "age": 25})

# 获取对象
user = redis_utils.get_obj("user")

# 删除
redis_utils.delete("my_key")

# 检查存在
exists = redis_utils.exists("my_key")
```

### 队列操作

```python
from app.database.redis_utils import redis_utils

# 发送消息到队列
message = {"task_id": "123", "action": "process"}
redis_utils.queue_product("my_queue", message)

# 从队列消费消息（使用消费者组）
msg = redis_utils.queue_consumer(
    queue_name="my_queue",
    group_name="my_group",
    consumer_name="consumer_1"
)

if msg:
    data = msg.get_message()
    print(f"收到消息: {data}")
    
    # 处理完成后确认
    msg.ack()
```

---

## 任务状态

| 状态 | 值 | 说明 |
|------|-----|------|
| PENDING | pending | 任务已提交，等待处理 |
| RUNNING | running | 任务正在执行 |
| COMPLETED | completed | 任务执行成功 |
| FAILED | failed | 任务执行失败 |
| CANCELLED | cancelled | 任务已取消 |

---

## 完整示例

### 完整的工作流程

```python
import time
from app.core.knowledgebase.server.task_executor import (
    task_executor, TaskStatus
)

def process_document(filename, file_data):
    """处理文档的完整流程"""
    
    # 1. 提交任务
    task = task_executor.submit_task(
        filename=filename,
        binary=file_data,
        parse_type="naive",
        lang="Chinese"
    )
    
    print(f"任务已提交: {task.task_id}")
    
    # 2. 等待并查询状态
    while True:
        task = task_executor.get_task_status(task.task_id)
        
        if not task:
            print("任务不存在")
            break
        
        print(f"[{task.status.value}] {task.progress:.1%} - {task.progress_message}")
        
        if task.status == TaskStatus.COMPLETED:
            print(f"✅ 完成！共 {len(task.result)} 个切片")
            return task.result
        elif task.status == TaskStatus.FAILED:
            print(f"❌ 失败: {task.error}")
            return None
        elif task.status == TaskStatus.CANCELLED:
            print("⚠️  已取消")
            return None
        
        time.sleep(2)

# 使用示例
if __name__ == "__main__":
    # 启动调度器
    task_executor.start()
    
    try:
        # 读取文件
        with open("document.pdf", "rb") as f:
            file_data = f.read()
        
        # 处理文档
        chunks = process_document("document.pdf", file_data)
        
        if chunks:
            print(f"切片结果: {chunks[:3]}...")
            
    except KeyboardInterrupt:
        print("\n正在停止...")
    finally:
        task_executor.stop()
```

---

## 心跳报告

任务调度器每10秒会自动打印心跳报告：

```
------------------------------------------------------------
              📊 任务调度器状态报告
------------------------------------------------------------
  队列信息: document_chunk_queue
    - 待处理: 5
    - 消费者: 2
  待确认消息: 1
  内存任务:
    - 待执行: 3
    - 执行中: 1
    - 已完成: 15
    - 已失败: 2
  总任务数: 21
------------------------------------------------------------
```

---

## 架构说明

### 数据流

```
[提交任务] → [Redis Stream队列] → [消费者组] → [工作线程]
     ↓            ↓                   ↓            ↓
[任务存储]    [持久化]            [并行处理]   [结果存储]
     ↓            ↓                   ↓            ↓
[Redis Hash]  [Redis Stream]    [多Worker]   [Redis Hash]
```

### 目录结构

```
app/
├── database/
│   └── redis_utils.py          # Redis工具类
└── core/knowledge/
    └── server/
        ├── __init__.py
        └── task_executor.py    # 任务调度器
```

---

## 最佳实践

1. **启动调度器** - 在项目启动时启动任务调度器
2. **错误处理** - 总是检查任务状态，处理 FAILED 情况
3. **资源清理** - 任务完成后及时调用 `cleanup_task()` 释放资源
4. **监控** - 关注心跳报告中的待处理任务数量
5. **重试机制** - Redis工具类已内置重试机制，无需额外处理
6. **优雅关闭** - 接收 SIGINT/SIGTERM 时调用 `stop()` 安全退出

---

## 故障排查

### Redis连接失败

**问题**: `Redis不可用`

**解决方案**:
1. 检查 Redis 服务是否启动
2. 检查配置文件中的 host/port 是否正确
3. 检查防火墙设置
4. 运行 `redis-cli ping` 测试连接

### 任务不执行

**问题**: 任务提交后一直处于 PENDING 状态

**解决方案**:
1. 确认任务调度器已启动
2. 检查心跳报告中的队列信息
3. 查看是否有错误日志

### 任务执行失败

**问题**: 任务状态变为 FAILED

**解决方案**:
1. 获取任务对象查看 `task.error` 字段
2. 检查文件格式是否支持
3. 检查切片策略配置

---

## API 参考

### TaskExecutor 类

#### 方法

| 方法 | 说明 |
|------|------|
| `start()` | 启动任务调度器 |
| `stop()` | 停止任务调度器 |
| `submit_task(...)` | 提交新任务 |
| `get_task_status(task_id)` | 获取任务状态 |
| `cancel_task(task_id)` | 取消任务 |
| `cleanup_task(task_id)` | 清理任务 |

#### 属性

| 属性 | 说明 |
|------|------|
| `QUEUE_NAME` | 队列名称 |
| `GROUP_NAME` | 消费者组名称 |
| `CONSUMER_NAME` | 消费者名称 |
| `TASK_KEY_PREFIX` | 任务存储Key前缀 |

### DocumentTask 类

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `task_id` | str | 任务ID |
| `filename` | str | 文件名 |
| `parse_type` | str | 切片策略 |
| `lang` | str | 语言 |
| `status` | TaskStatus | 任务状态 |
| `progress` | float | 进度 (0.0-1.0) |
| `progress_message` | str | 进度消息 |
| `result` | List[Dict] | 切片结果 |
| `error` | str | 错误信息 |
| `created_at` | datetime | 创建时间 |
| `started_at` | datetime | 开始时间 |
| `completed_at` | datetime | 完成时间 |

---

## 相关文档

- [README.md](README.md) - 文档切片功能说明
- [ES_ENHANCEMENTS.md](ES_ENHANCEMENTS.md) - ES增强功能说明
- [ALL_STRATEGIES_REPORT.md](ALL_STRATEGIES_REPORT.md) - 切片策略说明

---

**Generated on**: 2026-04-07  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
