# Docker部署文件说明

本目录包含AI Center项目的Docker部署相关文件。

## 文件列表

### Docker镜像构建
- **Dockerfile**: Docker镜像构建文件，使用Ubuntu 24.04作为基础镜像，支持多阶段构建
- **nginx/nginx.conf**: Nginx主配置文件
- **nginx/aicenter.conf**: Nginx站点配置，配置前后端统一入口和反向代理
- **entrypoint.sh**: 容器启动脚本，自动启动Nginx、后端服务和MCP服务（支持动态端口显示）

### Docker编排配置
- **docker-compose.yml**: 完整环境部署配置，包含MySQL、Redis、Elasticsearch、RustFS和应用
- **docker-compose-app.yml**: 仅应用部署配置，适用于连接已部署的数据库服务

### 环境变量配置
- **.env.example**: 完整环境部署的环境变量模板
- **.env.app.example**: 仅应用部署的环境变量模板（包含REDIS_USERNAME）

### 文档
- **BUILD.md**: Docker构建和部署详细说明文档
- **README.md**: 本文件，Docker部署文件说明
- **TROUBLESHOOTING.md**: 故障排查文档

## 快速开始

### 方式一：完整环境部署（开发测试）

使用docker-compose.yml启动完整环境，包含MySQL、Redis、Elasticsearch、RustFS和应用。

```bash
# 1. 进入docker目录
cd docker

# 2. 配置环境变量
cp .env.example .env
# 编辑.env文件，设置数据库密码等

# 3. 构建并启动所有服务
docker-compose up -d --build

# 4. 查看服务状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f

# 6. 查看特定服务日志
docker-compose logs -f ai-center

# 7. 访问服务
# 前端: http://localhost:8000
# 后端API: http://localhost:8081/docs
# MCP Server: http://localhost:8082

# 8. 停止服务
docker-compose down

# 9. 停止服务并删除数据卷（慎用）
docker-compose down -v
```

### 方式二：仅应用部署（生产环境）

使用docker-compose-app.yml仅启动应用，连接已部署的数据库服务。

```bash
# 1. 进入docker目录
cd docker

# 2. 配置环境变量
cp .env.app.example .env
# 编辑.env文件，配置已部署的数据库地址

# 3. 构建并启动应用
docker-compose -f docker-compose-app.yml up -d --build

# 4. 查看服务状态
docker-compose -f docker-compose-app.yml ps

# 5. 查看日志
docker-compose -f docker-compose-app.yml logs -f

# 6. 停止服务
docker-compose -f docker-compose-app.yml down
```

### 方式三：Docker Run启动（高级用户）

#### 3.1 通过配置文件挂载

```bash
# 1. 创建配置文件目录
mkdir -p /opt/ai-center/config

# 2. 复制配置文件
cp ../configs/server_config.yaml /opt/ai-center/config/
cp nginx/aicenter.conf /opt/ai-center/config/

# 3. 修改配置文件中的数据库连接信息
vim /opt/ai-center/config/server_config.yaml

# 4. 启动容器（端口映射：8000->80, 8081->8081, 8082->8082）
docker run -d \
  --name ai-center \
  --restart unless-stopped \
  -p 8000:80 \
  -p 8081:8081 \
  -p 8082:8082 \
  -v /opt/ai-center/config/server_config.yaml:/aicenter/configs/server_config.yaml:ro \
  -v /opt/ai-center/config/aicenter.conf:/etc/nginx/conf.d/aicenter.conf:ro \
  ai-center:aihub_v2_beta_0.1

# 5. 查看容器日志
docker logs -f ai-center

# 6. 进入容器
docker exec -it ai-center bash

# 7. 停止并删除容器
docker stop ai-center && docker rm ai-center
```

#### 3.2 通过环境变量配置

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
  -e MYSQL_PASSWORD=your-password \
  -e MYSQL_DATABASE=ai_center \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e REDIS_USERNAME= \
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

## 目录结构

```
docker/
├── Dockerfile                  # Docker镜像构建文件
├── docker-compose.yml          # 完整环境编排配置
├── docker-compose-app.yml      # 仅应用编排配置
├── nginx.conf                  # Nginx主配置
├── aicenter.conf               # Nginx站点配置
├── entrypoint.sh               # 启动脚本（支持动态端口显示）
├── .env.example                # 完整环境变量模板
├── .env.app.example            # 应用环境变量模板
├── init/                       # 数据库初始化脚本
│   └── mysql/                  # MySQL初始化SQL
├── BUILD.md                    # 构建部署文档
├── README.md                   # 本文件
└── TROUBLESHOOTING.md          # 故障排查文档
```

## 镜像说明

