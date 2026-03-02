from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class MCPBase(BaseModel):
    name: str
    url: str
    api_key: str
    status: bool = True

class MCPCreate(MCPBase):
    pass

class MCPUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    api_key: Optional[str] = None
    status: Optional[bool] = None

class MCP(MCPBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True