from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ChatBase(BaseModel):
    user_id: int
    chatbot_id: int
    message: str
    response: str

class ChatCreate(ChatBase):
    pass

class ChatUpdate(BaseModel):
    user_id: Optional[int] = None
    chatbot_id: Optional[int] = None
    message: Optional[str] = None
    response: Optional[str] = None

class Chat(ChatBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True