### 基础镜像
- **前端构建阶段**: node:18-alpine
- **运行环境**: ubuntu:24.04

### 工作目录
容器内工作目录：`/aicenter`

### 端口映射

| 容器端口 | 主机端口 | 说明 |
|---------|---------|------|
| 80 | 8000 | Nginx前端入口（可通过SERVER_PORT修改） |
| 8081 | 8081 | 后端API服务 |
| 8082 | 8082 | MCP服务 |

### 访问地址

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:8000 |
| 后端API文档 | http://localhost:8081/docs |
| MCP服务 | http://localhost:8082 |

### 数据卷
- `/aicenter/configs`: 配置文件目录（只读挂载）
- `/aicenter/logs`: 日志目录
- `/aicenter/data`: 数据目录

## 环境变量说明

项目支持通过环境变量覆盖`server_config.yaml`中的配置项。

### 环境变量命名规则
- 全部大写，使用下划线连接
- 格式：`配置段名_配置项名`
- 示例：`mysql.host` → `MYSQL_HOST`

### 支持的环境变量

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

### 配置优先级
1. **环境变量**（最高优先级）
2. **server_config.yaml配置文件**
3. **代码默认值**（最低优先级）

## 文件挂载

您可以通过挂载方式覆盖容器内的配置文件：

```bash
# 挂载server_config.yaml
docker run -v /path/to/server_config.yaml:/aicenter/configs/server_config.yaml:ro

# 挂载Nginx配置
docker run -v /path/to/aicenter.conf:/etc/nginx/conf.d/aicenter.conf:ro

# 挂载多个配置文件
docker run \
  -v /path/to/server_config.yaml:/aicenter/configs/server_config.yaml:ro \
  -v /path/to/aicenter.conf:/etc/nginx/conf.d/aicenter.conf:ro \
  -v /path/to/nginx.conf:/etc/nginx/nginx.conf:ro

# 使用docker-compose挂载
services:
  ai-center:
    volumes:
      - /path/to/server_config.yaml:/aicenter/configs/server_config.yaml:ro
      - /path/to/aicenter.conf:/etc/nginx/conf.d/aicenter.conf:ro
```

## 服务依赖

### 完整环境部署
- MySQL 8.0
- Redis 7
- Elasticsearch 8.11.0
- RustFS (MinIO)

### 仅应用部署
需要预先部署以下服务：
- MySQL 8.0+
- Redis 5.0+
- Elasticsearch 8.0+
- RustFS/MinIO（可选）

### 单独启动依赖服务

如果选择仅应用部署模式，需要预先启动以下依赖服务。以下是各服务的Docker启动命令：

#### 1. MySQL 8.0

**资源建议**：
- **CPU**: 建议分配1-2核
- **内存**: 建议分配1-2GB
- **存储**: 根据数据量调整，建议至少10GB

```bash
docker run -d \
  --name ai-center-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=your_mysql_root_password \
  -e MYSQL_DATABASE=aicenter \
  -e MYSQL_USER=aicenter \
  -e MYSQL_PASSWORD=your_mysql_password \
  -e MYSQL_INITDB_SKIP_TZINFO=1 \
  -v /path/to/mysql/data:/var/lib/mysql \
  --cpus="2" \
  --memory="2g" \
  --restart unless-stopped \
  mysql:8.0 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci \
  --max_connections=1000 \
  --innodb_buffer_pool_size=512M
```

**环境变量说明**：
- `MYSQL_ROOT_PASSWORD`: root用户密码
- `MYSQL_DATABASE`: 自动创建的数据库名称
- `MYSQL_USER`: 应用使用的用户名
- `MYSQL_PASSWORD`: 应用用户密码
- `MYSQL_INITDB_SKIP_TZINFO`: 跳过时区初始化

**资源限制参数**：
- `--cpus="2"`: 限制使用2核CPU
- `--memory="2g"`: 限制使用2GB内存

#### 2. Redis 7

**资源建议**：
- **CPU**: 建议分配1核
- **内存**: 建议分配512MB-2GB（根据缓存数据量调整）
- **存储**: 建议开启持久化，至少2GB

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
  --appendonly yes \
  --maxmemory 512mb \
  --maxmemory-policy allkeys-lru
