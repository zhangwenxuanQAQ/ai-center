"""
聊天事件发布器

供 API 层使用，封装事件的发布操作：
    - 发布聊天请求事件到请求队列
    - 发布停止事件到请求队列
    - 查询流式状态（供前端断点重连检测）
"""

import logging
from typing import Optional, Any, List, Dict

from app.core.chat.event.event_bus import EventBus
from app.core.chat.event.event import ChatRequestEvent, ChatStopEvent, IntegrationChatRequestEvent
from app.database.redis_utils import redis_utils

logger = logging.getLogger(__name__)


class ChatEventPublisher:
    """
    聊天事件发布器

    API 层通过此类将前端请求封装为事件并发布到事件总线。
    """

    @staticmethod
    async def publish_chat_request(
        chat_id: str,
        user_id: str,
        query: List[Dict[str, Any]],
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        config: Optional[Any] = None,
        message_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        assistant_message_id: Optional[str] = None,
    ) -> bool:
        """
        发布聊天请求事件

        Args:
            chat_id: 对话ID
            user_id: 用户ID
            query: 查询数组（已序列化为字典列表）
            model_id: 模型ID
            chatbot_id: 机器人ID
            config: 配置
            message_id: 消息ID
            system_prompt: 系统提示词
            assistant_message_id: 助手消息ID

        Returns:
            bool: 是否发布成功
        """
        # 清理旧的结果队列数据
        EventBus.cleanup(chat_id)

        # 清除上一次的停止标记（新请求开始前清除，避免被消费者覆盖用户刚设置的停止）
        from app.core.chat.chat_service import ChatStopManager
        ChatStopManager().clear_stop(chat_id)

        # 设置流式状态为 streaming
        EventBus.set_streaming_status(chat_id, 'streaming')

        event = ChatRequestEvent.create(
            chat_id=chat_id,
            user_id=user_id,
            query=query,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config,
            message_id=message_id,
            system_prompt=system_prompt,
            assistant_message_id=assistant_message_id,
        )

        success = await EventBus.publish(event)
        if success:
            logger.info(f"聊天请求事件已发布: chat_id={chat_id}")
        else:
            logger.error(f"聊天请求事件发布失败: chat_id={chat_id}")
            EventBus.set_streaming_status(chat_id, 'error')
        return success

    @staticmethod
    async def publish_integration_chat_request(
        chat_id: str,
        query: List[Dict[str, Any]],
        integration_id: Any,
        integration_api_key: str,
        temporary: bool = False,
        config: Optional[Any] = None,
        edit_message_id: Optional[str] = None,
        preview_token: Optional[str] = None,
    ) -> bool:
        """
        发布插件集成聊天请求事件

        Args:
            chat_id: 对话ID
            query: 查询数组（已序列化为字典列表）
            integration_id: 集成配置ID
            integration_api_key: 集成配置API Key（用于消费者重新加载 integration 对象）
            temporary: 是否临时会话
            config: 配置
            edit_message_id: 编辑消息ID
            preview_token: 预览token

        Returns:
            bool: 是否发布成功
        """
        # 清理旧的结果队列数据
        EventBus.cleanup(chat_id)

        # 清除上一次的停止标记
        from app.core.chat.chat_service import ChatStopManager
        ChatStopManager().clear_stop(chat_id)

        # 设置流式状态为 streaming
        EventBus.set_streaming_status(chat_id, 'streaming')

        event = IntegrationChatRequestEvent.create(
            chat_id=chat_id,
            query=query,
            integration_id=integration_id,
            integration_api_key=integration_api_key,
            temporary=temporary,
            config=config,
            edit_message_id=edit_message_id,
            preview_token=preview_token,
        )

        success = await EventBus.publish(event)
        if success:
            logger.info(f"插件聊天请求事件已发布: chat_id={chat_id}")
        else:
            logger.error(f"插件聊天请求事件发布失败: chat_id={chat_id}")
            EventBus.set_streaming_status(chat_id, 'error')
        return success

    @staticmethod
    async def publish_chat_stop(chat_id: str) -> bool:
        """
        发布停止聊天事件

        Args:
            chat_id: 对话ID

        Returns:
            bool: 是否发布成功
        """
        event = ChatStopEvent.create(chat_id)
        success = await EventBus.publish(event)
        if success:
            logger.info(f"停止事件已发布: chat_id={chat_id}")
        return success

    @staticmethod
    def get_streaming_status(chat_id: str) -> dict:
        """
        查询流式状态（供前端检测断点重连）

        Args:
            chat_id: 对话ID

        Returns:
            dict: 包含 is_streaming, status, chunks_count
        """
        status = EventBus.get_streaming_status(chat_id)
        chunks_count = EventBus.get_result_queue_length(chat_id)
        return {
            'is_streaming': status == 'streaming',
            'status': status,
            'chunks_count': chunks_count,
        }
