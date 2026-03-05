"""
知识库数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional
from app.services.base_dto import BaseDTO


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


class Knowledge(KnowledgeBase, BaseDTO):
    """
    知识库响应DTO
    
    继承自KnowledgeBase和BaseDTO，包含知识库基本信息和公共字段
    """
    
    class Config:
        from_attributes = True