```

**环境变量说明**：
- `REDIS_PASSWORD`: Redis密码（需在命令中重复指定）

**资源限制参数**：
- `--cpus="1"`: 限制使用1核CPU
- `--memory="1g"`: 限制使用1GB内存

**Redis配置参数**：
- `--appendonly yes`: 开启AOF持久化
- `--maxmemory 512mb`: 设置最大内存限制
- `--maxmemory-policy allkeys-lru`: 内存不足时使用LRU策略淘汰

#### 3. Elasticsearch 8.11.0

**资源建议**：
- **CPU**: 建议分配2-4核
- **内存**: 建议分配4-8GB（JVM堆内存建议为物理内存的50%）
- **存储**: 根据索引数据量调整，建议至少20GB，使用SSD更佳

```bash
docker run -d \
  --name ai-center-es \
  -p 9200:9200 \
  -p 9300:9300 \
  -e discovery.type=single-node \
  -e ES_JAVA_OPTS="-Xms2g -Xmx2g" \
  -e xpack.security.enabled=true \
  -e xpack.security.enrollment.enabled=false \
  -e ELASTIC_PASSWORD=your_es_password \
  -e bootstrap.memory_lock=true \
  -v /path/to/es/data:/usr/share/elasticsearch/data \
  --cpus="4" \
  --memory="4g" \
  --ulimit memlock=-1:-1 \
  --restart unless-stopped \
  elasticsearch:8.11.0
```

**环境变量说明**：
- `discovery.type`: 单节点模式
- `ES_JAVA_OPTS`: JVM内存配置（建议设置为物理内存的50%，最大不超过32GB）
- `xpack.security.enabled`: 启用安全认证
- `xpack.security.enrollment.enabled`: 禁用自动注册（单节点模式）
- `ELASTIC_PASSWORD`: elastic用户密码
- `bootstrap.memory_lock`: 锁定内存，避免swap

**资源限制参数**：
- `--cpus="4"`: 限制使用4核CPU
- `--memory="4g"`: 限制使用4GB内存
- `--ulimit memlock=-1:-1`: 解除内存锁定限制

**注意**：首次启动后，需要设置Kibana密码：
```bash
docker exec -it ai-center-es /usr/share/elasticsearch/bin/elasticsearch-reset-password -u kibana_system -i
```

#### 4. RustFS (MinIO)

**资源建议**：
- **CPU**: 建议分配2-4核
- **内存**: 建议分配2-4GB
- **存储**: 根据文件存储需求调整，建议至少50GB，使用SSD更佳

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

**环境变量说明**：
- `RUSTFS_ACCESS_KEY`: 管理员用户名
- `RUSTFS_SECRET_KEY`: 管理员密码

**资源限制参数**：
- `--cpus="2"`: 限制使用2核CPU
- `--memory="4g"`: 限制使用4GB内存

**创建存储桶**：
```bash
# 安装mc客户端
docker run --rm -it minio/mc:latest \
  mc config host add ai-center http://localhost:9000 rustfsadmin your_rustfs_password
  
# 创建存储桶
docker run --rm -it minio/mc:latest \
  mc mb ai-center/aicenter
```

## 常用命令

```bash
# ========== 镜像管理 ==========
# 构建镜像
docker-compose build

# 构建镜像（不使用缓存）
docker-compose build --no-cache

# 查看本地镜像
docker images | grep ai-center

# 删除镜像
docker rmi ai-center:aihub_v2_beta_0.1

# 推送镜像到仓库
docker tag ai-center:aihub_v2_beta_0.1 your-registry/ai-center:aihub_v2_beta_0.1
docker push your-registry/ai-center:aihub_v2_beta_0.1

# ========== 容器管理 ==========
# 启动服务（完整环境）
docker-compose up -d

# 启动服务（仅应用）
docker-compose -f docker-compose-app.yml up -d

# 启动服务并重建镜像
docker-compose up -d --build

# 停止服务
docker-compose down

# 停止服务并删除数据卷
docker-compose down -v

# 重启服务
docker-compose restart

# 重启特定服务
docker-compose restart ai-center

# 强制重新创建服务
docker-compose up -d --force-recreate

# ========== 日志管理 ==========
# 查看所有服务日志
docker-compose logs

# 实时查看所有日志
docker-compose logs -f

# 实时查看特定服务日志
docker-compose logs -f ai-center

# 查看最近100行日志
docker-compose logs --tail 100

# 查看特定时间范围内的日志
docker-compose logs --since "2024-01-01T00:00:00"

# ========== 容器操作 ==========
# 进入容器
docker exec -it ai-center-app bash

# 进入容器（使用root）
docker exec -it -u root ai-center-app bash

# 查看容器进程
docker top ai-center-app

# 查看容器详细信息
docker inspect ai-center-app

# 查看容器资源使用
docker stats ai-center-app

# 查看容器端口映射
docker port ai-center-app

# 执行容器内命令
docker exec ai-center-app ps aux
docker exec ai-center-app ls -la /aicenter

# ========== 网络管理 ==========
# 查看网络
docker network ls

