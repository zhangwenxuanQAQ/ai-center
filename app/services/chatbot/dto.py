"""
聊天机器人数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ChatbotBase(BaseModel):
    """
    聊天机器人基础DTO
    
    Attributes:
        name: 聊天机器人名称
        description: 聊天机器人描述
        model_id: LLM模型ID
        avatar: 头像URL
        greeting: 欢迎语
        prompt_id: 提示词ID
        knowledge_id: 知识库ID
        source_type: 来源类型
        source_config: 来源配置
    """
    name: str = Field(..., min_length=1, max_length=100, description="聊天机器人名称，长度1-100个字符")
    description: str = Field(..., min_length=1, max_length=500, description="聊天机器人描述，长度1-500个字符")
    model_id: int = Field(..., gt=0, description="LLM模型ID，必须大于0")
    avatar: Optional[str] = Field(None, max_length=500, description="头像URL，最大长度500个字符")
    greeting: Optional[str] = Field(None, max_length=500, description="欢迎语，最大长度500个字符")
    prompt_id: Optional[int] = Field(None, gt=0, description="提示词ID，必须大于0")
    knowledge_id: Optional[int] = Field(None, gt=0, description="知识库ID，必须大于0")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型，最大长度50个字符")
    source_config: Optional[str] = Field(None, max_length=2000, description="来源配置，最大长度2000个字符")


class ChatbotCreate(ChatbotBase):
    """
    聊天机器人创建DTO
    
    Attributes:
        mcp_ids: MCP ID列表
    """
    mcp_ids: Optional[List[int]] = Field(None, description="MCP ID列表")


class ChatbotUpdate(BaseModel):
    """
    聊天机器人更新DTO
    
    Attributes:
        name: 聊天机器人名称
        description: 聊天机器人描述
        model_id: LLM模型ID
        avatar: 头像URL
        greeting: 欢迎语
        prompt_id: 提示词ID
        knowledge_id: 知识库ID
        source_type: 来源类型
        source_config: 来源配置
        mcp_ids: MCP ID列表
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="聊天机器人名称，长度1-100个字符")
    description: Optional[str] = Field(None, min_length=1, max_length=500, description="聊天机器人描述，长度1-500个字符")
    model_id: Optional[int] = Field(None, gt=0, description="LLM模型ID，必须大于0")
    avatar: Optional[str] = Field(None, max_length=500, description="头像URL，最大长度500个字符")
    greeting: Optional[str] = Field(None, max_length=500, description="欢迎语，最大长度500个字符")
    prompt_id: Optional[int] = Field(None, gt=0, description="提示词ID，必须大于0")
    knowledge_id: Optional[int] = Field(None, gt=0, description="知识库ID，必须大于0")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型，最大长度50个字符")
    source_config: Optional[str] = Field(None, max_length=2000, description="来源配置，最大长度2000个字符")
    mcp_ids: Optional[List[int]] = Field(None, description="MCP ID列表")


class Chatbot(ChatbotBase):
    """
    聊天机器人响应DTO
    
    Attributes:
        id: 聊天机器人ID
        created_at: 创建时间
        updated_at: 更新时间
        mcp_ids: MCP ID列表
    """
    id: int = Field(..., description="聊天机器人ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    mcp_ids: Optional[List[int]] = Field(None, description="MCP ID列表")
    
    class Config:
        from_attributes = True
