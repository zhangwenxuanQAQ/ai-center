from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ChatbotBase(BaseModel):
    name: str
    description: str
    model_id: int

class ChatbotCreate(ChatbotBase):
    pass

class ChatbotUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    model_id: Optional[int] = None

class Chatbot(ChatbotBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True