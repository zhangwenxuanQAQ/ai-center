"""
自定义异常类定义
"""

import logging

logger = logging.getLogger(__name__)


class BaseServiceError(Exception):
    """
    Service层基础异常

    Attributes:
        message: 错误消息
        detail: 错误详情
    """
    def __init__(self, message: str, detail: str = None):
        """
        初始化异常

        Args:
            message: 错误消息
            detail: 错误详情
        """
        self.message = message
        self.detail = detail
        super().__init__(self.message)


class ResourceNotFoundError(BaseServiceError):
    """
    资源未找到异常
    """
    pass


class DuplicateResourceError(BaseServiceError):
    """
    资源重复异常（唯一约束冲突）
    """
    pass


class DatabaseOperationError(BaseServiceError):
    """
    数据库操作异常
    """
    pass


def extract_actual_exception(exc: Exception) -> Exception:
    """
    解包ExceptionGroup/TaskGroup包装的异常，返回最内层的实际异常

    场景说明：
        Python 3.11+ 引入 ExceptionGroup，anyio.TaskGroup 等异步并发原语在
        子任务抛出异常时，会将其包装为 ExceptionGroup 后再抛出。这会导致
        str(e) 只能获取到 "unhandled errors in a TaskGroup (1 sub-exception)"
        之类的占位信息，而真正的错误内容被埋在 sub-exceptions 中。

        MCP SDK 内部使用 anyio.TaskGroup 管理异步任务，因此工具调用抛出的
        异常（如 MCPClientError）在穿过 connect() 上下文退出时会被 TaskGroup
        包装，需要本方法解包后才能拿到原始错误信息。

    Args:
        exc: 可能被ExceptionGroup包装的异常

    Returns:
        Exception: 最内层的实际异常；若无可解包的子异常则返回原异常
    """
    logger.debug(
        f"[extract_actual_exception] 开始解包异常, 原始异常类型: {type(exc).__name__}, "
        f"原始异常信息: {str(exc)}"
    )

    current = exc
    depth = 0

    while isinstance(current, BaseExceptionGroup):
        sub_exceptions = current.exceptions
        logger.debug(
            f"[extract_actual_exception] 第{depth}层为ExceptionGroup, "
            f"类型: {type(current).__name__}, 子异常数量: {len(sub_exceptions)}"
        )

        if not sub_exceptions:
            logger.debug(
                f"[extract_actual_exception] 第{depth}层ExceptionGroup无子异常, 停止解包"
            )
            break

        # 取第一个子异常继续向下解包
        current = sub_exceptions[0]
        logger.debug(
            f"[extract_actual_exception] 第{depth}层解包出子异常, "
            f"类型: {type(current).__name__}, 信息: {str(current)}"
        )
        depth += 1

    if current is not exc:
        logger.info(
            f"[extract_actual_exception] 解包完成, 原始类型: {type(exc).__name__}, "
            f"最终类型: {type(current).__name__}, 解包层数: {depth}, "
            f"最终异常信息: {str(current)}"
        )
    else:
        logger.debug(
            f"[extract_actual_exception] 异常未被ExceptionGroup包装, 直接返回, "
            f"类型: {type(current).__name__}"
        )

    return current
