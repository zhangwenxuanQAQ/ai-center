"""
机器人插件集成数据传输对象（DTO）
"""

import json
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from app.services.base_dto import BaseDTO


class IntegrationBase(BaseModel):
    """
    集成配置基础DTO
    
    Attributes:
        chatbot_id: 机器人ID
        api_key: API密钥JSON数组
        openai_base_url: OpenAI基础URL
        configs: 配置JSON
    """
    chatbot_id: str = Field(..., max_length=40, description="机器人ID")
    api_key: Optional[list] = Field(None, description="API密钥JSON数组")
    openai_base_url: Optional[str] = Field(None, max_length=500, description="OpenAI基础URL")
    configs: Optional[dict] = Field(None, description="配置JSON")
    
    @field_validator('api_key', mode='before')
    @classmethod
    def parse_api_key(cls, v):
        """解析api_key字段，支持字符串和列表类型"""
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return []
    
    @field_validator('configs', mode='before')
    @classmethod
    def parse_configs(cls, v):
        """解析configs字段，支持字符串和字典类型"""
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


class IntegrationCreate(BaseModel):
    """
    集成配置创建DTO
    """
    configs: Optional[dict] = Field(None, description="配置JSON")


class IntegrationUpdate(BaseModel):
    """
    集成配置更新DTO
    """
    configs: Optional[dict] = Field(None, description="配置JSON")


class IntegrationResponse(IntegrationBase, BaseDTO):
    """
    集成配置响应DTO
    
    继承自IntegrationBase和BaseDTO
    """
    deleted: Optional[bool] = Field(False, description="是否删除")
    
    class Config:
        from_attributes = True


class IntegrationChatMessageResponse(BaseModel):
    """
    集成聊天消息响应DTO
    """
    id: str = Field(..., description="消息ID")
    chatbot_id: str = Field(..., description="机器人ID")
    chat_id: str = Field(..., description="聊天ID")
    message_id: str = Field(..., description="消息ID")
    role: str = Field(..., description="角色")
    content: str = Field(..., description="消息内容")
    extra_content: Optional[Any] = Field(None, description="额外内容JSON")
    reasoning_content: Optional[str] = Field(None, description="思考过程内容")
    reasoning_time: Optional[int] = Field(None, description="思考耗时（毫秒）")
    model_id: Optional[str] = Field(None, description="模型ID")
    created_at: Optional[Any] = Field(None, description="创建时间")
    updated_at: Optional[Any] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
