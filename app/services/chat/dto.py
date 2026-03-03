"""
聊天数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ChatBase(BaseModel):
    """
    聊天基础DTO
    
    Attributes:
        user_id: 用户ID
        chatbot_id: 聊天机器人ID
        message: 用户消息
        response: 机器人回复
    """
    user_id: int = Field(..., gt=0, description="用户ID，必须大于0")
    chatbot_id: int = Field(..., gt=0, description="聊天机器人ID，必须大于0")
    message: str = Field(..., min_length=1, max_length=5000, description="用户消息，长度1-5000个字符")
    response: str = Field(..., min_length=1, max_length=10000, description="机器人回复，长度1-10000个字符")


class ChatCreate(ChatBase):
    """
    聊天创建DTO
    """
    pass


class ChatUpdate(BaseModel):
    """
    聊天更新DTO
    
    Attributes:
        user_id: 用户ID
        chatbot_id: 聊天机器人ID
        message: 用户消息
        response: 机器人回复
    """
    user_id: Optional[int] = Field(None, gt=0, description="用户ID，必须大于0")
    chatbot_id: Optional[int] = Field(None, gt=0, description="聊天机器人ID，必须大于0")
    message: Optional[str] = Field(None, min_length=1, max_length=5000, description="用户消息，长度1-5000个字符")
    response: Optional[str] = Field(None, min_length=1, max_length=10000, description="机器人回复，长度1-10000个字符")


class Chat(ChatBase):
    """
    聊天响应DTO
    
    Attributes:
        id: 聊天ID
        created_at: 创建时间
    """
    id: int = Field(..., description="聊天ID")
    created_at: datetime = Field(..., description="创建时间")
    
    class Config:
        from_attributes = True
