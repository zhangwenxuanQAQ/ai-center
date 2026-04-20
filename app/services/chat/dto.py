"""
对话数据传输对象（DTO）
"""

import json
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from app.services.base_dto import BaseDTO


class ChatBase(BaseModel):
    """
    对话基础DTO
    
    Attributes:
        title: 对话标题
        model_id: 模型ID
        chatbot_id: 机器人ID
        config: 对话配置JSON
        sort_order: 排序序号
        is_top: 是否置顶
        system_prompt: 系统提示词
        messages: 对话消息列表JSON
    """
    title: Optional[str] = Field(None, max_length=255, description="对话标题")
    model_id: Optional[str] = Field(None, max_length=40, description="模型ID")
    chatbot_id: Optional[str] = Field(None, max_length=40, description="机器人ID")
    config: Optional[dict] = Field(None, description="对话配置JSON")
    sort_order: Optional[int] = Field(0, description="排序序号")
    is_top: Optional[bool] = Field(False, description="是否置顶")
    system_prompt: Optional[str] = Field(None, description="系统提示词")
    messages: Optional[list] = Field(None, description="对话消息列表JSON")
    
    @field_validator('config', mode='before')
    @classmethod
    def parse_config(cls, v):
        """解析config字段，支持字符串和字典类型"""
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return None
    
    @field_validator('messages', mode='before')
    @classmethod
    def parse_messages(cls, v):
        """解析messages字段，支持字符串和列表类型"""
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return None


class ChatCreate(BaseModel):
    """
    对话创建DTO
    
    Attributes:
        title: 对话标题
        model_id: 模型ID
        chatbot_id: 机器人ID
        config: 对话配置JSON
        system_prompt: 系统提示词
    """
    title: str = Field(..., max_length=255, description="对话标题")
    model_id: Optional[str] = Field(None, max_length=40, description="模型ID")
    chatbot_id: Optional[str] = Field(None, max_length=40, description="机器人ID")
    config: Optional[dict] = Field(None, description="对话配置JSON")
    system_prompt: Optional[str] = Field(None, description="系统提示词")


class ChatUpdate(BaseModel):
    """
    对话更新DTO
    
    Attributes:
        title: 对话标题
        model_id: 模型ID
        chatbot_id: 机器人ID
        config: 对话配置JSON
        system_prompt: 系统提示词
    """
    title: Optional[str] = Field(None, max_length=255, description="对话标题")
    model_id: Optional[str] = Field(None, max_length=40, description="模型ID")
    chatbot_id: Optional[str] = Field(None, max_length=40, description="机器人ID")
    config: Optional[dict] = Field(None, description="对话配置JSON")
    system_prompt: Optional[str] = Field(None, description="系统提示词")


class Chat(ChatBase, BaseDTO):
    """
    对话响应DTO
    
    继承自ChatBase和BaseDTO，包含对话基本信息和公共字段
    """
    user_id: str = Field(..., description="用户ID")
    
    class Config:
        from_attributes = True


class ChatMessageBase(BaseModel):
    """
    对话消息基础DTO
    
    Attributes:
        message_id: 消息ID
        chat_id: 对话ID
        config: 消息配置JSON
        messages: 消息内容JSON
        role: 角色
        content: 消息内容
        extra_content: 额外内容JSON
        reasoning_content: 思考过程内容
        reasoning_time: 思考耗时（毫秒）
        avatar: 头像URL
        model_id: 模型ID
        chatbot_id: 机器人ID
    """
    message_id: str = Field(..., max_length=40, description="消息ID")
    chat_id: str = Field(..., max_length=40, description="对话ID")
    config: Optional[str] = Field(None, description="消息配置JSON")
    messages: Optional[str] = Field(None, description="消息内容JSON")
    role: str = Field(..., max_length=20, description="角色：user/assistant/tool")
    content: str = Field(..., description="消息内容")
    extra_content: Optional[Any] = Field(None, description="额外内容JSON")
    reasoning_content: Optional[str] = Field(None, description="思考过程内容")
    reasoning_time: Optional[int] = Field(None, description="思考耗时（毫秒）")
    avatar: Optional[str] = Field(None, max_length=500, description="头像URL")
    model_id: Optional[str] = Field(None, max_length=40, description="模型ID")
    chatbot_id: Optional[str] = Field(None, max_length=40, description="机器人ID")
    
    @field_validator('extra_content', mode='before')
    @classmethod
    def parse_extra_content(cls, v):
        """解析extra_content字段，支持字符串和字典类型"""
        if v is None:
            return None
        if isinstance(v, (dict, list)):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return None


