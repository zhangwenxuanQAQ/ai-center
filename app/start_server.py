"""
后端服务启动脚本
负责启动MCP服务、文档切片任务执行器和FastAPI应用
"""

import os
import sys
import subprocess
import multiprocessing
import atexit

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.configs.config import config
import logging

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

_mcp_process = None
_task_executor = None
_shutdown_called = False


def _cleanup():
    """清理所有资源，确保服务完全关闭"""
    global _mcp_process, _task_executor, _shutdown_called

    if _shutdown_called:
        return
    _shutdown_called = True

    logger.info("\n[SHUTDOWN] 正在关闭所有服务...")

    if _task_executor:
        logger.info("[SHUTDOWN] 正在停止任务执行器...")
        try:
            _task_executor.stop()
            logger.info("[SHUTDOWN] ✅ 任务执行器已停止")
        except Exception as e:
            logger.error(f"[SHUTDOWN] ❌ 停止任务执行器失败: {e}")
        _task_executor = None

    if _mcp_process:
        logger.info("[SHUTDOWN] 正在停止MCP服务...")
        try:
            _mcp_process.terminate()
            try:
                _mcp_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning("[SHUTDOWN] MCP服务未在5秒内终止，强制终止...")
                _mcp_process.kill()
                _mcp_process.wait()
            logger.info("[SHUTDOWN] ✅ MCP服务已停止")
        except Exception as e:
            logger.error(f"[SHUTDOWN] ❌ 停止MCP服务失败: {e}")
        _mcp_process = None

    logger.info("[SHUTDOWN] ✅ 所有服务已关闭")


def main():
    """
    主函数：启动所有服务
    """
    global _mcp_process, _task_executor

    logger.info("=" * 80)
    logger.info("AI Center 后端服务启动中...")
    logger.info("=" * 80)

    atexit.register(_cleanup)

    os.environ["MAIN_PROCESS"] = "1"

    mcp_enabled = config.config.get('mcp', {}).get('enabled', False)

    if mcp_enabled:
        logger.info("\n[MCP] 正在启动MCP服务...")
        mcp_host = config.config.get('mcp', {}).get('host', '127.0.0.1')
        mcp_port = config.config.get('mcp', {}).get('port', 8082)

        logger.info(f"[MCP] 配置信息:")
        logger.info(f"  - 主机: {mcp_host}")
        logger.info(f"  - 端口: {mcp_port}")

        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        _mcp_process = subprocess.Popen(
            [sys.executable, "-m", "app.mcp_server"],
            cwd=project_root
        )
        logger.info(f"[MCP] ✅ MCP服务已启动: http://{mcp_host}:{mcp_port}/mcp")
    else:
        logger.info("[MCP] ⚠️ MCP服务未启用（配置文件中mcp.enabled=false）")

    logger.info("\n[TASK] 正在启动文档切片任务执行器...")
    try:
        from app.core.knowledgebase.server import task_executor
        _task_executor = task_executor
        task_executor.start()
        logger.info("[TASK] ✅ 文档切片任务执行器已启动")
    except Exception as e:
        logger.error(f"[TASK] ❌ 文档切片任务执行器启动失败: {e}")

    import uvicorn

    config_workers = config.server.get('workers', 0)
    if config_workers > 0:
        workers = config_workers
    else:
        workers = multiprocessing.cpu_count()
    workers = min(workers, 8)
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
    except KeyboardInterrupt:
        logger.info("\n[SHUTDOWN] 收到中断信号，正在关闭...")
    finally:
        _cleanup()


if __name__ == "__main__":
    main()
