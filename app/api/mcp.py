from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.database.database import get_db
from app.core.mcp.service import MCPService
from app.core.mcp.dto import MCPCreate, MCPUpdate, MCP as MCPSchema

router = APIRouter()

@router.post("", response_model=MCPSchema)
def create_mcp(mcp: MCPCreate, db = Depends(get_db)):
    return MCPService.create_mcp(db, mcp)

@router.get("", response_model=List[MCPSchema])
def get_mcps(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    return MCPService.get_mcps(db, skip, limit)

@router.get("/{mcp_id}", response_model=MCPSchema)
def get_mcp(mcp_id: int, db = Depends(get_db)):
    mcp = MCPService.get_mcp(db, mcp_id)
    if mcp is None:
        raise HTTPException(status_code=404, detail="MCP not found")
    return mcp

@router.put("/{mcp_id}", response_model=MCPSchema)
def update_mcp(mcp_id: int, mcp: MCPUpdate, db = Depends(get_db)):
    return MCPService.update_mcp(db, mcp_id, mcp)

@router.delete("/{mcp_id}")
def delete_mcp(mcp_id: int, db = Depends(get_db)):
    return MCPService.delete_mcp(db, mcp_id)