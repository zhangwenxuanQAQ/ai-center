"""
MCP服务独立入口
"""

import sys
import os
import uvicorn

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.configs.config import config
from app.core.mcp.server.server import mcp_runner

print("=" * 80)
print("MCP服务启动中...")
print("=" * 80)

mcp_runner.setup()
mcp = mcp_runner.get_app()

print("\n" + "=" * 80)
print("MCP服务启动成功！")
print("=" * 80)
print(f"\n服务地址:")
print(f"  - MCP服务:     http://{config.config.get('mcp', {}).get('host', '127.0.0.1')}:{config.config.get('mcp', {}).get('port', 8082)}/mcp")
print("\n" + "=" * 80)

if __name__ == "__main__":
    mcp_host = config.config.get('mcp', {}).get('host', '127.0.0.1')
    mcp_port = config.config.get('mcp', {}).get('port', 8082)
    uvicorn.run(
        mcp,
        host=mcp_host,
        port=mcp_port,
        ws='none'
    )
