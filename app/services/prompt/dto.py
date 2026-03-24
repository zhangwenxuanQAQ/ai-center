"""
提示词数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.base_dto import BaseDTO


class PromptCategoryBase(BaseModel):
    """
    提示词分类基础DTO
    
    Attributes:
        name: 分类名称
        description: 分类描述
        parent_id: 父分类ID
        sort_order: 排序顺序
        is_default: 是否默认分类
    """
    name: str = Field(..., min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    parent_id: Optional[str] = Field(None, description="父分类ID，UUID格式")
    sort_order: int = Field(default=0, description="排序顺序")
    is_default: Optional[bool] = Field(default=False, description="是否默认分类")


class PromptCategoryCreate(PromptCategoryBase):
    """
    提示词分类创建DTO
    """
    pass


class PromptCategoryUpdate(BaseModel):
    """
    提示词分类更新DTO
    
    Attributes:
        name: 分类名称
        description: 分类描述
        parent_id: 父分类ID
        sort_order: 排序顺序
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    parent_id: Optional[str] = Field(None, description="父分类ID，UUID格式")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class PromptCategory(PromptCategoryBase, BaseDTO):
    """
    提示词分类响应DTO
    
    继承自PromptCategoryBase和BaseDTO，包含提示词分类基本信息和公共字段
    """
    
    class Config:
        from_attributes = True


class PromptBase(BaseModel):
    """
    提示词基础DTO
    
    Attributes:
        name: 提示词名称
        content: 提示词内容
        description: 提示词描述
        category_id: 分类ID
        tags: 标签列表
        status: 状态
    """
    name: str = Field(..., min_length=1, max_length=100, description="提示词名称，长度1-100个字符")
    content: str = Field(..., min_length=1, description="提示词内容")
    description: Optional[str] = Field(None, max_length=500, description="提示词描述，最大长度500个字符")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    tags: Optional[List[str]] = Field(default=None, description="标签列表")
    status: bool = Field(default=True, description="状态：True启用，False禁用")


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
        description: 提示词描述
        category_id: 分类ID
        tags: 标签列表
        status: 状态
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="提示词名称，长度1-100个字符")
    content: Optional[str] = Field(None, min_length=1, description="提示词内容")
    description: Optional[str] = Field(None, max_length=500, description="提示词描述，最大长度500个字符")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    tags: Optional[List[str]] = Field(None, description="标签列表")
    status: Optional[bool] = Field(None, description="状态：True启用，False禁用")


class Prompt(PromptBase, BaseDTO):
    """
    提示词响应DTO
    
    继承自PromptBase和BaseDTO，包含提示词基本信息和公共字段
    """
    
    class Config:
        from_attributes = True
