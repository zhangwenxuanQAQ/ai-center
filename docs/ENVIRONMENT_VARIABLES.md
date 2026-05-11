# 环境变量配置说明

## 概述

项目支持通过环境变量覆盖`server_config.yaml`中的配置项。环境变量的优先级高于YAML文件配置。

## 环境变量命名规则

环境变量名称遵循以下规则：
- 全部大写
- 使用下划线连接
- 格式：`配置段名_配置项名`

例如：
- `mysql.host` → `MYSQL_HOST`
- `es.username` → `ES_USER`

## 支持的环境变量

### 服务器配置 (server)

| 环境变量 | YAML配置路径 | 说明 | 默认值 |
|---------|-------------|------|--------|
| SERVER_HOST | server.host | 服务器监听地址 | 0.0.0.0 |
| SERVER_PORT | server.http_port | HTTP端口 | 8081 |

### MySQL配置 (mysql)

| 环境变量 | YAML配置路径 | 说明 | 默认值 |
|---------|-------------|------|--------|
| MYSQL_HOST | mysql.host | MySQL服务器地址 | 127.0.0.1 |
| MYSQL_PORT | mysql.port | MySQL端口 | 3306 |
| MYSQL_USER | mysql.user | MySQL用户名 | root |
| MYSQL_PASSWORD | mysql.password | MySQL密码 | 123456 |
| MYSQL_DATABASE | mysql.name | 数据库名称 | ai_center |
| MYSQL_MAX_CONNECTIONS | mysql.max_connections | 最大连接数 | 900 |

### MCP配置 (mcp)

| 环境变量 | YAML配置路径 | 说明 | 默认值 |
|---------|-------------|------|--------|
| MCP_HOST | mcp.host | MCP服务地址 | 127.0.0.1 |
| MCP_PORT | mcp.port | MCP端口 | 8082 |
| MCP_ENABLED | mcp.enabled | 是否启用MCP | true |

### Elasticsearch配置 (es)

| 环境变量 | YAML配置路径 | 说明 | 默认值 |
|---------|-------------|------|--------|
| ES_HOST | es.host | ES服务器地址 | 127.0.0.1 |
| ES_PORT | es.port | ES端口 | 9200 |
| ES_USER | es.username | ES用户名 | elastic |
| ES_PASSWORD | es.password | ES密码 | 123456 |
| ES_SCHEME | es.scheme | ES协议 | https |

### Redis配置 (redis)

| 环境变量 | YAML配置路径 | 说明 | 默认值 |
|---------|-------------|------|--------|
| REDIS_HOST | redis.host | Redis服务器地址 | 127.0.0.1 |
| REDIS_PORT | redis.port | Redis端口 | 6379 |
| REDIS_DB | redis.db | Redis数据库索引 | 1 |
| REDIS_USERNAME | redis.username | Redis用户名 | (空) |
| REDIS_PASSWORD | redis.password | Redis密码 | (空) |

### RustFS/MinIO配置 (rustfs)

| 环境变量 | YAML配置路径 | 说明 | 默认值 |
|---------|-------------|------|--------|
| RUSTFS_HOST | rustfs.host | RustFS服务器地址 | 127.0.0.1 |
| RUSTFS_PORT | rustfs.port | RustFS端口 | 9000 |
| RUSTFS_USER | rustfs.username | RustFS用户名 | rustfsadmin |
| RUSTFS_PASSWORD | rustfs.password | RustFS密码 | rustfsadmin |

### 日志配置 (logging)

| 环境变量 | YAML配置路径 | 说明 | 默认值 |
|---------|-------------|------|--------|
| LOG_LEVEL | logging.level | 日志级别 | INFO |
| LOG_FORMAT | logging.format | 日志格式 | %(asctime)s - %(name)s - %(levelname)s - %(message)s |

## 使用示例

### Docker运行时设置环境变量

```bash
docker run -d \
  --name ai-center \
  -e MYSQL_HOST=mysql \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=your_password \
  -e REDIS_HOST=redis \
  -e ES_HOST=elasticsearch \
  ai-center:aihub_v2_beta_0.1
```

### Docker Compose配置

```yaml
services:
  ai-center:
    image: ai-center:aihub_v2_beta_0.1
    environment:
      - MYSQL_HOST=mysql
      - MYSQL_PORT=3306
      - MYSQL_USER=root
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
      - REDIS_HOST=redis
      - ES_HOST=elasticsearch
```

### .env文件配置

```bash
# MySQL配置
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=ai_center

# Redis配置
REDIS_HOST=redis
REDIS_PORT=6379

# Elasticsearch配置
ES_HOST=elasticsearch
ES_PORT=9200
```

## 配置优先级

1. **环境变量**（最高优先级）：如果设置了环境变量，将覆盖YAML文件中的配置
2. **YAML文件配置**：如果未设置环境变量，使用YAML文件中的值
3. **默认值**：如果YAML文件中也没有配置，使用代码中的默认值

## 类型转换

配置类会自动处理类型转换：
- **整数类型**：如端口、连接数等，会自动转换为int
- **布尔类型**：如enabled，支持true/false、1/0、yes/no等
- **字符串类型**：直接使用字符串值

## 注意事项

1. 环境变量名称必须完全匹配，区分大小写
2. 布尔类型的环境变量值不区分大小写
3. 如果环境变量值无法转换为正确的类型，将使用字符串值
4. 建议在生产环境中使用环境变量管理敏感信息（如密码）