class ChatMessageCreate(BaseModel):
    """
    对话消息创建DTO
    
    Attributes:
        message_id: 消息ID
        chat_id: 对话ID
        config: 消息配置JSON
        messages: 消息内容JSON
        role: 角色
        content: 消息内容
        extra_content: 额外内容JSON
        model_id: 模型ID
        chatbot_id: 机器人ID
    """
    message_id: str = Field(..., max_length=40, description="消息ID")
    chat_id: str = Field(..., max_length=40, description="对话ID")
    config: Optional[str] = Field(None, description="消息配置JSON")
    messages: Optional[str] = Field(None, description="消息内容JSON")
    role: str = Field(..., max_length=20, description="角色：user/assistant/tool")
    content: str = Field(..., description="消息内容")
    extra_content: Optional[Any] = Field(None, description="额外内容JSON")
    model_id: Optional[str] = Field(None, max_length=40, description="模型ID")
    chatbot_id: Optional[str] = Field(None, max_length=40, description="机器人ID")


class ChatMessage(ChatMessageBase, BaseDTO):
    """
    对话消息响应DTO
    
    继承自ChatMessageBase和BaseDTO，包含消息基本信息和公共字段
    """
    
    class Config:
        from_attributes = True


class QueryItem(BaseModel):
    """
    查询项DTO
    
    Attributes:
        type: 类型（text/file_base64/document）
        content: 内容（字符串或dict）
        mime_type: MIME类型
    """
    type: str = Field(..., description="类型：text/file_base64/document")
    content: Any = Field(..., description="内容")
    mime_type: Optional[str] = Field(None, description="MIME类型")


class ChatRequest(BaseModel):
    """
    聊天请求DTO

    Attributes:
        config: 对话配置JSON
        query: 查询数组
        model_id: 模型ID
        chatbot_id: 机器人ID
        chat_id: 对话ID
        stream: 是否流式输出
        message_id: 消息ID，用于标识重新回答或编辑问题
        system_prompt: 系统提示词
    """
    config: Optional[dict] = Field(None, description="对话配置JSON")
    query: List[QueryItem] = Field(..., description="查询数组")
    model_id: Optional[str] = Field(None, max_length=40, description="模型ID")
    chatbot_id: Optional[str] = Field(None, max_length=40, description="机器人ID")
    chat_id: Optional[str] = Field(None, max_length=40, description="对话ID")
    stream: bool = Field(True, description="是否流式输出")
    message_id: Optional[str] = Field(None, max_length=40, description="消息ID，用于标识重新回答或编辑问题")
    system_prompt: Optional[str] = Field(None, description="系统提示词")


class ChatListResponse(BaseModel):
    """
    对话列表响应DTO
    
    Attributes:
        items: 对话列表
        total: 总数
        page: 当前页
        page_size: 每页数量
    """
    items: List[Chat] = Field(default_factory=list, description="对话列表")
    total: int = Field(0, description="总数")
    page: int = Field(1, description="当前页")
    page_size: int = Field(20, description="每页数量")


class ChatMessageListResponse(BaseModel):
    """
    对话消息列表响应DTO
    
    Attributes:
        items: 消息列表
        total: 总数
    """
    items: List[ChatMessage] = Field(default_factory=list, description="消息列表")
    total: int = Field(0, description="总数")
