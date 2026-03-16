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


def _get_default_local_mcp_config():
    """
    获取默认本地MCP SERVER配置
    从配置文件读取host和port
    """
    from app.configs.config import config
    host = config.config.get('mcp', {}).get('host', '127.0.0.1')
    port = config.config.get('mcp', {}).get('port', 8082)
    return {
        "host": host,
        "port": port,
        "transport_type": "streamable_http"
    }


DEFAULT_LOCAL_MCP_CONFIG = _get_default_local_mcp_config()

# MCP工具类型
TOOL_TYPE = {
    "restful_api": "api接口",
    "mcp": "mcp工具"
}