"""
LLM模型数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class LLMModelBase(BaseModel):
    """
    LLM模型基础DTO
    
    Attributes:
        name: 模型名称
        provider: 提供商
        api_key: API密钥
        endpoint: 端点URL
        model_type: 模型类型
    """
    name: str = Field(..., min_length=1, max_length=100, description="模型名称，长度1-100个字符")
    provider: str = Field(..., min_length=1, max_length=50, description="提供商，长度1-50个字符")
    api_key: str = Field(..., min_length=1, max_length=200, description="API密钥，长度1-200个字符")
    endpoint: str = Field(..., min_length=1, max_length=500, description="端点URL，长度1-500个字符")
    model_type: str = Field(..., min_length=1, max_length=50, description="模型类型，长度1-50个字符")


class LLMModelCreate(LLMModelBase):
    """
    LLM模型创建DTO
    """
    pass


class LLMModelUpdate(BaseModel):
    """
    LLM模型更新DTO
    
    Attributes:
        name: 模型名称
        provider: 提供商
        api_key: API密钥
        endpoint: 端点URL
        model_type: 模型类型
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="模型名称，长度1-100个字符")
    provider: Optional[str] = Field(None, min_length=1, max_length=50, description="提供商，长度1-50个字符")
    api_key: Optional[str] = Field(None, min_length=1, max_length=200, description="API密钥，长度1-200个字符")
    endpoint: Optional[str] = Field(None, min_length=1, max_length=500, description="端点URL，长度1-500个字符")
    model_type: Optional[str] = Field(None, min_length=1, max_length=50, description="模型类型，长度1-50个字符")


class LLMModel(LLMModelBase):
    """
    LLM模型响应DTO
    
    Attributes:
        id: 模型ID
        created_at: 创建时间
        updated_at: 更新时间
    """
    id: int = Field(..., description="模型ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
