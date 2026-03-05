"""
聊天数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional
from app.services.base_dto import BaseDTO


class ChatBase(BaseModel):
    """
    聊天基础DTO
    
    Attributes:
        user_id: 用户ID
        chatbot_id: 聊天机器人ID
        message: 用户消息
        response: 机器人回复
    """
    user_id: str = Field(..., description="用户ID，UUID格式")
    chatbot_id: str = Field(..., description="聊天机器人ID，UUID格式")
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
    user_id: Optional[str] = Field(None, description="用户ID，UUID格式")
    chatbot_id: Optional[str] = Field(None, description="聊天机器人ID，UUID格式")
    message: Optional[str] = Field(None, min_length=1, max_length=5000, description="用户消息，长度1-5000个字符")
    response: Optional[str] = Field(None, min_length=1, max_length=10000, description="机器人回复，长度1-10000个字符")


class Chat(ChatBase, BaseDTO):
    """
    聊天响应DTO
    
    继承自ChatBase和BaseDTO，包含聊天基本信息和公共字段
    """
    
    class Config:
        from_attributes = True
