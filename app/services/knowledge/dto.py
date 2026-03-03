"""
知识库数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class KnowledgeBase(BaseModel):
    """
    知识库基础DTO
    
    Attributes:
        name: 知识库名称
        description: 知识库描述
        file_path: 文件路径
        status: 状态
    """
    name: str = Field(..., min_length=1, max_length=100, description="知识库名称，长度1-100个字符")
    description: str = Field(..., min_length=1, max_length=500, description="知识库描述，长度1-500个字符")
    file_path: str = Field(..., min_length=1, max_length=500, description="文件路径，长度1-500个字符")
    status: bool = Field(default=True, description="状态，True表示启用，False表示禁用")


class KnowledgeCreate(KnowledgeBase):
    """
    知识库创建DTO
    """
    pass


class KnowledgeUpdate(BaseModel):
    """
    知识库更新DTO
    
    Attributes:
        name: 知识库名称
        description: 知识库描述
        file_path: 文件路径
        status: 状态
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="知识库名称，长度1-100个字符")
    description: Optional[str] = Field(None, min_length=1, max_length=500, description="知识库描述，长度1-500个字符")
    file_path: Optional[str] = Field(None, min_length=1, max_length=500, description="文件路径，长度1-500个字符")
    status: Optional[bool] = Field(None, description="状态，True表示启用，False表示禁用")


class Knowledge(KnowledgeBase):
    """
    知识库响应DTO
    
    Attributes:
        id: 知识库ID
        created_at: 创建时间
        updated_at: 更新时间
    """
    id: int = Field(..., description="知识库ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    
    class Config:
        from_attributes = True
