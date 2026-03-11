# 服务来源
SOURCE_TYPE = {
    "thirdparty": "第三方",
    "local": "本地"
}

# MCP服务传输类型
TRANSPORT_TYPE = {
    "sse": "SSE",
    "streamable_http": "Streamable HTTP",
    "stdio": "Stdio",
}

# 默认本地MCP SERVER配置
DEFAULT_LOCAL_MCP_CONFIG = {
    "host": "127.0.0.1",
    "port": 8082,
    "transport_type": "streamable_http"
}
