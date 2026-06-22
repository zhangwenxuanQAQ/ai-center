# 大模型AI服务中心

## 项目简介

大模型AI服务中心是一个集成了多种AI功能的管理系统，提供完整的AI应用开发和管理平台。系统支持多种大语言模型接入、知识库管理、智能对话机器人、MCP工具调用等核心功能。

### 核心功能模块

1. **机器人管理**：支持创建和管理多个智能对话机器人，可配置不同的模型、提示词和知识库
2. **MCP管理**：集成MCP（Model Context Protocol）协议，支持自定义工具和API调用
3. **知识库管理**：支持多种文档格式的上传、解析和向量化检索，包括PDF、Word、Excel、PPT等
4. **模型管理**：统一管理多种大语言模型，支持OpenAI、DeepSeek、GLM、Qwen等主流模型
5. **提示词管理**：提示词模板的创建、编辑和管理
6. **数据源管理**：支持MySQL、PostgreSQL、Oracle、SQL Server、RustFS、S3等多种数据源
7. **用户管理**：用户权限和角色管理
8. **聊天记录管理**：完整的对话历史记录和检索功能
9. **系统监控**：实时监控系统运行状态和性能指标

### 技术特性

- **RAG增强检索**：集成先进的文档解析和向量检索技术，支持DeepDoc文档解析
- **多模型支持**：支持文本生成、图像理解、语音识别、语音合成等多种AI能力
- **企业微信集成**：支持与企业微信对接，实现智能客服功能
- **Docker部署**：支持容器化部署，快速搭建生产环境

## 技术栈

### 后端
- **Python**: 3.10+
- **Web框架**: FastAPI
- **ORM**: Peewee + Playhouse
- **数据库**: MySQL
- **缓存**: Redis
- **搜索引擎**: Elasticsearch
- **对象存储**: RustFS/MinIO/S3
- **数据验证**: Pydantic
- **异步服务器**: Uvicorn
- **文档解析**: DeepDoc、PaddleOCR、MinerU
- **向量检索**: Elasticsearch

### 前端
- **框架**: React 18
- **UI库**: Ant Design 5
- **路由**: React Router 6
- **构建工具**: Vite 5
- **状态管理**: Zustand
- **样式**: Less + CSS Modules
- **语言**: TypeScript
- **图表**: @ant-design/charts
- **Markdown**: react-markdown、@uiw/react-md-editor

## 项目结构

