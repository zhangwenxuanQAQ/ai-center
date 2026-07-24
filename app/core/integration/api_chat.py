"""
插件集成聊天核心服务

处理通过API密钥调用的聊天逻辑。

独立实现聊天流程，不依赖 Chat 和 ChatMessage 表，
所有聊天数据持久化到 ChatbotChat 和 ChatbotChatMessage 表。
"""

import json
import uuid
import time
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, AsyncGenerator, Union, Tuple

from app.database.models import (
    ChatbotIntegration, ChatbotChat, ChatbotChatMessage, Chatbot, ChatbotModel
)
from app.services.chat.dto import QueryItem
from app.core.chat.chat_service import ChatCoreService, ChatStopManager
from app.core.chat.dto import (
    ChatStreamResponse, ToolCallInfo, MessageStatus, MessageStep
)
from app.core.llm_model.factory import LLMFactory
from app.core.llm_model.utils.tool_util import process_tool_calls
from app.core.exceptions import ResourceNotFoundError
from app.core.integration.temp_chat_store import TempChatStore

logger = logging.getLogger(__name__)


class IntegrationChatCoreService:
    """
    插件集成聊天核心服务

    独立实现聊天流程，所有聊天数据持久化到 ChatbotChat 和 ChatbotChatMessage 表，
    不再调用 ChatCoreService.chat_stream，避免对 Chat 和 ChatMessage 表的写入。
    复用 ChatCoreService 中不涉及 chat/chat_message 表的纯静态方法（如 get_chatbot_config、
    build_messages、convert_query_to_message 等）。
    """

    # ==================== 数据持久化辅助方法 ====================

    @staticmethod
    def _build_extra_content_str(
        extra_content: Optional[Any],
        step: Optional[str] = None,
        step_id: Optional[str] = None,
        step_status: Optional[str] = 'running'
    ) -> Optional[str]:
        """
        构建 extra_content JSON 字符串

        Args:
            extra_content: 原始 extra_content（dict/list/str/None）
            step: 步骤名称
            step_id: 步骤ID
            step_status: 步骤状态

        Returns:
            Optional[str]: JSON 字符串，无内容时返回 None
        """
        extra_content_dict = {}
        if extra_content is not None:
            if isinstance(extra_content, dict):
                extra_content_dict = extra_content
            elif isinstance(extra_content, list):
                extra_content_dict = {}
            else:
                try:
                    extra_content_dict = json.loads(extra_content)
                    if not isinstance(extra_content_dict, dict):
                        extra_content_dict = {}
                except (json.JSONDecodeError, TypeError):
                    extra_content_dict = {}

        if step is not None:
            extra_content_dict['step'] = step
        if step_id is not None:
            extra_content_dict['step_id'] = step_id
        if step_status is not None:
            extra_content_dict['step_status'] = step_status

        return json.dumps(extra_content_dict, ensure_ascii=False) if extra_content_dict else None

    @staticmethod
    def _get_or_create_bot_chat(
        integration: ChatbotIntegration,
        chatbot_id: str,
        chat_id: Optional[str],
        title: Optional[str] = None
    ) -> ChatbotChat:
        """
        获取或创建 ChatbotChat 记录

        Args:
            integration: 集成配置对象
            chatbot_id: 机器人ID
            chat_id: 对话ID（可选）
            title: 对话标题（可选，用于创建新对话时设置标题）

        Returns:
            ChatbotChat: 聊天记录对象
        """
        bot_chat = None
        if chat_id:
            try:
                bot_chat = ChatbotChat.get(
                    (ChatbotChat.id == chat_id) &
                    (ChatbotChat.integration_id == integration.id) &
                    (ChatbotChat.chatbot_id == chatbot_id)
                )
            except ChatbotChat.DoesNotExist:
                bot_chat = None

        if not bot_chat:
            bot_chat = ChatbotChat(
                integration_id=integration.id,
                chatbot_id=chatbot_id,
                title=title or "新对话",
                messages="[]"
            )
            bot_chat.save(force_insert=True)

        return bot_chat

    @staticmethod
    def _save_user_message(
        chatbot_id: str,
        chat_id: str,
        message_id: str,
        content: str,
        model_id: Optional[str] = None,
        extra_content: Optional[Any] = None
    ) -> ChatbotChatMessage:
        """
        保存用户消息到 ChatbotChatMessage 表

        Args:
            chatbot_id: 机器人ID
            chat_id: 对话ID
            message_id: 消息ID
            content: 消息内容
            model_id: 模型ID
            extra_content: 额外内容

        Returns:
            ChatbotChatMessage: 创建的用户消息对象
        """
        extra_content_str = IntegrationChatCoreService._build_extra_content_str(extra_content)
        user_message = ChatbotChatMessage(
            chatbot_id=chatbot_id,
            chat_id=chat_id,
            message_id=message_id or uuid.uuid4().hex,
            role='user',
            content=content,
            extra_content=extra_content_str,
            model_id=model_id
        )
        user_message.save(force_insert=True)
        return user_message

    @staticmethod
    def _create_assistant_message(
        chatbot_id: str,
        chat_id: str,
        message_id: str,
        content: str = '',
        model_id: Optional[str] = None,
        reasoning_content: Optional[str] = None,
        reasoning_time: Optional[int] = None,
        step: Optional[str] = None,
        step_id: Optional[str] = None,
        extra_content: Optional[Any] = None
    ) -> ChatbotChatMessage:
        """
        创建助手消息到 ChatbotChatMessage 表

        Args:
            chatbot_id: 机器人ID
            chat_id: 对话ID
            message_id: 消息ID
            content: 消息内容
            model_id: 模型ID
            reasoning_content: 思考过程内容
            reasoning_time: 思考耗时（毫秒）
            step: 当前步骤名称
            step_id: 当前步骤ID
            extra_content: 额外内容

        Returns:
            ChatbotChatMessage: 创建的助手消息对象
        """
        # 保证创建时间晚于用户消息
        time.sleep(0.001)
        extra_content_str = IntegrationChatCoreService._build_extra_content_str(
            extra_content, step, step_id, 'running'
        )
        assistant_message = ChatbotChatMessage(
            chatbot_id=chatbot_id,
            chat_id=chat_id,
            message_id=message_id or uuid.uuid4().hex,
            role='assistant',
            content=content,
            extra_content=extra_content_str,
            reasoning_content=reasoning_content,
            reasoning_time=reasoning_time,
            model_id=model_id
        )
        assistant_message.save(force_insert=True)
        return assistant_message

    @staticmethod
    def _upsert_assistant_message(
        chatbot_id: str,
        chat_id: str,
        message_id: str,
        step_id: str,
        content: Optional[str] = None,
        model_id: Optional[str] = None,
        reasoning_content: Optional[str] = None,
        reasoning_time: Optional[int] = None,
        step: Optional[str] = None,
        extra_content: Optional[Any] = None
    ) -> ChatbotChatMessage:
        """
        新增或更新助手消息

        根据 step_id 在 extra_content 中查找现有消息：
        - 找到则更新对应字段
        - 未找到则创建新消息

        Args:
            chatbot_id: 机器人ID
            chat_id: 对话ID
            message_id: 消息ID
            step_id: 步骤ID，用于匹配消息
            content: 消息内容
            model_id: 模型ID
            reasoning_content: 思考过程内容
            reasoning_time: 思考耗时
            step: 当前步骤名称
            extra_content: 额外内容

        Returns:
            ChatbotChatMessage: 更新或创建的消息对象
        """
        extra_content_str = IntegrationChatCoreService._build_extra_content_str(
            extra_content, step, step_id, 'done'
        )

        # 查找已存在的消息
        found_message = None
        try:
            query = ChatbotChatMessage.select().where(
                (ChatbotChatMessage.chat_id == chat_id) &
                (ChatbotChatMessage.role == 'assistant') &
                (ChatbotChatMessage.message_id == message_id)
            )
            for msg in query:
                if msg.extra_content:
                    try:
                        data = json.loads(msg.extra_content)
                        if isinstance(data, dict) and data.get('step_id') == step_id:
                            found_message = msg
                            break
                    except (json.JSONDecodeError, TypeError):
                        pass
        except Exception:
            pass

        # 兜底：使用 contains 查询
        if not found_message:
            try:
                found_message = ChatbotChatMessage.get(
                    (ChatbotChatMessage.chat_id == chat_id) &
                    (ChatbotChatMessage.role == 'assistant') &
                    (ChatbotChatMessage.message_id == message_id) &
                    (ChatbotChatMessage.extra_content.contains(f'"step_id":"{step_id}"'))
                )
            except ChatbotChatMessage.DoesNotExist:
                found_message = None

        if found_message:
            # 更新字段：传入不为空则覆盖
            if content is not None:
                found_message.content = content
            if reasoning_content is not None:
                found_message.reasoning_content = reasoning_content
            if reasoning_time is not None:
                found_message.reasoning_time = reasoning_time
            if extra_content_str is not None:
                found_message.extra_content = extra_content_str
            if model_id is not None:
                found_message.model_id = model_id
            found_message.save()
            return found_message

        # 未找到，创建新消息
        assistant_message = ChatbotChatMessage(
            chatbot_id=chatbot_id,
            chat_id=chat_id,
            message_id=message_id or uuid.uuid4().hex,
            role='assistant',
            content=content or '',
            extra_content=extra_content_str,
            reasoning_content=reasoning_content,
            reasoning_time=reasoning_time,
            model_id=model_id
        )
        assistant_message.save(force_insert=True)
        return assistant_message

    @staticmethod
    def _create_tool_message(
        chatbot_id: str,
        chat_id: str,
        message_id: str,
        content: str = '',
        model_id: Optional[str] = None,
        reasoning_content: Optional[str] = None,
        reasoning_time: Optional[int] = None,
        step: Optional[str] = None,
        step_id: Optional[str] = None,
        extra_content: Optional[Any] = None
    ) -> ChatbotChatMessage:
        """
        创建工具消息到 ChatbotChatMessage 表

        Args:
            chatbot_id: 机器人ID
            chat_id: 对话ID
            message_id: 消息ID
            content: 消息内容
            model_id: 模型ID
            reasoning_content: 思考过程内容
            reasoning_time: 思考耗时
            step: 当前步骤名称
            step_id: 当前步骤ID
            extra_content: 额外内容

        Returns:
            ChatbotChatMessage: 创建的工具消息对象
        """
        # 保证创建时间晚于助手消息
        time.sleep(0.001)
        extra_content_str = IntegrationChatCoreService._build_extra_content_str(
            extra_content, step, step_id, 'running'
        )
        tool_message = ChatbotChatMessage(
            chatbot_id=chatbot_id,
            chat_id=chat_id,
            message_id=message_id or uuid.uuid4().hex,
            role='tool',
            content=content,
            extra_content=extra_content_str,
            reasoning_content=reasoning_content,
            reasoning_time=reasoning_time,
            model_id=model_id
        )
        tool_message.save(force_insert=True)
        return tool_message

    @staticmethod
    def _upsert_tool_message(
        chatbot_id: str,
        chat_id: str,
        message_id: str,
        step_id: str,
        content: Optional[str] = None,
        model_id: Optional[str] = None,
        reasoning_content: Optional[str] = None,
        reasoning_time: Optional[int] = None,
        step: Optional[str] = None,
        extra_content: Optional[Any] = None
    ) -> ChatbotChatMessage:
        """
        新增或更新工具消息

        根据 step_id 在 extra_content 中查找现有消息：
        - 找到则更新对应字段
        - 未找到则创建新消息

        Args:
            chatbot_id: 机器人ID
            chat_id: 对话ID
            message_id: 消息ID
            step_id: 步骤ID，用于匹配消息
            content: 消息内容
            model_id: 模型ID
            reasoning_content: 思考过程内容
            reasoning_time: 思考耗时
            step: 当前步骤名称
            extra_content: 额外内容

        Returns:
            ChatbotChatMessage: 更新或创建的消息对象
        """
        extra_content_str = IntegrationChatCoreService._build_extra_content_str(
            extra_content, step, step_id, 'running'
        )

        # 查找已存在的消息
        found_message = None
        try:
            query = ChatbotChatMessage.select().where(
                (ChatbotChatMessage.chat_id == chat_id) &
                (ChatbotChatMessage.role == 'tool') &
                (ChatbotChatMessage.message_id == message_id)
            )
            for msg in query:
                if msg.extra_content:
                    try:
                        data = json.loads(msg.extra_content)
                        if isinstance(data, dict) and data.get('step_id') == step_id:
                            found_message = msg
                            break
                    except (json.JSONDecodeError, TypeError):
                        pass
        except Exception:
            pass

        # 兜底：使用 contains 查询
        if not found_message:
            try:
                found_message = ChatbotChatMessage.get(
                    (ChatbotChatMessage.chat_id == chat_id) &
                    (ChatbotChatMessage.role == 'tool') &
                    (ChatbotChatMessage.message_id == message_id) &
                    (ChatbotChatMessage.extra_content.contains(f'"step_id":"{step_id}"'))
                )
            except ChatbotChatMessage.DoesNotExist:
                found_message = None

        if found_message:
            if content is not None:
                found_message.content = content
            if reasoning_content is not None:
                found_message.reasoning_content = reasoning_content
            if reasoning_time is not None:
                found_message.reasoning_time = reasoning_time
            if extra_content_str is not None:
                found_message.extra_content = extra_content_str
            if model_id is not None:
                found_message.model_id = model_id
            found_message.save()
            return found_message

        # 未找到，创建新消息
        tool_message = ChatbotChatMessage(
            chatbot_id=chatbot_id,
            chat_id=chat_id,
            message_id=message_id or uuid.uuid4().hex,
            role='tool',
            content=content or '',
            extra_content=extra_content_str,
            reasoning_content=reasoning_content,
            reasoning_time=reasoning_time,
            model_id=model_id
        )
        tool_message.save(force_insert=True)
        return tool_message

    @staticmethod
    def _stop_chat_messages(chat_id: str) -> int:
        """
        停止对话中正在运行的消息

        将所有正在运行（running/start）的消息更新为 stop 状态，
        保留思考内容和正文内容，在 content 末尾拼接 "已停止"

        Args:
            chat_id: 对话ID

        Returns:
            int: 更新的消息数量
        """
        messages = ChatbotChatMessage.select().where(
            (ChatbotChatMessage.chat_id == chat_id) &
            (ChatbotChatMessage.role << ['assistant', 'tool'])
        ).order_by(ChatbotChatMessage.created_at.desc())

        updated_count = 0
        for msg in messages:
            extra_data = {}
            if msg.extra_content:
                try:
                    extra_data = json.loads(msg.extra_content)
                except (json.JSONDecodeError, TypeError):
                    pass

            step_status = extra_data.get('step_status', '')
            if step_status in ('running', 'start') or (not step_status and msg.content):
                extra_data['step_status'] = 'stop'
                msg.extra_content = json.dumps(extra_data, ensure_ascii=False)

                if msg.content:
                    if not msg.content.endswith('\n'):
                        msg.content += '\n'
                    msg.content += '已停止'
                else:
                    msg.content = '已停止'

                msg.save()
                updated_count += 1

        return updated_count

    @staticmethod
    def _delete_messages_after(chat_id: str, message_id: str) -> int:
        """
        删除指定消息及其后续所有消息

        用于编辑用户消息时清理历史记录。

        Args:
            chat_id: 对话ID
            message_id: 起始消息ID（该消息也会被删除）

        Returns:
            int: 删除的消息数量
        """
        try:
            # 找到指定消息
            target_message = ChatbotChatMessage.get(
                (ChatbotChatMessage.chat_id == chat_id) &
                (ChatbotChatMessage.message_id == message_id)
            )
            target_created_at = target_message.created_at

            # 删除该消息及其后续所有消息
            deleted_count = ChatbotChatMessage.delete().where(
                (ChatbotChatMessage.chat_id == chat_id) &
                (ChatbotChatMessage.created_at >= target_created_at)
            ).execute()

            logger.info(f"删除消息 {message_id} 及其后续消息，共 {deleted_count} 条")
            return deleted_count
        except ChatbotChatMessage.DoesNotExist:
            logger.warning(f"未找到消息 {message_id}")
            return 0
        except Exception as e:
            logger.error(f"删除消息失败: {e}")
            return 0

    @staticmethod
    def _load_history_messages(chat_id: str) -> List[Dict[str, Any]]:
        """
        从 ChatbotChatMessage 表加载历史消息，用于构建 LLM 上下文

        Args:
            chat_id: 对话ID

        Returns:
            List[Dict]: 历史消息列表（不包含 system 消息）
        """
        messages = ChatbotChatMessage.select().where(
            ChatbotChatMessage.chat_id == chat_id
        ).order_by(ChatbotChatMessage.created_at.asc())

        history = []
        for msg in messages:
            if msg.role == 'user':
                history.append({
                    'role': 'user',
                    'content': msg.content,
                    'message_id': msg.message_id
                })
            elif msg.role == 'assistant':
                history.append({
                    'role': 'assistant',
                    'content': msg.content,
                    'message_id': msg.message_id,
                    'reasoning_content': msg.reasoning_content
                })
            elif msg.role == 'tool':
                # 工具消息在 LLM 上下文中需要带 tool_call_id
                history.append({
                    'role': 'tool',
                    'tool_call_id': msg.message_id,
                    'content': msg.content
                })
        return history

    @staticmethod
    def _update_chat_messages_summary(bot_chat: ChatbotChat, chat_id: str) -> None:
        """
        更新 ChatbotChat 的 messages 摘要字段

        Args:
            bot_chat: ChatbotChat 对象
            chat_id: 对话ID
        """
        try:
            messages = list(ChatbotChatMessage.select().where(
                ChatbotChatMessage.chat_id == chat_id
            ).order_by(ChatbotChatMessage.created_at))

            messages_summary = []
            for msg in messages:
                messages_summary.append({
                    "role": msg.role,
                    "content": msg.content[:200] if len(msg.content) > 200 else msg.content,
                    "message_id": msg.message_id,
                    "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S") if msg.created_at else None
                })

            bot_chat.messages = json.dumps(messages_summary, ensure_ascii=False)
            bot_chat.save()
        except Exception as e:
            logger.error(f"更新ChatbotChat messages失败: {e}")

    @staticmethod
    def _get_chatbot_avatar(chatbot_id: str) -> Optional[str]:
        """
        获取机器人头像

        Args:
            chatbot_id: 机器人ID

        Returns:
            Optional[str]: 头像URL
        """
        try:
            chatbot = Chatbot.get(Chatbot.id == chatbot_id)
            return chatbot.avatar
        except Chatbot.DoesNotExist:
            return None

    @staticmethod
    def _prepare_chatbot_config(chatbot_id: str, config_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        准备机器人配置：获取模型、系统提示词、工具等

        Args:
            chatbot_id: 机器人ID
            config_dict: 当前配置字典（会被机器人模型关联表中的配置覆盖更新）

        Returns:
            Dict: 包含 model_id、system_prompt、user_prompt_messages、tools、tool_map、chatbot_config 的字典

        Raises:
            ResourceNotFoundError: 机器人不存在或未绑定模型
        """
        chatbot_config = ChatCoreService.get_chatbot_config(chatbot_id)
        model_id = chatbot_config['model_id']
        system_prompt = chatbot_config['system_prompt']
        user_prompt_messages = chatbot_config['user_prompt_messages']
        tools = chatbot_config['tools'] if chatbot_config['tools'] else None
        tool_map = chatbot_config['tool_map']

        # 获取机器人模型关联表中的模型配置，合并到 config_dict
        try:
            chatbot_model = ChatbotModel.get(
                (ChatbotModel.chatbot_id == chatbot_id) &
                (ChatbotModel.model_id == model_id) &
                (ChatbotModel.deleted == False)
            )
            if chatbot_model.config:
                try:
                    chatbot_model_config = json.loads(chatbot_model.config)
                    if isinstance(chatbot_model_config, dict):
                        config_dict.update(chatbot_model_config)
                except json.JSONDecodeError:
                    pass
        except ChatbotModel.DoesNotExist:
            pass

        return {
            'model_id': model_id,
            'system_prompt': system_prompt,
            'user_prompt_messages': user_prompt_messages,
            'tools': tools,
            'tool_map': tool_map,
            'chatbot_config': chatbot_config
        }

    # ==================== 核心聊天方法 ====================

    @staticmethod
    async def _execute_direct_answer(
        model,
        messages: List[Dict[str, Any]],
        chat_id: str,
        chatbot_id: str,
        user_message_id: str,
        assistant_message_id: str,
        model_id: Optional[str],
        config: Optional[Any],
        avatar: Optional[str],
        tool_map: Dict[str, str],
        planning_messages_history: List[Dict[str, Any]],
        start_time: float,
        reasoning_end_time: Optional[float],
        reasoning_content: str,
        full_response: str,
        temporary: bool = False,
        **model_params
    ) -> AsyncGenerator[Union[Dict[str, Any], Tuple[None, List[Dict[str, Any]], List[Dict[str, Any]]]], None]:
        """
        执行直接回答逻辑（不需要子任务）

        复用 ChatCoreService._execute_direct_answer 的核心流程，但消息持久化改为写入
        ChatbotChatMessage 表；temporary=True 时不进行任何持久化。

        Args:
            model: LLM 模型实例
            messages: 消息列表（会被本方法在工具调用循环中追加内容）
            chat_id: 聊天ID
            chatbot_id: 机器人ID
            user_message_id: 用户消息ID
            assistant_message_id: 助手消息ID
            model_id: 模型ID
            config: 配置（原样保留，用于兼容签名）
            avatar: 头像URL
            tool_map: 工具映射
            planning_messages_history: 任务规划历史消息
            start_time: 流程开始时间
            reasoning_end_time: 推理结束时间
            reasoning_content: 累计推理内容
            full_response: 累计完整响应
            temporary: 是否临时会话模式
            **model_params: 模型参数

        Yields:
            Dict: 流式响应数据；最后 yield 一个 (None, messages, planning_messages_history) 元组
        """
        while True:
            model_answer_step_id = f"step_{uuid.uuid4().hex[:8]}"

            round_start_time = time.time()
            round_reasoning_end_time = None

            # 步骤开始
            yield ChatStreamResponse.start_response(
                chat_id=chat_id,
                user_message_id=user_message_id,
                assistant_message_id=assistant_message_id,
                step=MessageStep.MODEL_ANSWER,
                step_id=model_answer_step_id,
                avatar=avatar
            ).to_dict()

            # 创建助手消息记录
            if not temporary:
                IntegrationChatCoreService._create_assistant_message(
                    chatbot_id=chatbot_id,
                    chat_id=chat_id,
                    message_id=assistant_message_id,
                    content='',
                    model_id=model_id,
                    step=MessageStep.MODEL_ANSWER,
                    step_id=model_answer_step_id
                )

            full_response_chunk = ''
            reasoning_content_chunk = ''
            tool_calls_list = []
            round_finished = False

            # 流式生成模型回复
            for chunk in model.stream_generate_with_messages(messages, **model_params):
                if ChatStopManager().is_stop_requested(chat_id):
                    yield ChatStreamResponse.text_response(
                        text='',
                        chat_id=chat_id,
                        user_message_id=user_message_id,
                        assistant_message_id=assistant_message_id,
                        status=MessageStatus.STOP,
                        step_id=model_answer_step_id,
                        step=MessageStep.MODEL_ANSWER,
                        avatar=avatar
                    ).to_dict()
                    return

                if 'error' in chunk:
                    if not temporary:
                        IntegrationChatCoreService._upsert_assistant_message(
                            chatbot_id=chatbot_id,
                            chat_id=chat_id,
                            message_id=assistant_message_id,
                            step_id=model_answer_step_id,
                            content=f"抱歉，发送消息时出现错误：{chunk['error']}",
                            model_id=model_id,
                            step=MessageStep.MODEL_ANSWER
                        )
                    yield ChatStreamResponse.error_response(
                        error=chunk['error'],
                        chat_id=chat_id,
                        user_message_id=user_message_id,
                        assistant_message_id=assistant_message_id,
                        step_id=model_answer_step_id,
                        step=MessageStep.MODEL_ANSWER,
                        text=f"抱歉，发送消息时出现错误：{chunk['error']}",
                        avatar=avatar
                    ).to_dict()
                    return

                # 累计文本与推理内容
                if chunk.get('text'):
                    if round_reasoning_end_time is None and reasoning_content_chunk:
                        round_reasoning_end_time = time.time()
                    full_response_chunk += chunk['text']
                    full_response += chunk['text']

                if chunk.get('reasoning_content'):
                    reasoning_content_chunk += chunk['reasoning_content']
                    reasoning_content += chunk['reasoning_content']

                if chunk.get('tool_calls'):
                    tool_calls_list = chunk.get('tool_calls')

                reasoning_end = False
                if chunk.get('usage') and reasoning_content_chunk and round_reasoning_end_time is not None:
                    reasoning_end = True

                chunk_status = MessageStatus.RUNNING
                if chunk.get('usage'):
                    chunk_status = MessageStatus.DONE
                    round_finished = True

                reasoning_time = int((time.time() - round_start_time) * 1000)

                yield ChatStreamResponse.text_response(
                    text=chunk.get('text', ''),
                    chat_id=chat_id,
                    user_message_id=user_message_id,
                    assistant_message_id=assistant_message_id,
                    reasoning_content=chunk.get('reasoning_content',''),
                    reasoning_end=reasoning_end,
                    finish_reason=chunk.get('finish_reason'),
                    usage=chunk.get('usage'),
                    status=chunk_status,
                    step_id=model_answer_step_id,
                    step=MessageStep.MODEL_ANSWER,
                    reasoning_time=reasoning_time,
                    avatar=avatar
                ).to_dict()

            # 本轮回复完成，更新助手消息
            if not temporary and (full_response_chunk or reasoning_content_chunk):
                reasoning_time = None
                if reasoning_content_chunk and round_reasoning_end_time:
                    reasoning_time = int((round_reasoning_end_time - round_start_time) * 1000)

                IntegrationChatCoreService._upsert_assistant_message(
                    chatbot_id=chatbot_id,
                    chat_id=chat_id,
                    message_id=assistant_message_id,
                    step_id=model_answer_step_id,
                    content=full_response_chunk,
                    model_id=model_id,
                    reasoning_content=reasoning_content_chunk if reasoning_content_chunk else None,
                    reasoning_time=reasoning_time,
                    step=MessageStep.MODEL_ANSWER
                )

            # 处理工具调用
            if tool_calls_list and tool_map:
                messages.append({
                    'role': 'assistant',
                    'content': full_response_chunk,
                    'tool_calls': tool_calls_list
                })

                async for tool_result in process_tool_calls(tool_calls_list, tool_map, chat_id):
                    if ChatStopManager().is_stop_requested(chat_id):
                        yield ChatStreamResponse.text_response(
                            text='',
                            chat_id=chat_id,
                            user_message_id=user_message_id,
                            assistant_message_id=assistant_message_id,
                            status=MessageStatus.STOP,
                            step_id=model_answer_step_id,
                            step=MessageStep.MODEL_ANSWER,
                            avatar=avatar
                        ).to_dict()
                        return

                    tool_call_id = tool_result.get('tool_call_id', '')
                    tool_name = tool_result.get('tool_name', '')
                    task_name = tool_result.get('task_name', '')
                    tool_status = tool_result.get('status', '')
                    elapsed_ms = tool_result.get('elapsed_ms', 0)
                    tool_reasoning_content = tool_result.get('reasoning_content', '')

                    tool_step_id = f"tool_{tool_call_id}"

                    if tool_status == 'start':
                        tool_call_info = ToolCallInfo(
                            tool_call_id=tool_call_id,
                            name=tool_name,
                            task_name=task_name,
                            status='start',
                            elapsed_ms=0,
                            reasoning_content=tool_reasoning_content
                        )
                        yield ChatStreamResponse.tool_call_response(
                            tool_call=tool_call_info,
                            chat_id=chat_id,
                            user_message_id=user_message_id,
                            assistant_message_id=assistant_message_id,
                            status=MessageStatus.START,
                            step_id=tool_step_id,
                            step=MessageStep.TOOL_CALL,
                            avatar=avatar
                        ).to_dict()

                        if not temporary:
                            IntegrationChatCoreService._create_tool_message(
                                chatbot_id=chatbot_id,
                                chat_id=chat_id,
                                message_id=assistant_message_id,
                                content='',
                                model_id=model_id,
                                step=MessageStep.TOOL_CALL,
                                step_id=tool_step_id,
                                reasoning_content=tool_reasoning_content,
                                extra_content=json.dumps({"tool_call": tool_call_info.to_dict()}, ensure_ascii=False)
                            )
                        continue

                    if tool_status == 'running':
                        tool_call_info = ToolCallInfo(
                            tool_call_id=tool_call_id,
                            name=tool_name,
                            task_name=task_name,
                            status='running',
                            elapsed_ms=elapsed_ms,
                            reasoning_content=tool_reasoning_content
                        )
                        yield ChatStreamResponse.tool_call_response(
                            tool_call=tool_call_info,
                            chat_id=chat_id,
                            user_message_id=user_message_id,
                            assistant_message_id=assistant_message_id,
                            status=MessageStatus.RUNNING,
                            step_id=tool_step_id,
                            step=MessageStep.TOOL_CALL,
                            avatar=avatar
                        ).to_dict()
                        continue

                    if 'error' in tool_result:
                        error_msg = tool_result['error']
                        tool_message_content = f"工具 {tool_name} 调用失败: {error_msg}"
                        tool_call_info = ToolCallInfo(
                            tool_call_id=tool_call_id,
                            name=tool_name,
                            task_name=task_name,
                            status='error',
                            message=tool_message_content,
                            elapsed_ms=elapsed_ms,
                            reasoning_content=tool_reasoning_content
                        )
                        yield ChatStreamResponse.tool_call_response(
                            tool_call=tool_call_info,
                            chat_id=chat_id,
                            user_message_id=user_message_id,
                            assistant_message_id=assistant_message_id,
                            status=MessageStatus.DONE,
                            step_id=tool_step_id,
                            step=MessageStep.TOOL_CALL,
                            avatar=avatar
                        ).to_dict()
                        messages.append({
                            'role': 'tool',
                            'tool_call_id': tool_call_id,
                            'content': tool_message_content
                        })

                        if not temporary:
                            IntegrationChatCoreService._upsert_tool_message(
                                chatbot_id=chatbot_id,
                                chat_id=chat_id,
                                message_id=assistant_message_id,
                                step_id=tool_step_id,
                                content=tool_message_content,
                                model_id=model_id,
                                step=MessageStep.TOOL_CALL,
                                reasoning_content=tool_reasoning_content,
                                extra_content=json.dumps({"tool_call": tool_call_info.to_dict()}, ensure_ascii=False)
                            )
                    else:
                        result_data = tool_result.get('result', '')
                        tool_message_content = result_data if isinstance(result_data, str) else json.dumps(result_data, ensure_ascii=False)
                        tool_call_info = ToolCallInfo(
                            tool_call_id=tool_call_id,
                            name=tool_name,
                            task_name=task_name,
                            status='success',
                            result=result_data,
                            elapsed_ms=elapsed_ms,
                            reasoning_content=tool_reasoning_content
                        )
                        yield ChatStreamResponse.tool_call_response(
                            tool_call=tool_call_info,
                            chat_id=chat_id,
                            user_message_id=user_message_id,
                            assistant_message_id=assistant_message_id,
                            status=MessageStatus.DONE,
                            step_id=tool_step_id,
                            step=MessageStep.TOOL_CALL,
                            avatar=avatar
                        ).to_dict()

                        if not temporary:
                            IntegrationChatCoreService._upsert_tool_message(
                                chatbot_id=chatbot_id,
                                chat_id=chat_id,
                                message_id=assistant_message_id,
                                step_id=tool_step_id,
                                content=tool_message_content,
                                model_id=model_id,
                                step=MessageStep.TOOL_CALL,
                                reasoning_content=tool_reasoning_content,
                                extra_content=json.dumps({"tool_call": tool_call_info.to_dict()}, ensure_ascii=False)
                            )
                        messages.append({
                            'role': 'tool',
                            'tool_call_id': tool_call_id,
                            'content': tool_message_content
                        })

                # 工具调用完成，继续下一轮让模型基于工具结果回答
                continue
            else:
                # 没有工具调用时，将模型回复添加到 messages 中并结束循环
                if full_response_chunk:
                    messages.append({
                        'role': 'assistant',
                        'content': full_response_chunk
                    })
                break

        yield (None, messages, planning_messages_history)

    @staticmethod
    async def chat_stream(
        query: List[QueryItem],
        chat_id: Optional[str],
        integration: ChatbotIntegration,
        stream: bool = True,
        temporary: bool = False,
        config: Optional[dict] = None,
        edit_message_id: Optional[str] = None,
        preview_token: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式聊天

        独立实现聊天流程，所有消息持久化到 ChatbotChat 和 ChatbotChatMessage 表，
        不再调用 ChatCoreService.chat_stream，避免对 Chat 和 ChatMessage 表的写入。

        Args:
            query: 查询数组
            chat_id: 对话ID（可选）
            integration: 集成配置对象
            stream: 是否流式输出
            temporary: 临时会话模式，不保存对话和消息到数据库
            config: 对话配置JSON，包含 deep_thinking 等配置项
            edit_message_id: 编辑消息ID，删除该消息及其后续消息

        Yields:
            Dict: 流式响应数据
        """
        chatbot_id = integration.chatbot_id
        user_text = ChatCoreService.extract_text_from_query(query)

        # 统一处理 config 参数为字典
        config_dict: Dict[str, Any] = {}
        if config:
            if isinstance(config, str):
                try:
                    config_dict = json.loads(config)
                except json.JSONDecodeError:
                    pass
            elif isinstance(config, dict):
                config_dict = config

        # 生成基础消息ID
        user_message_id = uuid.uuid4().hex
        assistant_message_id = uuid.uuid4().hex

        # 获取机器人配置（模型、系统提示词、工具等）
        try:
            chatbot_config_data = IntegrationChatCoreService._prepare_chatbot_config(chatbot_id, config_dict)
            model_id = chatbot_config_data['model_id']
            system_prompt = chatbot_config_data['system_prompt']
            user_prompt_messages = chatbot_config_data['user_prompt_messages']
            tools = chatbot_config_data['tools']
            tool_map = chatbot_config_data['tool_map']
        except ResourceNotFoundError as e:
            # 获取机器人配置失败，返回错误
            actual_chat_id = chat_id or f"temp_{uuid.uuid4().hex[:12]}"
            yield ChatStreamResponse.error_response(
                error=str(e),
                chat_id=actual_chat_id,
                user_message_id=user_message_id,
                assistant_message_id=assistant_message_id,
                text=f"抱歉，发送消息时出现错误：{str(e)}"
            ).to_dict()
            return

        if not model_id:
            actual_chat_id = chat_id or f"temp_{uuid.uuid4().hex[:12]}"
            yield ChatStreamResponse.error_response(
                error='未指定模型',
                chat_id=actual_chat_id,
                user_message_id=user_message_id,
                assistant_message_id=assistant_message_id,
                text="抱歉，发送消息时出现错误：未指定模型"
            ).to_dict()
            return

        # 获取头像
        avatar = IntegrationChatCoreService._get_chatbot_avatar(chatbot_id)

        # 获取模型配置并创建模型实例
        model_config, llm_config, model_type = ChatCoreService.get_model_config(model_id)
        user_message = ChatCoreService.convert_query_to_message(query, model_type, model_id)
        model = LLMFactory.create_model(model_type, model_config)

        # 合并模型参数
        model_params: Dict[str, Any] = {}
        if llm_config:
            model_params.update(llm_config)
        if config_dict:
            model_params.update(config_dict)
        if tools is not None:
            model_params['tools'] = tools

        # ============ 临时会话模式 ============
        # 不创建 ChatbotChat 记录，将聊天记录和消息保存到 Redis
        if temporary:
            temp_chat_id = chat_id or f"temp_{uuid.uuid4().hex[:12]}"
            integration_id = integration.id
            # 预览token隔离：不同preview_token使用不同的scope_id，数据互相隔离
            scope_id = f"{integration_id}:preview:{preview_token}" if preview_token else None

            # 如果是新对话，在 Redis 中创建临时聊天记录
            if not chat_id or not TempChatStore.get_chat(integration_id, temp_chat_id, scope_id=scope_id):
                TempChatStore.create_chat(
                    integration_id=integration_id,
                    chat_id=temp_chat_id,
                    chatbot_id=chatbot_id,
                    title=user_text[:30] if user_text else "临时对话",
                    scope_id=scope_id
                )

            # 处理编辑消息：删除该消息及其后续所有消息
            if edit_message_id:
                temp_messages = TempChatStore.get_messages(integration_id, temp_chat_id, scope_id=scope_id)
                for i, msg in enumerate(temp_messages):
                    if msg.get('id') == edit_message_id or msg.get('message_id') == edit_message_id:
                        TempChatStore.clear_messages_after(integration_id, temp_chat_id, i, scope_id=scope_id)
                        break

            # 保存用户消息到 Redis
            user_msg_data = {
                "id": user_message_id,
                "message_id": user_message_id,
                "chat_id": temp_chat_id,
                "chatbot_id": chatbot_id,
                "role": "user",
                "content": user_text,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            TempChatStore.add_message(integration_id, temp_chat_id, user_msg_data, scope_id=scope_id)

            # 加载历史消息
            temp_history = TempChatStore.get_messages(integration_id, temp_chat_id, scope_id=scope_id)
            history_messages = []
            for msg in temp_history[:-1]:
                history_messages.append({
                    "role": msg.get("role", ""),
                    "content": msg.get("content", "")
                })

            # 构建消息列表
            messages = ChatCoreService.build_messages(
                system_prompt, history_messages, user_message, user_prompt_messages
            )

            start_time = time.time()
            reasoning_end_time = None
            full_response = ''
            reasoning_content = ''
            planning_messages_history: List[Dict[str, Any]] = []

            try:
                ChatStopManager().clear_stop(temp_chat_id)

                async for result in IntegrationChatCoreService._execute_direct_answer(
                    model=model,
                    messages=messages,
                    chat_id=temp_chat_id,
                    chatbot_id=chatbot_id,
                    user_message_id=user_message_id,
                    assistant_message_id=assistant_message_id,
                    model_id=model_id,
                    config=config,
                    avatar=avatar,
                    tool_map=tool_map,
                    planning_messages_history=planning_messages_history,
                    start_time=start_time,
                    reasoning_end_time=reasoning_end_time,
                    reasoning_content=reasoning_content,
                    full_response=full_response,
                    temporary=True,
                    **model_params
                ):
                    if isinstance(result, dict):
                        if result.get('status') == MessageStatus.STOP:
                            ChatStopManager().clear_stop(temp_chat_id)
                            return
                        if result.get('text'):
                            full_response += result['text']
                        if result.get('reasoning_content'):
                            reasoning_content += result['reasoning_content']
                        if result.get('reasoning_end') and reasoning_end_time is None:
                            reasoning_end_time = time.time()
                        result['chat_id'] = temp_chat_id
                        yield result
                    elif isinstance(result, tuple) and len(result) == 3:
                        _, messages, planning_messages_history = result
            except GeneratorExit:
                ChatStopManager().request_stop(temp_chat_id)
            except Exception as e:
                logger.error(f"集成临时会话流式输出异常: {e}", exc_info=True)
                yield ChatStreamResponse.error_response(
                    error=str(e),
                    chat_id=temp_chat_id,
                    user_message_id=user_message_id,
                    assistant_message_id=assistant_message_id,
                    text=f"抱歉，发送消息时出现错误：{str(e)}"
                ).to_dict()

            # 保存助手最终消息到 Redis
            if full_response or reasoning_content:
                assistant_msg_data = {
                    "id": assistant_message_id,
                    "message_id": assistant_message_id,
                    "chat_id": temp_chat_id,
                    "chatbot_id": chatbot_id,
                    "role": "assistant",
                    "content": full_response,
                    "reasoning_content": reasoning_content,
                    "reasoning_time": int((reasoning_end_time - start_time) * 1000) if reasoning_end_time else None,
                    "model_id": model_id,
                    "extra_content": None,
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                TempChatStore.add_message(integration_id, temp_chat_id, assistant_msg_data, scope_id=scope_id)

            return

        # ============ 正式会话模式 ============
        # 获取或创建 ChatbotChat
        chat_title = user_text[:20] if len(user_text) > 20 else user_text
        bot_chat = IntegrationChatCoreService._get_or_create_bot_chat(integration, chatbot_id, chat_id, title=chat_title)
        actual_chat_id = bot_chat.id

        # 处理编辑消息：删除该消息及其后续所有消息
        if edit_message_id:
            IntegrationChatCoreService._delete_messages_after(actual_chat_id, edit_message_id)

        # 加载历史消息
        history_messages = IntegrationChatCoreService._load_history_messages(actual_chat_id)

        # 构建完整消息列表
        messages = ChatCoreService.build_messages(
            system_prompt, history_messages, user_message, user_prompt_messages
        )

        # 保存用户消息到 ChatbotChatMessage
        from app.services.chat.file_utils import build_extra_content
        extra_content = build_extra_content(query)
        IntegrationChatCoreService._save_user_message(
            chatbot_id=chatbot_id,
            chat_id=actual_chat_id,
            message_id=user_message_id,
            content=user_text,
            model_id=model_id,
            extra_content=extra_content
        )

        start_time = time.time()
        reasoning_end_time = None
        full_response = ''
        reasoning_content = ''
        is_stopped = False
        planning_messages_history = history_messages.copy()

        current_step: Optional[str] = None
        current_step_id: Optional[str] = None

        try:
            ChatStopManager().clear_stop(actual_chat_id)

            while True:
                # 检查停止信号
                if ChatStopManager().is_stop_requested(actual_chat_id):
                    yield ChatStreamResponse.text_response(
                        text='',
                        chat_id=actual_chat_id,
                        user_message_id=user_message_id,
                        assistant_message_id=assistant_message_id,
                        status=MessageStatus.STOP,
                        step_id=current_step_id or '',
                        step=current_step,
                        avatar=avatar
                    ).to_dict()
                    is_stopped = True

                    # 保存已生成的内容
                    if full_response or reasoning_content:
                        reasoning_time = None
                        if reasoning_content and reasoning_end_time:
                            reasoning_time = int((reasoning_end_time - start_time) * 1000)

                        if current_step_id:
                            IntegrationChatCoreService._upsert_assistant_message(
                                chatbot_id=chatbot_id,
                                chat_id=actual_chat_id,
                                message_id=assistant_message_id,
                                step_id=current_step_id,
                                content=full_response,
                                model_id=model_id,
                                reasoning_content=reasoning_content if reasoning_content else None,
                                reasoning_time=reasoning_time,
                                step=current_step
                            )

                    IntegrationChatCoreService._stop_chat_messages(actual_chat_id)
                    ChatStopManager().clear_stop(actual_chat_id)
                    break

                # 任务规划已注释，直接执行直接回答
                direct_answer_result = IntegrationChatCoreService._execute_direct_answer(
                    model=model,
                    messages=messages,
                    chat_id=actual_chat_id,
                    chatbot_id=chatbot_id,
                    user_message_id=user_message_id,
                    assistant_message_id=assistant_message_id,
                    model_id=model_id,
                    config=config,
                    avatar=avatar,
                    tool_map=tool_map,
                    planning_messages_history=planning_messages_history,
                    start_time=start_time,
                    reasoning_end_time=reasoning_end_time,
                    reasoning_content=reasoning_content,
                    full_response=full_response,
                    temporary=False,
                    **model_params
                )

                async for result in direct_answer_result:
                    if isinstance(result, dict):
                        if result.get('status') == MessageStatus.STOP:
                            is_stopped = True

                            # 保存已生成的内容
                            if full_response or reasoning_content:
                                reasoning_time = None
                                if reasoning_content and reasoning_end_time:
                                    reasoning_time = int((reasoning_end_time - start_time) * 1000)

                                if current_step_id:
                                    IntegrationChatCoreService._upsert_assistant_message(
                                        chatbot_id=chatbot_id,
                                        chat_id=actual_chat_id,
                                        message_id=assistant_message_id,
                                        step_id=current_step_id,
                                        content=full_response,
                                        model_id=model_id,
                                        reasoning_content=reasoning_content if reasoning_content else None,
                                        reasoning_time=reasoning_time,
                                        step=current_step
                                    )

                            IntegrationChatCoreService._stop_chat_messages(actual_chat_id)
                            ChatStopManager().clear_stop(actual_chat_id)
                            return

                        # 确保返回的 chat_id 是 ChatbotChat 的 id
                        result['chat_id'] = actual_chat_id
                        yield result
                    elif isinstance(result, tuple) and len(result) == 3:
                        # 最终返回值 (None, messages, planning_messages_history)
                        _, messages, planning_messages_history = result
                # 任务规划已注释，直接结束主循环
                break
        except GeneratorExit:
            is_stopped = True
            ChatStopManager().request_stop(actual_chat_id)
        except Exception as e:
            logger.error(f"集成聊天流式输出异常: {e}", exc_info=True)
            yield ChatStreamResponse.error_response(
                error=str(e),
                chat_id=actual_chat_id,
                user_message_id=user_message_id,
                assistant_message_id=assistant_message_id,
                text=f"抱歉，发送消息时出现错误：{str(e)}"
            ).to_dict()
        finally:
            # 更新 ChatbotChat 的 messages 摘要
            IntegrationChatCoreService._update_chat_messages_summary(bot_chat, actual_chat_id)

    @staticmethod
    async def chat(
        query: List[QueryItem],
        chat_id: Optional[str],
        integration: ChatbotIntegration,
        temporary: bool = False,
        config: Optional[dict] = None,
        edit_message_id: Optional[str] = None,
        preview_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        非流式聊天

        Args:
            query: 查询数组
            chat_id: 对话ID（可选）
            integration: 集成配置对象
            temporary: 临时会话模式
            config: 对话配置JSON，包含 deep_thinking 等配置项
            edit_message_id: 编辑消息ID，删除该消息及其后续消息

        Returns:
            Dict: 聊天结果
        """
        result: Dict[str, Any] = {}
        async for chunk in IntegrationChatCoreService.chat_stream(
            query=query,
            chat_id=chat_id,
            integration=integration,
            stream=False,
            temporary=temporary,
            config=config,
            edit_message_id=edit_message_id,
            preview_token=preview_token
        ):
            if chunk.get('status') == 'done':
                result = chunk
            elif chunk.get('error'):
                return {"error": chunk['error']}
            # 记录 chat_id
            if chunk.get('chat_id'):
                result['chat_id'] = chunk['chat_id']

        return result

    @staticmethod
    def get_chat_messages(chat_id: str, integration: ChatbotIntegration, preview_token: Optional[str] = None) -> Dict[str, Any]:
        """
        获取聊天记录

        Args:
            chat_id: 聊天ID
            integration: 集成配置对象
            preview_token: 预览token（可选），用于临时会话数据隔离

        Returns:
            Dict: 包含 items 和 total 的字典

        Raises:
            ResourceNotFoundError: 对话不存在
        """
        is_temporary = chat_id.startswith('temp_')

        if is_temporary:
            scope_id = f"{integration.id}:preview:{preview_token}" if preview_token else None
            messages = TempChatStore.get_messages(integration.id, chat_id, scope_id=scope_id)
            items = []
            for msg in messages:
                items.append({
                    "id": msg.get("id", ""),
                    "chatbot_id": msg.get("chatbot_id", ""),
                    "chat_id": msg.get("chat_id", chat_id),
                    "message_id": msg.get("message_id", ""),
                    "role": msg.get("role", ""),
                    "content": msg.get("content", ""),
                    "extra_content": msg.get("extra_content", None),
                    "reasoning_content": msg.get("reasoning_content", None),
                    "reasoning_time": msg.get("reasoning_time", None),
                    "model_id": msg.get("model_id", None),
                    "created_at": msg.get("created_at", None),
                    "updated_at": msg.get("updated_at", None),
                })
            return {
                "items": items,
                "total": len(items)
            }

        # 验证 chat 属于当前 integration
        try:
            bot_chat = ChatbotChat.get(
                (ChatbotChat.id == chat_id) &
                (ChatbotChat.integration_id == integration.id)
            )
        except ChatbotChat.DoesNotExist:
            raise ResourceNotFoundError("对话不存在")

        # 查询消息列表
        messages = ChatbotChatMessage.select().where(
            ChatbotChatMessage.chat_id == chat_id
        ).order_by(ChatbotChatMessage.created_at)

        items = []
        for msg in messages:
            items.append({
                "id": msg.id,
                "chatbot_id": msg.chatbot_id,
                "chat_id": msg.chat_id,
                "message_id": msg.message_id,
                "role": msg.role,
                "content": msg.content,
                "extra_content": msg.extra_content,
                "reasoning_content": msg.reasoning_content,
                "reasoning_time": msg.reasoning_time,
                "model_id": msg.model_id,
                "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S") if msg.created_at else None,
                "updated_at": msg.updated_at.strftime("%Y-%m-%d %H:%M:%S") if msg.updated_at else None
            })

        return {
            "items": items,
            "total": len(items)
        }
