# 文档切片功能说明

## 概述

本项目基于 RAGFLOW 项目实现了完整的文档解析和切片功能，支持多种文档格式的智能分块处理。

## 功能特性

### 支持的文档格式

- **PDF** - 支持OCR识别、布局分析、表格提取
- **DOCX** - Word文档解析，保留格式和结构
- **XLS/XLSX** - Excel表格解析
- **PPT/PPTX** - PowerPoint演示文稿
- **TXT** - 纯文本文件
- **MD/Markdown** - Markdown文档
- **HTML** - 网页内容
- **JSON** - JSON数据文件

### 切片策略

1. **Naive（通用）** - 基于分隔符的简单切片
2. **Q&A** - 问答对提取（开发中）
3. **Paper** - 论文结构化切片（开发中）
4. **Book** - 书籍章节切片（开发中）
5. **Laws** - 法律法规切片（开发中）

## 目录结构

```
app/core/knowledge/
├── deepdoc/                    # Deepdoc解析器代码
│   ├── parser/                 # 各种文件格式解析器
│   │   ├── pdf_parser.py       # PDF解析器
│   │   ├── docx_parser.py      # DOCX解析器
│   │   ├── excel_parser.py     # Excel解析器
│   │   ├── txt_parser.py       # TXT解析器
│   │   ├── html_parser.py      # HTML解析器
│   │   ├── markdown_parser.py  # Markdown解析器
│   │   └── ...                 # 其他解析器
│   └── vision/                 # 视觉识别模块
│       ├── ocr.py              # OCR文字识别
│       ├── recognizer.py       # 布局识别
│       └── ...
├── rag/                        # RAG核心模块
│   ├── __init__.py
│   ├── app/                    # 应用层
│   │   ├── __init__.py
│   │   └── naive.py            # Naive切片方法实现
│   ├── nlp/                    # 自然语言处理
│   │   ├── __init__.py
│   │   ├── rag_tokenizer.py    # 分词器
│   │   └── search.py           # 搜索和文本处理
│   ├── utils/                  # 工具类
│   │   └── __init__.py         # 文件处理、链接提取等
│   └── svr/                    # 服务层
│       ├── __init__.py
│       └── task_executor.py    # 任务执行器
```

## 快速开始

### 基本使用

```python
from app.core.knowledge.rag.app.naive import chunk

# 方式1：通过文件路径
result = chunk(
    filename="document.pdf",
    lang="Chinese",
    callback=my_callback
)

# 方式2：通过二进制数据
with open("document.pdf", "rb") as f:
    binary = f.read()

result = chunk(
    filename="document.pdf",
    binary=binary,
    lang="Chinese",
    parser_config={
        "chunk_token_num": 512,
        "delimiter": "\n!?。；！？",
        "layout_recognize": "DeepDOC"
    }
)

# 处理结果
for doc in result:
    print(f"Content: {doc.get('content_with_weight', '')[:100]}...")
    print(f"Tokens: {doc.get('content_ltks', '')}")
```

### 使用任务执行器

```python
from app.core.knowledge.rag.svr.task_executor import (
    task_executor,
    create_and_execute_task,
    TaskStatus
)

# 提交并执行任务
success, result = create_and_execute_task(
    task_id="task_001",
    filename="test.pdf",
    binary=file_binary,
    parse_type="naive",
    lang="Chinese",
    callback=lambda p, msg: print(f"[{p}] {msg}")
)

if success:
    print(f"成功生成 {len(result)} 个切片")
else:
    print(f"任务失败: {result}")

# 异步方式
task = task_executor.submit_task(
    task_id="task_002",
    filename="large_file.pdf",
    binary=large_binary
)

# 后续查询状态
status = task_executor.get_task_status("task_002")
print(status)

# 获取结果
result = task_executor.get_task_result("task_002")
```

## 配置参数

### parser_config 配置项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| chunk_token_num | int | 512 | 每个chunk的最大token数 |
| delimiter | str | "\n!?。；！？" | 分隔符 |
| layout_recognize | str | "DeepDOC" | 布局识别器 (DeepDOC/Plain Text/Vision) |
| analyze_hyperlink | bool | True | 是否分析超链接 |
| children_delimiter | str | "" | 子级分隔符 |
| table_context_size | int | 0 | 表格上下文大小 |
| image_context_size | int | 0 | 图片上下文大小 |
| overlapped_percent | float | 0 | 重叠百分比 (0-100) |