```
ai-center/
├── app/                           # 后端应用
│   ├── api/                       # API控制器层
│   │   ├── chat/                  # 聊天相关接口
│   │   ├── system/                # 系统监控接口
│   │   ├── chatbot.py             # 机器人管理接口
│   │   ├── chatbot_category.py    # 机器人分类接口
│   │   ├── knowledgebase.py       # 知识库管理接口
│   │   ├── llm_model.py           # 模型管理接口
│   │   ├── mcp.py                 # MCP管理接口
│   │   ├── prompt.py              # 提示词管理接口
│   │   ├── datasource.py          # 数据源管理接口
│   │   └── user.py                # 用户管理接口
│   ├── configs/                   # 配置文件
│   ├── constants/                 # 常量定义
│   ├── core/                      # 核心业务逻辑
│   │   ├── agent/                 # Agent相关
│   │   ├── chat/                  # 聊天核心逻辑
│   │   ├── chatbot/               # 机器人核心逻辑
│   │   ├── datasource/            # 数据源连接器
│   │   ├── knowledgebase/         # 知识库核心逻辑
│   │   │   ├── deepdoc/           # 文档解析模块
│   │   │   ├── document/          # 文档上传下载
│   │   │   └── rag/               # RAG检索增强
│   │   ├── llm_model/             # 模型调用封装
│   │   ├── mcp/                   # MCP协议实现
│   │   ├── prompt/                # 提示词处理
│   │   └── user/                  # 用户核心逻辑
│   ├── database/                  # 数据库管理
│   │   ├── migrations/            # 数据库迁移脚本
│   │   ├── storage/               # 存储工具
│   │   ├── database.py            # 数据库连接
│   │   ├── db_utils.py            # 数据库工具
│   │   ├── es_utils.py            # ES工具
│   │   ├── models.py              # 数据模型
│   │   └── redis_utils.py         # Redis工具
│   ├── services/                  # 服务层（CRUD操作）
│   │   ├── chat/                  # 聊天服务
│   │   ├── chatbot/               # 机器人服务
│   │   ├── knowledgebase/         # 知识库服务
│   │   ├── llm_model/             # 模型服务
│   │   ├── mcp/                   # MCP服务
│   │   ├── prompt/                # 提示词服务
│   │   ├── datasource/            # 数据源服务
│   │   └── user/                  # 用户服务
│   ├── test/                      # 测试和验证脚本
│   ├── server_run.py              # 服务定义
│   ├── server_wsgi.py             # 生产环境入口
│   ├── start_server.py            # 启动后端服务入口
│   └── mcp_server.py              # MCP服务器入口
│
├── web/                           # 前端应用
│   ├── src/
│   │   ├── pages/                 # 页面组件
│   │   │   ├── chat/              # 聊天页面
│   │   │   ├── chatbot/           # 机器人管理页面
│   │   │   ├── knowledgebase/     # 知识库管理页面
│   │   │   ├── llm_model/         # 模型管理页面
│   │   │   ├── mcp/               # MCP管理页面
│   │   │   ├── prompt/            # 提示词管理页面
│   │   │   ├── datasource/        # 数据源管理页面
│   │   │   ├── user/              # 用户管理页面
│   │   │   └── system/            # 系统监控页面
│   │   ├── services/              # API服务
│   │   ├── components/            # 公共组件
│   │   ├── constants/             # 常量定义
│   │   ├── utils/                 # 工具类
│   │   ├── styles/                # 样式文件
│   │   ├── App.tsx                # 应用入口
│   │   └── main.tsx               # 渲染入口
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── configs/                       # 配置文件目录
│   └── server_config.yaml         # 服务器配置
│
├── docker/                        # Docker部署文件
│   ├── Dockerfile                 # Docker镜像构建文件
│   └── docker-compose.yml         # Docker编排文件
│
├── .venv/                         # Python虚拟环境
├── requirements.txt               # Python依赖
├── pyproject.toml                 # 项目配置
├── uv.lock                        # uv依赖锁定文件
├── PROJECT_VERSION                # 版本号文件
└── README.md                      # 项目说明
```

## 核心特性

### 1. 统一的API响应格式
所有API接口返回统一的JSON格式：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

### 2. UUID主键
所有数据库表使用UUID作为主键，确保全局唯一性和安全性。

### 3. 公共字段
所有模型都包含以下公共字段：
- `id`: UUID主键
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `create_user_id`: 创建用户ID
- `update_user_id`: 更新用户ID

### 4. 全局错误处理
前端实现了全局错误消息提示，无论是网络错误还是业务错误都会自动提示用户。

### 5. 参数校验
所有API接口的必填参数都进行了严格的校验，确保数据安全。

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 16+
- MySQL 5.7+
- Redis 5.0+
- Elasticsearch 8.0+
- RustFS 或 MinIO（可选，用于文件存储）

### 后端服务

1. 安装依赖
   ```bash
   # 使用pip
   pip install -r requirements.txt
   
   # 或使用uv（推荐）
   uv pip install -r requirements.txt
   ```

2. 配置数据库
   修改 `configs/server_config.yaml` 中的数据库配置

3. 启动服务
   ```bash
   python -m app.start_server
   ```
   后端服务将运行在 http://0.0.0.0:8081
   
   **说明**：
   - 新版本使用 `app.start_server` 作为启动入口
   - 支持多worker模式，根据CPU核心数自动调整（最多8个worker）
   - MCP服务和文档切片任务执行器只启动一次，避免端口冲突

### 前端服务

1. 安装依赖
   ```bash
   cd web
   npm install
   ```

2. 启动服务
   ```bash
   npm run dev
   ```
   前端服务将运行在 http://localhost:8000

