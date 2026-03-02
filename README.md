# 大模型AI服务中心

## 项目简介
大模型AI服务中心是一个集成了多种AI功能的管理系统，包括机器人管理、MCP管理、知识库管理、模型管理、提示词管理、用户管理和聊天记录管理等功能。

## 技术栈
- 后端：Python 3.10+, FastAPI, SQLAlchemy, MySQL
- 前端：React, Ant Design, React Router

## 项目结构
```
app/  # 后端应用
├── configs/        # 配置文件
├── constants/      # 常量定义
├── core/           # 核心业务逻辑
├── database/       # 数据库管理
├── services/       # API实现
├── server_run.py   # 开发环境入口
└── server_wsgi.py  # 生产环境入口

web/  # 前端应用
├── src/
│   ├── pages/      # 页面组件
│   ├── App.tsx     # 应用入口
│   └── main.tsx    # 渲染入口
├── index.html
├── package.json
└── vite.config.js
```

## 快速开始

### 后端服务
1. 安装依赖
   ```bash
   pip install -r requirements.txt
   ```

2. 启动服务
   ```bash
   python -m app.server_run
   ```
   后端服务将运行在 http://localhost:8081

### 前端服务
1. 安装依赖
   ```bash
   cd web && npm install
   ```

2. 启动服务
   ```bash
   npm run dev
   ```
   前端服务将运行在 http://localhost:8000

## API文档
后端服务提供了Swagger文档，可以通过以下地址访问：
- Swagger UI: http://localhost:8081/docs
- ReDoc: http://localhost:8081/redoc

## 配置说明
配置文件位于 `configs/server_config.yaml`，可以根据需要修改服务器和数据库配置。
## 注意事项

- 确保MySQL服务已经启动
- 确保配置文件中的数据库连接信息正确
- 前端服务默认运行在3000端口，后端服务默认运行在9380端口
- 首次启动时，后端会自动创建数据库表结构