### ES配置

在 `configs/server_config.yaml` 中配置：

```yaml
es:
  host: '127.0.0.1'
  port: 9200
  username: 'elastic'
  password: '123456'
```

## API接口

### 提交切片任务

**POST** `/api/knowledge/chunk`

请求体：
```json
{
    "filename": "document.pdf",
    "parse_type": "naive",
    "lang": "Chinese",
    "parser_config": {
        "chunk_token_num": 512,
        "delimiter": "\n!?。；！？"
    }
}
```

响应：
```json
{
    "code": 200,
    "message": "任务提交成功",
    "data": {
        "task_id": "task_xxx",
        "status": "running"
    }
}
```

### 查询任务状态

**GET** `/api/knowledge/task/{task_id}`

响应：
```json
{
    "code": 200,
    "message": "success",
    "data": {
        "task_id": "task_xxx",
        "status": "completed",
        "progress": 1.0,
        "message": "完成，共生成25个切片"
    }
}
```

### 获取切片结果

**GET** `/api/knowledge/result/{task_id}`

## 核心组件说明

### 1. Deepdoc 解析器

基于深度学习的文档解析引擎：

- **PDF Parser**: 支持OCR、布局分析、表格识别
- **DOCX Parser**: 保留Word文档的格式和结构
- **Vision Module**: 图片和表格的视觉识别

### 2. NLP 分词

- 中英文混合分词
- 细粒度关键词提取
- Token数量计算
- 文本预处理

### 3. 切片算法

- **Naive Merge**: 基于token数量的简单合并
- **Hierarchical Merge**: 层次化合并（保留标题结构）
- **Context Attachment**: 为图片/表格添加上下文

### 4. 任务调度

- 并发任务控制
- 进度回调机制
- 任务生命周期管理
- 结果缓存

## 依赖安装

核心依赖：

```
# PDF处理
PyPDF2>=3.0.0

# Office文档
python-docx>=0.8.11
openpyxl>=3.1.0

# Markdown
markdown>=3.4.0
beautifulsoup4>=4.12.0

# 图像处理
Pillow>=10.0.0

# Elasticsearch
elasticsearch>=8.0.0
elasticsearch-dsl>=8.0.0

# 编码检测
chardet>=5.0.0
```

## 最佳实践

1. **选择合适的chunk_size**
   - 短文本: 256-512 tokens
   - 长文档: 1024-2048 tokens
   - 问答场景: 较小的chunks提高精度

2. **设置合理的分隔符**
   - 中文: `\n!?。；！？`
   - 英文: `\n.!?;`
   - 代码: `\n`

3. **启用超链接分析**
   - 对网页和电子书很重要
   - 可以提取引用的外部内容

4. **使用上下文增强**
   - `table_context_size`: 为表格添加周围文本
   - `image_context_size`: 为图片添加描述性文本

5. **监控任务进度**
   - 使用回调函数实时获取进度
   - 大文件处理时特别重要

## 故障排查

### 常见问题

1. **PDF解析失败**
   - 检查PDF是否加密或损坏
   - 尝试使用不同的layout_recognizer
   - 安装OCR依赖 (paddleocr/tesseract)

2. **内存不足**
   - 减小chunk_token_num
   - 分批处理大文件
   - 增加系统内存

3. **中文乱码**
   - 检查文件编码
   - 设置正确的lang参数
   - 确保chardet已安装

4. **ES连接失败**
   - 检查ES服务是否启动
   - 验证server_config.yaml中的配置
   - 检查网络连接

## 扩展开发

### 添加新的解析类型

1. 在 `rag/app/` 下创建新模块
2. 实现 `chunk()` 函数
3. 在 `TaskExecutor.PARSE_TYPE_MAP` 中注册
4. 更新API接口

### 自定义分词器

继承 `RagTokenizer` 类：

```python
from app.core.knowledge.rag.nlp.rag_tokenizer import RagTokenizer

class CustomTokenizer(RagTokenizer):
    def tokenize(self, text):
        # 自定义分词逻辑
        return custom_tokenize(text)
```

## 版本信息

- 基于RAGFLOW v0.24.0
- 适配本项目的架构和编码规范
- 移除了graphrag和llm相关依赖

## 许可证

遵循原RAGFLOW项目的Apache 2.0许可证
