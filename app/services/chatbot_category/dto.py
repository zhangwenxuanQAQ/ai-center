"""
机器人分类数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ChatbotCategoryBase(BaseModel):
    """
    机器人分类基础DTO
    
    Attributes:
        name: 分类名称
        description: 分类描述
    """
    name: str = Field(..., min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")


class ChatbotCategoryCreate(ChatbotCategoryBase):
    """
    机器人分类创建DTO
    """
    pass


class ChatbotCategoryUpdate(BaseModel):
    """
    机器人分类更新DTO
    
    Attributes:
        name: 分类名称
        description: 分类描述
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")


class ChatbotCategory(ChatbotCategoryBase):
    """
    机器人分类响应DTO
    
    Attributes:
        id: 分类ID
        is_default: 是否为默认分类
        created_at: 创建时间
        updated_at: 更新时间
    """
    id: int = Field(..., description="分类ID")
    is_default: bool = Field(default=False, description="是否为默认分类")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
