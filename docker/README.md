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