## Docker部署

### 环境需求

#### 基础环境
- Docker 20.10+
- Docker Compose 2.0+
- 至少4GB可用内存
- 至少10GB可用磁盘空间

#### 第三方依赖服务
- **MySQL 8.0+**: 数据存储
- **Redis 5.0+**: 缓存和会话管理
- **Elasticsearch 8.0+**: 向量检索和全文搜索
- **RustFS/MinIO**: 文件存储（可选）

### 环境变量配置

项目支持通过环境变量覆盖`server_config.yaml`中的配置项。环境变量的优先级高于YAML文件配置。

创建 `.env` 文件或直接修改 `docker/docker-compose.yml` 中的环境变量：

**环境变量命名规则**：将YAML配置路径转换为大写，用下划线连接
- 例如：`mysql.host` → `MYSQL_HOST`，`es.username` → `ES_USER`

详细的环境变量说明请参考：[docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)

```bash
# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8081

# MySQL配置
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=ai_center

# Redis配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=1

# Elasticsearch配置
ES_HOST=elasticsearch
ES_PORT=9200
ES_USER=elastic
ES_PASSWORD=your_password

# RustFS/MinIO配置（可选）
RUSTFS_HOST=rustfs
RUSTFS_PORT=9000
RUSTFS_USER=rustfsadmin
RUSTFS_PASSWORD=rustfsadmin
```

### 打包步骤

1. **构建前端**
   ```bash
   cd web
   npm install
   npm run build
   cd ..
   ```

2. **构建Docker镜像**
   ```bash
   # 进入docker目录
   cd docker
   
   # 构建镜像（镜像名称来自PROJECT_VERSION文件）
   # 在项目根目录执行
   docker build -t ai-center:aihub_v2_beta_0.1 -f docker/Dockerfile .
   
   # 或使用docker-compose构建（完整环境）
   docker-compose build
   
   # 或仅构建应用镜像（使用已部署的数据库）
   docker-compose -f docker-compose-app.yml build
   ```

3. **推送镜像到仓库（可选）**
   ```bash
   docker tag ai-center:$(cat PROJECT_VERSION) your-registry/ai-center:$(cat PROJECT_VERSION)
   docker push your-registry/ai-center:$(cat PROJECT_VERSION)
   ```

### 启动步骤

项目提供三种启动方式，可根据实际需求选择：

---

#### 方式一：Docker Compose启动（推荐）

**适用于开发测试环境，包含完整的数据库服务**

**方式1.1：完整环境部署**
使用docker-compose.yml启动完整环境，包括MySQL、Redis、Elasticsearch、RustFS和应用。

```bash
# 进入docker目录
cd docker

# 复制并配置环境变量
cp .env.example .env
# 编辑.env文件，设置数据库密码等配置

# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 访问服务
# 前端: http://localhost:8000
# 后端API: http://localhost:8081/docs
# MCP Server: http://localhost:8082

# 停止服务
docker-compose down
```

**方式1.2：仅部署应用**
使用docker-compose-app.yml仅启动应用，连接已部署的数据库服务（适用于生产环境）。

```bash
# 进入docker目录
cd docker

# 复制并配置环境变量（使用已部署的数据库）
cp .env.app.example .env
# 编辑.env文件，配置已部署的数据库地址和密码

# 构建并启动应用
docker-compose -f docker-compose-app.yml up -d --build

# 查看服务状态
docker-compose -f docker-compose-app.yml ps

# 查看日志
docker-compose -f docker-compose-app.yml logs -f ai-center

# 停止服务
docker-compose -f docker-compose-app.yml down
```

---

#### 方式二：Docker Run启动（通过配置文件挂载）

**适用于需要自定义配置文件的场景**

