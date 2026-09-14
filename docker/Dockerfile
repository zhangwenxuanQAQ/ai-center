# 第一阶段：构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /aicenter/web

COPY web/package.json web/package-lock.json ./

RUN npm install

COPY web/ ./

RUN npm run build

# 第二阶段：构建后端运行环境
FROM ubuntu:24.04

LABEL maintainer="AI Center Team"
ARG VERSION=aihub_v2_beta_0.1.2
LABEL version="${VERSION}"
LABEL description="大模型AI服务中心 - 集成多种AI功能的管理系统"

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /aicenter

RUN echo "deb http://mirrors.aliyun.com/ubuntu/ noble main restricted universe multiverse" > /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/ubuntu/ noble-security main restricted universe multiverse" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/ubuntu/ noble-updates main restricted universe multiverse" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.aliyun.com/ubuntu/ noble-backports main restricted universe multiverse" >> /etc/apt/sources.list && \
    apt-get update --allow-insecure-repositories && apt-get install -y --no-install-recommends \
    python3.12 \
    python3-pip \
    python3.12-venv \
    curl \
    nginx \
    ffmpeg \
    ca-certificates \
    vim \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

RUN curl -LsSf https://astral.sh/uv/install.sh | sh

ENV PATH="/root/.local/bin:$PATH"

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml uv.lock ./

RUN uv pip install py-spy --index-url https://mirrors.aliyun.com/pypi/simple/

RUN uv pip install -r pyproject.toml --index-url https://mirrors.aliyun.com/pypi/simple/

# 安装 hermes-agent 智能体引擎 CLI（PyPI 发版，--no-deps 与主项目依赖解耦）
# 说明：hermes-agent 核心依赖（openai/pyyaml/pydantic/fastapi/httpx 等）已包含在主项目依赖中，
# 版本冲突的依赖通过 --no-deps 规避，与本地开发环境安装方式一致
RUN uv pip install "hermes-agent==0.19.0" --no-deps --index-url https://mirrors.aliyun.com/pypi/simple/

# 智能体运行时目录（HERMES_HOME 默认指向容器内持久化目录）
RUN mkdir -p /aicenter/data/hermes

COPY app/ ./app/
COPY configs/ ./configs/
COPY app/core/knowledgebase/rag/res/nltk_data /root/nltk_data
COPY 9b5ad71b2ce5302211f9c61530b329a4922fc6a4 9b5ad71b2ce5302211f9c61530b329a4922fc6a4

RUN rm -rf ./app/test

# 创建数据目录，包含skill等运行时持久化目录
RUN mkdir -p /aicenter/data/skill
COPY data/ /aicenter/data/

COPY --from=frontend-builder /aicenter/web/dist /aicenter/web/dist

# 复制资源文件到容器中（包括Swagger UI静态资源）
COPY web/src/assets /aicenter/web/src/assets

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/aicenter.conf /etc/nginx/conf.d/aicenter.conf

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 8081 8082


# 持久化数据卷（可选挂载）
VOLUME ["/aicenter/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8081/docs || exit 1

ENTRYPOINT ["/entrypoint.sh"]
