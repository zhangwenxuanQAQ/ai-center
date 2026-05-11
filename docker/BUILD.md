# Docker构建说明

## 构建前准备

### 1. 检查Docker环境
确保Docker已正确安装并运行：
```bash
docker --version
docker info
```

### 2. 配置Docker镜像加速（可选）
如果遇到Docker Hub访问问题，可以配置国内镜像加速：

编辑Docker配置文件（Windows: `%USERPROFILE%\.docker\daemon.json`，Linux: `/etc/docker/daemon.json`）：
```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

重启Docker服务：
```bash
# Linux
sudo systemctl restart docker

# Windows
# 通过Docker Desktop重启
```

## 构建镜像

### 方式一：使用docker build命令

```bash
# 在项目根目录执行
docker build -t ai-center:aihub_v2_beta_0.1 -f docker/Dockerfile .
```

### 方式二：使用docker-compose构建

#### 完整环境构建（包含数据库等服务）
```bash
cd docker
docker-compose build
```

#### 仅构建应用（使用已部署的数据库）
```bash
cd docker
docker-compose -f docker-compose-app.yml build
```

## 构建参数说明

- `-t ai-center:aihub_v2_beta_0.1`: 指定镜像名称和标签
- `-f docker/Dockerfile`: 指定Dockerfile路径
- `.`: 指定构建上下文为当前目录

## 部署方式

### 方式一：完整环境部署（推荐用于开发测试）

使用 `docker-compose.yml` 启动完整环境，包括MySQL、Redis、Elasticsearch、MinIO和应用：

```bash
cd docker
# 配置环境变量
cp .env.example .env
# 编辑.env文件，设置密码等配置

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f ai-center
```

### 方式二：仅部署应用（推荐用于生产环境）

使用 `docker-compose-app.yml` 仅启动应用，连接已部署的数据库服务：

```bash
cd docker
# 配置环境变量
cp .env.app.example .env
# 编辑.env文件，配置已部署的数据库地址和密码

# 启动应用
docker-compose -f docker-compose-app.yml up -d

# 查看服务状态
docker-compose -f docker-compose-app.yml ps

# 查看日志
docker-compose -f docker-compose-app.yml logs -f ai-center
```

**注意**：
- 使用 `docker-compose-app.yml` 时，需要确保MySQL、Redis、Elasticsearch等服务已部署并可访问
- 默认使用 `host.docker.internal` 访问宿主机服务，如需访问其他服务器，请修改对应的环境变量

## 构建过程

Dockerfile采用多阶段构建：

1. **第一阶段**：构建前端
   - 基础镜像：node:18-alpine
   - 安装npm依赖
   - 构建前端静态文件

2. **第二阶段**：构建运行环境
   - 基础镜像：ubuntu:24.04
   - 安装Python 3.12、Nginx、FFmpeg等依赖
   - 使用uv安装Python依赖
   - 配置Nginx
   - 复制应用代码和前端构建结果

## 常见问题

### 1. 无法拉取基础镜像

**原因**：Docker Hub访问受限或网络问题

**解决方案**：
- 配置Docker镜像加速器
- 使用代理
- 使用其他可用的镜像源

### 2. 构建过程中内存不足

**原因**：前端构建或依赖安装需要较多内存

**解决方案**：
- 增加Docker内存限制（Docker Desktop设置）
- 关闭其他占用内存的应用

### 3. 构建速度慢

**原因**：网络下载速度慢或依赖较多

**解决方案**：
- 使用镜像加速器
- 使用构建缓存
- 分步构建，便于排查问题

### 4. Windows下路径问题

**原因**：Windows路径格式与Linux不同

**解决方案**：
- 使用PowerShell或Git Bash
- 确保路径使用正斜杠或反斜杠正确

## 验证构建结果

构建完成后，验证镜像：

```bash
# 查看镜像列表
docker images | grep ai-center

# 查看镜像详情
docker inspect ai-center:aihub_v2_beta_0.1

# 测试运行容器
docker run -d --name test-ai-center ai-center:aihub_v2_beta_0.1

# 查看容器日志
docker logs test-ai-center

# 进入容器
docker exec -it test-ai-center bash

# 停止并删除测试容器
docker stop test-ai-center
docker rm test-ai-center
```

## 推送镜像到仓库

构建完成后，可以推送到Docker仓库：

```bash
# 登录Docker仓库
docker login your-registry.com

# 标记镜像
docker tag ai-center:aihub_v2_beta_0.1 your-registry.com/ai-center:aihub_v2_beta_0.1

# 推送镜像
docker push your-registry.com/ai-center:aihub_v2_beta_0.1
```

## 清理构建缓存

如果需要重新构建或清理空间：

```bash
# 清理悬空镜像
docker image prune

# 清理所有未使用的镜像
docker image prune -a

# 清理构建缓存
docker builder prune
```
