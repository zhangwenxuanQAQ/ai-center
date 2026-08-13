"""
聊天事件类定义

所有聊天相关事件的统一定义文件，包含：
    - BaseEvent:         事件基类
    - ChatRequestEvent:  前端发起的聊天请求事件
    - ChatStreamEvent:   聊天流式输出的单个 chunk 事件
    - ChatStopEvent:     停止聊天事件
    - ChatDoneEvent:     聊天完成事件

每个事件通过 Redis Stream 传递，使用 JSON 序列化。
"""

import uuid
import time
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List


@dataclass
class BaseEvent:
    """
    事件基类

    所有聊天相关事件的公共属性：
        - event_id: 事件唯一ID（自动生成）
        - event_type: 事件类型（由子类定义）
        - chat_id: 对话ID
        - timestamp: 事件时间戳（毫秒）
        - data: 事件携带的业务数据

    序列化/反序列化通过 to_dict / from_dict 方法完成，
    事件在 Redis Stream 中以 JSON 字符串形式存储。
    """
    event_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    event_type: str = ''
    chat_id: str = ''
    timestamp: int = field(default_factory=lambda: int(time.time() * 1000))
    data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return asdict(self)

    def to_json_str(self) -> str:
        """序列化为JSON字符串"""
        import json
        return json.dumps(self.to_dict(), ensure_ascii=False)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BaseEvent':
        """从字典反序列化"""
        return cls(
            event_id=data.get('event_id', ''),
            event_type=data.get('event_type', ''),
            chat_id=data.get('chat_id', ''),
            timestamp=data.get('timestamp', 0),
            data=data.get('data', {}),
        )

    @classmethod
    def from_json_str(cls, json_str: str) -> 'BaseEvent':
        """从JSON字符串反序列化"""
        import json
        return cls.from_dict(json.loads(json_str))


@dataclass
class ChatRequestEvent(BaseEvent):
    """
    聊天请求事件

    携带前端发起聊天所需的全部参数，消费者收到后执行聊天预处理和流式生成。

    data 字段结构：
        - user_id: 用户ID
        - query: 查询数组（List[QueryItem] 序列化后的列表）
        - model_id: 模型ID
        - chatbot_id: 机器人ID
        - chat_id: 对话ID（空则创建新对话）
        - config: 配置（字符串或字典）
        - message_id: 消息ID，用于标识重新回答或编辑问题
        - system_prompt: 系统提示词
        - assistant_message_id: 助手消息ID
    """
    event_type: str = 'chat_request'

    @classmethod
    def create(
        cls,
        chat_id: str,
        user_id: str,
        query: List[Dict[str, Any]],
        model_id: Optional[str] = None,
        chatbot_id: Optional[str] = None,
        config: Optional[Any] = None,
        message_id: Optional[str] = None,
        system_prompt: Optional[str] = None,
        assistant_message_id: Optional[str] = None,
    ) -> 'ChatRequestEvent':
        """
        创建聊天请求事件

        Args:
            chat_id: 对话ID（用于结果队列路由）
            user_id: 用户ID
            query: 查询数组
            model_id: 模型ID
            chatbot_id: 机器人ID
            config: 配置
            message_id: 消息ID
            system_prompt: 系统提示词
            assistant_message_id: 助手消息ID

        Returns:
            ChatRequestEvent: 聊天请求事件实例
        """
        return cls(
            chat_id=chat_id,
            data={
                'user_id': user_id,
                'query': query,
                'model_id': model_id,
                'chatbot_id': chatbot_id,
                'config': config,
                'message_id': message_id,
                'system_prompt': system_prompt,
                'assistant_message_id': assistant_message_id,
            },
        )


@dataclass
class ChatStreamEvent(BaseEvent):
    """
    聊天流式事件

    携带单个流式 chunk 的数据，与原有 ChatStreamResponse.to_dict() 的输出格式一致，
    确保前端 yield 到的数据保持不变。

    data 字段即为原始的流式响应字典，包含 text、reasoning_content、tool_call 等字段。
    """
    event_type: str = 'chat_stream'

    @classmethod
    def create(cls, chat_id: str, stream_data: Dict[str, Any]) -> 'ChatStreamEvent':
        """
        创建流式事件

        Args:
            chat_id: 对话ID
            stream_data: 流式响应数据（ChatStreamResponse.to_dict() 的结果）

        Returns:
            ChatStreamEvent: 流式事件实例
        """
        return cls(
            chat_id=chat_id,
            data=stream_data,
        )


@dataclass
class IntegrationChatRequestEvent(BaseEvent):
    """
    插件集成聊天请求事件

    携带插件集成聊天所需的全部参数，消费者收到后执行 IntegrationChatCoreService.chat_stream。

    data 字段结构：
        - query: 查询数组（List[QueryItem] 序列化后的列表）
        - chat_id: 对话ID（空则创建新对话）
        - integration_id: 集成配置ID
        - integration_api_key: 集成配置API Key（用于重新加载 integration 对象）
        - temporary: 是否临时会话
        - config: 配置
        - edit_message_id: 编辑消息ID
        - preview_token: 预览token
    """
    event_type: str = 'integration_chat_request'

    @classmethod
    def create(
        cls,
        chat_id: str,
        query: List[Dict[str, Any]],
        integration_id: Any,
        integration_api_key: str,
        temporary: bool = False,
        config: Optional[Any] = None,
        edit_message_id: Optional[str] = None,
        preview_token: Optional[str] = None,
    ) -> 'IntegrationChatRequestEvent':
        return cls(
            chat_id=chat_id,
            data={
                'query': query,
                'integration_id': str(integration_id),
                'integration_api_key': integration_api_key,
                'temporary': temporary,
                'config': config,
                'edit_message_id': edit_message_id,
                'preview_token': preview_token,
            },
        )


@dataclass
class ChatStopEvent(BaseEvent):
    """
    聊天停止事件

    携带需要停止的对话ID，消费者收到后设置停止标记。

    data 字段结构：
        - chat_id: 需要停止的对话ID（与事件顶层 chat_id 相同，便于消费者路由）
    """
    event_type: str = 'chat_stop'

    @classmethod
    def create(cls, chat_id: str) -> 'ChatStopEvent':
        """
        创建停止事件

        Args:
            chat_id: 对话ID

        Returns:
            ChatStopEvent: 停止事件实例
        """
        return cls(
            chat_id=chat_id,
            data={'chat_id': chat_id},
        )


@dataclass
class ChatDoneEvent(BaseEvent):
    """
    聊天完成事件

    携带完成状态（done/error/stop），消费者在聊天流程结束后发布此事件。

    data 字段结构：
        - status: 完成状态（done/error/stop）
        - error: 错误信息（仅 status=error 时存在）
    """
    event_type: str = 'chat_done'

    @classmethod
    def create(cls, chat_id: str, status: str = 'done', error: Optional[str] = None) -> 'ChatDoneEvent':
        """
        创建完成事件

        Args:
            chat_id: 对话ID
            status: 完成状态（done/error/stop）
            error: 错误信息

        Returns:
            ChatDoneEvent: 完成事件实例
        """
        data = {'status': status}
        if error:
            data['error'] = error
        return cls(
            chat_id=chat_id,
            data=data,
        )
