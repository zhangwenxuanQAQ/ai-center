"""
基础数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class BaseDTO(BaseModel):
    """
    基础DTO类
    
    所有DTO的基类，提供公共字段
    
    Attributes:
        id: 主键ID（UUID格式）
        created_at: 创建时间
        updated_at: 更新时间
        create_user_id: 创建用户ID
        update_user_id: 更新用户ID
    """
    id: str = Field(..., description="主键ID（UUID格式）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    create_user_id: Optional[str] = Field(None, description="创建用户ID")
    update_user_id: Optional[str] = Field(None, description="更新用户ID")
