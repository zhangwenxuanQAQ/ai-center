# 版本控制功能实施计划

## 仓库调研结论

### 后端模块结构（基于API路由前缀）
| 模块 | API前缀 | 说明 |
|------|---------|------|
| user | `/user` | 用户管理 |
| llm_model | `/llm_model` | 模型管理 |
| prompt | `/prompt` | 提示词 |
| datasource | `/datasource`, `/datasource_category` | 数据源 |
| knowledgebase | `/knowledgebase` | 知识库 |
| mcp | `/mcp` | MCP服务 |
| toolkit | `/toolkit` | 工具箱 |
| chatbot | `/chatbot`, `/chatbot_category` | 机器人 |
| chat | `/chat` | 聊天 |
| agent | `/agent` | 智能体 |
| system_monitor | `/system` | 系统监控 |
| integration | `/integration` | 集成/插件 |
| ontology | `/ontology` | 本体 |

### 前端模块结构（基于路由和菜单）
- **首页** (`/`) - Home
- **聊天** (`/chats`) - Chat
- **本体工作台** (`/ontology/objects`, `/ontology/tasks`) - Ontology
- **配置组**: 机器人、知识库、智能体、工具箱、提示词、模型管理、数据源
- **日志**: 问答日志
- **系统**: 监控

### 数据库表映射
- user: `user`
- llm_model: `llm_model`, `llm_category`
- prompt: `prompt`, `prompt_category`
- datasource: `datasource`, `datasource_category`
- knowledgebase: `knowledgebase`, `knowledgebase_category`, `knowledgebase_document`, `knowledgebase_document_category`
- mcp: `mcp_server`, `mcp_category`, `mcp_tool`
- toolkit: `toolkit_category`
- chatbot: `chatbot`, `chatbot_category`, `chatbot_model`, `chatbot_mcp`, `chatbot_tool`, `chatbot_knowledgebase`, `chatbot_prompt`, `chatbot_integration`
- chat: `chat`, `chat_message`, `chatbot_chat`, `chatbot_chat_message`
- agent: `agent_instance`, `agent_category`, `agent_component`
- ontology: `ontology_object`, `ontology_task`

### 核心依赖关系
```
user (核心模块，几乎所有模块依赖)
├── llm_model (chatbot/chat/agent/integration 依赖)
│   ├── chatbot (依赖: llm_model, prompt, knowledgebase, mcp, toolkit, user)
│   │   ├── chat (依赖: chatbot, llm_model)
│   │   └── integration (依赖: chatbot, llm_model)
│   └── agent (依赖: llm_model, prompt, knowledgebase, mcp, toolkit, chatbot, user)
├── prompt (chatbot/agent 依赖)
├── knowledgebase (chatbot/agent 依赖)
├── mcp (chatbot/agent 依赖)
├── toolkit (chatbot/agent 依赖)
├── datasource (ontology 依赖)
│   └── ontology (依赖: datasource)
└── system_monitor (依赖: user)
```

### 技术方案
采用**运行时配置**方式而非物理删除代码文件：
1. 创建版本配置文件（YAML），定义可用模块
2. 后端启动时读取配置，条件性注册API路由和创建数据库表
3. 前端构建时嵌入配置，条件性渲染菜单和路由
4. Docker构建时复制对应的版本配置文件

---

## 文件和模块变更

### 新建文件
1. **`configs/modules_config.yaml`** - 模块注册表配置（定义所有模块、依赖关系、API前缀、前端路由、数据库表）
2. **`app/versioning/__init__.py`** - 版本管理模块入口
3. **`app/versioning/manager.py`** - 版本管理器（加载配置、解析依赖、提供查询接口）
4. **`docker/versions/full/Dockerfile`** - 满血版Dockerfile
5. **`docker/versions/full/README.md`** - 满血版说明
6. **`docker/versions/full/docker-compose.yml`** - 满血版docker-compose
7. **`docker/versions/specified/Dockerfile`** - 指定功能版Dockerfile
8. **`docker/versions/specified/README.md`** - 指定功能版说明
9. **`docker/versions/specified/docker-compose.yml`** - 指定功能版docker-compose
10. **`docker/versions/specified/modules_config.yaml`** - 指定功能版的模块配置示例
11. **`docker/versions/404.html`** - 前端404页面

### 修改文件
1. **`app/api/__init__.py`** - 条件性注册API路由
2. **`app/database/models.py`** - 条件性创建数据库表
3. **`app/server.py`** - 条件性执行数据库迁移
4. **`app/main.py`** - 启动时加载版本配置
5. **`app/configs/config.py`** - 添加版本配置读取
6. **`web/src/App.tsx`** - 条件性渲染菜单和路由，添加404页面
7. **`web/src/config.ts`** - 添加模块配置读取
8. **`web/src/services/config.ts`** (新建) - 前端版本配置服务
9. **`web/src/pages/notfound/notfound.tsx`** (新建) - 404页面组件
10. **`docker/Dockerfile`** - 修改为默认指向full版本
11. **`docker/nginx/aicenter.conf`** - 添加API模块过滤中间件配置

---

## 实施步骤

### 步骤1: 创建模块注册表配置文件
创建 `configs/modules_config.yaml`，定义：
- 所有模块的唯一标识符
- 每个模块的API路由前缀列表
- 每个模块的前端路由列表和菜单键
- 每个模块关联的数据库表
- 每个模块的依赖关系

