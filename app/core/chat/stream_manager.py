"""
聊天流式管理器

管理后台流式任务，支持客户端断开连接（如F5刷新）后继续处理，
并通过Redis存储流式数据以支持重连后接着打印输出。

工作流程：
1. 客户端发起流式请求 → 后端启动后台任务运行chat_stream
2. 后台任务将每个chunk存储到Redis list中
3. HTTP响应从Redis list中读取chunk并发送给客户端（SSE）
4. 如果客户端断开（F5），HTTP响应停止，但后台任务继续
5. 客户端重连 → 调用重连端点 → 从Redis list开头读取所有chunk + 继续读取新chunk
"""

import asyncio
import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional

from app.database.redis_utils import redis_utils

logger = logging.getLogger(__name__)


class ChatStreamManager:
    """
    聊天流式管理器

    使用Redis list存储流式chunks，支持客户端断开重连。
    每个对话的流式数据存储在两个Redis key中：
    - chat:stream:{chat_id}:chunks - Redis list，存储所有SSE chunks
    - chat:stream:{chat_id}:status - Redis string，存储流式状态（streaming/done/error）
    """

    # 存储正在运行的后台任务，key为chat_id
    _background_tasks: Dict[str, asyncio.Task] = {}

    # Redis key前缀
    CHUNKS_PREFIX = "chat:stream:"
    CHUNKS_SUFFIX = ":chunks"
    STATUS_SUFFIX = ":status"

    # 过期时间（秒）：1小时
    EXPIRE_SECONDS = 3600

    # 轮询间隔（秒）
    POLL_INTERVAL = 0.05

    @classmethod
    def _get_chunks_key(cls, chat_id: str) -> str:
        """获取流式数据chunks的Redis key"""
        return f"{cls.CHUNKS_PREFIX}{chat_id}{cls.CHUNKS_SUFFIX}"

    @classmethod
    def _get_status_key(cls, chat_id: str) -> str:
        """获取流式状态的Redis key"""
        return f"{cls.CHUNKS_PREFIX}{chat_id}{cls.STATUS_SUFFIX}"

    @classmethod
    def is_streaming(cls, chat_id: str) -> bool:
        """
        检查是否有正在进行的流式任务

        Args:
            chat_id: 对话ID

        Returns:
            bool: 是否正在流式处理中
        """
        if not redis_utils.is_available:
            return False
        status = redis_utils.get(cls._get_status_key(chat_id))
        return status == "streaming"

    @classmethod
    def get_status(cls, chat_id: str) -> str:
        """
        获取流式状态

        Args:
            chat_id: 对话ID

        Returns:
            str: 流式状态（streaming/done/error/空字符串）
        """
        if not redis_utils.is_available:
            return ""
        return redis_utils.get(cls._get_status_key(chat_id)) or ""

    @classmethod
    def get_chunks(cls, chat_id: str, start_index: int = 0) -> List[str]:
        """
        获取已存储的chunks

        Args:
            chat_id: 对话ID
            start_index: 起始索引

        Returns:
            list: chunks列表，每个元素是JSON字符串或"[DONE]"
        """
        if not redis_utils.is_available:
            return []
        try:
            key = cls._get_chunks_key(chat_id)
            return redis_utils.client.lrange(key, start_index, -1) or []
        except Exception as e:
            logger.warning(f"获取chunks失败: {e}")
            return []

    @classmethod
    def get_chunks_count(cls, chat_id: str) -> int:
        """
        获取已存储的chunks数量

        Args:
            chat_id: 对话ID

        Returns:
            int: chunks数量
        """
        if not redis_utils.is_available:
            return 0
        try:
            key = cls._get_chunks_key(chat_id)
            return redis_utils.client.llen(key) or 0
        except Exception as e:
            logger.warning(f"获取chunks数量失败: {e}")
            return 0

    @classmethod
    async def start_background_stream(
        cls,
        chat_id: str,
        chat_stream_gen: AsyncGenerator[Dict[str, Any], None]
    ) -> asyncio.Task:
        """
        启动后台流式任务

        取消该对话已有的后台任务（如果有），清理旧数据，然后启动新任务。

        Args:
            chat_id: 对话ID
            chat_stream_gen: chat_stream异步生成器

        Returns:
            asyncio.Task: 后台任务对象
        """
        # 取消已有的后台任务
        cls.cancel_background_task(chat_id)

        # 清理旧的Redis数据
        cls.cleanup_stream(chat_id)

        # 初始化Redis状态
        redis_utils.set(cls._get_status_key(chat_id), "streaming", exp=cls.EXPIRE_SECONDS)

        # 创建后台任务
        task = asyncio.create_task(cls._run_background_stream(chat_id, chat_stream_gen))
        cls._background_tasks[chat_id] = task

        logger.info(f"启动后台流式任务 - chat_id: {chat_id}")
        return task

    @classmethod
    async def _run_background_stream(
        cls,
        chat_id: str,
        chat_stream_gen: AsyncGenerator[Dict[str, Any], None]
    ):
        """
        运行后台流式任务

        迭代chat_stream生成器，将每个chunk存储到Redis list中。
        即使客户端断开连接，此任务也会继续运行。
        """
        chunks_key = cls._get_chunks_key(chat_id)
        status_key = cls._get_status_key(chat_id)

        try:
            async for chunk in chat_stream_gen:
                # 将chunk存储到Redis list
                chunk_str = json.dumps(chunk, ensure_ascii=False)
                await asyncio.to_thread(
                    redis_utils.client.rpush,
                    chunks_key,
                    chunk_str
                )
                # 更新过期时间
                await asyncio.to_thread(
                    redis_utils.client.expire,
                    chunks_key,
                    cls.EXPIRE_SECONDS
                )

            # 流式完成，推入[DONE]标记
            await asyncio.to_thread(
                redis_utils.client.rpush,
                chunks_key,
                "[DONE]"
            )
            redis_utils.set(status_key, "done", exp=cls.EXPIRE_SECONDS)
            logger.info(f"后台流式任务完成 - chat_id: {chat_id}")

        except asyncio.CancelledError:
            logger.info(f"后台流式任务被取消 - chat_id: {chat_id}")
            # 推入[DONE]标记，让等待的客户端能正常结束
            await asyncio.to_thread(
                redis_utils.client.rpush,
                chunks_key,
                "[DONE]"
            )
            redis_utils.set(status_key, "done", exp=cls.EXPIRE_SECONDS)
            raise

        except Exception as e:
            logger.error(f"后台流式任务异常 - chat_id: {chat_id}, error: {e}", exc_info=True)
            # 推入错误信息
            error_chunk = json.dumps({
                "status": "error",
                "text": f"后台流式处理异常: {str(e)}",
                "chat_id": chat_id
            }, ensure_ascii=False)
            await asyncio.to_thread(
                redis_utils.client.rpush,
                chunks_key,
                error_chunk
            )
            await asyncio.to_thread(
                redis_utils.client.rpush,
                chunks_key,
                "[DONE]"
            )
            redis_utils.set(status_key, "error", exp=cls.EXPIRE_SECONDS)

        finally:
            cls._background_tasks.pop(chat_id, None)

    @classmethod
    def cancel_background_task(cls, chat_id: str):
        """
        取消指定对话的后台任务

        Args:
            chat_id: 对话ID
        """
        task = cls._background_tasks.get(chat_id)
        if task and not task.done():
            task.cancel()
            logger.info(f"取消后台流式任务 - chat_id: {chat_id}")
        cls._background_tasks.pop(chat_id, None)

    @classmethod
    def cleanup_stream(cls, chat_id: str):
        """
        清理指定对话的流式数据

        Args:
            chat_id: 对话ID
        """
        if not redis_utils.is_available:
            return
        redis_utils.delete(cls._get_chunks_key(chat_id))
        redis_utils.delete(cls._get_status_key(chat_id))

    @classmethod
    async def stream_from_redis(
        cls,
        chat_id: str,
        start_index: int = 0
    ) -> AsyncGenerator[str, None]:
        """
        从Redis读取流式数据并生成SSE格式字符串

        此方法既用于原始请求，也用于重连请求。
        从指定索引开始读取chunks，直到读取到[DONE]标记或流式结束。

        Args:
            chat_id: 对话ID
            start_index: 起始读取索引（重连时传0以获取所有历史chunks）

        Yields:
            str: SSE格式的数据字符串
        """
        last_index = start_index
        chunks_key = cls._get_chunks_key(chat_id)
        status_key = cls._get_status_key(chat_id)

        try:
            while True:
                # 从Redis读取新的chunks
                chunks = await asyncio.to_thread(
                    redis_utils.client.lrange,
                    chunks_key,
                    last_index,
                    -1
                ) or []

                for chunk in chunks:
                    last_index += 1
                    if chunk == "[DONE]":
                        yield "data: [DONE]\n\n"
                        return
                    yield f"data: {chunk}\n\n"
                    await asyncio.sleep(0)

                # 检查流式是否已完成
                status = redis_utils.get(status_key) or ""
                if status in ("done", "error"):
                    # 确认是否还有未读取的chunks
                    total = await asyncio.to_thread(
                        redis_utils.client.llen,
                        chunks_key
                    ) or 0
                    if last_index >= total:
                        # 所有chunks已读取完毕，确保发送[DONE]
                        yield "data: [DONE]\n\n"
                        return

                # 短暂等待后继续轮询
                await asyncio.sleep(cls.POLL_INTERVAL)

        except GeneratorExit:
            # 客户端断开连接，正常退出
            raise
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"从Redis读取流式数据异常 - chat_id: {chat_id}, error: {e}")
            yield "data: [DONE]\n\n"
            raise
