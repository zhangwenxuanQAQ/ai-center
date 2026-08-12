"""
聊天结果流读取器

供 API 层使用，从事件总线结果队列中读取流式事件，
转换为 SSE 格式供前端消费。

支持断点继续：前端重连时从结果队列头部开始读取全部历史事件。
"""

import json
import logging
import asyncio
from typing import AsyncGenerator

from app.core.chat.event.event_bus import EventBus

logger = logging.getLogger(__name__)


class ChatResultStream:
    """
    聊天结果流读取器

    从 Redis Stream 结果队列读取事件，转换为 SSE 格式字符串。
    前端通过 HTTP SSE 接口消费这些数据。

    用法：
        async for sse_data in ChatResultStream.stream(chat_id, start_id):
            yield sse_data  # "data: {...}\\n\\n" 或 "data: [DONE]\\n\\n"
    """

    @staticmethod
    async def stream(
        chat_id: str,
        start_id: str = '0',
    ) -> AsyncGenerator[str, None]:
        """
        从结果队列读取事件并生成 SSE 格式字符串

        持续读取结果队列中的事件，直到收到 ChatDoneEvent。
        ChatStreamEvent 转换为 "data: {json}\\n\\n"，
        ChatDoneEvent 转换为 "data: [DONE]\\n\\n"。

        Args:
            chat_id: 对话ID
            start_id: 起始读取的 Stream ID，'0' 表示从头读取（用于断点重连）

        Yields:
            str: SSE 格式字符串
        """
        try:
            async for event in EventBus.read_result_stream(chat_id, start_id):
                if event.event_type == 'chat_done':
                    yield "data: [DONE]\n\n"
                    return
                elif event.event_type == 'chat_stream':
                    # 将事件 data 字段作为 SSE 数据返回
                    chunk_json = json.dumps(event.data, ensure_ascii=False)
                    yield f"data: {chunk_json}\n\n"
                    await asyncio.sleep(0)
                else:
                    # 其他事件类型也作为数据返回
                    chunk_json = json.dumps(event.data, ensure_ascii=False)
                    yield f"data: {chunk_json}\n\n"
                    await asyncio.sleep(0)
        except GeneratorExit:
            # 客户端断开连接，正常退出
            raise
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"结果流读取异常: chat_id={chat_id}, error={e}", exc_info=True)
            yield "data: [DONE]\n\n"