### 步骤2: 创建后端版本管理器
创建 `app/versioning/manager.py`：
- `ModuleConfig` 类：解析单个模块配置
- `VersionManager` 类：加载配置、解析传递依赖、提供查询接口
- 支持 `is_module_enabled(module_name)` 查询
- 支持 `get_enabled_modules()` 获取所有启用模块
- 支持 `get_enabled_tables()` 获取启用的数据库表
- 支持 `get_enabled_api_prefixes()` 获取启用的API前缀
- 支持 `get_enabled_frontend_routes()` 获取启用的前端路由
- 支持 `get_module_dependencies(module_name)` 获取模块依赖

### 步骤3: 修改后端API路由注册
修改 `app/api/__init__.py`：
- 导入 VersionManager
- 根据启用的模块条件性注册路由
- 未启用模块的路由不注册到 FastAPI

### 步骤4: 添加API访问控制中间件
在 `app/server.py` 中添加：
- 版本检查中间件，拦截对禁用模块API的请求
- 返回403 Forbidden或自定义错误响应

### 步骤5: 修改数据库表创建逻辑
修改 `app/database/models.py`：
- `create_tables()` 方法接受启用的模块列表参数
- 只创建启用模块关联的表

### 步骤6: 修改数据库迁移逻辑
修改 `app/server.py`：
- 数据库迁移逻辑只处理启用模块的表
- 跳过禁用模块的迁移

### 步骤7: 创建前端版本配置服务
创建 `web/src/services/config.ts`：
- 定义模块配置的TypeScript接口
- 提供版本配置常量
- 导出 `getEnabledModules()` 函数

### 步骤8: 修改前端菜单和路由
修改 `web/src/App.tsx`：
- 从版本配置获取启用的模块
- 条件性渲染侧边栏菜单项
- 条件性注册前端路由
- 添加通配符404路由
- 集成页面路由也做条件性处理

### 步骤9: 创建404页面
创建 `web/src/pages/notfound/notfound.tsx`：
- 美观的404错误页面
- 返回首页按钮
- 返回上一页按钮

### 步骤10: 创建版本Docker目录结构
创建 `docker/versions/` 目录：
- `full/` 满血版（默认包含所有模块）
  - Dockerfile
  - docker-compose.yml
  - README.md
- `specified/` 指定功能版
  - Dockerfile
  - docker-compose.yml
  - modules_config.yaml（示例配置）
  - README.md

### 步骤11: 创建版本特定Dockerfile
每个版本的Dockerfile：
- 基于主项目Dockerfile结构
- 复制对应版本的 `modules_config.yaml` 到 `/aicenter/configs/`
- 指定版本标签

### 步骤12: 创建nginx配置更新
修改 `docker/nginx/aicenter.conf`：
- 添加API访问控制的location规则
- 对禁用模块的API路径返回403

---

## 依赖关系和注意事项

1. **核心模块 user** 必须在所有版本中启用
2. **llm_model** 是多个模块的依赖，通常需要启用
3. **chatbot** 依赖最多，需要 llm_model, prompt, knowledgebase, mcp, toolkit
4. **agent** 依赖 chatbot + 其他多个模块
5. **integration** 依赖 chatbot
6. **ontology** 依赖 datasource
7. **知识图谱功能** (ontology) 依赖数据源模块
8. 前端路由变更需要重新构建前端
9. 后端路由过滤使用条件性注册，非中间件拦截（性能更优）
10. 数据库表创建采用"按需创建"策略，已存在的表不受影响

---

## 验证方法

1. **满血版验证**：
   - 启动满血版，确认所有菜单、路由、API正常工作
   - 访问所有前端页面无404错误
   - 所有API接口可正常访问

2. **指定功能版验证**：
   - 仅启用 `user`, `llm_model`, `prompt`, `chatbot`, `chat` 模块
   - 确认菜单只显示对应模块
   - 尝试访问禁用模块URL，显示404页面
   - 尝试调用禁用模块API，返回403错误
   - 数据库只创建启用模块的表

3. **依赖自动解析验证**：
   - 仅指定 `chat` 模块，验证 `llm_model`, `chatbot` 依赖自动启用
   - 仅指定 `agent` 模块，验证所有传递依赖自动启用

4. **Docker构建验证**：
   - 构建满血版镜像成功
   - 构建指定功能版镜像成功
   - 运行指定功能版容器，功能正常

---

## 风险与处理

| 风险 | 处理方案 |
|------|---------|
| 模块间代码存在隐式依赖（非API层） | 采用"全量代码+配置过滤"方式，不物理删除代码，避免隐式依赖断裂 |
| 前端构建时模块配置硬编码 | 通过环境变量或配置文件注入，支持构建时动态配置 |
| 数据库迁移与版本配置冲突 | 迁移逻辑只处理启用模块的表，禁用模块的表保留在数据库中但不使用 |
| 前端路由在未加载配置时短暂可见 | 添加版本配置预加载机制，在应用初始化时先加载配置再渲染 |
| Docker镜像体积优化 | 后续可根据版本物理删除不必要的代码文件 |
| 现有缓存/持久化数据兼容 | 已存在的数据库表不因版本切换而删除，仅影响新功能可用