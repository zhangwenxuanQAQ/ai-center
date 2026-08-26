"""
API服务数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.base_dto import BaseDTO


class ApiServerCategoryBase(BaseModel):
    """
    API服务分类基础DTO

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


class ApiServerCategoryCreate(ApiServerCategoryBase):
    """
    API服务分类创建DTO
    """
    pass


class ApiServerCategoryUpdate(BaseModel):
    """
    API服务分类更新DTO

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


class ApiServerCategory(ApiServerCategoryBase, BaseDTO):
    """
    API服务分类响应DTO

    继承自ApiServerCategoryBase和BaseDTO，包含分类基本信息和公共字段
    """

    class Config:
        from_attributes = True


class ApiServerBase(BaseModel):
    """
    API服务基础DTO

    Attributes:
        name: API服务名称
        description: API服务描述
        url: API服务基础URL
        avatar: API服务头像
        headers: 请求头配置，JSON格式字符串
        configs: API服务配置，JSON格式字符串
        category_id: 分类ID
    """
    name: str = Field(..., min_length=1, max_length=100, description="API服务名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="API服务描述，最大长度500个字符")
    url: Optional[str] = Field(None, max_length=500, description="API服务基础URL，最大长度500个字符")
    avatar: Optional[str] = Field(None, description="API服务头像，base64格式字符串")
    headers: Optional[str] = Field(None, description="请求头配置，JSON格式字符串")
    configs: Optional[str] = Field(None, description="API服务配置，JSON格式字符串，包含所需的所有配置参数")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    status: bool = Field(default=True, description="状态，True表示启用，False表示停用")


class ApiServerCreate(ApiServerBase):
    """
    API服务创建DTO
    """
    pass


class ApiServerUpdate(BaseModel):
    """
    API服务更新DTO

    Attributes:
        name: API服务名称
        description: API服务描述
        url: API服务基础URL
        avatar: API服务头像
        headers: 请求头配置
        configs: API服务配置
        category_id: 分类ID
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="API服务名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="API服务描述，最大长度500个字符")
    url: Optional[str] = Field(None, max_length=500, description="API服务基础URL，最大长度500个字符")
    avatar: Optional[str] = Field(None, description="API服务头像，base64格式字符串")
    headers: Optional[str] = Field(None, description="请求头配置，JSON格式字符串")
    configs: Optional[str] = Field(None, description="API服务配置，JSON格式字符串")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    status: Optional[bool] = Field(None, description="状态，True表示启用，False表示停用")


class ApiServer(ApiServerBase, BaseDTO):
    """
    API服务响应DTO

    继承自ApiServerBase和BaseDTO，包含API服务基本信息和公共字段
    """

    class Config:
        from_attributes = True


class ApiBase(BaseModel):
    """
    API接口基础DTO

    Attributes:
        name: 接口名称
        title: 接口标题
        description: 接口描述
        server_id: API服务ID
        configs: 接口配置，JSON格式字符串，包含method/path/parameters等
        status: 状态
    """
    name: str = Field(..., min_length=1, max_length=100, description="接口名称，长度1-100个字符")
    title: Optional[str] = Field(None, max_length=255, description="接口标题，最大长度255个字符")
    description: Optional[str] = Field(None, max_length=500, description="接口描述，最大长度500个字符")
    server_id: str = Field(..., description="API服务ID，UUID格式")
    configs: Optional[str] = Field(None, description="接口配置，JSON格式字符串，包含method/path/parameters等所有配置参数")
    status: bool = Field(default=True, description="状态，True表示启用，False表示禁用")


class ApiCreate(ApiBase):
    """
    API接口创建DTO
    """
    pass


class ApiUpdate(BaseModel):
    """
    API接口更新DTO

    Attributes:
        name: 接口名称
        title: 接口标题
        description: 接口描述
        server_id: API服务ID
        configs: 接口配置
        status: 状态
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="接口名称，长度1-100个字符")
    title: Optional[str] = Field(None, max_length=255, description="接口标题，最大长度255个字符")
    description: Optional[str] = Field(None, max_length=500, description="接口描述，最大长度500个字符")
    server_id: Optional[str] = Field(None, description="API服务ID，UUID格式")
    configs: Optional[str] = Field(None, description="接口配置，JSON格式字符串")
    status: Optional[bool] = Field(None, description="状态，True表示启用，False表示禁用")


class Api(ApiBase, BaseDTO):
    """
    API接口响应DTO

    继承自ApiBase和BaseDTO，包含API接口基本信息和公共字段
    """

    class Config:
        from_attributes = True


class SwaggerImportRequest(BaseModel):
    """
    Swagger批量导入请求DTO

    Attributes:
        swagger_url: Swagger文档URL
        swagger_json: Swagger文档JSON字符串
        include_patterns: 包含的API路径模式列表（正则表达式）
        exclude_patterns: 排除的API路径模式列表（正则表达式）
        headers: 请求头（JSON字符串，用于访问需认证的Swagger文档）
    """
    swagger_url: Optional[str] = Field(None, description="Swagger文档URL")
    swagger_json: Optional[str] = Field(None, description="Swagger文档JSON字符串")
    include_patterns: Optional[List[str]] = Field(None, description="包含的API路径模式列表（正则表达式）")
    exclude_patterns: Optional[List[str]] = Field(None, description="排除的API路径模式列表（正则表达式）")
    headers: Optional[str] = Field(None, description="请求头（JSON字符串）")
