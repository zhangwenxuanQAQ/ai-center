"""
工具箱数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.base_dto import BaseDTO


class ToolkitCategoryBase(BaseModel):
    """
    工具箱分类基础DTO

    Attributes:
        name: 分类名称
        description: 分类描述
        type: 工具类型：mcp/api/code_script/builtin_tool/skill
        parent_id: 父分类ID
        sort_order: 排序顺序
        is_default: 是否默认分类
    """
    name: str = Field(..., min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    type: Optional[str] = Field(None, max_length=50, description="工具类型：mcp/api/code_script/builtin_tool/skill")
    parent_id: Optional[str] = Field(None, description="父分类ID，UUID格式")
    sort_order: int = Field(default=0, description="排序顺序")
    is_default: Optional[bool] = Field(default=False, description="是否默认分类")


class ToolkitCategoryCreate(ToolkitCategoryBase):
    """
    工具箱分类创建DTO
    """
    pass


class ToolkitCategoryUpdate(BaseModel):
    """
    工具箱分类更新DTO

    Attributes:
        name: 分类名称
        description: 分类描述
        type: 工具类型
        parent_id: 父分类ID
        sort_order: 排序顺序
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    type: Optional[str] = Field(None, max_length=50, description="工具类型：mcp/api/code_script/builtin_tool/skill")
    parent_id: Optional[str] = Field(None, description="父分类ID，UUID格式")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class ToolkitCategory(ToolkitCategoryBase, BaseDTO):
    """
    工具箱分类响应DTO

    继承自ToolkitCategoryBase和BaseDTO，包含分类基本信息和公共字段
    """

    class Config:
        from_attributes = True
