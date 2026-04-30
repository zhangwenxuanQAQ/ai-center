"""
切片通用工具
"""

import hashlib
import logging

from app.database.redis_utils import redis_utils

logger = logging.getLogger(__name__)


def get_llm_cache(llm_name: str, txt: str, history: str, gen_conf: dict) -> str:
    """
    获取LLM缓存

    基于模型名称、文本内容、历史记录和生成配置计算哈希值作为缓存key，
    从Redis获取缓存结果

    Args:
        llm_name: 模型名称
        txt: 文本内容
        history: 历史记录
        gen_conf: 生成配置

    Returns:
        str: 缓存结果，未命中返回None
    """
    if not redis_utils.is_available:
        return None

    try:
        hasher = hashlib.md5()
        hasher.update((str(llm_name) + str(txt) + str(history) + str(gen_conf)).encode("utf-8"))
        k = hasher.hexdigest()
        cached = redis_utils.get(k)
        if cached:
            if isinstance(cached, bytes):
                return cached.decode("utf-8")
            return cached
        return None
    except Exception as e:
        logger.warning(f"获取LLM缓存失败: {e}")
        return None


def set_llm_cache(llm_name: str, txt: str, value: str, history: str, gen_conf: dict):
    """
    设置LLM缓存

    基于模型名称、文本内容、历史记录和生成配置计算哈希值作为缓存key，
    将结果写入Redis，过期时间为24小时

    Args:
        llm_name: 模型名称
        txt: 文本内容
        value: 缓存值
        history: 历史记录
        gen_conf: 生成配置
    """
    if not redis_utils.is_available:
        return

    try:
        hasher = hashlib.md5()
        hasher.update((str(llm_name) + str(txt) + str(history) + str(gen_conf)).encode("utf-8"))
        k = hasher.hexdigest()
        redis_utils.set(k, value, expire=24 * 3600)
    except Exception as e:
        logger.warning(f"设置LLM缓存失败: {e}")
