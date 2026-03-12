"""
MCP数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.base_dto import BaseDTO


class MCPCategoryBase(BaseModel):
    """
    MCP分类基础DTO
    
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


class MCPCategoryCreate(MCPCategoryBase):
    """
    MCP分类创建DTO
    """
    pass


class MCPCategoryUpdate(BaseModel):
    """
    MCP分类更新DTO
    
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


class MCPCategory(MCPCategoryBase, BaseDTO):
    """
    MCP分类响应DTO
    
    继承自MCPCategoryBase和BaseDTO，包含MCP分类基本信息和公共字段
    """
    
    class Config:
        from_attributes = True


class MCPServerBase(BaseModel):
    """
    MCP服务基础DTO
    
    Attributes:
        code: MCP服务编码（全局唯一）
        name: MCP服务名称
        description: MCP服务描述
        url: MCP URL
        avatar: MCP服务头像
        transport_type: 传输方式
        source_type: 来源类型
        category_id: 分类ID
        config: MCP服务配置
    """
    code: str = Field(..., min_length=1, max_length=100, description="MCP服务编码，全局唯一")
    name: str = Field(..., min_length=1, max_length=100, description="MCP服务名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="MCP服务描述，最大长度500个字符")
    url: Optional[str] = Field(None, max_length=500, description="MCP URL，最大长度500个字符")
    avatar: Optional[str] = Field(None, description="MCP服务头像，base64格式字符串")
    transport_type: str = Field(default="streamable_http", description="传输方式：sse/streamable_http/stdio")
    source_type: str = Field(default="thirdparty", description="来源类型：local/thirdparty")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    config: Optional[str] = Field(None, description="MCP服务配置，JSON格式字符串")


class MCPServerCreate(MCPServerBase):
    """
    MCP服务创建DTO
    """
    pass


class MCPServerUpdate(BaseModel):
    """
    MCP服务更新DTO
    
    Attributes:
        code: MCP服务编码
        name: MCP服务名称
        description: MCP服务描述
        url: MCP URL
        avatar: MCP服务头像
        transport_type: 传输方式
        source_type: 来源类型
        category_id: 分类ID
        config: MCP服务配置
    """
    code: Optional[str] = Field(None, min_length=1, max_length=100, description="MCP服务编码，全局唯一")
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="MCP服务名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="MCP服务描述，最大长度500个字符")
    url: Optional[str] = Field(None, max_length=500, description="MCP URL，最大长度500个字符")
    avatar: Optional[str] = Field(None, description="MCP服务头像，base64格式字符串")
    transport_type: Optional[str] = Field(None, description="传输方式：sse/streamable_http/stdio")
    source_type: Optional[str] = Field(None, description="来源类型：local/thirdparty")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    config: Optional[str] = Field(None, description="MCP服务配置，JSON格式字符串")


class MCPServer(MCPServerBase, BaseDTO):
    """
    MCP服务响应DTO
    
    继承自MCPServerBase和BaseDTO，包含MCP服务基本信息和公共字段
    """
    
    class Config:
        from_attributes = True


class MCPToolBase(BaseModel):
    """
    MCP工具基础DTO
    
    Attributes:
        name: 工具名称
        description: 工具描述
        tool_type: 工具类型
        server_id: MCP服务ID
        config: 工具配置
        status: 状态
    """
    name: str = Field(..., min_length=1, max_length=100, description="工具名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="工具描述，最大长度500个字符")
    tool_type: str = Field(..., min_length=1, max_length=50, description="工具类型，长度1-50个字符")
    server_id: str = Field(..., description="MCP服务ID，UUID格式")
    config: Optional[str] = Field(None, description="工具配置")
    status: bool = Field(default=True, description="状态，True表示启用，False表示禁用")


class MCPToolCreate(MCPToolBase):
    """
    MCP工具创建DTO
    """
    pass


class MCPToolUpdate(BaseModel):
    """
    MCP工具更新DTO
    
    Attributes:
        name: 工具名称
        description: 工具描述
        tool_type: 工具类型
        server_id: MCP服务ID
        config: 工具配置
        status: 状态
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="工具名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="工具描述，最大长度500个字符")
    tool_type: Optional[str] = Field(None, min_length=1, max_length=50, description="工具类型，长度1-50个字符")
    server_id: Optional[str] = Field(None, description="MCP服务ID，UUID格式")
    config: Optional[str] = Field(None, description="工具配置")
    status: Optional[bool] = Field(None, description="状态，True表示启用，False表示禁用")


class MCPTool(MCPToolBase, BaseDTO):
    """
    MCP工具响应DTO
    
    继承自MCPToolBase和BaseDTO，包含MCP工具基本信息和公共字段
    """
    
    class Config:
        from_attributes = True


class MCPConnectionTest(BaseModel):
    """
    MCP连接测试请求DTO
    
    Attributes:
        transport_type: 传输类型
        url: 服务URL（用于sse和streamable_http）
        config: 配置信息（用于stdio的命令等）
    """
    transport_type: str = Field(..., description="传输类型：sse/streamable_http/stdio")
    url: Optional[str] = Field(None, description="服务URL，用于sse和streamable_http")
    config: Optional[str] = Field(None, description="配置信息，JSON格式")


class MCPConnectionTestResult(BaseModel):
    """
    MCP连接测试结果DTO
    
    Attributes:
        success: 是否成功
        message: 结果消息
        server_info: 服务器信息（连接成功时返回）
    """
    success: bool = Field(..., description="是否连接成功")
    message: str = Field(..., description="结果消息")
    server_info: Optional[dict] = Field(None, description="服务器信息")
