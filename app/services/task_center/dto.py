"""
任务中心数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class TaskInfoCreate(BaseModel):
    """任务创建DTO"""
    name: str = Field(..., min_length=1, max_length=255, description="任务名称")
    description: Optional[str] = Field(None, description="任务描述")
    task_type: str = Field(..., max_length=50, description="任务类型：data_extract/api/doc_chunk")
    task_configs: Optional[Dict[str, Any]] = Field(None, description="任务配置JSON")


class TaskInfoUpdate(BaseModel):
    """任务更新DTO"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="任务名称")
    description: Optional[str] = Field(None, description="任务描述")
    task_configs: Optional[Dict[str, Any]] = Field(None, description="任务配置JSON")


class TaskResultQuery(BaseModel):
    """任务结果查询DTO"""
    task_id: str = Field(..., description="任务ID")
