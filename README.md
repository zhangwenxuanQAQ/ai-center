# 大模型AI服务中心

## 项目简介
大模型AI服务中心是一个前后端分离的应用，用于管理聊天机器人、MCP服务、知识库、模型配置、提示词、用户权限和聊天会话。

## 项目结构

```
├── backend/         # 后端代码
│   ├── config.py    # 配置管理
│   ├── database.py  # 数据库连接
│   ├── main.py      # 主应用
│   ├── models/      # 数据库模型
│   ├── routers/     # API路由
│   └── schemas/     # 数据验证
├── web/            # 前端代码
│   ├── assets/      # 静态资源
│   ├── pages/       # 页面组件
│   ├── src/         # 源代码
│   ├── index.html   # 入口HTML
│   ├── package.json # 依赖管理
│   └── vite.config.js # Vite配置
├── configs/         # 配置文件
│   └── server_config.yaml # 服务器配置
├── docker/          # Docker配置
│   ├── Dockerfile   # Dockerfile
│   └── docker-compose.yml # Docker Compose配置
└── README.md        # 项目说明
```

## 技术栈

### 后端
- FastAPI - Web框架
- SQLAlchemy - ORM
- Pydantic - 数据验证
- MySQL - 数据库

### 前端
- React - 前端框架
- Ant Design - UI组件库
- React Router - 路由管理
- Vite - 构建工具

## 快速开始

### 后端
1. 安装依赖
```bash
pip install -r backend/requirements.txt
```

2. 配置数据库
编辑 `configs/server_config.yaml` 文件，设置数据库连接信息。

3. 启动服务
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 9380 --reload
```

### 前端
1. 安装依赖
```bash
cd web
npm install
```

2. 启动服务
```bash
npm run dev
```

### Docker
1. 构建和启动容器
```bash
docker-compose -f docker/docker-compose.yml up -d
```

2. 访问应用
前端：http://localhost:3000
后端：http://localhost:9380

## 功能模块

1. **聊天机器人管理** - 管理和配置聊天机器人
2. **MCP服务管理** - 管理和配置MCP服务
3. **知识库管理** - 管理和配置知识库
4. **模型配置** - 管理和配置LLM模型
5. **提示词管理** - 管理和配置提示词
6. **用户权限管理** - 管理用户和权限
7. **用户聊天会话** - 查看和管理用户聊天会话

## 注意事项

- 确保MySQL服务已经启动
- 确保配置文件中的数据库连接信息正确
- 前端服务默认运行在3000端口，后端服务默认运行在9380端口
- 首次启动时，后端会自动创建数据库表结构