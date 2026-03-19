"""
LLM模型数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.base_dto import BaseDTO


class LLMCategoryBase(BaseModel):
    """
    LLM分类基础DTO
    
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


class LLMCategoryCreate(LLMCategoryBase):
    """
    LLM分类创建DTO
    """
    pass


class LLMCategoryUpdate(BaseModel):
    """
    LLM分类更新DTO
    
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


class LLMCategory(LLMCategoryBase, BaseDTO):
    """
    LLM分类响应DTO
    
    继承自LLMCategoryBase和BaseDTO，包含LLM分类基本信息和公共字段
    """
    
    class Config:
        from_attributes = True


class LLMModelBase(BaseModel):
    """
    LLM模型基础DTO
    
    Attributes:
        name: 模型名称
        provider: 提供商（可选）
        api_key: API密钥
        endpoint: 端点URL
        model_type: 模型类型
        category_id: 分类ID
        tags: 标签数组
        config: 模型参数配置
        status: 状态
    """
    name: str = Field(..., min_length=1, max_length=100, description="模型名称，长度1-100个字符")
    provider: Optional[str] = Field(None, min_length=1, max_length=50, description="提供商，长度1-50个字符")
    api_key: str = Field(..., min_length=1, max_length=200, description="API密钥，长度1-200个字符")
    endpoint: str = Field(..., min_length=1, max_length=500, description="端点URL，长度1-500个字符")
    model_type: str = Field(..., min_length=1, max_length=50, description="模型类型，长度1-50个字符")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    tags: Optional[str] = Field(None, description="标签数组，JSON格式字符串")
    config: Optional[str] = Field(None, description="模型参数配置，JSON格式字符串")
    status: bool = Field(default=True, description="状态，True表示启用，False表示禁用")


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
        category_id: 分类ID
        tags: 标签数组
        config: 模型参数配置
        status: 状态
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="模型名称，长度1-100个字符")
    provider: Optional[str] = Field(None, min_length=1, max_length=50, description="提供商，长度1-50个字符")
    api_key: Optional[str] = Field(None, min_length=1, max_length=200, description="API密钥，长度1-200个字符")
    endpoint: Optional[str] = Field(None, min_length=1, max_length=500, description="端点URL，长度1-500个字符")
    model_type: Optional[str] = Field(None, min_length=1, max_length=50, description="模型类型，长度1-50个字符")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    tags: Optional[str] = Field(None, description="标签数组，JSON格式字符串")
    config: Optional[str] = Field(None, description="模型参数配置，JSON格式字符串")
    status: Optional[bool] = Field(None, description="状态，True表示启用，False表示禁用")


class LLMModel(LLMModelBase, BaseDTO):
    """
    LLM模型响应DTO
    
    继承自LLMModelBase和BaseDTO，包含LLM模型基本信息和公共字段
    """
    
    class Config:
        from_attributes = True
