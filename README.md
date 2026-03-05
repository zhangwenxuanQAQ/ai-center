# 大模型AI服务中心

## 项目简介

大模型AI服务中心是一个集成了多种AI功能的管理系统，包括机器人管理、MCP管理、知识库管理、模型管理、提示词管理、用户管理和聊天记录管理等功能。

## 技术栈

### 后端
- **Python**: 3.10+
- **Web框架**: FastAPI
- **ORM**: Peewee + Playhouse
- **数据库**: MySQL
- **数据验证**: Pydantic
- **异步服务器**: Uvicorn

### 前端
- **框架**: React
- **UI库**: Ant Design
- **路由**: React Router
- **构建工具**: Vite
- **状态管理**: Zustand
- **样式**: Tailwind CSS + Less
- **语言**: TypeScript

## 项目结构

```
ai-center/
├── app/                    # 后端应用
│   ├── api/               # API控制器层
│   │   ├── chatbot.py
│   │   ├── chatbot_category.py
│   │   ├── chat.py
│   │   ├── knowledge.py
│   │   ├── llm_model.py
│   │   ├── mcp.py
│   │   ├── prompt.py
│   │   └── user.py
│   ├── configs/           # 配置文件
│   ├── core/              # 核心业务逻辑
│   │   └── exceptions.py  # 自定义异常
│   ├── database/          # 数据库管理
│   │   ├── database.py    # 数据库连接
│   │   ├── db_utils.py    # 数据库工具
│   │   └── models.py      # 数据模型
│   ├── services/          # 服务层（CRUD操作）
│   │   ├── base_dto.py    # 基础DTO
│   │   ├── chatbot/
│   │   ├── chat/
│   │   ├── knowledge/
│   │   ├── llm_model/
│   │   ├── mcp/
│   │   ├── prompt/
│   │   └── user/
│   ├── test/              # 测试和验证脚本
│   │   ├── verify_imports.py
│   │   ├── check_imports.py
│   │   └── check_database.py
│   ├── utils/             # 工具类
│   │   └── response.py    # 统一响应格式
│   ├── server_run.py      # 开发环境入口
│   └── server_wsgi.py     # 生产环境入口
│
├── web/                   # 前端应用
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API服务
│   │   ├── utils/         # 工具类
│   │   ├── hooks/         # React Hooks
│   │   ├── lib/           # 库和配置
│   │   ├── theme/         # 主题配置
│   │   ├── locale/        # 国际化
│   │   ├── App.tsx        # 应用入口
│   │   └── main.tsx       # 渲染入口
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── configs/               # 配置文件目录
│   └── server_config.yaml # 服务器配置
│
├── requirements.txt       # Python依赖
├── pyproject.toml        # 项目配置
└── README.md             # 项目说明
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

### 后端服务

1. 安装依赖
   ```bash
   pip install -r requirements.txt
   # 或使用uv
   uv pip install -r requirements.txt
   ```

2. 配置数据库
   修改 `configs/server_config.yaml` 中的数据库配置

3. 启动服务
   ```bash
   python -m app.server_run
   ```
   后端服务将运行在 http://0.0.0.0:8081

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
