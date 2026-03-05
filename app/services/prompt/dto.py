"""
提示词数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional
from app.services.base_dto import BaseDTO


class PromptBase(BaseModel):
    """
    提示词基础DTO
    
    Attributes:
        name: 提示词名称
        content: 提示词内容
        category: 提示词分类
    """
    name: str = Field(..., min_length=1, max_length=100, description="提示词名称，长度1-100个字符")
    content: str = Field(..., min_length=1, max_length=5000, description="提示词内容，长度1-5000个字符")
    category: str = Field(..., min_length=1, max_length=50, description="提示词分类，长度1-50个字符")


class PromptCreate(PromptBase):
    """
    提示词创建DTO
    """
    pass


class PromptUpdate(BaseModel):
    """
    提示词更新DTO
    
    Attributes:
        name: 提示词名称
        content: 提示词内容
        category: 提示词分类
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="提示词名称，长度1-100个字符")
    content: Optional[str] = Field(None, min_length=1, max_length=5000, description="提示词内容，长度1-5000个字符")
    category: Optional[str] = Field(None, min_length=1, max_length=50, description="提示词分类，长度1-50个字符")


class Prompt(PromptBase, BaseDTO):
    """
    提示词响应DTO
    
    继承自PromptBase和BaseDTO，包含提示词基本信息和公共字段
    """
    
    class Config:
        from_attributes = True