```bash
# 创建配置文件目录
mkdir -p /opt/ai-center/config

# 复制配置文件（根据需要修改）
cp configs/server_config.yaml /opt/ai-center/config/
cp docker/aicenter.conf /opt/ai-center/config/

# 修改配置文件中的数据库连接信息
# vi /opt/ai-center/config/server_config.yaml

# 启动容器，挂载配置文件
docker run -d \
  --name ai-center \
  --restart unless-stopped \
  -p 8000:80 \
  -p 8081:8081 \
  -p 8082:8082 \
  -v /opt/ai-center/config/server_config.yaml:/aicenter/configs/server_config.yaml:ro \
  ai-center:aihub_v2_beta_0.1
```

**注意**：使用此方式时，需要确保配置文件中指定的数据库服务已部署并可访问。

---

#### 方式三：Docker Run启动（通过环境变量）

**适用于需要灵活配置的场景，环境变量优先级高于配置文件**

```bash
# 启动容器，通过环境变量配置
docker run -d \
  --name ai-center \
  --restart unless-stopped \
  -p 8000:80 \
  -p 8081:8081 \
  -p 8082:8082 \
  -e SERVER_HOST=0.0.0.0 \
  -e SERVER_PORT=8081 \
  -e MYSQL_HOST=your-mysql-host \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=your-mysql-password \
  -e MYSQL_DATABASE=ai_center \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD=your-redis-password \
  -e REDIS_DB=1 \
  -e ES_HOST=your-es-host \
  -e ES_PORT=9200 \
  -e ES_USER=elastic \
  -e ES_PASSWORD=your-es-password \
  -e ES_SCHEME=http \
  -e RUSTFS_HOST=your-rustfs-host \
  -e RUSTFS_PORT=9000 \
  -e RUSTFS_USER=rustfsadmin \
  -e RUSTFS_PASSWORD=your-rustfs-password \
  -e MCP_HOST=0.0.0.0 \
  -e MCP_PORT=8082 \
  -e MCP_ENABLED=true \
  ai-center:aihub_v2_beta_0.1
```

**支持的环境变量**：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| SERVER_HOST | 服务器监听地址 | 0.0.0.0 |
| SERVER_PORT | 主机映射端口 | 8000 |
| MYSQL_HOST | MySQL服务器地址 | 127.0.0.1 |
| MYSQL_PORT | MySQL端口 | 3306 |
| MYSQL_USER | MySQL用户名 | root |
| MYSQL_PASSWORD | MySQL密码 | 123456 |
| MYSQL_DATABASE | 数据库名称 | ai_center |
| REDIS_HOST | Redis服务器地址 | 127.0.0.1 |
| REDIS_PORT | Redis端口 | 6379 |
| REDIS_USERNAME | Redis用户名 | (空) |
| REDIS_PASSWORD | Redis密码 | (空) |
| REDIS_DB | Redis数据库索引 | 1 |
| ES_HOST | Elasticsearch地址 | 127.0.0.1 |
| ES_PORT | Elasticsearch端口 | 9200 |
| ES_USER | Elasticsearch用户名 | elastic |
| ES_PASSWORD | Elasticsearch密码 | 123456 |
| ES_SCHEME | Elasticsearch协议 | http |
| RUSTFS_HOST | RustFS服务器地址 | 127.0.0.1 |
| RUSTFS_PORT | RustFS端口 | 9000 |
| RUSTFS_USER | RustFS用户名 | rustfsadmin |
| RUSTFS_PASSWORD | RustFS密码 | rustfsadmin |
| MCP_HOST | MCP服务地址 | 0.0.0.0 |
| MCP_PORT | MCP端口 | 8082 |
| MCP_ENABLED | 是否启用MCP | true |

**详细的环境变量说明请参考**：[docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)

### 配置文件说明

配置文件位于 `configs/server_config.yaml`，主要配置项：

```yaml
server:
  host: '0.0.0.0'
  http_port: 8081

mysql:
  name: 'ai_center'
  user: 'root'
  password: 'your_password'
  host: 'mysql'  # Docker环境使用服务名
  port: 3306
  max_connections: 900

mcp:
  host: '0.0.0.0'
  port: 8082
  enabled: true

es:
  host: 'elasticsearch'  # Docker环境使用服务名
  port: 9200
  username: 'elastic'
  password: 'your_password'
  scheme: 'http'

redis:
  db: 1
  username: ''
  password: ''
  host: 'redis'  # Docker环境使用服务名
  port: 6379

rustfs:
  username: 'rustfsadmin'
  password: 'rustfsadmin'
  host: 'rustfs'  # Docker环境使用服务名
  port: 9000
```

