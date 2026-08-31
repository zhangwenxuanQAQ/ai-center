"""
SKILL分类数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class SkillCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    parent_id: Optional[str] = Field(None, description="父分类ID，为None时表示顶级分类")
    sort_order: Optional[int] = Field(default=0, description="排序顺序，默认值为0")


class SkillCategoryCreate(SkillCategoryBase):
    """SKILL分类创建DTO"""
    pass


class SkillCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="分类名称")
    description: Optional[str] = Field(None, max_length=500, description="分类描述")
    parent_id: Optional[str] = Field(None, description="父分类ID")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class SkillCategory(SkillCategoryBase):
    id: str = Field(..., description="分类ID")
    is_default: bool = Field(default=False, description="是否为默认分类")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
