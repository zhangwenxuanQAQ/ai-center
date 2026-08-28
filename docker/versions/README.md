# AI Center 版本管理

AI Center 支持多个版本，可根据客户需求打包不同功能模块的镜像。

## 快速开始

### 使用构建脚本（推荐）

使用 `build.py` 脚本可以自动根据模块配置生成 Dockerfile 并构建镜像：

```bash
# 构建满血版（包含所有功能）
python docker/versions/build.py --version full

# 构建自定义功能版（根据配置文件）
python docker/versions/build.py --version custom

# 仅生成 Dockerfile，不构建镜像（输出到 stdout）
python docker/versions/build.py --version custom --no-build

# 仅生成 Dockerfile 并保存到指定文件
python docker/versions/build.py --version custom --no-build -o my.Dockerfile

# 使用自定义配置文件
python docker/versions/build.py --config docker/versions/my-version/modules_config.yaml

# 自定义镜像标签
python docker/versions/build.py --version custom -t my-registry/aicenter:v1.0
```

> **注意**：构建镜像时不会生成 `Dockerfile.generated` 临时文件，Dockerfile 内容通过 stdin 直接传递给 `docker build -f -`。

### 直接使用 Dockerfile（传统方式）

```bash
# 满血版
docker build -f docker/versions/full/Dockerfile -t aicenter:full .

# 自定义版
docker build -f docker/versions/custom/Dockerfile -t aicenter:custom .
```

## 版本说明

### 1. 满血版（full）
包含所有功能模块，适用于需要完整功能的客户。

**特性：**
- 启用全部 13 个功能模块
- 包含所有模块相关的资源文件（如知识库的 nltk_data、模型文件等）
- 无需额外配置

### 2. 自定义功能版（custom）
根据配置文件指定启用的功能模块，系统会自动解析依赖关系。

**配置文件：** `docker/versions/custom/modules_config.yaml`

**修改配置：**
```yaml
# 编辑 docker/versions/custom/modules_config.yaml
enabled_modules:
  - user          # 用户管理（必须）
  - llm_model     # 模型管理
  - chatbot       # 机器人
  # ... 添加其他需要的模块
```

## 可用模块列表

| 模块名 | 说明 | 依赖 |
|--------|------|------|
| `user` | 用户管理 | 无（核心模块，必须启用） |
| `llm_model` | 模型管理 | 无 |
| `prompt` | 提示词 | 无 |
| `datasource` | 数据源 | 无 |
| `knowledgebase` | 知识库 | llm_model |
| `mcp` | MCP服务 | 无 |
| `toolkit` | 工具箱 | 无 |
| `chatbot` | 机器人 | user, llm_model, prompt, knowledgebase, mcp, toolkit |
| `chat` | 聊天 | user, llm_model, chatbot |
| `agent` | 智能体 | user, llm_model, prompt, knowledgebase, mcp, toolkit, chatbot |
| `system_monitor` | 系统监控 | user |
| `integration` | 插件集成 | user, llm_model, chatbot |
| `ontology` | 本体工作台 | user, datasource |

## 依赖自动解析

启用某个模块时，系统会自动启用其所有依赖模块。例如：

- 启用 `chatbot` → 自动启用 `user`, `llm_model`, `prompt`, `knowledgebase`, `mcp`, `toolkit`
- 启用 `agent` → 自动启用 `user`, `llm_model`, `prompt`, `knowledgebase`, `mcp`, `toolkit`, `chatbot`
- 启用 `chat` → 自动启用 `user`, `llm_model`, `chatbot`

## 模块特定文件处理

Dockerfile 支持条件性包含模块特定文件。使用以下标记格式：

```dockerfile
# [MODULE:module_name:START]
COPY path/to/module_files /destination
# [MODULE:module_name:END]
```

**示例：**
```dockerfile
# [MODULE:knowledgebase:START]
COPY app/core/knowledgebase/rag/res/nltk_data /root/nltk_data
COPY model_file_path model_destination
# [MODULE:knowledgebase:END]
```

当 `knowledgebase` 模块未启用时，上述 COPY 指令会被自动跳过。

**如何添加新的模块特定文件：**
1. 在 Dockerfile 中使用 `# [MODULE:xxx:START]` 和 `# [MODULE:xxx:END]` 标记包裹相关指令
2. 确保 `modules_config.yaml` 中定义了对应的模块
3. 运行 `build.py` 时会自动处理这些标记

## 版本行为

### 前端
- 侧边栏菜单仅显示当前版本启用的功能模块
- 尝试访问未启用模块的页面时，显示 404 页面

### 后端
- 仅注册启用模块的 API 路由
- 对未启用模块的 API 请求返回 403 Forbidden
- 仅创建启用模块对应的数据库表

### 数据库
- 仅创建启用模块关联的数据库表
- 减少资源占用，提高启动速度

## 自定义新版本

如需创建新版本，可按以下步骤操作：

```bash
# 1. 复制模板
cp -r docker/versions/custom docker/versions/my-version

# 2. 修改配置文件
#    编辑 docker/versions/my-version/modules_config.yaml
#    修改 enabled_modules 列表

# 3. 修改 Dockerfile 标签
#    LABEL version="my-version"
#    LABEL description="AI Center My Version"

# 4. 构建镜像
python docker/versions/build.py --version my-version
# 或
python docker/versions/build.py --config docker/versions/my-version/modules_config.yaml
```

## build.py 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--version`, `-v` | 版本名称 (full/custom) | `--version full` |
| `--config`, `-c` | 自定义配置文件路径 | `--config docker/versions/my-version/modules_config.yaml` |
| `--output`, `-o` | 输出 Dockerfile 路径（仅 `--no-build` 时生效） | `--no-build -o my.Dockerfile` |
| `--image-tag`, `-t` | Docker 镜像标签 | `-t aicenter:v1.0` |
| `--no-build` | 仅生成 Dockerfile，不构建镜像（默认输出到 stdout） | `--no-build` |
| `--no-cache` | 不使用缓存构建镜像 | `--no-cache` |

## 注意事项

1. **配置文件位置**：运行时配置文件位于 `/aicenter/configs/modules_config.yaml`
2. **默认行为**：如果未找到配置文件，默认启用所有模块（满血版行为）
3. **热更新**：修改配置文件后需要重启服务生效
4. **核心模块**：`user` 是核心模块，所有版本都必须启用
5. **依赖解析**：`build.py` 会自动解析模块依赖，但仅在配置文件包含 `modules` 定义时生效
6. **模块文件标记**：Dockerfile 中的 `# [MODULE:xxx:START]` 标记用于条件性包含文件

## 目录结构

```
docker/versions/
├── README.md                    # 本说明文档
├── build.py                     # 构建脚本（自动处理模块依赖和文件）
├── full/                        # 满血版
│   ├── modules_config.yaml      # 启用所有模块的配置
│   └── Dockerfile              # 满血版构建文件
└── custom/                      # 自定义功能版
    ├── modules_config.yaml      # 指定功能模块的配置（可修改）
    └── Dockerfile              # 自定义版构建文件
```