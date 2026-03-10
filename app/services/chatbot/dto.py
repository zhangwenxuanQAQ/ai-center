"""
聊天机器人数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.base_dto import BaseDTO


class ChatbotBase(BaseModel):
    """
    聊天机器人基础DTO
    
    Attributes:
        code: 机器人编码（全局唯一，必填）
        name: 聊天机器人名称（必填）
        description: 聊天机器人描述
        model_id: LLM模型ID
        category_id: 分类ID
        avatar: 头像URL或Base64
        greeting: 欢迎语（必填）
        prompt_id: 提示词ID
        knowledge_id: 知识库ID
        source_type: 来源类型（必填）
        source_config: 来源配置
    """
    code: str = Field(..., min_length=1, max_length=100, description="机器人编码，全局唯一")
    name: str = Field(..., min_length=1, max_length=100, description="聊天机器人名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="聊天机器人描述，最大长度500个字符")
    model_id: Optional[str] = Field(None, description="LLM模型ID，UUID格式")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    avatar: Optional[str] = Field(None, description="头像URL或Base64")
    greeting: str = Field(..., min_length=1, max_length=500, description="欢迎语，长度1-500个字符")
    prompt_id: Optional[str] = Field(None, description="提示词ID，UUID格式")
    knowledge_id: Optional[str] = Field(None, description="知识库ID，UUID格式")
    source_type: str = Field(..., min_length=1, max_length=50, description="来源类型，最大长度50个字符")
    source_config: Optional[str] = Field(None, max_length=2000, description="来源配置，最大长度2000个字符")


class ChatbotCreate(ChatbotBase):
    """
    聊天机器人创建DTO
    
    Attributes:
        mcp_ids: MCP ID列表
    """
    mcp_ids: Optional[List[str]] = Field(None, description="MCP ID列表，UUID格式")


class ChatbotUpdate(BaseModel):
    """
    聊天机器人更新DTO
    
    Attributes:
        code: 机器人编码（全局唯一）
        name: 聊天机器人名称
        description: 聊天机器人描述
        model_id: LLM模型ID
        category_id: 分类ID
        avatar: 头像URL
        greeting: 欢迎语
        prompt_id: 提示词ID
        knowledge_id: 知识库ID
        source_type: 来源类型
        source_config: 来源配置
        mcp_ids: MCP ID列表
    """
    code: Optional[str] = Field(None, min_length=1, max_length=100, description="机器人编码，全局唯一")
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="聊天机器人名称，长度1-100个字符")
    description: Optional[str] = Field(None, min_length=1, max_length=500, description="聊天机器人描述，长度1-500个字符")
    model_id: Optional[str] = Field(None, description="LLM模型ID，UUID格式")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    avatar: Optional[str] = Field(None, description="头像URL或Base64")
    greeting: Optional[str] = Field(None, max_length=500, description="欢迎语，最大长度500个字符")
    prompt_id: Optional[str] = Field(None, description="提示词ID，UUID格式")
    knowledge_id: Optional[str] = Field(None, description="知识库ID，UUID格式")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型，最大长度50个字符")
    source_config: Optional[str] = Field(None, max_length=2000, description="来源配置，最大长度2000个字符")
    mcp_ids: Optional[List[str]] = Field(None, description="MCP ID列表，UUID格式")


class Chatbot(ChatbotBase, BaseDTO):
    """
    聊天机器人响应DTO
    
    继承自ChatbotBase和BaseDTO，包含聊天机器人基本信息和公共字段
    
    Attributes:
        mcp_ids: MCP ID列表
    """
    mcp_ids: Optional[List[str]] = Field(None, description="MCP ID列表，UUID格式")
    
    class Config:
        from_attributes = True
