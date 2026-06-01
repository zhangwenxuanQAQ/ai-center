"""
后端服务启动脚本
负责启动MCP服务、文档切片任务执行器和FastAPI应用
"""

import os
import sys
import subprocess
import multiprocessing

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.configs.config import config
import logging

# 从配置文件读取日志配置
log_level = config.logging.get('level', 'INFO').upper()
log_format = config.logging.get('format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')

logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format=log_format,
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def main():
    """
    主函数：启动所有服务
    """
    logger.info("=" * 80)
    logger.info("AI Center 后端服务启动中...")
    logger.info("=" * 80)
    
    # 设置环境变量标识主进程
    os.environ["MAIN_PROCESS"] = "1"
    
    # 启动MCP服务
    mcp_process = None
    mcp_enabled = config.config.get('mcp', {}).get('enabled', False)
    
    if mcp_enabled:
        logger.info("\n[MCP] 正在启动MCP服务...")
        mcp_host = config.config.get('mcp', {}).get('host', '127.0.0.1')
        mcp_port = config.config.get('mcp', {}).get('port', 8082)
        
        logger.info(f"[MCP] 配置信息:")
        logger.info(f"  - 主机: {mcp_host}")
        logger.info(f"  - 端口: {mcp_port}")
        
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        mcp_process = subprocess.Popen(
            [sys.executable, "-m", "app.mcp_server"],
            cwd=project_root
        )
        logger.info(f"[MCP] ✅ MCP服务已启动: http://{mcp_host}:{mcp_port}/mcp")
    else:
        logger.info("[MCP] ⚠️ MCP服务未启用（配置文件中mcp.enabled=false）")
    
    # 启动文档切片任务执行器
    logger.info("\n[TASK] 正在启动文档切片任务执行器...")
    try:
        from app.core.knowledgebase.server import task_executor
        task_executor.start()
        logger.info("[TASK] ✅ 文档切片任务执行器已启动")
    except Exception as e:
        logger.error(f"[TASK] ❌ 文档切片任务执行器启动失败: {e}")
    
    # 启动FastAPI应用
    import uvicorn
    
    # 自动根据CPU核心数设置workers数量
    workers = multiprocessing.cpu_count()
    # 限制最大workers数量为8，避免过多进程
    workers = min(workers, 8)
    # 至少1个worker
    workers = max(workers, 1)
    
    logger.info(f"\n[SERVER] 启动配置:")
    logger.info(f"  - Workers数量: {workers}")
    logger.info(f"  - CPU核心数: {multiprocessing.cpu_count()}")
    logger.info(f"  - 后端API: http://{config.server['host']}:{config.server['http_port']}")
    logger.info(f"  - Swagger文档: http://{config.server['host']}:{config.server['http_port']}/docs")
    logger.info(f"  - ReDoc文档: http://{config.server['host']}:{config.server['http_port']}/redoc")
    
    try:
        uvicorn.run(
            "app.server_run:app",
            host=config.server['host'],
            port=config.server['http_port'],
            workers=workers,
            access_log=True,
            timeout_keep_alive=5,
        )
    finally:
        if mcp_process:
            logger.info("\n[SHUTDOWN] 正在停止MCP服务...")
            mcp_process.terminate()
            mcp_process.wait()
            logger.info("[SHUTDOWN] ✅ MCP服务已停止")

if __name__ == "__main__":
    main()
