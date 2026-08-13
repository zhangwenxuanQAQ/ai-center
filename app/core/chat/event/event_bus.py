"""
事件总线

基于 Redis Stream 实现的事件总线，提供事件的发布和消费能力。

使用两组 Redis Stream：
    1. 请求队列（Request Queue）：前端 → 消费者，传递聊天请求和停止事件
    2. 结果队列（Result Queue）：消费者 → 前端，传递流式 chunk 和完成事件

每个对话有独立的结果队列（按 chat_id 区分），请求队列全局共享。
结果队列同时作为断点继续聊天的数据源：前端重连时从结果队列读取历史 chunk。
"""

import json
import logging
import asyncio
from typing import Optional, Dict, Any, List, AsyncGenerator

from app.database.redis_utils import redis_utils
from app.core.chat.event.event import BaseEvent, ChatRequestEvent, ChatStopEvent, ChatStreamEvent, ChatDoneEvent, IntegrationChatRequestEvent

logger = logging.getLogger(__name__)


class EventBus:
    """
    Redis Stream 事件总线

    提供事件的发布、消费和结果队列管理。

    队列命名规则：
        - 请求队列: chat:event:request （全局共享）
        - 结果队列: chat:event:result:{chat_id} （每个对话独立）
        - 流式状态: chat:event:status:{chat_id} （记录当前流式状态）

    消费者组：
        - 请求队列消费者组: chat_request_group
        - 结果队列消费者组: chat_result_group:{chat_id}
    """

    # 请求队列名称（全局共享）
    REQUEST_QUEUE = 'chat:event:request'
    REQUEST_GROUP = 'chat_request_group'
    REQUEST_CONSUMER = 'chat_consumer_1'

    # 结果队列前缀（按 chat_id 区分）
    RESULT_QUEUE_PREFIX = 'chat:event:result:'
    RESULT_GROUP_PREFIX = 'chat_result_group:'

    # 流式状态前缀
    STATUS_PREFIX = 'chat:event:status:'

    # 聊天上下文前缀（用于停止时保存/恢复 _save_stop_response 所需参数）
    CONTEXT_PREFIX = 'chat:event:context:'

    # 过期时间（秒）：2小时
    EXPIRE_SECONDS = 7200

    # 轮询间隔（秒）
    POLL_INTERVAL = 0.05

    @classmethod
    def _get_result_queue(cls, chat_id: str) -> str:
        """获取结果队列名称"""
        return f'{cls.RESULT_QUEUE_PREFIX}{chat_id}'

    @classmethod
    def _get_result_group(cls, chat_id: str) -> str:
        """获取结果队列消费者组名称"""
        return f'{cls.RESULT_GROUP_PREFIX}{chat_id}'

    @classmethod
    def _get_status_key(cls, chat_id: str) -> str:
        """获取流式状态key"""
        return f'{cls.STATUS_PREFIX}{chat_id}'

    # ==================== 发布事件 ====================

    @classmethod
    async def publish(cls, event: BaseEvent, queue: Optional[str] = None) -> bool:
        """
        发布事件到指定队列

        Args:
            event: 事件对象
            queue: 目标队列名称，None 时根据事件类型自动选择

        Returns:
            bool: 是否发布成功
        """
        if not redis_utils.is_available:
            logger.error("Redis不可用，无法发布事件")
            return False

        target_queue = queue or cls._resolve_queue(event)
        event_json = event.to_json_str()

        try:
            await asyncio.to_thread(
                redis_utils.client.xadd,
                target_queue,
                {'message': event_json},
            )
            # 设置过期时间
            await asyncio.to_thread(
                redis_utils.client.expire,
                target_queue,
                cls.EXPIRE_SECONDS,
            )
            logger.debug(f"事件已发布: type={event.event_type}, queue={target_queue}, chat_id={event.chat_id}")
            return True
        except Exception as e:
            logger.error(f"发布事件失败: {e}", exc_info=True)
            return False

    @classmethod
    def _resolve_queue(cls, event: BaseEvent) -> str:
        """根据事件类型自动选择目标队列"""
        if event.event_type in ('chat_request', 'integration_chat_request', 'chat_stop'):
            return cls.REQUEST_QUEUE
        else:
            # 流式事件和完成事件发送到对应 chat_id 的结果队列
            return cls._get_result_queue(event.chat_id)

    # ==================== 消费请求队列 ====================

    @classmethod
    async def consume_request(cls, block_ms: int = 1000) -> Optional[BaseEvent]:
        """
        从请求队列消费一条事件（阻塞式）

        使用消费者组读取请求队列中的新消息。
        消息读取后会自动 ACK，避免重复消费。

        Args:
            block_ms: 阻塞等待时间（毫秒），0 表示非阻塞

        Returns:
            BaseEvent 或 None（无消息时）
        """
        if not redis_utils.is_available:
            return None

        try:
            # 确保消费者组存在
            cls._ensure_request_group()

            result = await asyncio.to_thread(
                redis_utils.client.xreadgroup,
                cls.REQUEST_GROUP,
                cls.REQUEST_CONSUMER,
                {cls.REQUEST_QUEUE: '>'},
                count=1,
                block=block_ms,
            )

            if not result:
                return None

            stream, element_list = result[0]
            if not element_list:
                return None

            msg_id, payload = element_list[0]
            event = BaseEvent.from_json_str(payload['message'])

            # ACK 消息
            await asyncio.to_thread(
                redis_utils.client.xack,
                cls.REQUEST_QUEUE,
                cls.REQUEST_GROUP,
                msg_id,
            )

            # 根据 event_type 还原为具体事件类型
            return cls._resolve_event_type(event)

        except Exception as e:
            logger.error(f"消费请求队列失败: {e}", exc_info=True)
            return None

    @classmethod
    def _ensure_request_group(cls):
        """确保请求队列的消费者组存在"""
        try:
            redis_utils.client.xgroup_create(
                cls.REQUEST_QUEUE, cls.REQUEST_GROUP, id='0', mkstream=True
            )
        except Exception as e:
            if 'busygroup' not in str(e).lower() and 'no such key' not in str(e).lower():
                logger.warning(f"创建请求队列消费者组异常: {e}")

    @classmethod
    def _resolve_event_type(cls, event: BaseEvent) -> BaseEvent:
        """根据 event_type 字段还原为具体的事件子类"""
        type_map = {
            'chat_request': ChatRequestEvent,
            'integration_chat_request': IntegrationChatRequestEvent,
            'chat_stop': ChatStopEvent,
        }
        target_cls = type_map.get(event.event_type, BaseEvent)
        return target_cls(
            event_id=event.event_id,
            event_type=event.event_type,
            chat_id=event.chat_id,
            timestamp=event.timestamp,
            data=event.data,
        )

    # ==================== 结果队列管理 ====================

    @classmethod
    def set_streaming_status(cls, chat_id: str, status: str):
        """
        设置流式状态

        Args:
            chat_id: 对话ID
            status: 状态值（streaming/done/error/stop）
        """
        if not redis_utils.is_available:
            return
        redis_utils.set(cls._get_status_key(chat_id), status, exp=cls.EXPIRE_SECONDS)

    @classmethod
    def get_streaming_status(cls, chat_id: str) -> str:
        """
        获取流式状态

        Returns:
            str: 状态值（streaming/done/error/stop/空字符串）
        """
        if not redis_utils.is_available:
            return ''
        return redis_utils.get(cls._get_status_key(chat_id)) or ''

    @classmethod
    def is_streaming(cls, chat_id: str) -> bool:
        """检查是否正在流式处理"""
        return cls.get_streaming_status(chat_id) == 'streaming'

    @classmethod
    async def read_result_stream(
        cls,
        chat_id: str,
        start_id: str = '0',
    ) -> AsyncGenerator[BaseEvent, None]:
        """
        从结果队列读取流式事件（供前端 SSE 消费）

        从指定位置开始读取结果队列中的事件，持续轮询直到收到 ChatDoneEvent。
        支持断点继续：前端重连时传入 start_id='0' 可获取全部历史事件。

        Args:
            chat_id: 对话ID
            start_id: 起始读取的 Stream ID，'0' 表示从头读取

        Yields:
            BaseEvent: 事件对象（ChatStreamEvent 或 ChatDoneEvent）
        """
        if not redis_utils.is_available:
            return

        result_queue = cls._get_result_queue(chat_id)
        last_id = start_id

        try:
            while True:
                # 从结果队列读取新事件
                entries = await asyncio.to_thread(
                    redis_utils.client.xrange,
                    result_queue,
                    last_id,
                    '+',
                    count=100,
                ) or []

                for entry_id, payload in entries:
                    # 跳过已读的 ID（xrange 是闭区间，需要排除 last_id 本身）
                    if entry_id == last_id:
                        continue
                    last_id = entry_id

                    event = BaseEvent.from_json_str(payload['message'])
                    event = cls._resolve_result_event_type(event)
                    yield event

                    if event.event_type == 'chat_done':
                        return

                # 检查流式是否已结束
                status = cls.get_streaming_status(chat_id)
                if status in ('done', 'error', 'stop'):
                    # 确认是否还有未读取的事件
                    remaining = await asyncio.to_thread(
                        redis_utils.client.xrange,
                        result_queue,
                        last_id,
                        '+',
                        count=1,
                    ) or []
                    # 检查是否还有未读事件（排除当前 last_id）
                    has_unread = any(eid != last_id for eid, _ in remaining)
                    if not has_unread:
                        # 发送一个 [DONE] 兜底
                        yield ChatDoneEvent.create(chat_id, status=status)
                        return

                # 短暂等待后继续轮询
                await asyncio.sleep(cls.POLL_INTERVAL)

        except asyncio.CancelledError:
            raise
        except GeneratorExit:
            raise
        except Exception as e:
            logger.error(f"读取结果队列异常: chat_id={chat_id}, error={e}", exc_info=True)
            yield ChatDoneEvent.create(chat_id, status='error', error=str(e))

    @classmethod
    def _resolve_result_event_type(cls, event: BaseEvent) -> BaseEvent:
        """根据 event_type 字段还原结果事件的具体子类"""
        type_map = {
            'chat_stream': ChatStreamEvent,
            'chat_done': ChatDoneEvent,
        }
        target_cls = type_map.get(event.event_type, BaseEvent)
        return target_cls(
            event_id=event.event_id,
            event_type=event.event_type,
            chat_id=event.chat_id,
            timestamp=event.timestamp,
            data=event.data,
        )

    @classmethod
    def get_result_queue_length(cls, chat_id: str) -> int:
        """获取结果队列中的事件数量"""
        if not redis_utils.is_available:
            return 0
        try:
            return redis_utils.client.xlen(cls._get_result_queue(chat_id)) or 0
        except Exception:
            return 0

    @classmethod
    def cleanup(cls, chat_id: str):
        """清理指定对话的事件总线数据"""
        if not redis_utils.is_available:
            return
        redis_utils.delete(cls._get_result_queue(chat_id))
        redis_utils.delete(cls._get_status_key(chat_id))
        cls.clear_chat_context(chat_id)

    # ==================== 聊天上下文管理 ====================

    @classmethod
    def save_chat_context(cls, chat_id: str, context: dict):
        """
        保存聊天上下文到Redis（供停止时调用 _save_stop_response 使用）

        聊天循环中实时更新此上下文，停止接口从中读取参数。

        Args:
            chat_id: 对话ID
            context: 上下文字典，包含 _save_stop_response 所需的全部参数
        """
        if not redis_utils.is_available:
            return
        redis_utils.set_obj(f'{cls.CONTEXT_PREFIX}{chat_id}', context, exp=cls.EXPIRE_SECONDS)

    @classmethod
    def get_chat_context(cls, chat_id: str) -> Optional[dict]:
        """
        获取聊天上下文

        Args:
            chat_id: 对话ID

        Returns:
            Optional[dict]: 上下文字典，不存在则返回 None
        """
        if not redis_utils.is_available:
            return None
        return redis_utils.get_obj(f'{cls.CONTEXT_PREFIX}{chat_id}')

    @classmethod
    def clear_chat_context(cls, chat_id: str):
        """清空指定对话的聊天上下文"""
        if not redis_utils.is_available:
            return
        redis_utils.delete(f'{cls.CONTEXT_PREFIX}{chat_id}')
