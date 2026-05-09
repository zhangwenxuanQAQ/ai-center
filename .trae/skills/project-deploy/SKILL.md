---
name: project-deploy
description: 项目打包以及部署需要实现的功能以及操作
---

## 使用场景
- 项目前后端编译以及打包成Docker镜像
- 项目发布新版本

## 技术栈
- npm （前端编译打包）
- Docker （镜像部署）
- uv （python依赖管理）

## 需要实现的功能
1. 阅读项目整体目录结构，理解功能模块，更新项目README.MD文件内容
2. README.md 增加打包部署说明（需要包含环境需求，，打包步骤，启动步骤，环境变量设置，第三方数据库依赖等）
3. 更新项目的CHANGELOG.md文件内容
4. 在Docker下生成Dockerfile文件，生成docker-compose文件。
5. 根据Dockerfile打包成镜像

## 说明
- app是后端目录，web是前端目录，configs/server_config.yaml为配置项文件
- PROJECT_VERSION文件内容时版本号
- pyproject.toml以及uv.lock为项目需要的pyhon依赖

## 需要遵守
- 基础镜像需要选择Ubuntu24.04， 需要使用nginx访问前端
- 镜像名称需要来自PROJECT_VERSION
- 不要把test目录打包进镜像
- 需要使用uv安装python依赖
- 需要额外安装py-spy （RUN uv pip install py-spy）
- 需要安装ffmpeg （RUN apt-get update --allow-insecure-repositories && \
    apt-get -y install ffmpeg）
- 镜像的端口映射以及配置项需要动态可配置