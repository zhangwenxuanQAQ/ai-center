"""
技能数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict


class SkillBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="技能名称")
    title: Optional[str] = Field(None, max_length=255, description="技能标题")
    description: Optional[str] = Field(None, description="技能描述")
    tags: Optional[List[str]] = Field(None, description="技能标签")
    avatar: Optional[str] = Field(None, description="技能头像（base64或URL）")
    content: Optional[str] = Field(None, description="技能内容（SKILL.md）")
    metadata: Optional[Dict[str, str]] = Field(None, description="元数据")
    category_id: Optional[str] = Field(None, description="分类ID")
    status: Optional[bool] = Field(default=True, description="状态：True启用，False禁用")


class SkillCreate(SkillBase):
    """技能创建DTO - 手动新建时使用"""
    pass


class SkillCreateWithUpload(BaseModel):
    """技能创建DTO - 上传文件/文件夹时使用"""
    name: str = Field(..., min_length=1, max_length=255, description="技能名称")
    title: Optional[str] = Field(None, max_length=255, description="技能标题")
    description: Optional[str] = Field(None, description="技能描述")
    tags: Optional[List[str]] = Field(None, description="技能标签")
    avatar: Optional[str] = Field(None, description="技能头像（base64或URL）")
    content: Optional[str] = Field(None, description="技能内容（SKILL.md）")
    metadata: Optional[Dict[str, str]] = Field(None, description="元数据")
    category_id: Optional[str] = Field(None, description="分类ID")
    status: Optional[bool] = Field(default=True, description="状态")


class SkillUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="技能名称")
    title: Optional[str] = Field(None, max_length=255, description="技能标题")
    description: Optional[str] = Field(None, description="技能描述")
    tags: Optional[List[str]] = Field(None, description="技能标签")
    avatar: Optional[str] = Field(None, description="技能头像（base64或URL）")
    content: Optional[str] = Field(None, description="技能内容（SKILL.md）")
    metadata: Optional[Dict[str, str]] = Field(None, description="元数据")
    category_id: Optional[str] = Field(None, description="分类ID")
    status: Optional[bool] = Field(None, description="状态")


class Skill(SkillBase):
    id: str = Field(..., description="技能ID")
    directory: str = Field(..., description="技能所在目录")
    skill_md_content: Optional[str] = Field(None, description="SKILL.md文件内容（读取时填充）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")
    category_name: Optional[str] = Field(None, description="分类名称")

    class Config:
        from_attributes = True


class SkillListResponse(BaseModel):
    data: List[Skill]
    total: int
    page: int
    page_size: int


class FileNode(BaseModel):
    """文件目录节点"""
    name: str = Field(..., description="文件/文件夹名称")
    path: str = Field(..., description="相对路径")
    is_dir: bool = Field(..., description="是否为文件夹")
    size: Optional[int] = Field(None, description="文件大小（字节）")
    modified_at: Optional[datetime] = Field(None, description="修改时间")
    children: Optional[List["FileNode"]] = Field(None, description="子节点（文件夹时）")


class FileContent(BaseModel):
    """文件内容"""
    path: str = Field(..., description="文件相对路径")
    name: str = Field(..., description="文件名")
    content: str = Field(..., description="文件内容")
    is_text: bool = Field(default=True, description="是否为文本文件")


class FileContentUpdate(BaseModel):
    """文件内容更新"""
    content: str = Field(..., description="新文件内容")
