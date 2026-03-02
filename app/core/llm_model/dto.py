from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class LLMModelBase(BaseModel):
    name: str
    provider: str
    api_key: str
    endpoint: str
    model_type: str

class LLMModelCreate(LLMModelBase):
    pass

class LLMModelUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    model_type: Optional[str] = None

class LLMModel(LLMModelBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True