### Docker文件挂载

您可以通过挂载方式覆盖容器内的配置文件：

#### 挂载server_config.yaml
```bash
docker run -d \
  --name ai-center \
  -v /path/to/your/server_config.yaml:/aicenter/configs/server_config.yaml \
  ai-center:aihub_v2_beta_0.1
```

#### 挂载Nginx配置文件
```bash
docker run -d \
  --name ai-center \
  -v /path/to/your/aicenter.conf:/etc/nginx/conf.d/aicenter.conf \
  ai-center:aihub_v2_beta_0.1
```

#### 同时挂载多个配置文件
```bash
docker run -d \
  --name ai-center \
  -v /path/to/your/server_config.yaml:/aicenter/configs/server_config.yaml \
  -v /path/to/your/aicenter.conf:/etc/nginx/conf.d/aicenter.conf \
  -v /path/to/your/nginx.conf:/etc/nginx/nginx.conf \
  ai-center:aihub_v2_beta_0.1
```

#### 使用docker-compose挂载
```yaml
services:
  ai-center:
    volumes:
      - /path/to/your/server_config.yaml:/aicenter/configs/server_config.yaml:ro
      - /path/to/your/aicenter.conf:/etc/nginx/conf.d/aicenter.conf:ro
```

**注意**：挂载配置文件时，建议使用`:ro`只读模式以提高安全性。

### 前端API配置

前端应用通过Nginx反向代理访问后端API，配置如下：

**Nginx反向代理规则**：
```
前端请求 /aicenter/v1/xxx → Nginx → http://0.0.0.0:8081/aicenter/v1/xxx
前端请求 /apidocs/xxx → Nginx → http://0.0.0.0:8081/apidocs/xxx
前端请求 /docs → Nginx → http://0.0.0.0:8081/apidocs
```

**访问地址**：
- 前端界面：http://localhost:8000
- 后端API：http://localhost:8000/aicenter/v1/（通过Nginx代理）
- Swagger文档：http://localhost:8000/docs 或 http://localhost:8000/apidocs

### 数据持久化

Docker Compose配置中已包含数据卷映射，确保数据持久化：

```yaml
volumes:
  mysql_data:      # MySQL数据
  redis_data:      # Redis数据
  es_data:         # Elasticsearch数据
  rustfs_data:    # RustFS数据（如果使用）
```

### 健康检查

访问以下地址验证服务是否正常启动：

- **前端服务**: http://localhost:8000 (Nginx代理)
- **后端服务**: http://localhost:8081/docs (Swagger文档)
- **MCP服务**: http://localhost:8082
- **Elasticsearch**: http://localhost:9200/_cluster/health

### 单独启动依赖服务

如果选择仅应用部署模式，需要预先启动以下依赖服务。以下是各服务的Docker启动命令：

#### 1. MySQL 8.0

**资源建议**：CPU 1-2核，内存 1-2GB，存储至少10GB

```bash
docker run -d \
  --name ai-center-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=your_mysql_root_password \
  -e MYSQL_DATABASE=aicenter \
  -e MYSQL_USER=aicenter \
  -e MYSQL_PASSWORD=your_mysql_password \
  -v /path/to/mysql/data:/var/lib/mysql \
  --cpus="2" \
  --memory="2g" \
  --restart unless-stopped \
  mysql:8.0 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci
```

#### 2. Redis 7

**资源建议**：CPU 1核，内存 512MB-2GB，存储至少2GB

```bash
docker run -d \
  --name ai-center-redis \
  -p 6379:6379 \
  -e REDIS_PASSWORD=your_redis_password \
  -v /path/to/redis/data:/data \
  --cpus="1" \
  --memory="1g" \
  --restart unless-stopped \
  redis:7 \
  --requirepass your_redis_password \
  --appendonly yes
```

