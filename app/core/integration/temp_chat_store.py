"""
临时聊天存储服务

使用Redis存储临时会话的聊天记录和消息，支持设置过期时间。
与预览页的超时时间保持一致（1小时）。
"""

import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.database.redis_utils import redis_utils

logger = logging.getLogger(__name__)


class TempChatStore:
    """
    临时聊天存储服务
    
    使用Redis存储临时会话数据：
    - 聊天记录列表
    - 每条消息
    
    Redis Key设计：
    - integration:temp:chat:{scope_id}:{chat_id} - 聊天基本信息
    - integration:temp:chat:{scope_id}:{chat_id}:messages - 消息列表（Redis List）
    - integration:temp:chats:{scope_id} - 该scope下的所有临时聊天ID列表（Redis List）
    
    scope_id默认为integration_id，当使用预览模式时可传入
    "{integration_id}:preview:{preview_token}"实现不同预览token之间的数据隔离。
    """

    CHAT_PREFIX = "integration:temp:chat:"
    CHATS_LIST_PREFIX = "integration:temp:chats:"
    MESSAGES_SUFFIX = ":messages"

    EXPIRE_SECONDS = 3600

    @classmethod
    def _get_scope_id(cls, integration_id: str, scope_id: Optional[str] = None) -> str:
        """获取实际的scope_id，如果未提供则使用integration_id"""
        return scope_id if scope_id else integration_id

    @classmethod
    def _get_chat_key(cls, scope_id: str, chat_id: str) -> str:
        return f"{cls.CHAT_PREFIX}{scope_id}:{chat_id}"

    @classmethod
    def _get_messages_key(cls, scope_id: str, chat_id: str) -> str:
        return f"{cls.CHAT_PREFIX}{scope_id}:{chat_id}{cls.MESSAGES_SUFFIX}"

    @classmethod
    def _get_chats_list_key(cls, scope_id: str) -> str:
        return f"{cls.CHATS_LIST_PREFIX}{scope_id}"

    @classmethod
    def is_available(cls) -> bool:
        return redis_utils.is_available

    @classmethod
    def create_chat(cls, integration_id: str, chat_id: str, chatbot_id: str, title: str = "", scope_id: Optional[str] = None) -> bool:
        if not cls.is_available():
            return False

        try:
            sid = cls._get_scope_id(integration_id, scope_id)
            chat_data = {
                "id": chat_id,
                "integration_id": integration_id,
                "chatbot_id": chatbot_id,
                "title": title,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "temporary": True,
            }

            chat_key = cls._get_chat_key(sid, chat_id)
            redis_utils.set_obj(chat_key, chat_data, exp=cls.EXPIRE_SECONDS)

            chats_list_key = cls._get_chats_list_key(sid)
            redis_utils.client.lpush(chats_list_key, chat_id)
            redis_utils.client.expire(chats_list_key, cls.EXPIRE_SECONDS)

            return True
        except Exception as e:
            logger.error(f"创建临时聊天失败: {e}")
            return False

    @classmethod
    def get_chat(cls, integration_id: str, chat_id: str, scope_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not cls.is_available():
            return None

        try:
            sid = cls._get_scope_id(integration_id, scope_id)
            chat_key = cls._get_chat_key(sid, chat_id)
            data = redis_utils.get(chat_key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"获取临时聊天失败: {e}")
            return None

    @classmethod
    def update_chat(cls, integration_id: str, chat_id: str, scope_id: Optional[str] = None, **kwargs) -> bool:
        if not cls.is_available():
            return False

        try:
            sid = cls._get_scope_id(integration_id, scope_id)
            chat = cls.get_chat(integration_id, chat_id, scope_id=scope_id)
            if not chat:
                return False

            chat.update(kwargs)
            chat["updated_at"] = datetime.now().isoformat()

            chat_key = cls._get_chat_key(sid, chat_id)
            redis_utils.set_obj(chat_key, chat, exp=cls.EXPIRE_SECONDS)

            return True
        except Exception as e:
            logger.error(f"更新临时聊天失败: {e}")
            return False

    @classmethod
    def list_chats(cls, integration_id: str, scope_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if not cls.is_available():
            return []

        try:
            sid = cls._get_scope_id(integration_id, scope_id)
            chats_list_key = cls._get_chats_list_key(sid)
            chat_ids = redis_utils.client.lrange(chats_list_key, 0, -1) or []

            chats = []
            for chat_id in chat_ids:
                chat = cls.get_chat(integration_id, chat_id, scope_id=scope_id)
                if chat:
                    chats.append(chat)

            return chats
        except Exception as e:
            logger.error(f"获取临时聊天列表失败: {e}")
            return []

    @classmethod
    def add_message(cls, integration_id: str, chat_id: str, message: Dict[str, Any], scope_id: Optional[str] = None) -> bool:
        if not cls.is_available():
            return False

        try:
            sid = cls._get_scope_id(integration_id, scope_id)
            messages_key = cls._get_messages_key(sid, chat_id)
            redis_utils.client.rpush(messages_key, json.dumps(message, ensure_ascii=False))
            redis_utils.client.expire(messages_key, cls.EXPIRE_SECONDS)

            cls.update_chat(integration_id, chat_id, scope_id=scope_id)

            return True
        except Exception as e:
            logger.error(f"添加临时消息失败: {e}")
            return False

    @classmethod
    def get_messages(cls, integration_id: str, chat_id: str, scope_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if not cls.is_available():
            return []

        try:
            sid = cls._get_scope_id(integration_id, scope_id)
            messages_key = cls._get_messages_key(sid, chat_id)
            raw_messages = redis_utils.client.lrange(messages_key, 0, -1) or []

            messages = []
            for raw in raw_messages:
                try:
                    messages.append(json.loads(raw))
                except:
                    pass

            return messages
        except Exception as e:
            logger.error(f"获取临时消息失败: {e}")
            return []

    @classmethod
    def update_message(cls, integration_id: str, chat_id: str, message_id: str, scope_id: Optional[str] = None, **kwargs) -> bool:
        if not cls.is_available():
            return False

        try:
            sid = cls._get_scope_id(integration_id, scope_id)
            messages_key = cls._get_messages_key(sid, chat_id)
            raw_messages = redis_utils.client.lrange(messages_key, 0, -1) or []

            updated = False
            new_messages = []
            for raw in raw_messages:
                try:
                    msg = json.loads(raw)
                    if msg.get("id") == message_id or msg.get("message_id") == message_id:
                        msg.update(kwargs)
                        updated = True
                    new_messages.append(json.dumps(msg, ensure_ascii=False))
                except:
                    new_messages.append(raw)

            if updated:
                redis_utils.client.delete(messages_key)
                if new_messages:
                    redis_utils.client.rpush(messages_key, *new_messages)
                redis_utils.client.expire(messages_key, cls.EXPIRE_SECONDS)
                cls.update_chat(integration_id, chat_id, scope_id=scope_id)

            return updated
        except Exception as e:
            logger.error(f"更新临时消息失败: {e}")
            return False

    @classmethod
    def clear_messages_after(cls, integration_id: str, chat_id: str, message_index: int, scope_id: Optional[str] = None) -> bool:
        if not cls.is_available():
            return False

        try:
            sid = cls._get_scope_id(integration_id, scope_id)
            messages_key = cls._get_messages_key(sid, chat_id)
            raw_messages = redis_utils.client.lrange(messages_key, 0, -1) or []

            if message_index < 0 or message_index >= len(raw_messages):
                return False

            remaining = raw_messages[:message_index]
            redis_utils.client.delete(messages_key)
            if remaining:
                redis_utils.client.rpush(messages_key, *remaining)
            redis_utils.client.expire(messages_key, cls.EXPIRE_SECONDS)
            cls.update_chat(integration_id, chat_id, scope_id=scope_id)

            return True
        except Exception as e:
            logger.error(f"清除临时消息失败: {e}")
            return False
