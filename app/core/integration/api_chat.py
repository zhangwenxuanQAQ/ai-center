"""
插件集成聊天核心服务

处理通过API密钥调用的聊天逻辑。

独立实现聊天流程，不依赖 Chat 和 ChatMessage 表，
所有聊天数据持久化到 ChatbotChat 和 ChatbotChatMessage 表。

架构说明：
    聊天流程分为三大阶段：
        1. 聊天前预处理（IntegrationChatPreprocessor）：参数校验、初始化参数、提示词拼装等
        2. 聊天执行（IntegrationChatCoreService._run_conversation_loop）：模型流式调用与工具调用循环
        3. 聊天后置处理（IntegrationChatCoreService._postprocess）：消息持久化与收尾

    各阶段通过 IntegrationChatContext 共享状态，层级分明、易于扩展。
"""

import json
import uuid
import time
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional, AsyncGenerator, Union, Tuple

from app.database.models import (
    ChatbotIntegration, ChatbotChat, ChatbotChatMessage, Chatbot, ChatbotModel
)
from app.services.chat.dto import QueryItem
from app.core.chat.chat_service import ChatCoreService, ChatStopManager, ChatInputManager
from app.core.chat.dto import (
    ChatStreamResponse, ToolCallInfo, MessageStatus, MessageStep
)
from app.core.llm_model.factory import LLMFactory
from app.core.tools.tool_util import process_tool_calls
from app.core.exceptions import ResourceNotFoundError
from app.core.integration.temp_chat_store import TempChatStore

logger = logging.getLogger(__name__)


@dataclass
class IntegrationChatContext:
    """
    集成聊天上下文

    在聊天前预处理阶段构建，贯穿聊天执行与后置处理全流程，
    集中持有集成聊天所需的全部状态，避免在方法间传递大量零散参数。

    Attributes:
        chat_id: 对话ID
        chatbot_id: 机器人ID
        integration: 集成配置对象
        integration_id: 集成配置ID
        user_text: 用户输入文本
        user_message_id: 用户消息ID
        assistant_message_id: 助手消息ID
        model_id: 模型ID
        model: LLM模型实例
        model_type: 模型类型
        config: 原始配置（字符串或字典）
        config_dict: 解析后的配置字典
        system_prompt: 系统提示词
        user_prompt_messages: 用户提示词消息列表
        messages: 完整的消息列表（含系统提示词、历史消息、用户消息）
        history_messages: 历史消息列表
        tools: OpenAI tool格式工具列表
        tool_map: 工具名称到工具实例的映射
        model_params: 传给大模型的参数
        avatar: 头像URL
        temporary: 是否临时会话模式
        edit_message_id: 编辑消息ID
        preview_token: 预览token
        scope_id: 临时会话数据隔离scope
        bot_chat: ChatbotChat对象（正式会话模式）
        start_time: 聊天开始时间戳
        reasoning_end_time: 推理结束时间戳
        full_response: 累积的完整响应文本
        reasoning_content: 累积的推理内容
    """
    chat_id: str = ''
    chatbot_id: str = ''
    integration: Optional[ChatbotIntegration] = None
    integration_id: Optional[Any] = None
    query: List[QueryItem] = field(default_factory=list)
    user_text: str = ''
    user_message_id: str = ''
    assistant_message_id: str = ''
    model_id: Optional[str] = None
    model: Any = None
    model_type: Optional[str] = None
    config: Optional[Any] = None
    config_dict: Dict[str, Any] = field(default_factory=dict)
    system_prompt: Optional[str] = None
    user_prompt_messages: Optional[List[Dict]] = None
    messages: List[Dict[str, Any]] = field(default_factory=list)
    history_messages: List[Dict[str, Any]] = field(default_factory=list)
    tools: Optional[List[Dict]] = None
    tool_map: Optional[Dict[str, Any]] = None
    model_params: Dict[str, Any] = field(default_factory=dict)
    avatar: Optional[str] = None
    temporary: bool = False
    edit_message_id: Optional[str] = None
    preview_token: Optional[str] = None
    scope_id: Optional[str] = None
    bot_chat: Optional[ChatbotChat] = None
    start_time: float = 0.0
    reasoning_end_time: Optional[float] = None
    full_response: str = ''
    reasoning_content: str = ''


