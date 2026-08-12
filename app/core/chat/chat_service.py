"""
聊天核心服务

处理聊天逻辑，包括消息转换、模型调用等

架构说明：
    聊天流程分为三大阶段：
        1. 聊天前预处理（ChatPreprocessor）：参数校验、初始化参数、提示词拼装等
        2. 聊天执行（ChatCoreService._run_conversation_loop）：模型流式调用与工具调用循环
        3. 聊天后置处理（ChatCoreService._postprocess）：消息持久化与收尾

    各阶段通过 ChatContext 共享状态，层级分明、易于扩展。
"""

import json
import uuid
import time
import asyncio
import threading
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Generator, AsyncGenerator, Tuple, Union

from app.database.models import Chat, ChatMessage, LLMModel, Chatbot, ChatbotPrompt, ChatbotTool, MCPTool
from app.services.chat.dto import QueryItem
from app.services.chat.service import ChatService, ChatMessageService
from app.core.llm_model.factory import LLMFactory
from app.core.tools.tool_util import process_tool_calls, convert_db_tools_to_openai_tools, convert_kbs_to_openai_tools
from app.core.exceptions import ResourceNotFoundError
from app.core.utils.resource_utils import get_provider_avatar_url
from app.core.chat.dto import ChatStreamResponse, ToolCallInfo, MessageStatus, MessageStep
from app.core.prompt.utils.system_prompt_builder import build_system_prompt


class ChatStopManager:
    """
    聊天停止状态管理器
    
    管理聊天的停止状态，用于在手动停止回答时终止后端聊天流程
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._stop_flags = {}
                    cls._instance._flags_lock = threading.Lock()
        return cls._instance

    def request_stop(self, chat_id: str):
        """标记某个对话需要停止"""
        with self._flags_lock:
            self._stop_flags[chat_id] = True

    def is_stop_requested(self, chat_id: str) -> bool:
        """检查某个对话是否需要停止"""
        with self._flags_lock:
            return self._stop_flags.get(chat_id, False)

    def clear_stop(self, chat_id: str):
        """清除停止标记"""
        with self._flags_lock:
            self._stop_flags.pop(chat_id, None)


class ChatInputManager:
    """
    聊天用户输入管理器

    用于 clarify 等需要用户交互的工具：工具执行后暂停对话循环，
    等待前端通过 API 提交用户输入，再恢复对话。

    使用 message_id 作为 key，确保同一对话中多次澄清不会互相干扰。
    使用 Redis 存储用户输入，支持多进程场景。
    回退到内存字典（Redis 不可用时）。
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._inputs = {}
                    cls._instance._inputs_lock = threading.Lock()
        return cls._instance

    @staticmethod
    def _redis_key(message_id: str) -> str:
        return f"chat:input:{message_id}"

    def set_input(self, message_id: str, input_data: Any):
        """设置用户输入"""
        try:
            from app.database.redis_utils import redis_utils
            if redis_utils.is_available:
                redis_utils.set_obj(self._redis_key(message_id), input_data, exp=3600)
                return
        except Exception:
            pass
        # 回退到内存
        with self._inputs_lock:
            self._inputs[message_id] = input_data

    def get_input(self, message_id: str) -> Optional[Any]:
        """获取用户输入（不删除）"""
        try:
            from app.database.redis_utils import redis_utils
            if redis_utils.is_available:
                return redis_utils.get_obj(self._redis_key(message_id))
        except Exception:
            pass
        # 回退到内存
        with self._inputs_lock:
            return self._inputs.get(message_id)

    def clear_input(self, message_id: str):
        """清除用户输入"""
        try:
            from app.database.redis_utils import redis_utils
            if redis_utils.is_available:
                redis_utils.delete(self._redis_key(message_id))
                return
        except Exception:
            pass
        # 回退到内存
        with self._inputs_lock:
            self._inputs.pop(message_id, None)


@dataclass
class ChatContext:
    """
    聊天上下文

    在聊天前预处理阶段构建，贯穿聊天执行与后置处理全流程，
    集中持有聊天所需的全部状态，避免在方法间传递大量零散参数。

    Attributes:
        chat_id: 对话ID
        user_id: 用户ID
        user_text: 用户输入文本
        user_message_id: 用户消息ID
        assistant_message_id: 助手消息ID
        message_id: 重新回答/编辑问题对应的消息ID
        model_id: 模型ID
        chatbot_id: 机器人ID
        model: LLM模型实例
        model_type: 模型类型
        config: 原始配置（字符串或字典，用于消息持久化）
        config_dict: 解析后的配置字典
        system_prompt: 系统提示词
        user_prompt_messages: 用户提示词消息列表
        messages: 完整的消息列表（含系统提示词、历史消息、用户消息）
        history_messages: 历史消息列表
        tools: OpenAI tool格式工具列表
        tool_map: 工具名称到工具实例的映射
        model_params: 传给大模型的参数
        avatar: 头像URL
        start_time: 聊天开始时间戳
        reasoning_end_time: 推理结束时间戳
        full_response: 累积的完整响应文本
        reasoning_content: 累积的推理内容
    """
    chat_id: str = ''
    user_id: str = ''
    user_text: str = ''
    user_message_id: str = ''
    assistant_message_id: str = ''
    message_id: Optional[str] = None
    model_id: Optional[str] = None
    chatbot_id: Optional[str] = None
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
    start_time: float = 0.0
    reasoning_end_time: Optional[float] = None
    full_response: str = ''
    reasoning_content: str = ''


