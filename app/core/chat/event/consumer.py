"""
聊天事件消费者

后台运行的事件消费者，从请求队列中拉取聊天请求事件和停止事件，
执行聊天逻辑，并将流式输出作为事件发布到结果队列。

生命周期：
    1. 应用启动时调用 ChatEventConsumer.start() 启动后台消费循环
    2. 持续从请求队列拉取事件
    3. 收到 ChatRequestEvent → 执行聊天，流式 chunk 发布为 ChatStreamEvent
    4. 收到 ChatStopEvent → 设置停止标记
    5. 聊天结束 → 发布 ChatDoneEvent
    6. 应用关闭时调用 ChatEventConsumer.stop() 停止消费循环
"""

import asyncio
import logging
from typing import Optional

from app.core.chat.event.event_bus import EventBus
from app.core.chat.event.event import BaseEvent, ChatRequestEvent, ChatStopEvent, ChatStreamEvent, ChatDoneEvent, IntegrationChatRequestEvent

logger = logging.getLogger(__name__)


class ChatEventConsumer:
    """
    聊天事件消费者

    在后台 asyncio 任务中运行，持续消费请求队列事件。
    每个聊天请求在独立的 asyncio Task 中执行，互不阻塞。
    """

    _consumer_task: Optional[asyncio.Task] = None
    _running: bool = False
    # 正在运行的聊天任务，key=chat_id
    _active_chat_tasks: dict = {}

    @classmethod
    def start(cls):
        """
        启动事件消费循环

        在应用启动时调用，创建后台 asyncio Task 持续消费请求队列。
        """
        if cls._running:
            logger.warning("事件消费者已在运行")
            return

        cls._running = True
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        cls._consumer_task = loop.create_task(cls._consume_loop())
        logger.info("聊天事件消费者已启动")

    @classmethod
    async def stop(cls):
        """
        停止事件消费循环

        在应用关闭时调用，取消所有正在运行的任务。
        """
        cls._running = False
        if cls._consumer_task and not cls._consumer_task.done():
            cls._consumer_task.cancel()
            try:
                await cls._consumer_task
            except asyncio.CancelledError:
                pass

        # 取消所有活跃的聊天任务
        for chat_id, task in list(cls._active_chat_tasks.items()):
            if not task.done():
                task.cancel()
        cls._active_chat_tasks.clear()
        logger.info("聊天事件消费者已停止")

    @classmethod
    async def _consume_loop(cls):
        """
        事件消费主循环

        持续从请求队列拉取事件，根据事件类型分发处理。
        """
        logger.info("事件消费循环开始")
        while cls._running:
            try:
                event = await EventBus.consume_request(block_ms=1000)
                if event is None:
                    continue

                if event.event_type == 'chat_request':
                    await cls._handle_chat_request(event)
                elif event.event_type == 'integration_chat_request':
                    await cls._handle_integration_chat_request(event)
                elif event.event_type == 'chat_stop':
                    await cls._handle_chat_stop(event)
                else:
                    logger.warning(f"未知事件类型: {event.event_type}")

            except asyncio.CancelledError:
                logger.info("事件消费循环被取消")
                break
            except Exception as e:
                logger.error(f"事件消费循环异常: {e}", exc_info=True)
                await asyncio.sleep(1)

        logger.info("事件消费循环结束")

    @classmethod
    async def _handle_chat_request(cls, event: ChatRequestEvent):
        """
        处理聊天请求事件

        为每个聊天请求创建独立的 asyncio Task 执行聊天逻辑，
        不阻塞消费循环继续处理其他事件。

        Args:
            event: 聊天请求事件
        """
        chat_id = event.chat_id

        # 如果该对话已有正在运行的任务，先取消
        existing_task = cls._active_chat_tasks.get(chat_id)
        if existing_task and not existing_task.done():
            existing_task.cancel()
            try:
                await existing_task
            except asyncio.CancelledError:
                pass

        # 创建新的聊天任务
        task = asyncio.create_task(cls._execute_chat(event))
        cls._active_chat_tasks[chat_id] = task

    @classmethod
    async def _handle_chat_stop(cls, event: ChatStopEvent):
        """
        处理停止聊天事件

        设置 ChatStopManager 停止标记，正在运行的聊天循环会检测到并退出。

        Args:
            event: 停止事件
        """
        chat_id = event.chat_id
        from app.core.chat.chat_service import ChatStopManager
        ChatStopManager().request_stop(chat_id)
        logger.info(f"已设置停止标记: chat_id={chat_id}")

    @classmethod
    async def _handle_integration_chat_request(cls, event: IntegrationChatRequestEvent):
        """
        处理插件集成聊天请求事件

        为每个聊天请求创建独立的 asyncio Task 执行聊天逻辑，
        不阻塞消费循环继续处理其他事件。

        Args:
            event: 插件集成聊天请求事件
        """
        chat_id = event.chat_id

        # 如果该对话已有正在运行的任务，先取消
        existing_task = cls._active_chat_tasks.get(chat_id)
        if existing_task and not existing_task.done():
            existing_task.cancel()
            try:
                await existing_task
            except asyncio.CancelledError:
                pass

        # 创建新的聊天任务
        task = asyncio.create_task(cls._execute_integration_chat(event))
        cls._active_chat_tasks[chat_id] = task

    @classmethod
    async def _execute_integration_chat(cls, event: IntegrationChatRequestEvent):
        """
        执行插件集成聊天逻辑

        调用 IntegrationChatCoreService.chat_stream 执行聊天，将每个流式 chunk
        发布为 ChatStreamEvent 到结果队列，结束后发布 ChatDoneEvent。

        Args:
            event: 插件集成聊天请求事件
        """
        chat_id = event.chat_id
        data = event.data

        try:
            from app.core.chat.chat_service import ChatStopManager
            from app.services.chat.dto import QueryItem
            from app.core.integration.api_chat import IntegrationChatCoreService
            from app.services.integration.service import ChatbotIntegrationService

            # 通过 api_key 重新加载 integration 对象
            api_key = data.get('integration_api_key', '')
            integration = ChatbotIntegrationService.get_by_api_key(api_key)
            if not integration:
                EventBus.set_streaming_status(chat_id, 'error')
                done_event = ChatDoneEvent.create(chat_id, status='error', error='API密钥无效')
                await EventBus.publish(done_event)
                return

            # 将 query 字典列表还原为 QueryItem 对象
            query_items = [QueryItem(**q) for q in data.get('query', [])]

            # 调用 chat_stream 并将每个 chunk 发布为事件
            async for chunk in IntegrationChatCoreService.chat_stream(
                query=query_items,
                chat_id=chat_id,
                integration=integration,
                stream=True,
                temporary=data.get('temporary', False),
                config=data.get('config'),
                edit_message_id=data.get('edit_message_id'),
                preview_token=data.get('preview_token'),
            ):
                # 检查停止状态
                if ChatStopManager().is_stop_requested(chat_id):
                    stop_event = ChatStreamEvent.create(chat_id, {
                        'text': '',
                        'chat_id': chat_id,
                        'status': 'stop',
                    })
                    await EventBus.publish(stop_event)
                    break

                # 发布流式事件
                stream_event = ChatStreamEvent.create(chat_id, chunk)
                await EventBus.publish(stream_event)

            # 发布完成事件
            if ChatStopManager().is_stop_requested(chat_id):
                EventBus.set_streaming_status(chat_id, 'stop')
                done_event = ChatDoneEvent.create(chat_id, status='stop')
            else:
                EventBus.set_streaming_status(chat_id, 'done')
                done_event = ChatDoneEvent.create(chat_id, status='done')

            await EventBus.publish(done_event)

        except asyncio.CancelledError:
            logger.info(f"插件聊天任务被取消: chat_id={chat_id}")
            EventBus.set_streaming_status(chat_id, 'stop')
            done_event = ChatDoneEvent.create(chat_id, status='stop')
            await EventBus.publish(done_event)
            raise

        except Exception as e:
            logger.error(f"插件聊天任务异常: chat_id={chat_id}, error={e}", exc_info=True)
            EventBus.set_streaming_status(chat_id, 'error')
            done_event = ChatDoneEvent.create(chat_id, status='error', error=str(e))
            await EventBus.publish(done_event)

        finally:
            cls._active_chat_tasks.pop(chat_id, None)

    @classmethod
    async def _execute_chat(cls, event: ChatRequestEvent):
        """
        执行聊天逻辑

        调用 ChatCoreService.chat_stream 执行聊天，将每个流式 chunk
        发布为 ChatStreamEvent 到结果队列，结束后发布 ChatDoneEvent。

        Args:
            event: 聊天请求事件
        """
        chat_id = event.chat_id
        data = event.data

        try:
            from app.core.chat.chat_service import ChatCoreService, ChatStopManager
            from app.services.chat.dto import QueryItem

            # 将 query 字典列表还原为 QueryItem 对象
            query_items = [QueryItem(**q) for q in data.get('query', [])]

            # 调用 chat_stream 并将每个 chunk 发布为事件
            async for chunk in ChatCoreService.chat_stream(
                user_id=data.get('user_id', ''),
                query=query_items,
                model_id=data.get('model_id'),
                chatbot_id=data.get('chatbot_id'),
                chat_id=chat_id,
                config=data.get('config'),
                message_id=data.get('message_id'),
                system_prompt=data.get('system_prompt'),
                assistant_message_id=data.get('assistant_message_id'),
            ):
                # 检查停止状态
                if ChatStopManager().is_stop_requested(chat_id):
                    # 发布停止状态事件
                    stop_event = ChatStreamEvent.create(chat_id, {
                        'text': '',
                        'chat_id': chat_id,
                        'status': 'stop',
                    })
                    await EventBus.publish(stop_event)
                    break

                # 发布流式事件
                stream_event = ChatStreamEvent.create(chat_id, chunk)
                await EventBus.publish(stream_event)

            # 发布完成事件
            if ChatStopManager().is_stop_requested(chat_id):
                EventBus.set_streaming_status(chat_id, 'stop')
                done_event = ChatDoneEvent.create(chat_id, status='stop')
            else:
                EventBus.set_streaming_status(chat_id, 'done')
                done_event = ChatDoneEvent.create(chat_id, status='done')

            await EventBus.publish(done_event)

        except asyncio.CancelledError:
            logger.info(f"聊天任务被取消: chat_id={chat_id}")
            EventBus.set_streaming_status(chat_id, 'stop')
            done_event = ChatDoneEvent.create(chat_id, status='stop')
            await EventBus.publish(done_event)
            raise

        except Exception as e:
            logger.error(f"聊天任务异常: chat_id={chat_id}, error={e}", exc_info=True)
            EventBus.set_streaming_status(chat_id, 'error')
            done_event = ChatDoneEvent.create(chat_id, status='error', error=str(e))
            await EventBus.publish(done_event)

        finally:
            cls._active_chat_tasks.pop(chat_id, None)
