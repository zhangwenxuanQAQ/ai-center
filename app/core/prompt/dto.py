from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PromptBase(BaseModel):
    name: str
    content: str
    category: str

class PromptCreate(PromptBase):
    pass

class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None

class Prompt(PromptBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True