#### 3. Elasticsearch 8.11.0

**资源建议**：CPU 2-4核，内存 4-8GB，存储至少20GB（SSD更佳）

```bash
docker run -d \
  --name ai-center-es \
  -p 9200:9200 \
  -p 9300:9300 \
  -e ES_JAVA_OPTS="-Xms2g -Xmx2g" \
  -e bootstrap.memory_lock=false \
  -e cluster.routing.allocation.disk.watermark.low=5gb \
  -e cluster.routing.allocation.disk.watermark.high=3gb \
  -e cluster.routing.allocation.disk.watermark.flood_stage=2gb \
  -e ELASTIC_PASSWORD=your_es_password \
  -v /path/to/es/data:/usr/share/elasticsearch/data \
  --cpus="4" \
  --memory="4g" \
  --restart unless-stopped \
  elasticsearch:8.11.0
```

**环境变量说明**：

| 参数 | 说明 |
|------|------|
| `bootstrap.memory_lock=false` | 是否锁定内存（生产环境建议启用） |
| `cluster.routing.allocation.disk.watermark.low=5gb` | 磁盘水位低阈值，低于此值时停止分片分配 |
| `cluster.routing.allocation.disk.watermark.high=3gb` | 磁盘水位高阈值，低于此值时迁移分片 |
| `cluster.routing.allocation.disk.watermark.flood_stage=2gb` | 磁盘洪水阶段阈值，低于此值时只读保护 |

#### 4. RustFS (MinIO)

**资源建议**：CPU 2-4核，内存 2-4GB，存储至少50GB（SSD更佳）

```bash
docker run -d \
  --name ai-center-rustfs \
  -p 9000:9000 \
  -p 9001:9001 \
  -e RUSTFS_ACCESS_KEY=rustfsadmin \
  -e RUSTFS_SECRET_KEY=your_rustfs_password \
  -v /path/to/rustfs/data:/data \
  --cpus="2" \
  --memory="4g" \
  --restart unless-stopped \
  rustfs/rustfs:latest \
  server /data --console-address ":9001"
```

### 常见问题

1. **端口冲突**
   - 修改 `docker-compose.yml` 中的端口映射
   - 或停止占用端口的其他服务

2. **内存不足**
   - Elasticsearch默认需要至少2GB内存
   - 可通过环境变量 `ES_JAVA_OPTS="-Xms1g -Xmx1g"` 调整

3. **权限问题**
   - Linux环境下可能需要使用 `sudo`
   - 或将用户添加到docker组：`sudo usermod -aG docker $USER`

4. **网络问题**
   - 确保Docker网络正常：`docker network ls`
   - 重启Docker服务：`sudo systemctl restart docker`

## API文档

后端服务提供了Swagger文档，可以通过以下地址访问：
- Swagger UI: http://localhost:8081/docs
- ReDoc: http://localhost:8081/redoc

## 测试验证

项目提供了多个测试脚本用于验证功能：

```bash
# 验证模块导入
python -m app.test.verify_imports

# 检查目录导入
python -m app.test.check_imports

# 测试数据库连接
python -m app.test.check_database
```

## 配置说明

配置文件位于 `configs/server_config.yaml`，包含以下配置：
- 服务器配置（主机、端口）
- MySQL数据库配置
- 其他环境配置

## 开发规范

### 1. 代码注释
- 所有类都需要写注释
- 重要的业务逻辑需要写注释

### 2. API设计
- 新增、更新、删除操作使用POST方法
- 查询操作使用GET方法
- 所有接口返回统一的JSON格式

### 3. 参数校验
- Controller层接口入参所有必填参数必须进行校验

### 4. 测试脚本
- 单元测试和验证脚本统一放到 `app/test` 目录

## 注意事项

- 确保MySQL服务已经启动
- 确保配置文件中的数据库连接信息正确
- 前端服务默认运行在8000端口，后端服务默认运行在8081端口
- 首次启动时，后端会自动创建数据库表结构
- 所有表都使用UUID作为主键
- 所有表名称使用单数形式

## 许可证

MIT License