class IntegrationChatPreprocessor:
    """
    集成聊天前处理器

    负责聊天执行前的全部准备工作，按步骤组织：
        - 参数校验与初始化（解析config、获取机器人配置、校验模型）
        - 临时/正式会话处理（创建对话、处理编辑消息、加载历史消息）
        - 提示词与消息拼装（构建系统提示词、历史消息、用户消息）
        - 工具与模型参数准备（注入内置工具、组装model_params、创建模型实例）
        - 用户消息持久化与头像解析

    所有方法均为静态方法，返回值写入 IntegrationChatContext。
    若预处理过程中出现需要终止的错误，会抛出 PreprocessError。
    """

    @staticmethod
    def _parse_config(config: Optional[Any]) -> Dict[str, Any]:
        """将config统一解析为字典"""
        config_dict = {}
        if config:
            if isinstance(config, str):
                try:
                    config_dict = json.loads(config)
                except json.JSONDecodeError:
                    pass
            elif isinstance(config, dict):
                config_dict = config
        return config_dict

    @staticmethod
    def _resolve_avatar(chatbot_id: str) -> Optional[str]:
        """获取机器人头像"""
        try:
            chatbot = Chatbot.get(Chatbot.id == chatbot_id)
            return chatbot.avatar
        except Chatbot.DoesNotExist:
            return None

    @staticmethod
    def _load_chatbot_config(ctx: IntegrationChatContext) -> None:
        """
        加载机器人配置（模型、提示词、工具等）并合并模型关联表配置

        Raises:
            ResourceNotFoundError: 机器人不存在或未绑定模型
        """
        chatbot_config = ChatCoreService.get_chatbot_config(ctx.chatbot_id)
        ctx.model_id = chatbot_config['model_id']
        ctx.system_prompt = chatbot_config['system_prompt']
        ctx.user_prompt_messages = chatbot_config['user_prompt_messages']
        ctx.tools = chatbot_config['tools'] if chatbot_config['tools'] else None
        ctx.tool_map = chatbot_config['tool_map']

        # 获取机器人模型关联表中的模型配置，合并到 config_dict
        try:
            chatbot_model = ChatbotModel.get(
                (ChatbotModel.chatbot_id == ctx.chatbot_id) &
                (ChatbotModel.model_id == ctx.model_id) &
                (ChatbotModel.deleted == False)
            )
            if chatbot_model.config:
                try:
                    chatbot_model_config = json.loads(chatbot_model.config)
                    if isinstance(chatbot_model_config, dict):
                        ctx.config_dict.update(chatbot_model_config)
                except json.JSONDecodeError:
                    pass
        except ChatbotModel.DoesNotExist:
            pass

    @staticmethod
    def _inject_builtin_tools(ctx: IntegrationChatContext) -> None:
        """注入内置工具（网络搜索、PPT生成等）"""
        from app.core.tools import ToolConvert
        web_search_enabled = ctx.config_dict.get('web_search', False)
        # 如果配置文件中禁用了搜索引擎，强制关闭
        from app.configs.config import config as app_config
        if not app_config.get("web_search_engine.enabled", True):
            web_search_enabled = False
        ctx.tools, ctx.tool_map = ToolConvert.inject_builtin_tools(
            tools=ctx.tools,
            tool_map=ctx.tool_map,
            web_search_enabled=web_search_enabled
        )

    @staticmethod
    def _resolve_model(ctx: IntegrationChatContext) -> None:
        """
        校验并解析模型配置、创建模型实例

        Raises:
            PreprocessError: 未指定模型
        """
        if not ctx.model_id:
            raise PreprocessError('未指定模型', chat_id=ctx.chat_id)

        model_config, llm_config, model_type = ChatCoreService.get_model_config(ctx.model_id)
        ctx.model_type = model_type
        ctx.model = LLMFactory.create_model(model_type, model_config)
        ctx.model_params = dict(llm_config) if llm_config else {}

    @staticmethod
    def _build_model_params(ctx: IntegrationChatContext) -> None:
        """组装传给大模型的参数（合并配置、剔除前端专用参数、挂载工具）"""
        if ctx.config_dict:
            ctx.model_params.update(ctx.config_dict)
            # 移除前端专用参数，不传给大模型
            ctx.model_params.pop('web_search', None)
            ctx.model_params.pop('deep_thinking', None)
        if ctx.tools:
            ctx.model_params['tools'] = ctx.tools

    @staticmethod
    def _setup_temporary_session(ctx: IntegrationChatContext) -> None:
        """设置临时会话：创建/加载临时聊天记录、处理编辑消息、保存用户消息、加载历史消息"""
        temp_chat_id = ctx.chat_id or f"temp_{uuid.uuid4().hex[:12]}"
        ctx.chat_id = temp_chat_id
        ctx.scope_id = f"{ctx.integration_id}:preview:{ctx.preview_token}" if ctx.preview_token else None

        # 如果是新对话，在 Redis 中创建临时聊天记录
        if not ctx.chat_id or not TempChatStore.get_chat(ctx.integration_id, temp_chat_id, scope_id=ctx.scope_id):
            TempChatStore.create_chat(
                integration_id=ctx.integration_id,
                chat_id=temp_chat_id,
                chatbot_id=ctx.chatbot_id,
                title=ctx.user_text[:30] if ctx.user_text else "临时对话",
                scope_id=ctx.scope_id
            )

        # 处理编辑消息：删除该消息及其后续所有消息
        if ctx.edit_message_id:
            temp_messages = TempChatStore.get_messages(ctx.integration_id, temp_chat_id, scope_id=ctx.scope_id)
            for i, msg in enumerate(temp_messages):
                if msg.get('id') == ctx.edit_message_id or msg.get('message_id') == ctx.edit_message_id:
                    TempChatStore.clear_messages_after(ctx.integration_id, temp_chat_id, i, scope_id=ctx.scope_id)
                    break

        # 保存用户消息到 Redis
        from app.services.chat.file_utils import build_extra_content
        temp_extra_content = build_extra_content(ctx.query)
        user_msg_data = {
            "id": ctx.user_message_id,
            "message_id": ctx.user_message_id,
            "chat_id": temp_chat_id,
            "chatbot_id": ctx.chatbot_id,
            "role": "user",
            "content": ctx.user_text,
            "extra_content": json.dumps(temp_extra_content, ensure_ascii=False) if temp_extra_content else None,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        TempChatStore.add_message(ctx.integration_id, temp_chat_id, user_msg_data, scope_id=ctx.scope_id)

        # 加载历史消息
        temp_history = TempChatStore.get_messages(ctx.integration_id, temp_chat_id, scope_id=ctx.scope_id)
        ctx.history_messages = []
        for msg in temp_history[:-1]:
            ctx.history_messages.append({
                "role": msg.get("role", ""),
                "content": msg.get("content", "")
            })

    @staticmethod
    def _setup_formal_session(ctx: IntegrationChatContext) -> None:
        """设置正式会话：创建/加载ChatbotChat、处理编辑消息、加载历史消息、保存用户消息"""
        # 获取或创建 ChatbotChat
        chat_title = ctx.user_text[:20] if len(ctx.user_text) > 20 else ctx.user_text
        ctx.bot_chat = IntegrationChatCoreService._get_or_create_bot_chat(
            ctx.integration, ctx.chatbot_id, ctx.chat_id, title=chat_title
        )
        ctx.chat_id = ctx.bot_chat.id

        # 处理编辑消息：删除该消息及其后续所有消息
        if ctx.edit_message_id:
            IntegrationChatCoreService._delete_messages_after(ctx.chat_id, ctx.edit_message_id)

        # 加载历史消息
        ctx.history_messages = IntegrationChatCoreService._load_history_messages(ctx.chat_id)

        # 保存用户消息到 ChatbotChatMessage
        from app.services.chat.file_utils import build_extra_content
        extra_content = build_extra_content(ctx.query)
        IntegrationChatCoreService._save_user_message(
            chatbot_id=ctx.chatbot_id,
            chat_id=ctx.chat_id,
            message_id=ctx.user_message_id,
            content=ctx.user_text,
            model_id=ctx.model_id,
            extra_content=extra_content
        )

    @staticmethod
    def _build_messages(ctx: IntegrationChatContext, query: List[QueryItem]) -> None:
        """构建完整的消息列表（系统提示词 + 用户提示词 + 历史消息 + 用户消息）"""
        user_message = ChatCoreService.convert_query_to_message(query, ctx.model_type, ctx.model_id)
        ctx.messages = ChatCoreService.build_messages(
            ctx.system_prompt, ctx.history_messages, user_message, ctx.user_prompt_messages
        )

    @staticmethod
    def preprocess(
        query: List[QueryItem],
        chat_id: Optional[str],
        integration: ChatbotIntegration,
        temporary: bool,
        config: Optional[dict],
        edit_message_id: Optional[str],
        preview_token: Optional[str],
    ) -> IntegrationChatContext:
        """
        执行聊天前预处理，构建完整的 IntegrationChatContext

        按顺序执行各预处理步骤，任一步骤失败抛出 PreprocessError 或 ResourceNotFoundError。

        Returns:
            IntegrationChatContext: 预处理完成的聊天上下文
        """
        chatbot_id = integration.chatbot_id

        ctx = IntegrationChatContext(
            chat_id=chat_id or '',
            chatbot_id=chatbot_id,
            integration=integration,
            integration_id=integration.id,
            query=query,
            config=config,
            config_dict=IntegrationChatPreprocessor._parse_config(config),
            temporary=temporary,
            edit_message_id=edit_message_id,
            preview_token=preview_token,
            user_message_id=uuid.uuid4().hex,
            assistant_message_id=uuid.uuid4().hex,
        )
        ctx.user_text = ChatCoreService.extract_text_from_query(query)

        # 1. 加载机器人配置（模型、提示词、工具等）
        IntegrationChatPreprocessor._load_chatbot_config(ctx)
        # 2. 注入内置工具
        IntegrationChatPreprocessor._inject_builtin_tools(ctx)
        # 3. 校验并创建模型实例
        IntegrationChatPreprocessor._resolve_model(ctx)
        # 4. 组装模型参数
        IntegrationChatPreprocessor._build_model_params(ctx)
        # 5. 设置会话（临时/正式）
        if temporary:
            IntegrationChatPreprocessor._setup_temporary_session(ctx)
        else:
            IntegrationChatPreprocessor._setup_formal_session(ctx)
        # 6. 构建消息列表
        IntegrationChatPreprocessor._build_messages(ctx, query)
        # 7. 解析头像
        ctx.avatar = IntegrationChatPreprocessor._resolve_avatar(ctx.chatbot_id)
        # 8. 初始化计时
        ctx.start_time = time.time()

        return ctx


class PreprocessError(Exception):
    """
    预处理阶段错误

    携带 chat_id 与错误信息，供调用方在流式返回错误响应时使用。

    Attributes:
        message: 错误信息
        chat_id: 对话ID（可能为空）
    """
    def __init__(self, message: str, chat_id: str = ''):
        super().__init__(message)
        self.message = message
        self.chat_id = chat_id


class IntegrationChatCoreService:
    """
    插件集成聊天核心服务

    独立实现聊天流程，所有聊天数据持久化到 ChatbotChat 和 ChatbotChatMessage 表，
    不再调用 ChatCoreService.chat_stream，避免对 Chat 和 ChatMessage 表的写入。
    复用 ChatCoreService 中不涉及 chat/chat_message 表的纯静态方法（如 get_chatbot_config、
    build_messages、convert_query_to_message 等）。

    流程编排：
        preprocess（IntegrationChatPreprocessor） -> execute（_run_conversation_loop） -> postprocess（_postprocess）
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
    def _save_tool_response_message(
        chatbot_id: str,
        chat_id: str,
        message_id: str,
        content: str,
        model_id: Optional[str] = None,
        extra_content: Optional[str] = None
    ) -> ChatbotChatMessage:
        """保存 tool_response 消息到 ChatbotChatMessage 表"""
        tool_response_message = ChatbotChatMessage(
            chatbot_id=chatbot_id,
            chat_id=chat_id,
            message_id=message_id or uuid.uuid4().hex,
            role='tool_response',
            content=content,
            model_id=model_id,
            extra_content=extra_content
        )
        tool_response_message.save(force_insert=True)
        return tool_response_message

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
    async def _wait_for_clarify_input(
        chat_id: str,
        tool_call_id: str,
        message_id: str,
        chatbot_id: str,
        model_id: Optional[str] = None,
        temporary: bool = False,
        integration_id: Optional[Any] = None,
        scope_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        等待用户通过 API 提交澄清问题的回复

        暂停对话循环，轮询 ChatInputManager 获取用户输入，
        收到输入后保存用户消息记录并返回工具结果消息。
        支持超时（1小时）和手动停止。

        Args:
            chat_id: 对话ID
            tool_call_id: 工具调用ID
            message_id: 助手消息ID，作为 ChatInputManager 的 key
            chatbot_id: 机器人ID
            model_id: 模型ID
            temporary: 是否临时会话
            integration_id: 集成配置ID（临时会话保存消息时需要）
            scope_id: 临时会话数据隔离scope

        Returns:
            Dict: 工具结果消息（role='tool'），包含 user_response 或 [用户未响应]
        """
        ChatInputManager().clear_input(message_id)
        wait_start = time.time()
        CLARIFY_TIMEOUT = 86400  # 24 小时超时
        user_input = None
        while time.time() - wait_start < CLARIFY_TIMEOUT:
            if ChatStopManager().is_stop_requested(chat_id):
                break
            user_input = ChatInputManager().get_input(message_id)
            if user_input is not None:
                break
            await asyncio.sleep(0.5)
        ChatInputManager().clear_input(message_id)

        # 无论有没有用户回答都保存 tool_response 消息记录
        save_content = user_input if user_input is not None else '[用户未响应]'
        tool_response_extra = json.dumps({"tool_call": {"tool_call_id": tool_call_id, "name": "clarify"}}, ensure_ascii=False)
        if temporary and integration_id is not None:
            user_msg_data = {
                "id": message_id,
                "message_id": message_id,
                "chat_id": chat_id,
                "chatbot_id": chatbot_id,
                "role": "tool_response",
                "content": save_content,
                "extra_content": tool_response_extra,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            TempChatStore.add_message(integration_id, chat_id, user_msg_data, scope_id=scope_id)
        else:
            IntegrationChatCoreService._save_tool_response_message(
                chatbot_id=chatbot_id,
                chat_id=chat_id,
                message_id=message_id,
                content=save_content,
                model_id=model_id,
                extra_content=tool_response_extra,
            )
        if user_input is not None:
            return {
                'role': 'tool',
                'tool_call_id': tool_call_id,
                'content': user_input
            }
        else:
            return {
                'role': 'tool',
                'tool_call_id': tool_call_id,
                'content': '[用户未响应]'
            }

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
        ).order_by(ChatbotChatMessage.created_at.desc(), ChatbotChatMessage.role.desc())

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
                # clarify 工具消息停止时设为 done，不追加"已停止"
                tool_call = extra_data.get('tool_call', {})
                is_clarify = isinstance(tool_call, dict) and tool_call.get('name') == 'clarify'
                if is_clarify:
                    extra_data['step_status'] = 'done'
                    msg.extra_content = json.dumps(extra_data, ensure_ascii=False)
                    msg.save()
                    updated_count += 1
                    continue

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
        ).order_by(ChatbotChatMessage.created_at.asc(), ChatbotChatMessage.role.asc())

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
            elif msg.role == 'tool_response':
                # tool_response 转为 tool 消息发送给大模型
                tool_call_id = msg.message_id
                if msg.extra_content:
                    try:
                        ec = json.loads(msg.extra_content) if isinstance(msg.extra_content, str) else msg.extra_content
                        tc = ec.get('tool_call', {}) if isinstance(ec, dict) else {}
                        tool_call_id = tc.get('tool_call_id', msg.message_id)
                    except Exception:
                        pass
                history.append({
                    'role': 'tool',
                    'tool_call_id': tool_call_id,
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
            ).order_by(ChatbotChatMessage.created_at.asc(), ChatbotChatMessage.role.asc()))

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

    # ==================== 核心聊天方法 ====================

    @staticmethod
    async def _run_conversation_loop(
        ctx: IntegrationChatContext
    ) -> AsyncGenerator[Union[Dict[str, Any], Tuple[None, List[Dict[str, Any]], List[Dict[str, Any]]]], None]:
        """
        执行聊天主循环（模型流式生成 + 工具调用循环）

        循环执行模型流式生成，遇到工具调用时执行工具并将结果回填给模型，
        直到模型不再发起工具调用为止。期间处理停止信号与错误。

        Args:
            ctx: 集成聊天上下文（包含 model、messages、tool_map 等运行时状态）

        Yields:
            Dict: 流式响应数据
            Tuple[None, List, List]: 循环结束时的最终消息列表（供后置处理使用）
        """
        chat_id = ctx.chat_id
        user_message_id = ctx.user_message_id
        assistant_message_id = ctx.assistant_message_id
        model = ctx.model
        messages = ctx.messages
        tool_map = ctx.tool_map or {}
        avatar = ctx.avatar
        model_id = ctx.model_id
        chatbot_id = ctx.chatbot_id
        # 保存消息记录时，如果使用了 chatbot_id 则 model_id 置空
        msg_model_id = model_id if not chatbot_id else None
        model_params = ctx.model_params
        temporary = ctx.temporary
        planning_messages_history = ctx.history_messages.copy()

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
                            model_id=msg_model_id,
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
                    ctx.full_response += chunk['text']

                if chunk.get('reasoning_content'):
                    reasoning_content_chunk += chunk['reasoning_content']
                    ctx.reasoning_content += chunk['reasoning_content']

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
                    reasoning_content=chunk.get('reasoning_content', ''),
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
                    model_id=msg_model_id,
                    reasoning_content=reasoning_content_chunk if reasoning_content_chunk else None,
                    reasoning_time=reasoning_time,
                    step=MessageStep.MODEL_ANSWER
                )

            # 处理工具调用
            if tool_calls_list:
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
                                model_id=msg_model_id,
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
                                model_id=msg_model_id,
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
                                model_id=msg_model_id,
                                step=MessageStep.TOOL_CALL,
                                reasoning_content=tool_reasoning_content,
                                extra_content=json.dumps({"tool_call": tool_call_info.to_dict()}, ensure_ascii=False)
                            )

                        # clarify 工具：暂停对话循环，等待用户通过 API 提交输入
                        if isinstance(result_data, dict) and result_data.get('type') == 'clarify':
                            tool_msg = await IntegrationChatCoreService._wait_for_clarify_input(
                                chat_id=chat_id,
                                tool_call_id=tool_call_id,
                                message_id=assistant_message_id,
                                chatbot_id=chatbot_id,
                                model_id=msg_model_id,
                                temporary=temporary,
                                integration_id=ctx.integration_id,
                                scope_id=ctx.scope_id
                            )
                            # 用户回答后，更新工具消息 step_status 为 done
                            if not temporary:
                                IntegrationChatCoreService._upsert_tool_message(
                                    chatbot_id=chatbot_id,
                                    chat_id=chat_id,
                                    message_id=assistant_message_id,
                                    step_id=tool_step_id,
                                    content=tool_message_content,
                                    model_id=msg_model_id,
                                    step=MessageStep.TOOL_CALL,
                                    reasoning_content=tool_reasoning_content,
                                    extra_content=json.dumps({"tool_call": tool_call_info.to_dict(), "step_status": "done"}, ensure_ascii=False)
                                )
                            messages.append(tool_msg)
                        else:
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
    def _postprocess(ctx: IntegrationChatContext) -> None:
        """
        聊天后置处理：持久化助手消息与收尾

        - 临时会话：将助手最终消息保存到 Redis
        - 正式会话：更新 ChatbotChat 的 messages 摘要
        """
        if ctx.temporary:
            # 临时会话：保存助手最终消息到 Redis
            if ctx.full_response or ctx.reasoning_content:
                assistant_msg_data = {
                    "id": ctx.assistant_message_id,
                    "message_id": ctx.assistant_message_id,
                    "chat_id": ctx.chat_id,
                    "chatbot_id": ctx.chatbot_id,
                    "role": "assistant",
                    "content": ctx.full_response,
                    "reasoning_content": ctx.reasoning_content,
                    "reasoning_time": int((ctx.reasoning_end_time - ctx.start_time) * 1000) if ctx.reasoning_end_time else None,
                    "model_id": ctx.model_id,
                    "extra_content": None,
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                TempChatStore.add_message(ctx.integration_id, ctx.chat_id, assistant_msg_data, scope_id=ctx.scope_id)
        else:
            # 正式会话：更新 ChatbotChat 的 messages 摘要
            if ctx.bot_chat:
                IntegrationChatCoreService._update_chat_messages_summary(ctx.bot_chat, ctx.chat_id)

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

        流程：聊天前预处理 -> 聊天执行 -> 聊天后置处理

        Args:
            query: 查询数组
            chat_id: 对话ID（可选）
            integration: 集成配置对象
            stream: 是否流式输出
            temporary: 临时会话模式，不保存对话和消息到数据库
            config: 对话配置JSON，包含 deep_thinking 等配置项
            edit_message_id: 编辑消息ID，删除该消息及其后续消息
            preview_token: 预览token

        Yields:
            Dict: 流式响应数据
        """
        # 1. 聊天前预处理
        try:
            ctx = IntegrationChatPreprocessor.preprocess(
                query=query,
                chat_id=chat_id,
                integration=integration,
                temporary=temporary,
                config=config,
                edit_message_id=edit_message_id,
                preview_token=preview_token,
            )
        except PreprocessError as e:
            actual_chat_id = e.chat_id or chat_id or f"temp_{uuid.uuid4().hex[:12]}"
            yield ChatStreamResponse.error_response(
                error=e.message,
                chat_id=actual_chat_id,
                user_message_id='',
                assistant_message_id='',
                text=f"抱歉，发送消息时出现错误：{e.message}"
            ).to_dict()
            return
        except ResourceNotFoundError as e:
            actual_chat_id = chat_id or f"temp_{uuid.uuid4().hex[:12]}"
            user_message_id = uuid.uuid4().hex
            assistant_message_id = uuid.uuid4().hex
            yield ChatStreamResponse.error_response(
                error=str(e),
                chat_id=actual_chat_id,
                user_message_id=user_message_id,
                assistant_message_id=assistant_message_id,
                text=f"抱歉，发送消息时出现错误：{str(e)}"
            ).to_dict()
            return

        # 2. 聊天执行
        try:
            ChatStopManager().clear_stop(ctx.chat_id)
            async for result in IntegrationChatCoreService._run_conversation_loop(ctx):
                if isinstance(result, dict):
                    if result.get('status') == MessageStatus.STOP:
                        ChatStopManager().clear_stop(ctx.chat_id)
                        return
                    if result.get('text'):
                        ctx.full_response += result['text']
                    if result.get('reasoning_content'):
                        ctx.reasoning_content += result['reasoning_content']
                    if result.get('reasoning_end') and ctx.reasoning_end_time is None:
                        ctx.reasoning_end_time = time.time()
                    result['chat_id'] = ctx.chat_id
                    yield result
                elif isinstance(result, tuple) and len(result) == 3:
                    _, ctx.messages, _ = result
        except GeneratorExit:
            ChatStopManager().request_stop(ctx.chat_id)
        except Exception as e:
            logger.error(f"集成聊天流式输出异常: {e}", exc_info=True)
            yield ChatStreamResponse.error_response(
                error=str(e),
                chat_id=ctx.chat_id,
                user_message_id=ctx.user_message_id,
                assistant_message_id=ctx.assistant_message_id,
                text=f"抱歉，发送消息时出现错误：{str(e)}"
            ).to_dict()
        # 3. 聊天后置处理
        finally:
            IntegrationChatCoreService._postprocess(ctx)

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
        ).order_by(ChatbotChatMessage.created_at.asc(), ChatbotChatMessage.role.asc())

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
