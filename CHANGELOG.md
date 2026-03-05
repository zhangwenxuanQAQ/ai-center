# 更新日志 (Changelog)

本文档记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 添加统一响应格式工具类 `app/utils/response.py`
- 添加基础DTO类 `app/services/base_dto.py`
- 添加全局错误消息提示功能（前端）
- 添加前端HTTP请求工具类 `web/src/utils/request.ts`
- 添加测试验证脚本目录 `app/test/`
- 添加数据库连接测试脚本
- 添加模块导入验证脚本

### 变更
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

### 修复
- 修复UUIDField导入路径问题
- 修复数据库表名称不一致问题
- 修复前端请求错误处理不完善的问题

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
