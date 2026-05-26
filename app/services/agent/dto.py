"""
智能体数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.services.base_dto import BaseDTO


class AgentCategoryBase(BaseModel):
    """
    智能体分类基础DTO
    
    Attributes:
        name: 分类名称
        description: 分类描述
        parent_id: 父分类ID
        sort_order: 排序顺序
        is_default: 是否默认分类
        is_default_select: 是否默认选中
    """
    name: str = Field(..., min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    parent_id: Optional[str] = Field(None, description="父分类ID，UUID格式")
    sort_order: int = Field(default=0, description="排序顺序")
    is_default: Optional[bool] = Field(default=False, description="是否默认分类")
    is_default_select: Optional[bool] = Field(default=False, description="是否默认选中")


class AgentCategoryCreate(AgentCategoryBase):
    """
    智能体分类创建DTO
    """
    pass


class AgentCategoryUpdate(BaseModel):
    """
    智能体分类更新DTO
    
    Attributes:
        name: 分类名称
        description: 分类描述
        parent_id: 父分类ID
        sort_order: 排序顺序
        is_default_select: 是否默认选中
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    parent_id: Optional[str] = Field(None, description="父分类ID，UUID格式")
    sort_order: Optional[int] = Field(None, description="排序顺序")
    is_default_select: Optional[bool] = Field(None, description="是否默认选中")


class AgentCategory(AgentCategoryBase, BaseDTO):
    """
    智能体分类响应DTO
    
    继承自AgentCategoryBase和BaseDTO，包含智能体分类基本信息和公共字段
    """
    
    class Config:
        from_attributes = True


class AgentComponentBase(BaseModel):
    """
    智能体组件基础DTO
    
    Attributes:
        name: 组件名称
        code: 组件编码
        component_title: 组件标题
        description: 组件描述
        component_type: 组件类型
        category: 组件分类
        icon: 组件图标
        config: 组件配置
        status: 状态（0停用，1启用）
        sort_order: 排序顺序
    """
    name: str = Field(..., min_length=1, max_length=100, description="组件名称")
    code: str = Field(..., min_length=1, max_length=50, description="组件编码")
    component_title: Optional[str] = Field(None, max_length=255, description="组件标题")
    description: Optional[str] = Field(None, max_length=500, description="组件描述")
    component_type: str = Field(..., description="组件类型")
    category: Optional[str] = Field(None, description="组件分类")
    icon: Optional[str] = Field(None, description="组件图标")
    config: Optional[dict] = Field(None, description="组件配置JSON")
    status: Optional[int] = Field(default=1, description="状态：0停用，1启用")
    sort_order: Optional[int] = Field(default=0, description="排序顺序")


class AgentComponentCreate(AgentComponentBase):
    """
    智能体组件创建DTO
    """
    pass


class AgentComponentUpdate(BaseModel):
    """
    智能体组件更新DTO
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="组件名称")
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="组件编码")
    component_title: Optional[str] = Field(None, max_length=255, description="组件标题")
    description: Optional[str] = Field(None, max_length=500, description="组件描述")
    component_type: Optional[str] = Field(None, description="组件类型")
    category: Optional[str] = Field(None, description="组件分类")
    icon: Optional[str] = Field(None, description="组件图标")
    config: Optional[dict] = Field(None, description="组件配置JSON")
    status: Optional[int] = Field(None, description="状态：0停用，1启用")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class AgentComponent(AgentComponentBase):
    """
    智能体组件响应DTO
    """
    id: str = Field(..., description="组件ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True


class AgentInstanceBase(BaseModel):
    """
    智能体实例基础DTO
    
    Attributes:
        name: 智能体名称
        code: 智能体编码
        description: 智能体描述
        category_id: 分类ID
        avatar: 智能体头像
        dsl: 工作流DSL配置
        tags: 智能体标签
        version: 版本号
        status: 状态
        is_template: 是否为模板
    """
    name: str = Field(..., min_length=1, max_length=100, description="智能体名称")
    code: str = Field(..., min_length=1, max_length=50, description="智能体编码")
    description: Optional[str] = Field(None, max_length=500, description="智能体描述")
    category_id: Optional[str] = Field(None, description="分类ID")
    avatar: Optional[str] = Field(None, description="智能体头像")
    dsl: Optional[dict] = Field(None, description="工作流DSL配置JSON")
    tags: Optional[str] = Field(None, description="智能体标签JSON")
    version: Optional[int] = Field(default=1, description="版本号")
    status: Optional[bool] = Field(default=True, description="状态")
    is_template: Optional[bool] = Field(default=False, description="是否为模板")


class AgentInstanceCreate(AgentInstanceBase):
    """
    智能体实例创建DTO
    """
    pass


class AgentInstanceUpdate(BaseModel):
    """
    智能体实例更新DTO
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="智能体名称")
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="智能体编码")
    description: Optional[str] = Field(None, max_length=500, description="智能体描述")
    category_id: Optional[str] = Field(None, description="分类ID")
    avatar: Optional[str] = Field(None, description="智能体头像")
    dsl: Optional[dict] = Field(None, description="工作流DSL配置JSON")
    tags: Optional[str] = Field(None, description="智能体标签JSON")
    version: Optional[int] = Field(None, description="版本号")
    status: Optional[bool] = Field(None, description="状态")
    is_template: Optional[bool] = Field(None, description="是否为模板")


class AgentInstance(AgentInstanceBase):
    """
    智能体实例响应DTO
    """
    id: str = Field(..., description="智能体ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