class ChatPreprocessor:
    """
    聊天前处理器

    负责聊天执行前的全部准备工作，按步骤组织：
        - 参数校验与初始化（解析config、获取机器人配置、校验模型）
        - 对话与历史消息处理（创建/加载对话、处理重新回答）
        - 提示词与消息拼装（构建系统提示词、历史消息、用户消息）
        - 工具与模型参数准备（注入内置工具、组装model_params、创建模型实例）
        - 用户消息持久化与头像解析

    所有方法均为静态方法，返回值写入 ChatContext。
    若预处理过程中出现需要终止的错误，会抛出 PreprocessError，
    其中携带已就绪的 chat_id 与 error 文本，由调用方决定如何返回给前端。
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
    def _resolve_avatar(chatbot_id: Optional[str], model_id: Optional[str]) -> Optional[str]:
        """解析头像URL：优先使用机器人头像，否则使用模型提供商头像"""
        if chatbot_id:
            try:
                chatbot = Chatbot.get(Chatbot.id == chatbot_id)
                return chatbot.avatar
            except Chatbot.DoesNotExist:
                return None
        elif model_id:
            try:
                model_obj = LLMModel.get(LLMModel.id == model_id)
                if model_obj.provider:
                    return get_provider_avatar_url(model_obj.provider)
                else:
                    return get_provider_avatar_url(None)
            except LLMModel.DoesNotExist:
                return None
        return None

    @staticmethod
    def _load_chatbot_config(ctx: ChatContext) -> None:
        """
        加载机器人配置（模型、提示词、工具等）并合并模型关联表配置

        Raises:
            PreprocessError: 机器人不存在或未绑定模型
        """
        if not ctx.chatbot_id:
            return

        try:
            chatbot_config = ChatCoreService.get_chatbot_config(ctx.chatbot_id)
        except ResourceNotFoundError as e:
            raise PreprocessError(str(e), chat_id=ctx.chat_id)

        ctx.model_id = chatbot_config['model_id']
        ctx.system_prompt = chatbot_config['system_prompt']
        ctx.user_prompt_messages = chatbot_config['user_prompt_messages']
        ctx.tools = chatbot_config['tools'] if chatbot_config['tools'] else None
        ctx.tool_map = chatbot_config['tool_map']

        # 合并机器人模型关联表中的模型配置
        from app.database.models import ChatbotModel
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
    def _inject_builtin_tools(ctx: ChatContext) -> None:
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
    def _resolve_chat_and_history(ctx: ChatContext, user_id: str) -> None:
        """
        创建或加载对话，并加载历史消息

        Raises:
            ResourceNotFoundError: 指定的对话不存在
        """
        if not ctx.chat_id:
            title = ctx.user_text[:20] if len(ctx.user_text) > 20 else ctx.user_text
            # 当选择的是模型时，机器人id设为空；当选择的是机器人时，模型id设为空
            chat_model_id = ctx.model_id if not ctx.chatbot_id else None
            chat_chatbot_id = ctx.chatbot_id if not ctx.model_id else None
            chat = ChatService.create_chat(user_id, {
                'title': title,
                'model_id': chat_model_id,
                'chatbot_id': chat_chatbot_id,
                'config': json.dumps(ctx.config_dict) if ctx.config_dict else None,
                'system_prompt': ctx.system_prompt
            })
            ctx.chat_id = chat.id
            ctx.history_messages = []
        else:
            chat = ChatService.get_chat(ctx.chat_id, user_id)
            if not chat:
                raise ResourceNotFoundError(message=f"对话 {ctx.chat_id} 不存在")

            try:
                ctx.history_messages = json.loads(chat.messages) if chat.messages else []
            except json.JSONDecodeError:
                ctx.history_messages = []

            if not ctx.chatbot_id:
                ctx.system_prompt = chat.system_prompt

    @staticmethod
    def _handle_rerun(ctx: ChatContext) -> None:
        """处理重新回答/编辑问题：截断历史消息并删除后续消息记录"""
        if not ctx.message_id:
            return
        try:
            target_message = ChatMessage.get(
                (ChatMessage.message_id == ctx.message_id) &
                (ChatMessage.chat_id == ctx.chat_id) &
                (ChatMessage.deleted == False)
            )
            # 查找历史消息中对应的消息 - 只根据 message_id 匹配，不比较 content
            for i in reversed(range(len(ctx.history_messages))):
                msg = ctx.history_messages[i]
                if msg.get('role') == 'user' and msg.get('message_id') == ctx.message_id:
                    ctx.history_messages = ctx.history_messages[:i]
                    break

            # 删除聊天消息表中本条消息以及之后的消息记录
            target_created_at = target_message.created_at
            ChatMessage.update(deleted=True).where(
                (ChatMessage.chat_id == ctx.chat_id) &
                (ChatMessage.created_at >= target_created_at) &
                (ChatMessage.deleted == False)
            ).execute()
        except ChatMessage.DoesNotExist:
            pass

    @staticmethod
    def _resolve_model(ctx: ChatContext) -> None:
        """
        校验并解析模型配置、创建模型实例

        Raises:
            PreprocessError: 未指定模型或模型不存在
        """
        if not ctx.model_id:
            chat = ChatService.get_chat(ctx.chat_id, ctx.user_id)
            if chat and chat.model_id:
                ctx.model_id = chat.model_id
            else:
                raise PreprocessError('未指定模型', chat_id=ctx.chat_id)

        model_config, llm_config, model_type = ChatCoreService.get_model_config(ctx.model_id)
        ctx.model_type = model_type
        ctx.model = LLMFactory.create_model(model_type, model_config)
        # llm_config 在后续组装 model_params 时使用，暂存于 model_params
        ctx.model_params = dict(llm_config) if llm_config else {}

    @staticmethod
    def _build_messages(ctx: ChatContext, query: List[QueryItem]) -> None:
        """构建完整的消息列表（系统提示词 + 用户提示词 + 历史消息 + 用户消息）"""
        user_message = ChatCoreService.convert_query_to_message(query, ctx.model_type, ctx.model_id)
        ctx.messages = ChatCoreService.build_messages(
            ctx.system_prompt, ctx.history_messages, user_message, ctx.user_prompt_messages
        )

    @staticmethod
    def _build_model_params(ctx: ChatContext) -> None:
        """组装传给大模型的参数（合并配置、剔除前端专用参数、挂载工具）"""
        if ctx.config_dict:
            ctx.model_params.update(ctx.config_dict)
            # 移除前端专用参数，不传给大模型
            ctx.model_params.pop('web_search', None)
            ctx.model_params.pop('deep_thinking', None)
        if ctx.tools:
            ctx.model_params['tools'] = ctx.tools

    @staticmethod
    def _persist_user_message(ctx: ChatContext, query: List[QueryItem]) -> None:
        """持久化用户消息并生成消息ID"""
        from app.services.chat.file_utils import build_extra_content
        extra_content = build_extra_content(query)

        user_msg = ChatMessageService.create_user_message(
            chat_id=ctx.chat_id,
            user_content=ctx.user_text,
            model_id=ctx.model_id if not ctx.chatbot_id else None,
            chatbot_id=ctx.chatbot_id,
            config=ctx.config,
            message_id=ctx.message_id,
            extra_content=extra_content
        )
        ctx.user_message_id = user_msg.message_id
        # 如果前端已传入assistant_message_id，则使用它，否则生成新的ID
        if not ctx.assistant_message_id:
            ctx.assistant_message_id = uuid.uuid4().hex

    @staticmethod
    def preprocess(
        user_id: str,
        query: List[QueryItem],
        model_id: Optional[str],
        chatbot_id: Optional[str],
        chat_id: Optional[str],
        config: Optional[Any],
        message_id: Optional[str],
        system_prompt: Optional[str],
        assistant_message_id: Optional[str],
    ) -> ChatContext:
        """
        执行聊天前预处理，构建完整的 ChatContext

        按顺序执行各预处理步骤，任一步骤失败抛出 PreprocessError。

        Returns:
            ChatContext: 预处理完成的聊天上下文
        """
        ctx = ChatContext(
            user_id=user_id,
            model_id=model_id,
            chatbot_id=chatbot_id,
            chat_id=chat_id or '',
            config=config,
            config_dict=ChatPreprocessor._parse_config(config),
            system_prompt=system_prompt,
            assistant_message_id=assistant_message_id,
            message_id=message_id,
        )
        ctx.user_text = ChatCoreService.extract_text_from_query(query)

        # 1. 加载机器人配置
        ChatPreprocessor._load_chatbot_config(ctx)
        # 2. 注入内置工具
        ChatPreprocessor._inject_builtin_tools(ctx)
        # 3. 创建/加载对话与历史消息
        ChatPreprocessor._resolve_chat_and_history(ctx, user_id)
        # 4. 处理重新回答/编辑问题
        ChatPreprocessor._handle_rerun(ctx)
        # 5. 补充机器人系统提示词（未通过配置加载时）
        if ctx.chatbot_id and ctx.system_prompt is None:
            ctx.system_prompt = ChatCoreService.get_chatbot_system_prompt(ctx.chatbot_id)
        # 6. 校验并创建模型实例
        ChatPreprocessor._resolve_model(ctx)
        # 7. 构建消息列表
        ChatPreprocessor._build_messages(ctx, query)
        # 8. 组装模型参数
        ChatPreprocessor._build_model_params(ctx)
        # 9. 更新对话配置
        ChatService.update_chat_config(
            chat_id=ctx.chat_id,
            model_id=None if ctx.chatbot_id else ctx.model_id,
            chatbot_id=ctx.chatbot_id,
            config=ctx.config
        )
        # 10. 持久化用户消息
        ChatPreprocessor._persist_user_message(ctx, query)
        # 11. 解析头像
        ctx.avatar = ChatPreprocessor._resolve_avatar(ctx.chatbot_id, ctx.model_id)
        # 12. 初始化计时
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


class ChatCoreService:
    """
    聊天核心服务类
    
    处理聊天逻辑，包括消息转换、模型调用等

    流程编排：
        preprocess（ChatPreprocessor） -> execute（_run_conversation_loop） -> postprocess（_postprocess）
    """
    
    @staticmethod
    def convert_query_to_message(query: List[QueryItem], model_type: Optional[str] = None, model_id: Optional[str] = None) -> Dict[str, Any]:
        """
        将query数组转换为OpenAI格式的用户消息
        
        Args:
            query: 查询数组
            model_type: 模型类型，用于判断如何处理文件
            model_id: 模型ID，用于查询数据库中的support_image字段
            
        Returns:
            Dict: OpenAI格式的用户消息
        """
        from app.core.llm_model.utils.llm_util import convert_query_to_message as llm_convert_query_to_message
        return llm_convert_query_to_message(query, model_type, model_id)
    
    @staticmethod
    def get_model_config(model_id: str) -> Tuple[Dict[str, Any], str]:
        """
        获取模型配置
        
        Args:
            model_id: 模型ID
            
        Returns:
            Tuple[Dict, str]: 模型配置和模型类型
            
        Raises:
            ResourceNotFoundError: 模型不存在
        """
        try:
            model = LLMModel.get(LLMModel.id == model_id)
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(message=f"模型 {model_id} 不存在")
        
        config = {
            'api_key': model.api_key,
            'endpoint': model.endpoint,
            'name': model.name,
            'provider': model.provider
        }
        
        llm_config = {}
        if model.config:
            try:
                llm_config = json.loads(model.config)
            except json.JSONDecodeError:
                pass
        
        return config, llm_config, model.model_type
    
    @staticmethod
    def get_chatbot_system_prompt(chatbot_id: str) -> Optional[str]:
        """
        获取机器人的系统提示词
        
        Args:
            chatbot_id: 机器人ID
            
        Returns:
            Optional[str]: 系统提示词
        """
        try:
            chatbot = Chatbot.get(Chatbot.id == chatbot_id)
            return chatbot.greeting
        except Chatbot.DoesNotExist:
            return None
    
    @staticmethod
    def get_chatbot_config(chatbot_id: str) -> Dict[str, Any]:
        """
        获取机器人的完整配置，包括模型、提示词、工具等
        
        Args:
            chatbot_id: 机器人ID
            
        Returns:
            Dict[str, Any]: 机器人配置，包含model_id、system_prompt、user_prompts、tools等
            
        Raises:
            ResourceNotFoundError: 机器人不存在或未绑定模型
        """
        try:
            chatbot = Chatbot.get(Chatbot.id == chatbot_id)
        except Chatbot.DoesNotExist:
            raise ResourceNotFoundError(message=f"机器人不存在")
        
        from app.database.models import ChatbotModel
        model_bindings = list(ChatbotModel.select().where(
            (ChatbotModel.chatbot_id == chatbot_id) &
            (ChatbotModel.deleted == False)
        ))
        
        if not model_bindings:
            raise ResourceNotFoundError(message=f"机器人未绑定任何模型")
        
        text_model_id = None
        vision_model_id = None
        multimodal_model_id = None
        
        for binding in model_bindings:
            if binding.model_type == 'text':
                text_model_id = binding.model_id
            elif binding.model_type == 'vision':
                vision_model_id = binding.model_id
            elif binding.model_type == 'multimodal':
                multimodal_model_id = binding.model_id
        
        model_id = text_model_id or multimodal_model_id or vision_model_id
        
        if not model_id:
            raise ResourceNotFoundError(message=f"机器人未绑定有效的模型")
        
        system_prompts = list(ChatbotPrompt.select().where(
            (ChatbotPrompt.chatbot_id == chatbot_id) &
            (ChatbotPrompt.prompt_type == 'system') &
            (ChatbotPrompt.deleted == False)
        ).order_by(ChatbotPrompt.sort_order))
        
        system_prompt_parts = []
        for prompt in system_prompts:
            if prompt.prompt_source == 'library' and prompt.prompt_id:
                from app.database.models import Prompt
                try:
                    prompt_obj = Prompt.get(Prompt.id == prompt.prompt_id)
                    system_prompt_parts.append(prompt_obj.content)
                except Prompt.DoesNotExist:
                    pass
            elif prompt.prompt_source == 'manual' and prompt.prompt_content:
                system_prompt_parts.append(prompt.prompt_content)

        # 解析提示词中的引用占位符 {{prompt@prompt_id}}
        from app.core.llm_model.utils.llm_util import resolve_prompt_references
        system_prompt = resolve_prompt_references('\n'.join(system_prompt_parts)) if system_prompt_parts else None

        user_prompts = list(ChatbotPrompt.select().where(
            (ChatbotPrompt.chatbot_id == chatbot_id) &
            (ChatbotPrompt.prompt_type == 'user') &
            (ChatbotPrompt.deleted == False)
        ).order_by(ChatbotPrompt.sort_order))

        user_prompt_messages = []
        for prompt in user_prompts:
            if prompt.prompt_source == 'library' and prompt.prompt_id:
                from app.database.models import Prompt
                try:
                    prompt_obj = Prompt.get(Prompt.id == prompt.prompt_id)
                    user_prompt_messages.append({
                        'role': 'user',
                        'content': prompt_obj.content
                    })
                except Prompt.DoesNotExist:
                    pass
            elif prompt.prompt_source == 'manual' and prompt.prompt_content:
                user_prompt_messages.append({
                    'role': 'user',
                    'content': prompt.prompt_content
                })

        # 解析用户提示词中的引用占位符 {{prompt@prompt_id}}
        for msg in user_prompt_messages:
            msg['content'] = resolve_prompt_references(msg['content'])
        
        tool_bindings = list(ChatbotTool.select().where(
            (ChatbotTool.chatbot_id == chatbot_id) &
            (ChatbotTool.deleted == False)
        ))
        
        tool_ids = [binding.mcp_tool_id for binding in tool_bindings]
        tools = list(MCPTool.select().where(
            (MCPTool.id.in_(tool_ids)) &
            (MCPTool.deleted == False)
        ))
        
        openai_tools = convert_db_tools_to_openai_tools(tools)

        from app.core.tools.builtin_tools.mcp_tool import McpTool
        tool_map = {}
        for tool in tools:
            tool_map[tool.name] = McpTool.from_db_tool(tool)

        from app.database.models import ChatbotKnowledgebase, Knowledgebase

        kb_bindings = list(ChatbotKnowledgebase.select().where(
            (ChatbotKnowledgebase.chatbot_id == chatbot_id) &
            (ChatbotKnowledgebase.deleted == False)
        ))

        kb_ids = [binding.knowledgebase_id for binding in kb_bindings]
        knowledgebases = list(Knowledgebase.select().where(
            (Knowledgebase.id.in_(kb_ids)) &
            (Knowledgebase.deleted == False)
        ))

        kb_tools = convert_kbs_to_openai_tools(knowledgebases)
        openai_tools.extend(kb_tools)

        from app.core.tools.builtin_tools.knowledgebase_search import KnowledgebaseSearch
        for kb in knowledgebases:
            tool_map[kb.name] = KnowledgebaseSearch.from_kb(kb)

        return {
            'model_id': model_id,
            'system_prompt': system_prompt,
            'user_prompt_messages': user_prompt_messages,
            'tools': openai_tools,
            'tool_map': tool_map
        }
    
    @staticmethod
    def build_messages(
        system_prompt: Optional[str],
        history_messages: List[Dict],
        user_message: Dict,
        user_prompt_messages: Optional[List[Dict]] = None
    ) -> List[Dict]:
        """
        构建完整的消息列表
        
        Args:
            system_prompt: 系统提示词
            history_messages: 历史消息
            user_message: 用户消息
            user_prompt_messages: 用户提示词消息列表
            
        Returns:
            List[Dict]: 完整的消息列表
        """
        from app.core.prompt.utils.system_prompt_builder import build_system_prompt
        
        messages = []
        
        built_system_prompt = build_system_prompt(system_prompt)
        messages.append({
            'role': 'system',
            'content': built_system_prompt
        })
        
        if user_prompt_messages:
            messages.extend(user_prompt_messages)
        
        history_messages_without_system = [msg for msg in history_messages if msg['role'] != 'system']
        messages.extend(history_messages_without_system)
        messages.append(user_message)
        
        return messages
    
    @staticmethod
    def extract_text_from_query(query: List[QueryItem]) -> str:
        """
        从query中提取文本内容
        
        Args:
            query: 查询数组
            
        Returns:
            str: 文本内容
        """
        texts = [item.content for item in query if item.type == 'text']
        return ' '.join(texts)

    @staticmethod
    async def _run_conversation_loop(
        ctx: ChatContext
    ) -> AsyncGenerator[Union[Dict[str, Any], Tuple[None, List[Dict[str, Any]], List[Dict[str, Any]]]], None]:
        """
        执行聊天主循环（模型流式生成 + 工具调用循环）

        循环执行模型流式生成，遇到工具调用时执行工具并将结果回填给模型，
        直到模型不再发起工具调用为止。期间处理停止信号与错误。

        Args:
            ctx: 聊天上下文（包含 model、messages、tool_map 等运行时状态）

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
        config = ctx.config
        model_params = ctx.model_params
        planning_messages_history = ctx.history_messages.copy()

        while True:
            model_answer_step_id = f"step_{uuid.uuid4().hex[:8]}"
            
            round_start_time = time.time()
            round_reasoning_end_time = None
            
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

            # 在流式生成前创建空的助理消息，确保消息记录存在
            ChatMessageService.upsert_assistant_message(
                chat_id=chat_id,
                assistant_content='',
                step_id=model_answer_step_id,
                model_id=msg_model_id,
                chatbot_id=chatbot_id,
                config=config,
                step=MessageStep.MODEL_ANSWER,
                message_id=assistant_message_id,
                avatar=avatar
            )

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
                    ChatMessageService.upsert_assistant_message(
                        chat_id=chat_id,
                        assistant_content=f"抱歉，发送消息时出现错误：{chunk['error']}",
                        step_id=model_answer_step_id,
                        model_id=msg_model_id,
                        chatbot_id=chatbot_id,
                        config=config,
                        step=MessageStep.MODEL_ANSWER,
                        message_id=assistant_message_id,
                        avatar=avatar
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
        
            if round_finished and (full_response_chunk or reasoning_content_chunk):
                reasoning_time = None
                if reasoning_content_chunk and round_reasoning_end_time:
                    reasoning_time = int((round_reasoning_end_time - round_start_time) * 1000)
                
                ChatMessageService.upsert_assistant_message(
                    chat_id=chat_id,
                    assistant_content=full_response_chunk,
                    step_id=model_answer_step_id,
                    model_id=msg_model_id,
                    chatbot_id=chatbot_id,
                    config=config,
                    reasoning_content=reasoning_content_chunk if reasoning_content_chunk else None,
                    reasoning_time=reasoning_time,
                    avatar=avatar,
                    step=MessageStep.MODEL_ANSWER,
                    message_id=assistant_message_id
                )
        
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
                    reasoning_content = tool_result.get('reasoning_content', '')
                    tool_parameters = tool_result.get('parameters')
                    
                    tool_step_id = f"tool_{tool_call_id}"

                    if tool_status == 'start':
                        tool_call_info = ToolCallInfo(
                            tool_call_id=tool_call_id,
                            name=tool_name,
                            task_name=task_name,
                            status='start',
                            elapsed_ms=0,
                            reasoning_content=reasoning_content,
                            parameters=tool_parameters
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
                        
                        ChatMessageService.create_tool_message(
                            chat_id=chat_id,
                            tool_content='',
                            model_id=msg_model_id,
                            chatbot_id=chatbot_id,
                            config=config,
                            step=MessageStep.TOOL_CALL,
                            step_id=tool_step_id,
                            message_id=assistant_message_id,
                            reasoning_content=reasoning_content,
                            extra_content=json.dumps({"tool_call": tool_call_info.to_dict()}, ensure_ascii=False),
                            avatar=avatar
                        )
                        continue

                    if tool_status == 'running':
                        tool_call_info = ToolCallInfo(
                            tool_call_id=tool_call_id,
                            name=tool_name,
                            task_name=task_name,
                            status='running',
                            elapsed_ms=elapsed_ms,
                            reasoning_content=reasoning_content,
                            parameters=tool_parameters
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
                            reasoning_content=reasoning_content,
                            parameters=tool_parameters
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

                        ChatMessageService.upsert_tool_message(
                            chat_id=chat_id,
                            tool_content=tool_message_content,
                            step_id=tool_step_id,
                            model_id=msg_model_id,
                            chatbot_id=chatbot_id,
                            config=config,
                            step=MessageStep.TOOL_CALL,
                            message_id=assistant_message_id,
                            reasoning_content=reasoning_content,
                            extra_content=json.dumps({"tool_call": tool_call_info.to_dict()}, ensure_ascii=False),
                            avatar=avatar
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
                            reasoning_content=reasoning_content,
                            parameters=tool_parameters
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
                        
                        # clarify 工具的 step_status 设为 running，等待用户回答后再更新为 done
                        is_clarify = isinstance(result_data, dict) and result_data.get('type') == 'clarify'
                        tool_extra_content = {"tool_call": tool_call_info.to_dict()}
                        if is_clarify:
                            tool_extra_content['step_status'] = 'running'
                        ChatMessageService.upsert_tool_message(
                            chat_id=chat_id,
                            tool_content=tool_message_content,
                            step_id=tool_step_id,
                            model_id=msg_model_id,
                            chatbot_id=chatbot_id,
                            config=config,
                            step=MessageStep.TOOL_CALL,
                            message_id=assistant_message_id,
                            reasoning_content=reasoning_content,
                            extra_content=json.dumps(tool_extra_content, ensure_ascii=False),
                            avatar=avatar
                        )

                        # clarify 工具：暂停对话循环，等待用户通过 API 提交输入
                        if is_clarify:
                            tool_msg = await ChatCoreService._wait_for_clarify_input(
                                chat_id=chat_id,
                                tool_call_id=tool_call_id,
                                message_id=assistant_message_id,
                                chatbot_id=chatbot_id,
                                model_id=msg_model_id
                            )
                            # 用户回答后，更新工具消息 step_status 为 done
                            ChatMessageService.upsert_tool_message(
                                chat_id=chat_id,
                                tool_content=tool_message_content,
                                step_id=tool_step_id,
                                model_id=msg_model_id,
                                chatbot_id=chatbot_id,
                                config=config,
                                step=MessageStep.TOOL_CALL,
                                message_id=assistant_message_id,
                                reasoning_content=reasoning_content,
                                extra_content=json.dumps({"tool_call": tool_call_info.to_dict(), "step_status": "done"}, ensure_ascii=False),
                                avatar=avatar
                            )
                            messages.append(tool_msg)
                        else:
                            messages.append({
                                'role': 'tool',
                                'tool_call_id': tool_call_id,
                                'content': tool_message_content
                            })
        
                continue
            else:
                # 没有工具调用时，将模型回复添加到messages中
                if full_response_chunk:
                    messages.append({
                        'role': 'assistant',
                        'content': full_response_chunk
                    })
                break
        
        yield (None, messages, planning_messages_history)

    @staticmethod
    async def _wait_for_clarify_input(
        chat_id: str,
        tool_call_id: str,
        message_id: str,
        chatbot_id: Optional[str] = None,
        model_id: Optional[str] = None
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
        save_model_id = model_id if not chatbot_id else None
        ChatMessageService.create_tool_response_message(
            chat_id=chat_id,
            content=save_content,
            model_id=save_model_id,
            chatbot_id=chatbot_id,
            message_id=message_id,
            extra_content=json.dumps({"tool_call": {"tool_call_id": tool_call_id, "name": "clarify"}}, ensure_ascii=False),
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
    def _postprocess(ctx: ChatContext) -> None:
        """
        聊天后置处理：将最终消息列表持久化到对话记录

        从数据库读取已持久化的消息，回填 message_id 与 reasoning_content，
        再更新对话的 messages 字段。
        """
        chat_messages = ChatMessageService.get_messages_by_chat(ctx.chat_id)
        updated_messages = []
        msg_idx = 0
        for i in range(len(ctx.messages)):
            if ctx.messages[i]['role'] != 'system':
                if msg_idx < len(chat_messages.items):
                    ctx.messages[i]['message_id'] = chat_messages.items[msg_idx].message_id
                    ctx.messages[i]['reasoning_content'] = chat_messages.items[msg_idx].reasoning_content
                msg_idx += 1
            updated_messages.append(ctx.messages[i])
        ChatService.update_messages(ctx.chat_id, updated_messages)
    
    @staticmethod
    async def chat_stream(
        user_id: str,
        query: List[QueryItem],
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        chat_id: Optional[str] = None,
        config: Optional[Any] = None,
        message_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        assistant_message_id: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式聊天

        流程：聊天前预处理 -> 聊天执行 -> 聊天后置处理

        Args:
            user_id: 用户ID
            query: 查询数组
            model_id: 模型ID
            chatbot_id: 机器人ID
            chat_id: 对话ID
            config: 配置（支持字符串或字典）
            message_id: 消息ID，用于标识重新回答或编辑问题
            system_prompt: 系统提示词
            assistant_message_id: 助手消息ID，如果前端已创建消息，传入此ID保持一致

        Yields:
            Dict: 流式响应数据
        """
        # 1. 聊天前预处理
        try:
            ctx = ChatPreprocessor.preprocess(
                user_id=user_id,
                query=query,
                model_id=model_id,
                chatbot_id=chatbot_id,
                chat_id=chat_id,
                config=config,
                message_id=message_id,
                system_prompt=system_prompt,
                assistant_message_id=assistant_message_id,
            )
        except PreprocessError as e:
            step_id = f"{e.chat_id}_{assistant_message_id}" if assistant_message_id else f"{e.chat_id}"
            ChatMessageService.upsert_assistant_message(
                chat_id=e.chat_id,
                assistant_content=f"抱歉，发送消息时出现错误：{e.message}",
                step_id=step_id,
                model_id=model_id,
                chatbot_id=chatbot_id,
                config=config,
                message_id=assistant_message_id,
                avatar=ChatPreprocessor._resolve_avatar(chatbot_id, model_id)
            )
            yield ChatStreamResponse.error_response(
                error=e.message,
                chat_id=e.chat_id,
                user_message_id='',
                assistant_message_id=assistant_message_id or '',
                step_id=step_id,
                text=f"抱歉，发送消息时出现错误：{e.message}",
                avatar=ChatPreprocessor._resolve_avatar(chatbot_id, model_id)
            ).to_dict()
            return

        # 2. 聊天执行
        try:
            ChatStopManager().clear_stop(ctx.chat_id)
            async for result in ChatCoreService._run_conversation_loop(ctx):
                if isinstance(result, dict):
                    yield result
                elif isinstance(result, tuple) and len(result) == 3:
                    _, ctx.messages, _ = result
        except GeneratorExit:
            ChatStopManager().request_stop(ctx.chat_id)
        except Exception as e:
            print(f"Error in stream_chat: {e}")
        # 3. 聊天后置处理
        finally:
            ChatCoreService._postprocess(ctx)
    
    @staticmethod
    def chat(
        user_id: str,
        query: List[QueryItem],
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        chat_id: Optional[str] = None,
        config: Optional[Any] = None,
        message_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        assistant_message_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        非流式聊天

        Args:
            user_id: 用户ID
            query: 查询数组
            model_id: 模型ID
            chatbot_id: 机器人ID
            chat_id: 对话ID
            config: 配置（支持字符串或字典）
            message_id: 消息ID，用于标识重新回答或编辑问题
            system_prompt: 系统提示词
            assistant_message_id: 助手消息ID，如果前端已创建消息，传入此ID保持一致

        Returns:
            Dict: 响应数据
        """
        user_text = ChatCoreService.extract_text_from_query(query)
        
        # 处理config参数，统一转换为字典
        config_dict = {}
        if config:
            if isinstance(config, str):
                try:
                    config_dict = json.loads(config)
                except json.JSONDecodeError:
                    pass
            elif isinstance(config, dict):
                config_dict = config
        
        chatbot_config = None
        tools = None
        tool_map = None
        user_prompt_messages = None
        web_search_enabled = config_dict.get('web_search', False)
        # 如果配置文件中禁用了搜索引擎，强制关闭
        from app.configs.config import config as app_config
        if not app_config.get("web_search_engine.enabled", True):
            web_search_enabled = False
        
        # 使用机器人聊天
        if chatbot_id:
            try:
                chatbot_config = ChatCoreService.get_chatbot_config(chatbot_id)
                model_id = chatbot_config['model_id']
                system_prompt = chatbot_config['system_prompt']
                user_prompt_messages = chatbot_config['user_prompt_messages']
                tools = chatbot_config['tools'] if chatbot_config['tools'] else None
                tool_map = chatbot_config['tool_map']
                # 获取机器人模型关联表中的模型配置
                from app.database.models import ChatbotModel
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
            except ResourceNotFoundError as e:
                return {'error': str(e), 'chat_id': chat_id}
        
        # 注入内置工具（网络搜索和PPT生成等）
        from app.core.tools.tool_convert import ToolConvert
        tools, tool_map = ToolConvert.inject_builtin_tools(
            tools=tools,
            tool_map=tool_map,
            web_search_enabled=web_search_enabled
        )
        
        if not chat_id:
            title = user_text[:20] if len(user_text) > 20 else user_text
            # 当选择的是模型时，机器人id设为空；当选择的是机器人时，模型id设为空
            chat_model_id = model_id if not chatbot_id else None
            chat_chatbot_id = chatbot_id if not model_id else None
            chat = ChatService.create_chat(user_id, {
                'title': title,
                'model_id': chat_model_id,
                'chatbot_id': chat_chatbot_id,
                'config': json.dumps(config_dict) if config_dict else None,
                'system_prompt': system_prompt
            })
            chat_id = chat.id
            history_messages = []
        else:
            chat = ChatService.get_chat(chat_id, user_id)
            if not chat:
                raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
            
            try:
                history_messages = json.loads(chat.messages) if chat.messages else []
            except json.JSONDecodeError:
                history_messages = []
            
            if not chatbot_id:
                system_prompt = chat.system_prompt
        
        # 检查是否是重新回答（使用message_id或内容匹配）
        if message_id:
            # 使用message_id精确定位要重新回答的消息
            # 从数据库中获取消息，找到其在历史消息中的位置
            try:
                target_message = ChatMessage.get(
                    (ChatMessage.message_id == message_id) &
                    (ChatMessage.chat_id == chat_id) &
                    (ChatMessage.deleted == False)
                )
                # 查找历史消息中对应的消息 - 只根据 message_id 匹配，不比较 content
                for i in reversed(range(len(history_messages))):
                    msg = history_messages[i]
                    if msg.get('role') == 'user' and msg.get('message_id') == message_id:
                        # 移除从该用户消息开始的所有消息
                        history_messages = history_messages[:i]
                        break
            except ChatMessage.DoesNotExist:
                pass

        if chatbot_id and not chatbot_config:
            system_prompt = ChatCoreService.get_chatbot_system_prompt(chatbot_id)
        
        if not model_id:
            if chat.model_id:
                model_id = chat.model_id
            else:
                return {'error': '未指定模型', 'chat_id': chat_id}
        
        model_config, llm_config, model_type = ChatCoreService.get_model_config(model_id)
        
        # 现在获取了模型类型，转换查询为消息
        user_message = ChatCoreService.convert_query_to_message(query, model_type, model_id)
        
        model = LLMFactory.create_model(model_type, model_config)
        
        messages = ChatCoreService.build_messages(system_prompt, history_messages, user_message, user_prompt_messages)
        
        model_params = {}
        if llm_config:
            model_params.update(llm_config)
        if config_dict:
            model_params.update(config_dict)
            # 移除前端专用参数，不传给大模型
            model_params.pop('web_search', None)
            model_params.pop('deep_thinking', None)
        if tools is not None:
            model_params['tools'] = tools
        
        ChatService.update_chat_config(
            chat_id=chat_id,
            model_id=None if chatbot_id else model_id,
            chatbot_id= chatbot_id,
            config=config
        )
        
        from app.services.chat.file_utils import build_extra_content
        extra_content = build_extra_content(query)
        
        user_msg = ChatMessageService.create_user_message(
            chat_id=chat_id,
            user_content=user_text,
            model_id=model_id if not chatbot_id else None,
            chatbot_id=chatbot_id,
            config=config,
            message_id=message_id,
            extra_content=extra_content
        )
        user_message_id = user_msg.message_id
        # 如果前端已传入assistant_message_id，则使用它，否则生成新的ID
        if not assistant_message_id:
            assistant_message_id = uuid.uuid4().hex
        
        import time
        start_time = time.time()
        reasoning_end_time = None
        
        # 主循环：处理模型调用和工具调用
        while True:
            result = model.generate('', messages=messages, **model_params)
            
            if 'error' in result:
                return {'error': result['error'], 'chat_id': chat_id}
            
            full_response = result.get('text', '')
            full_reasoning = result.get('reasoning_content', '')
            tool_calls_list = result.get('tool_calls', [])
            
            # 检查是否需要调用工具
            if tool_calls_list and tool_map:
                messages.append({
                    'role': 'assistant',
                    'content': full_response,
                    'tool_calls': tool_calls_list
                })
                
                for tool_call in tool_calls_list:
                    function_name = tool_call.get('function', {}).get('name', '')
                    function_args_str = tool_call.get('function', {}).get('arguments', '{}')
                    tool_call_id = tool_call.get('id', '')
                    
                    try:
                        function_args = json.loads(function_args_str)
                    except json.JSONDecodeError:
                        tool_message_content = f"工具 {function_name} 调用失败: 参数解析错误"
                        messages.append({
                            'role': 'tool',
                            'tool_call_id': tool_call_id,
                            'content': tool_message_content
                        })
                        continue
                    
                    # 检查工具是否存在
                    tool_instance = tool_map.get(function_name)
                    if not tool_instance:
                        tool_message_content = f"工具 {function_name} 不存在"
                        messages.append({
                            'role': 'tool',
                            'tool_call_id': tool_call_id,
                            'content': tool_message_content
                        })
                        continue
                    
                    # 处理工具调用
                    tool_result = None
                    for result in process_tool_calls([tool_call], tool_map, chat_id):
                        tool_result = result
                        break
                    
                    if tool_result:
                        if 'error' in tool_result:
                            # 检查是否是缺少参数的错误
                            error_msg = tool_result['error']
                            if '缺少' in error_msg or '参数' in error_msg:
                                # 等待用户输入参数
                                return {
                                    'tool_call': {
                                        'name': function_name,
                                        'status': 'requires_input',
                                        'message': f"工具 {function_name} 需要输入参数",
                                        'requires_input': True,
                                        'tool_call_id': tool_call_id,
                                        'function_args': function_args
                                    },
                                    'chat_id': chat_id
                                }
                            else:
                                tool_message_content = f"工具 {function_name} 调用失败: {error_msg}"
                                messages.append({
                                    'role': 'tool',
                                    'tool_call_id': tool_call_id,
                                    'content': tool_message_content
                                })
                        else:
                            tool_message_content = json.dumps(tool_result.get('result'), ensure_ascii=False)
                            # 保存工具消息到数据库
                            ChatMessageService.create_tool_message(
                                chat_id=chat_id,
                                tool_content=tool_message_content,
                                model_id=model_id,
                                chatbot_id=chatbot_id,
                                config=config
                            )
                            messages.append({
                                'role': 'tool',
                                'tool_call_id': tool_call_id,
                                'content': tool_message_content
                            })
            else:
                # 没有工具调用，退出循环
                break
        
        reasoning_time = None
        if full_reasoning:
            reasoning_time = int((time.time() - start_time) * 1000)
        
        assistant_message_dict = {'role': 'assistant', 'content': full_response , 'message_id': assistant_message_id}
        if full_reasoning:
            assistant_message_dict['reasoning_content'] = full_reasoning

        model_answer_step_id = f"step_{uuid.uuid4().hex[:8]}"
        ChatMessageService.create_assistant_message(
            chat_id=chat_id,
            assistant_content=full_response,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config,
            reasoning_content=full_reasoning if full_reasoning else None,
            reasoning_time=reasoning_time,
            avatar=avatar,
            step=MessageStep.MODEL_ANSWER,
            step_id=model_answer_step_id,
            message_id=assistant_message_id
        )

        chat_messages = ChatMessageService.get_messages_by_chat(chat_id)
        updated_messages = []
        msg_idx = 0
        for i in range(len(messages)):
            if messages[i]['role'] != 'system':
                if msg_idx < len(chat_messages.items):
                    messages[i]['message_id'] = chat_messages.items[msg_idx].message_id
                    messages[i]['reasoning_content'] = chat_messages.items[msg_idx].reasoning_content
                msg_idx += 1
            updated_messages.append(messages[i])
        # updated_messages = [{"role": msg.role, "content": msg.content , "reasoning_content": msg.reasoning_content , "message_id": msg.message_id} for msg in chat_messages.items if not msg.role != 'system']
        # system_message = messages[0] if messages else None
        # if system_message:
        #     updated_messages.insert(0, system_message)
        updated_messages.append(assistant_message_dict)
        ChatService.update_messages(chat_id, updated_messages)

        return {
            'text': full_response,
            'reasoning_content': result.get('reasoning_content'),
            'usage': result.get('usage'),
            'chat_id': chat_id,
            'user_message_id': user_message_id,
            'assistant_message_id': assistant_message_id
        }
