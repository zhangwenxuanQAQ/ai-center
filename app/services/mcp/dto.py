"""
MCP数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class MCPBase(BaseModel):
    """
    MCP基础DTO
    
    Attributes:
        name: MCP名称
        url: MCP URL
        api_key: API密钥
        status: 状态
    """
    name: str = Field(..., min_length=1, max_length=100, description="MCP名称，长度1-100个字符")
    url: str = Field(..., min_length=1, max_length=500, description="MCP URL，长度1-500个字符")
    api_key: str = Field(..., min_length=1, max_length=200, description="API密钥，长度1-200个字符")
    status: bool = Field(default=True, description="状态，True表示启用，False表示禁用")


class MCPCreate(MCPBase):
    """
    MCP创建DTO
    """
    pass


class MCPUpdate(BaseModel):
    """
    MCP更新DTO
    
    Attributes:
        name: MCP名称
        url: MCP URL
        api_key: API密钥
        status: 状态
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="MCP名称，长度1-100个字符")
    url: Optional[str] = Field(None, min_length=1, max_length=500, description="MCP URL，长度1-500个字符")
    api_key: Optional[str] = Field(None, min_length=1, max_length=200, description="API密钥，长度1-200个字符")
    status: Optional[bool] = Field(None, description="状态，True表示启用，False表示禁用")


class MCP(MCPBase):
    """
    MCP响应DTO
    
    Attributes:
        id: MCP ID
        created_at: 创建时间
        updated_at: 更新时间
    """
    id: int = Field(..., description="MCP ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
