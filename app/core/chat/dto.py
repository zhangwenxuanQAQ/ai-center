from pydantic import BaseModel
from datetime import datetime

class ChatBase(BaseModel):
    user_id: int
    chatbot_id: int
    message: str
    response: str

class ChatCreate(ChatBase):
    pass

class Chat(ChatBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True