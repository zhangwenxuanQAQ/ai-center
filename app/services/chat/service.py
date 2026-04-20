"""
对话服务类，提供对话相关的CRUD操作
"""

import uuid
import json
from datetime import datetime
from typing import List, Optional, Tuple, Any
from peewee import fn

from app.database.models import Chat, ChatMessage
from app.services.chat.dto import (
    ChatCreate, ChatUpdate, Chat as ChatDTO,
    ChatMessageCreate, ChatMessage as ChatMessageDTO,
    ChatListResponse, ChatMessageListResponse
)
from app.database.db_utils import handle_transaction
from app.database.database import get_db_connection
from app.core.exceptions import ResourceNotFoundError


class ChatService:
    """
    对话服务类
    
    提供对话的创建、查询、更新、删除、置顶、排序等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_chat(user_id: str, chat_create: ChatCreate) -> Chat:
        """
        创建对话
        
        Args:
            user_id: 用户ID
            chat_create: 对话创建DTO
            
        Returns:
            Chat: 创建的对话对象
        """
        import json
        from app.constants.llm_constants import MODEL_CONFIG_PARAMS
        from app.database.models import LLMModel
        
        # 处理配置参数
        config = chat_create.config
        if not config and chat_create.model_id:
            # 如果没有配置参数且有模型ID，使用模型类型的默认参数
            try:
                model = LLMModel.get(LLMModel.id == chat_create.model_id)
                model_type = model.model_type
                # 从 MODEL_CONFIG_PARAMS 中获取默认参数
                if model_type in MODEL_CONFIG_PARAMS:
                    default_params = {}
                    for param in MODEL_CONFIG_PARAMS[model_type]:
                        default_params[param['key']] = param['default']
                    config = default_params
            except LLMModel.DoesNotExist:
                pass
        
        db_chat = Chat(
            user_id=user_id,
            title=chat_create.title,
            model_id=chat_create.model_id,
            chatbot_id=chat_create.chatbot_id,
            config=json.dumps(config) if config else None,
            system_prompt=chat_create.system_prompt,
            messages='[]'
        )
        db_chat.save(force_insert=True)
        return db_chat
    
    @staticmethod
    def get_chat_list(user_id: str, page: int = 1, page_size: int = 20, keyword: Optional[str] = None) -> ChatListResponse:
        """
        获取用户的对话列表（分页）
        
        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页数量
            keyword: 搜索关键词
            
        Returns:
            ChatListResponse: 对话列表响应
        """
        from app.database.database import get_db_connection
        
        get_db_connection()
        
        query = Chat.select().where(
            (Chat.user_id == user_id) & 
            (Chat.deleted == False)
        )
        
        if keyword:
            query = query.where(Chat.title.contains(keyword))
        
        total = query.count()
        
        chats = query.order_by(
            Chat.is_top.desc(),
            Chat.sort_order.desc(),
            Chat.updated_at.desc()
        ).offset((page - 1) * page_size).limit(page_size)
        
        items = [ChatDTO.model_validate(chat) for chat in chats]
        
        return ChatListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size
        )
    
    @staticmethod
    def get_chat(chat_id: str, user_id: str) -> Optional[Chat]:
        """
        获取单个对话
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            
        Returns:
            Chat: 对话对象，不存在则返回None
        """
        try:
            return Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_chat(chat_id: str, user_id: str, chat_update: ChatUpdate) -> Chat:
        """
        更新对话
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            chat_update: 对话更新DTO
            
        Returns:
            Chat: 更新后的对话对象
            
        Raises:
            ResourceNotFoundError: 对话不存在
        """
        try:
            db_chat = Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        import json
        update_data = chat_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == 'config' and value:
                setattr(db_chat, field, json.dumps(value))
            else:
                setattr(db_chat, field, value)
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def delete_chat(chat_id: str, user_id: str) -> Chat:
        """
        删除对话（软删除）
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            
        Returns:
            Chat: 被删除的对话对象
            
        Raises:
            ResourceNotFoundError: 对话不存在
        """
        try:
            db_chat = Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        # 软删除相关的聊天消息
        ChatMessage.update(
            deleted=True,
            deleted_at=datetime.now()
        ).where(
            (ChatMessage.chat_id == chat_id) &
            (ChatMessage.deleted == False)
        ).execute()
        
        db_chat.deleted = True
        db_chat.deleted_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def toggle_top(chat_id: str, user_id: str) -> Chat:
        """
        切换对话置顶状态
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            
        Returns:
            Chat: 更新后的对话对象
            
        Raises:
            ResourceNotFoundError: 对话不存在
        """
        try:
            db_chat = Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        db_chat.is_top = not db_chat.is_top
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def update_sort_order(chat_id: str, user_id: str, sort_order: int) -> Chat:
        """
        更新对话排序序号
        
        Args:
            chat_id: 对话ID
            user_id: 用户ID
            sort_order: 排序序号
            
        Returns:
            Chat: 更新后的对话对象
            
        Raises:
            ResourceNotFoundError: 对话不存在
        """
        try:
            db_chat = Chat.get(
                (Chat.id == chat_id) & 
                (Chat.user_id == user_id) & 
                (Chat.deleted == False)
            )
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        db_chat.sort_order = sort_order
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def update_messages(chat_id: str, messages: List[dict]) -> Chat:
        """
        更新对话消息列表
        
        Args:
            chat_id: 对话ID
            messages: 消息列表
            
        Returns:
            Chat: 更新后的对话对象
        """
        try:
            db_chat = Chat.get(Chat.id == chat_id)
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        db_chat.messages = json.dumps(messages, ensure_ascii=False)
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat
    
    @staticmethod
    @handle_transaction
    def update_chat_config(
        chat_id: str,
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        config: Optional[Any] = None
    ) -> Chat:
        """
        更新对话配置信息
        
        Args:
            chat_id: 对话ID
            model_id: 模型ID
            chatbot_id: 机器人ID
            config: 配置JSON（支持字符串或字典）
            
        Returns:
            Chat: 更新后的对话对象
        """
        try:
            db_chat = Chat.get(Chat.id == chat_id)
        except Chat.DoesNotExist:
            raise ResourceNotFoundError(message=f"对话 {chat_id} 不存在")
        
        if model_id is not None:
            db_chat.model_id = model_id
        if chatbot_id is not None:
            db_chat.chatbot_id = chatbot_id
        if config is not None:
            # 确保config作为JSON字符串保存
            if isinstance(config, dict):
                db_chat.config = json.dumps(config)
            elif isinstance(config, str):
                db_chat.config = config
            else:
                db_chat.config = json.dumps(config)
        
        db_chat.updated_at = datetime.now()
        db_chat.save()
        return db_chat


class ChatMessageService:
    """
    对话消息服务类
    
    提供对话消息的创建、查询等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_message(message_create: ChatMessageCreate) -> ChatMessage:
        """
        创建对话消息
        
        Args:
            message_create: 消息创建DTO
            
        Returns:
            ChatMessage: 创建的消息对象
        """
        db_message = ChatMessage(**message_create.model_dump())
        db_message.save(force_insert=True)
        return db_message
    
    @staticmethod
    def get_messages_by_chat(chat_id: str) -> ChatMessageListResponse:
        """
        获取对话的消息列表
        
        Args:
            chat_id: 对话ID
            
        Returns:
            ChatMessageListResponse: 消息列表响应
        """
        # 按创建时间升序排序，同一时间内用户消息排在助手消息前面
        messages = ChatMessage.select().where(
            (ChatMessage.chat_id == chat_id) & 
            (ChatMessage.deleted == False)
        ).order_by(ChatMessage.created_at.asc(), ChatMessage.role.desc())
        
        total = messages.count()
        items = [ChatMessageDTO.model_validate(msg) for msg in messages]
        
        return ChatMessageListResponse(items=items, total=total)
    
    @staticmethod
    @handle_transaction
    def clear_messages_by_chat(chat_id: str) -> None:
        """
        清空对话的所有消息
        
        Args:
            chat_id: 对话ID
        """
        # 软删除对话的所有消息
        ChatMessage.update(
            deleted=True,
            deleted_at=datetime.now()
        ).where(
            (ChatMessage.chat_id == chat_id) &
            (ChatMessage.deleted == False)
        ).execute()
        
        # 清空chat表的messages字段
        Chat.update(messages='[]').where(Chat.id == chat_id).execute()
    
    @staticmethod
    @handle_transaction
    def cleanup_old_messages(chat_id: str, user_content: str) -> None:
        """
        清理重新回答时的旧消息

        当用户重新回答时，删除与当前用户消息内容相同的消息之后的所有消息，
        保留该用户消息本身（因为会创建新的用户消息）

        Args:
            chat_id: 对话ID
            user_content: 用户消息内容
        """
        # 查找与当前用户消息内容相同的所有消息
        user_messages = ChatMessage.select().where(
            (ChatMessage.chat_id == chat_id) &
            (ChatMessage.role == 'user') &
            (ChatMessage.content == user_content) &
            (ChatMessage.deleted == False)
        ).order_by(ChatMessage.created_at.desc())

        for user_message in user_messages:
            # 删除该用户消息和之后的所有消息
            ChatMessage.update(deleted=True, deleted_at=datetime.now()).where(
                (ChatMessage.chat_id == chat_id) &
                (ChatMessage.created_at >= user_message.created_at) &
                (ChatMessage.deleted == False)
            ).execute()
            break  # 只处理最新的一条
    
    @staticmethod
    @handle_transaction
    def cleanup_old_messages_by_message_id(chat_id: str, message_id: str) -> bool:
        """
        根据消息ID清理旧消息

        当重新回答或编辑问题时，删除该消息之后的所有消息（保留该消息本身）

        Args:
            chat_id: 对话ID
            message_id: 消息ID

        Returns:
            bool: 是否找到并清理了消息
        """
        target_message = ChatMessage.select().where(
            (ChatMessage.chat_id == chat_id) &
            (ChatMessage.message_id == message_id) &
            (ChatMessage.deleted == False)
        ).order_by(ChatMessage.created_at.asc()).first()

        if target_message:
            # 只删除目标消息和之后的所有消息
            ChatMessage.update(deleted=True, deleted_at=datetime.now()).where(
                (ChatMessage.chat_id == chat_id) &
                (ChatMessage.created_at >= target_message.created_at) &
                (ChatMessage.deleted == False)
            ).execute()
            return True
        return False

    @staticmethod
    @handle_transaction
    def create_user_message(
        chat_id: str,
        user_content: str,
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        config: Optional[str] = None,
        message_id: Optional[str] = None,
        extra_content: Optional[Any] = None
    ) -> ChatMessage:
        """
        创建用户消息

        Args:
            chat_id: 对话ID
            user_content: 用户消息内容
            model_id: 模型ID
            chatbot_id: 机器人ID
            config: 配置JSON
            message_id: 消息ID，用于标识重新回答或编辑问题
            extra_content: 额外内容，如上传的文件信息

        Returns:
            ChatMessage: 用户消息对象
        """
        # 如果提供了message_id，使用message_id进行清理
        if message_id:
            # 先尝试通过message_id清理
            ChatMessageService.cleanup_old_messages_by_message_id(chat_id, message_id)
        else:
            # 对于新消息，不清理任何旧消息
            # 只在有message_id时进行清理，确保历史消息不会被意外删除
            pass

        import json
        extra_content_str = None
        if extra_content is not None:
            if isinstance(extra_content, (dict, list)):
                extra_content_str = json.dumps(extra_content, ensure_ascii=False)
            else:
                extra_content_str = str(extra_content)

        user_message = ChatMessage(
            message_id=uuid.uuid4().hex,
            chat_id=chat_id,
            config=config,
            role='user',
            content=user_content,
            extra_content=extra_content_str,
            model_id=model_id,
            chatbot_id=chatbot_id,
            created_at=datetime.now().astimezone()
        )
        user_message.save(force_insert=True)
        return user_message
    
    @staticmethod
    @handle_transaction
    def create_assistant_message(
        chat_id: str,
        assistant_content: str,
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        config: Optional[str] = None,
        reasoning_content: Optional[str] = None,
        reasoning_time: Optional[int] = None,
        avatar: Optional[str] = None
    ) -> ChatMessage:
        """
        创建助手消息
        
        Args:
            chat_id: 对话ID
            assistant_content: 助手消息内容
            model_id: 模型ID
            chatbot_id: 机器人ID
            config: 配置JSON
            reasoning_content: 思考过程内容
            reasoning_time: 思考耗时（毫秒）
            avatar: 头像URL
            
        Returns:
            ChatMessage: 助手消息对象
        """
        # 确保助手消息的创建时间总是晚于用户消息
        # 使用当前时间，并添加一个微小的延迟以确保时间戳不同
        import time
        time.sleep(0.001)  # 1毫秒延迟
        assistant_message = ChatMessage(
            message_id=uuid.uuid4().hex,
            chat_id=chat_id,
            config=config,
            role='assistant',
            content=assistant_content,
            reasoning_content=reasoning_content,
            reasoning_time=reasoning_time,
            avatar=avatar,
            model_id=model_id,
            chatbot_id=chatbot_id,
            created_at=datetime.now().astimezone()
        )
        assistant_message.save(force_insert=True)
        return assistant_message
    
    @staticmethod
    @handle_transaction
    def create_tool_message(
        chat_id: str,
        tool_content: str,
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        config: Optional[str] = None
    ) -> ChatMessage:
        """
        创建工具消息
        
        Args:
            chat_id: 对话ID
            tool_content: 工具消息内容
            model_id: 模型ID
            chatbot_id: 机器人ID
            config: 配置JSON
            
        Returns:
            ChatMessage: 工具消息对象
        """
        # 确保工具消息的创建时间总是晚于助手消息
        import time
        time.sleep(0.001)  # 1毫秒延迟
        tool_message = ChatMessage(
            message_id=uuid.uuid4().hex,
            chat_id=chat_id,
            config=config,
            role='tool',
            content=tool_content,
            model_id=model_id,
            chatbot_id=chatbot_id,
            created_at=datetime.now().astimezone()
        )
        tool_message.save(force_insert=True)
        return tool_message

    @staticmethod
    @handle_transaction
    def create_user_and_assistant_messages(
        chat_id: str,
        user_content: str,
        assistant_content: str,
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        config: Optional[str] = None,
        reasoning_content: Optional[str] = None,
        avatar: Optional[str] = None
    ) -> Tuple[ChatMessage, ChatMessage]:
        """
        创建用户消息和助手消息（已废弃，建议使用单独的创建方法）
        
        注意：此方法同时创建两条消息，时间戳会几乎相同。
        建议使用 create_user_message 和 create_assistant_message 分别创建，
        以记录准确的发送时间和回复时间。
        
        Args:
            chat_id: 对话ID
            user_content: 用户消息内容
            assistant_content: 助手消息内容
            model_id: 模型ID
            chatbot_id: 机器人ID
            config: 配置JSON
            reasoning_content: 思考过程内容
            avatar: 头像URL
            
        Returns:
            Tuple[ChatMessage, ChatMessage]: 用户消息和助手消息
        """
        user_message = ChatMessageService.create_user_message(
            chat_id=chat_id,
            user_content=user_content,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config
        )
        
        assistant_message = ChatMessageService.create_assistant_message(
            chat_id=chat_id,
            assistant_content=assistant_content,
            model_id=model_id,
            chatbot_id=chatbot_id,
            config=config,
            reasoning_content=reasoning_content,
            avatar=avatar
        )
        
        return user_message, assistant_message
