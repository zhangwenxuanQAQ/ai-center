"""
聊天流式缓冲区

基于 Redis List 实现流式 chunk 的缓冲与重连。
流式生成时将每个 chunk rpush 到 Redis List，
重连时 lrange 读取已缓冲的 chunk 再继续轮询新 chunk。

同时管理流式状态（streaming/done/stop/error）供前端查询。
"""

import json
import logging
import asyncio
from typing import AsyncGenerator, Optional

from app.database.redis_utils import redis_utils

logger = logging.getLogger(__name__)


class ChatStreamBuffer:
    """
    聊天流式缓冲区

    使用 Redis List 缓冲流式 chunk，支持断点重连。

    键命名规则：
        - 缓冲队列: chat:stream:buffer:{chat_id}
        - 流式状态: chat:stream:status:{chat_id}
        - [DONE] 标记: chat:stream:done:{chat_id}
    """

    BUFFER_PREFIX = 'chat:stream:buffer:'
    STATUS_PREFIX = 'chat:stream:status:'
    DONE_PREFIX = 'chat:stream:done:'

    EXPIRE_SECONDS = 7200  # 2小时
    POLL_INTERVAL = 0.05   # 50ms

    # ==================== 缓冲区操作 ====================

    @classmethod
    def _get_buffer_key(cls, chat_id: str) -> str:
        return f'{cls.BUFFER_PREFIX}{chat_id}'

    @classmethod
    def _get_status_key(cls, chat_id: str) -> str:
        return f'{cls.STATUS_PREFIX}{chat_id}'

    @classmethod
    def _get_done_key(cls, chat_id: str) -> str:
        return f'{cls.DONE_PREFIX}{chat_id}'

    @classmethod
    def append_chunk(cls, chat_id: str, chunk: dict):
        """将一个 chunk 追加到 Redis List 缓冲区"""
        if not redis_utils.is_available:
            return
        try:
            redis_utils.client.rpush(
                cls._get_buffer_key(chat_id),
                json.dumps(chunk, ensure_ascii=False)
            )
            redis_utils.client.expire(cls._get_buffer_key(chat_id), cls.EXPIRE_SECONDS)
        except Exception as e:
            logger.error(f"追加chunk到缓冲区失败: chat_id={chat_id}, error={e}")

    @classmethod
    def mark_done(cls, chat_id: str):
        """标记流式结束"""
        if not redis_utils.is_available:
            return
        try:
            redis_utils.client.rpush(cls._get_buffer_key(chat_id), '[DONE]')
            redis_utils.set(cls._get_done_key(chat_id), '1', exp=cls.EXPIRE_SECONDS)
        except Exception as e:
            logger.error(f"标记完成失败: chat_id={chat_id}, error={e}")

    @classmethod
    def is_done(cls, chat_id: str) -> bool:
        """检查流式是否已结束"""
        if not redis_utils.is_available:
            return False
        return bool(redis_utils.get(cls._get_done_key(chat_id)))

    # ==================== 状态管理 ====================

    @classmethod
    def set_streaming_status(cls, chat_id: str, status: str):
        """设置流式状态（streaming/done/stop/error）"""
        if not redis_utils.is_available:
            return
        redis_utils.set(cls._get_status_key(chat_id), status, exp=cls.EXPIRE_SECONDS)

    @classmethod
    def get_streaming_status(cls, chat_id: str) -> str:
        """获取流式状态"""
        if not redis_utils.is_available:
            return ''
        return redis_utils.get(cls._get_status_key(chat_id)) or ''

    @classmethod
    def is_streaming(cls, chat_id: str) -> bool:
        """检查是否正在流式处理"""
        return cls.get_streaming_status(chat_id) == 'streaming'

    @classmethod
    def get_streaming_status_info(cls, chat_id: str) -> dict:
        """获取流式状态详情（供 API 返回）"""
        status = cls.get_streaming_status(chat_id)
        buffer_len = 0
        if redis_utils.is_available:
            try:
                buffer_len = redis_utils.client.llen(cls._get_buffer_key(chat_id)) or 0
            except Exception:
                pass
        return {
            'is_streaming': status == 'streaming',
            'status': status,
            'chunks_count': buffer_len
        }

    # ==================== 重连读取 ====================

    @classmethod
    def get_buffered_chunks(cls, chat_id: str) -> list:
        """获取已缓冲的所有 chunk（用于重连时回放）"""
        if not redis_utils.is_available:
            return []
        try:
            raw_list = redis_utils.client.lrange(cls._get_buffer_key(chat_id), 0, -1) or []
            chunks = []
            for raw in raw_list:
                if isinstance(raw, bytes):
                    raw = raw.decode('utf-8')
                if raw == '[DONE]':
                    chunks.append('[DONE]')
                else:
                    try:
                        chunks.append(json.loads(raw))
                    except (json.JSONDecodeError, TypeError):
                        pass
            return chunks
        except Exception as e:
            logger.error(f"获取缓冲chunk失败: chat_id={chat_id}, error={e}")
            return []

    @classmethod
    async def stream_for_reconnect(cls, chat_id: str) -> AsyncGenerator[str, None]:
        """
        重连流式输出：先发送所有已缓冲的 chunk，然后轮询新 chunk 直到 [DONE]。

        Yields:
            str: SSE 格式字符串 "data: {json}\n\n" 或 "data: [DONE]\n\n"
        """
        try:
            # 1. 读取已缓冲的所有 chunk
            buffered = await asyncio.to_thread(cls.get_buffered_chunks, chat_id)

            for chunk in buffered:
                if chunk == '[DONE]':
                    yield "data: [DONE]\n\n"
                    return
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0)

            # 2. 如果已经结束，直接返回 [DONE]
            if cls.is_done(chat_id):
                yield "data: [DONE]\n\n"
                return

            # 3. 轮询新 chunk
            last_len = len(buffered)
            while True:
                status = cls.get_streaming_status(chat_id)

                # 读取当前缓冲区中新增的 chunk
                current_len = 0
                if redis_utils.is_available:
                    try:
                        current_len = redis_utils.client.llen(cls._get_buffer_key(chat_id)) or 0
                    except Exception:
                        pass

                if current_len > last_len:
                    # 有新 chunk，读取它们
                    new_raw = await asyncio.to_thread(
                        redis_utils.client.lrange,
                        cls._get_buffer_key(chat_id),
                        last_len,
                        -1
                    ) or []

                    for raw in new_raw:
                        if isinstance(raw, bytes):
                            raw = raw.decode('utf-8')
                        if raw == '[DONE]':
                            yield "data: [DONE]\n\n"
                            return
                        try:
                            chunk = json.loads(raw)
                            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                            await asyncio.sleep(0)
                        except (json.JSONDecodeError, TypeError):
                            pass

                    last_len = current_len

                # 检查是否已结束
                if status in ('done', 'stop', 'error'):
                    # 确保读取了所有剩余 chunk
                    if current_len > last_len:
                        continue
                    yield "data: [DONE]\n\n"
                    return

                await asyncio.sleep(cls.POLL_INTERVAL)

        except GeneratorExit:
            raise
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"重连流式读取异常: chat_id={chat_id}, error={e}", exc_info=True)
            yield "data: [DONE]\n\n"

    # ==================== 清理 ====================

    @classmethod
    def cleanup(cls, chat_id: str):
        """清理指定对话的缓冲区数据"""
        if not redis_utils.is_available:
            return
        try:
            redis_utils.delete(cls._get_buffer_key(chat_id))
            redis_utils.delete(cls._get_status_key(chat_id))
            redis_utils.delete(cls._get_done_key(chat_id))
        except Exception as e:
            logger.error(f"清理缓冲区失败: chat_id={chat_id}, error={e}")

    @classmethod
    def cleanup_all(cls):
        """清理所有流式缓冲区数据（服务重启时调用）"""
        if not redis_utils.is_available:
            return
        try:
            for prefix in (cls.BUFFER_PREFIX, cls.STATUS_PREFIX, cls.DONE_PREFIX):
                keys = redis_utils.client.keys(f'{prefix}*')
                if keys:
                    redis_utils.client.delete(*keys)
                    logger.info(f"清理流式缓冲区: prefix={prefix}, count={len(keys)}")
        except Exception as e:
            logger.error(f"清理所有缓冲区失败: {e}")
