---
name: backend
description: 后端应用代码开发（包括Restful API设计，数据库设计，逻辑代码生成）
---

## 使用场景
- 创建RESTFUL API
- 设置数据库连接以及数据模型
- 数据库交互
- 实现用户管理以及登录认证
- 集成第三方服务等
- 业务逻辑编写

## 技术栈
- Python 3.10+
- Flask （后端框架）
- Peewee （数据库ORM）
- Restful API （接口风格）
- Flasgger （Swagger 文档）
- Gunicorn （服务部署）

## 需要满足如下要求
1. API 设计
- 接口返回需要封装成统一json格式 （包含code , data , messages字段）
- 新增删除更新用POST,查询用GET
- 需要验证所有入参
- 需要对接口进行流量限制（比如每分钟限制单用户多少次访问，可用slowapi）
- 需要设计统一的错误码
- 需要生成Swagger文档
- 所有接口都需要有注释，注释需要包含入参，出参，错误码等信息
- 新增查询删除接口需要使用事务确保数据一致性

2.数据库
- 项目启动时需要根据最新的数据库模型进行数据库结构更新（不需要抛异常）
- 需要使用连接池
- 新增删除更新需要使用事务
- 所有表都需要有主键，主键类型为UUID
- 所有表都需要有created_at和updated_at, deleted,deleted_as字段，用于记录创建时间和更新时间，以及逻辑删除

3. 必要要有README.md和CHANGELOG.md文件
- README.md 需要对项目进行描述
- CHANGELOG.md 需要对重要功能以及版本更新进行记录

## 目录结构
```
app/  #主应用包
├── database/       # 数据库管理（数据模型，数据库连接）
├── configs/        # 配置文件以及配置模型
├── constants/      # 常量类
├── core/           # 核心功能模块
├── services/       # api实现
├── utils/          # 工具包
├── api/            # controller层
├── test/          # 单元测试，集成测试，验证脚本
├──server_run.py  #开发环境入口
├──server_wsgi.py  #生成环境入口
├── README.md
├── CHANGELOG.md
```

### 代码要求
1.api/ 只负责restful接口，每个接口都需要调用services对应的服务
2.services中只负责简单的逻辑实现（比如增改删查），复杂的业务逻辑需要调用core目录下对应的业务方法
3.core目录下每个功能模块需要都需要有自己的子目录，每个子目录下包含对应的模型，服务，以及数据模型
4.严格按照上述技术栈以及目录结构进行实现
5.api接口路径不同单词之间用下划线
6.每次数据库结构更新时需要生成增量脚本，项目启动时需要更新数据库
7.项目配置文件是configs/server_config.yaml, 包含数据库连接信息，MCP服务配置，项目端口等信息