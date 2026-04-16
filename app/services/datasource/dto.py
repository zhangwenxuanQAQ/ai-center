"""
数据源数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from app.services.base_dto import BaseDTO


class DatasourceBase(BaseModel):
    """
    数据源基础DTO
    
    Attributes:
        name: 数据源名称
        code: 数据源编码
        type: 数据源类型
        category_id: 分类ID
        config: 数据源配置
        status: 状态
    """
    name: str = Field(..., min_length=1, max_length=100, description="数据源名称，长度1-100个字符")
    code: str = Field(..., min_length=1, max_length=100, description="数据源编码，全局唯一")
    type: str = Field(..., min_length=1, max_length=50, description="数据源类型")
    category_id: Optional[str] = Field(None, description="分类ID")
    config: Optional[Dict[str, Any]] = Field(None, description="数据源配置JSON")
    status: Optional[bool] = Field(default=True, description="状态：True启用，False停用")


class DatasourceCreate(DatasourceBase):
    """
    数据源创建DTO
    """
    pass


class DatasourceUpdate(BaseModel):
    """
    数据源更新DTO
    
    Attributes:
        name: 数据源名称
        code: 数据源编码
        type: 数据源类型
        category_id: 分类ID
        config: 数据源配置
        status: 状态
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="数据源名称，长度1-100个字符")
    code: Optional[str] = Field(None, min_length=1, max_length=100, description="数据源编码，全局唯一")
    type: Optional[str] = Field(None, min_length=1, max_length=50, description="数据源类型")
    category_id: Optional[str] = Field(None, description="分类ID")
    config: Optional[Dict[str, Any]] = Field(None, description="数据源配置JSON")
    status: Optional[bool] = Field(None, description="状态：True启用，False停用")


class Datasource(DatasourceBase, BaseDTO):
    """
    数据源响应DTO
    
    继承自DatasourceBase和BaseDTO，包含数据源基本信息和公共字段
    """
    class Config:
        from_attributes = True
