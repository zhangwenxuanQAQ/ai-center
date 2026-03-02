# 后端基础镜像
FROM python:3.8-slim as backend

# 设置工作目录
WORKDIR /app

# 安装依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ .
COPY configs/ ../configs/

# 前端基础镜像
FROM node:16-slim as frontend

# 设置工作目录
WORKDIR /app

# 安装依赖
COPY web/package.json .
COPY web/package-lock.json .
RUN npm install

# 复制前端代码
COPY web/ .

# 构建前端
RUN npm run build

# 最终镜像
FROM python:3.8-slim

# 设置工作目录
WORKDIR /app

# 安装依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ .
COPY configs/ ../configs/

# 复制前端构建结果
COPY --from=frontend /app/dist ./web/dist

# 暴露端口
EXPOSE 9380

# 启动命令
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "9380"]