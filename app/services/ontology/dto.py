"""
本体工作台数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from app.services.base_dto import BaseDTO


class OntologyForeignKeyDTO(BaseModel):
    """外键关系DTO"""
    referenced_table: str = Field(default="", description="外键关联表")
    referenced_column: str = Field(default="", description="外键关联字段")


class OntologyColumnDTO(BaseModel):
    """本体字段DTO"""
    column_name: str = Field(..., description="字段名")
    column_name_cn: str = Field(default="", description="字段中文名称")
    column_description: str = Field(default="", description="字段描述")
    data_type: str = Field(default="", description="数据类型")
    is_primary_key: bool = Field(default=False, description="是否主键")
    is_nullable: bool = Field(default=True, description="是否可空")
    foreign_key: Optional[OntologyForeignKeyDTO] = Field(default=None, description="外键关系")


class OntologyContentDTO(BaseModel):
    """本体对象内容DTO（包含表信息及字段信息）"""
    table_name: str = Field(..., description="表名")
    title: Optional[str] = Field(default=None, description="表中文名称")
    description: Optional[str] = Field(default=None, description="表描述")
    columns: List[OntologyColumnDTO] = Field(default_factory=list, description="字段列表")


class OntologyObjectCreate(BaseModel):
    """本体对象创建DTO"""
    datasource_id: str = Field(..., description="数据源ID")
    name: str = Field(..., description="表名")
    title: Optional[str] = Field(None, description="表中文名称")
    description: Optional[str] = Field(None, description="表描述")
    content: Optional[OntologyContentDTO] = Field(None, description="本体对象内容")


class OntologyObjectUpdate(BaseModel):
    """本体对象更新DTO"""
    title: Optional[str] = Field(None, description="表中文名称")
    description: Optional[str] = Field(None, description="表描述")
    content: Optional[OntologyContentDTO] = Field(None, description="本体对象内容")


class OntologyObjectBatchItem(BaseModel):
    """批量创建中的单个本体对象"""
    name: str = Field(..., description="表名")
    title: Optional[str] = Field(None, description="表中文名称")
    description: Optional[str] = Field(None, description="表描述")
    content: Optional[OntologyContentDTO] = Field(None, description="本体对象内容")


class OntologyObjectBatchCreate(BaseModel):
    """批量创建本体对象DTO"""
    datasource_id: str = Field(..., description="数据源ID")
    objects: List[OntologyObjectBatchItem] = Field(..., min_length=1, description="本体对象列表")


class OntologyTaskCreate(BaseModel):
    """数据抽取任务创建DTO"""
    name: str = Field(..., min_length=1, max_length=255, description="任务名称")
    datasource_id: str = Field(..., description="数据源ID")
    configs: Optional[Dict[str, Any]] = Field(None, description="任务配置（包含ontology_object_id/custom_sql/export_format等）")


class OntologyTaskListQuery(BaseModel):
    """任务列表查询参数"""
    name: Optional[str] = Field(None, description="任务名称（模糊查询）")
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")
