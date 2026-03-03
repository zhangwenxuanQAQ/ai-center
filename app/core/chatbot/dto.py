from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class ChatbotBase(BaseModel):
    name: str
    description: str
    model_id: int
    avatar: Optional[str] = None
    greeting: Optional[str] = None
    prompt_id: Optional[int] = None
    knowledge_id: Optional[int] = None
    source_type: Optional[str] = None
    source_config: Optional[str] = None

class ChatbotCreate(ChatbotBase):
    mcp_ids: Optional[List[int]] = None

class ChatbotUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    model_id: Optional[int] = None
    avatar: Optional[str] = None
    greeting: Optional[str] = None
    prompt_id: Optional[int] = None
    knowledge_id: Optional[int] = None
    source_type: Optional[str] = None
    source_config: Optional[str] = None
    mcp_ids: Optional[List[int]] = None

class Chatbot(ChatbotBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    mcp_ids: Optional[List[int]] = None
    
    class Config:
        from_attributes = True