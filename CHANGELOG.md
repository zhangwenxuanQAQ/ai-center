# 更新日志 (Changelog)

本文档记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 添加多worker模式启动脚本 `app/start_server.py`
  - 支持根据CPU核心数自动设置workers数量（最多8个）
  - 确保MCP服务和文档切片任务执行器只启动一次
  - 避免多进程模式下的端口冲突问题

### 变更
- 更新后端服务启动方式
  - 启动命令从 `python -m app.server_run` 改为 `python -m app.start_server`
  - FastAPI应用使用导入字符串格式，支持多worker模式
  - 优化服务启动流程，提升并发处理能力
- 更新Docker部署配置
  - `docker/entrypoint.sh` 使用统一的启动脚本
  - 移除单独启动MCP服务的代码，由start_server统一管理
- 更新项目文档
  - README.md 更新启动命令说明
  - app/core/mcp/README.md 更新启动方式

### 优化
- 后端服务性能提升
  - 支持多worker进程并行处理请求
  - 根据CPU核心数自动调整worker数量
  - 设置keep-alive超时优化连接管理

## [aihub_v2_beta_0.1] - 2026-05-21

### 新增
- 知识库数据集表添加metadatas字段，支持设置元数据以及元数据查询知识
- 向量库增加availabel_int、image_base64字段
- 支持单个切片增改删操作

### 变更
- 切片关键词提取提示词修改
- es索引mapping文件更新
- rerank模型的相似度查询方法更新
- 知识向量检索的相似度计算更新
- 切片向量化逻辑代码更新
- 切片查询前后端代码更新
- 知识检索前后端代码更新
- 检索测试界面更新
- 切片列表页面更新
- Dockerfile更新

### 修复
- 任务进度bug修复
- 测试连接数据源前端代码bug修复
- 批量删除未删除es数据bug修复
- embedding数据错误问题修复
- PDF表格解析bug修复
- 前端assets资源文件获取路径bug修复

## [Unreleased]

### 新增
- 添加Docker部署支持，支持容器化部署
- 添加完整的Dockerfile和docker-compose.yml配置
- 添加Nginx配置，支持前后端统一入口
- 添加环境变量配置支持，实现配置动态化
- 添加健康检查机制，确保服务稳定运行
- 添加统一响应格式工具类 `app/utils/response.py`
- 添加基础DTO类 `app/services/base_dto.py`
- 添加全局错误消息提示功能（前端）
- 添加前端HTTP请求工具类 `web/src/utils/request.ts`
- 添加测试验证脚本目录 `app/test/`
- 添加数据库连接测试脚本
- 添加模块导入验证脚本
- 添加uv依赖管理工具支持
- 添加py-spy性能监控工具

### 变更
- 更新README.md，增加详细的功能说明和部署文档
- 更新项目结构说明，反映实际的目录结构
- 优化Dockerfile，使用Ubuntu 24.04作为基础镜像
- 使用uv替代pip进行Python依赖管理
- 将所有数据库主键从IntegerField改为UUIDField
- 将所有表名称从复数改为单数形式
- 将ORM从SQLAlchemy迁移到Peewee + Playhouse
- 重构目录结构，将dto和service从core移动到services目录
- 更新所有DTO文件，继承BaseDTO
- 更新所有API接口，使用统一的响应格式
- 更新HTTP方法：新增、更新、删除使用POST，查询使用GET
- 完善所有类和方法的中文注释
- 为所有DTO字段添加详细的参数校验和中文描述

### 优化
- 优化数据库连接管理，使用连接池
- 优化错误处理机制，统一异常处理
- 优化前端错误提示，支持全局消息提示
- 优化项目文档，更新README和添加CHANGELOG
- 优化Docker镜像构建，使用多阶段构建减小镜像体积
- 优化部署流程，支持一键启动所有服务

### 修复
- 修复UUIDField导入路径问题
- 修复数据库表名称不一致问题
- 修复前端请求错误处理不完善的问题
- 修复Docker配置中的路径引用问题

## [1.0.0] - 2026-03-2

### 新增
- 初始项目结构
- 用户管理功能
- 聊天机器人管理功能
- 聊天记录管理功能
- 知识库管理功能
- LLM模型管理功能
- MCP管理功能
- 提示词管理功能
- FastAPI后端框架
- React前端框架
- MySQL数据库支持
- Swagger API文档

---

## 版本说明

### 版本号格式
- **主版本号**: 不兼容的API变更
- **次版本号**: 向后兼容的功能新增
- **修订号**: 向后兼容的问题修复

### 变更类型
- **新增 (Added)**: 新功能
- **变更 (Changed)**: 对现有功能的变更
- **弃用 (Deprecated)**: 即将删除的功能
- **移除 (Removed)**: 已删除的功能
- **修复 (Fixed)**: 任何bug修复
- **安全 (Security)**: 安全相关的修复