# 查看容器网络连接
docker network inspect ai-center-network

# 测试容器网络连接
docker exec ai-center-app ping mysql
docker exec ai-center-app curl http://elasticsearch:9200

# ========== 数据卷管理 ==========
# 查看数据卷
docker volume ls | grep ai-center

# 查看数据卷详情
docker volume inspect ai-center_mysql_data

# 删除未使用的数据卷
docker volume prune

# 备份数据卷
docker run --rm -v ai-center_mysql_data:/data -v $(pwd):/backup ubuntu tar czf /backup/mysql_backup.tar.gz -C /data .

# ========== 服务维护 ==========
# 查看服务状态
docker-compose ps

# 查看服务健康状态
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# 清理未使用的镜像
docker image prune -a

# 清理所有停止的容器
docker container prune

# 完全清理（删除所有未使用的容器、网络、镜像）
docker system prune -a

# 查看磁盘使用
docker system df
```

## 注意事项

1. **首次启动**: 首次启动时需要等待数据库初始化完成，可能需要1-2分钟
2. **内存要求**: Elasticsearch默认需要至少2GB内存，可根据实际情况调整
3. **数据持久化**: 所有数据都通过Docker卷进行持久化，删除容器不会丢失数据
4. **配置修改**: 修改配置文件后需要重启容器才能生效
5. **网络访问**: 使用`host.docker.internal`可以在容器内访问宿主机服务
6. **环境变量优先级**: 环境变量优先级高于配置文件，敏感信息建议通过环境变量传递
7. **只读挂载**: 挂载配置文件时建议使用`:ro`只读模式提高安全性
8. **端口映射**: 默认前端端口为8000，可通过SERVER_PORT环境变量修改
9. **防火墙**: 确保防火墙允许8000、8081、8082端口的访问

## 故障排查

### 容器无法启动
```bash
# 查看容器日志
docker logs ai-center-app

# 查看容器详细信息
docker inspect ai-center-app

# 检查Docker服务状态
docker info

# 检查docker-compose配置
docker-compose config
```

### 数据库连接失败
```bash
# 检查数据库服务是否正常
docker-compose ps mysql

# 查看数据库日志
docker-compose logs mysql

# 测试数据库连接
docker exec ai-center-app ping mysql
docker exec ai-center-app nc -zv mysql 3306

# 进入MySQL容器
docker exec -it ai-center-mysql mysql -uroot -p
```

### Redis连接失败
```bash
# 检查Redis服务状态
docker-compose ps redis

# 测试Redis连接
docker exec ai-center-app redis-cli -h redis -p 6379 ping

# 查看Redis日志
docker-compose logs redis
```

### Elasticsearch连接失败
```bash
# 检查Elasticsearch服务状态
docker-compose ps elasticsearch

# 测试ES连接
curl http://localhost:9200

# 查看ES健康状态
curl http://localhost:9200/_cluster/health

# 查看ES日志
docker-compose logs elasticsearch
```

### 前端无法访问
```bash
# 检查Nginx配置
docker exec ai-center-app nginx -t

# 检查Nginx运行状态
docker exec ai-center-app ps aux | grep nginx

# 检查Nginx日志
docker exec ai-center-app cat /var/log/nginx/access.log
docker exec ai-center-app cat /var/log/nginx/error.log

# 重启Nginx
docker exec ai-center-app nginx -s reload
```

### 后端API无法访问
```bash
# 检查后端服务状态
docker exec ai-center-app ps aux | grep python

# 测试API端点
curl http://localhost:8081/docs
curl http://localhost:8081/api/v1/health

# 查看后端日志
docker exec ai-center-app cat /aicenter/logs/app.log
```

### 环境变量未生效
```bash
# 检查容器内环境变量
docker exec ai-center-app env | grep -E "MYSQL|REDIS|ES"

# 检查配置文件是否被环境变量覆盖
docker exec ai-center-app python3 -c "from app.configs.config import config; print(config.mysql)"

# 查看entrypoint.sh执行日志
docker exec ai-center-app cat /var/log/startup.log
```

### RustFS/MinIO连接失败
```bash
# 检查RustFS服务状态
docker-compose ps rustfs

# 测试RustFS连接
docker exec ai-center-app curl http://rustfs:9000/minio/health/live

# 查看RustFS日志
docker-compose logs rustfs

# 访问RustFS控制台
# http://localhost:9001
```

## 更多信息

详细的构建和部署说明请参考 [BUILD.md](./BUILD.md)

环境变量详细说明请参考 [../docs/ENVIRONMENT_VARIABLES.md](../docs/ENVIRONMENT_VARIABLES.md)

故障排查详细说明请参考 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)