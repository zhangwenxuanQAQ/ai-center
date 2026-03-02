from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class KnowledgeBase(BaseModel):
    name: str
    description: str
    file_path: str
    status: bool = True

class KnowledgeCreate(KnowledgeBase):
    pass

class KnowledgeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    file_path: Optional[str] = None
    status: Optional[bool] = None

class Knowledge(KnowledgeBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True