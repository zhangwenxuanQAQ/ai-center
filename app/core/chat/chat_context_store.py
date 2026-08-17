"""
聊天上下文管理

提供停止聊天上下文的保存/读取/清理功能，
用于停止聊天时保存/恢复流式生成过程中的中间状态。
"""

import logging
from typing import Optional, Dict, Any

from app.database.redis_utils import redis_utils

logger = logging.getLogger(__name__)


class ChatContextStore:
    """
    聊天上下文管理

    停止聊天上下文的保存/读取/清理。
    """

    # 聊天上下文前缀（用于停止时保存/恢复所需参数）
    CONTEXT_PREFIX = 'chat:event:context:'

    # 过期时间（秒）：2小时
    EXPIRE_SECONDS = 7200

    # ==================== 聊天上下文管理 ====================

    @classmethod
    def save_chat_context(cls, chat_id: str, context: dict):
        """
        保存聊天上下文到Redis（供停止时恢复使用）

        聊天循环中实时更新此上下文，停止接口从中读取参数。

        Args:
            chat_id: 对话ID
            context: 上下文字典，包含停止恢复所需的全部参数
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
