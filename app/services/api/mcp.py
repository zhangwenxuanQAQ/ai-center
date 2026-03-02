from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.database.models import MCP
from app.core.mcp.dto import MCPCreate, MCPUpdate, MCP as MCPSchema

router = APIRouter()

@router.post("", response_model=MCPSchema)
def create_mcp(mcp: MCPCreate, db: Session = Depends(get_db)):
    db_mcp = MCP(**mcp.model_dump())
    db.add(db_mcp)
    db.commit()
    db.refresh(db_mcp)
    return db_mcp

@router.get("", response_model=List[MCPSchema])
def get_mcps(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    mcps = db.query(MCP).offset(skip).limit(limit).all()
    return mcps

@router.get("/{mcp_id}", response_model=MCPSchema)
def get_mcp(mcp_id: int, db: Session = Depends(get_db)):
    mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
    if mcp is None:
        raise HTTPException(status_code=404, detail="MCP not found")
    return mcp

@router.put("/{mcp_id}", response_model=MCPSchema)
def update_mcp(mcp_id: int, mcp: MCPUpdate, db: Session = Depends(get_db)):
    db_mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
    if db_mcp is None:
        raise HTTPException(status_code=404, detail="MCP not found")
    
    update_data = mcp.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_mcp, field, value)
    
    db.commit()
    db.refresh(db_mcp)
    return db_mcp

@router.delete("/{mcp_id}")
def delete_mcp(mcp_id: int, db: Session = Depends(get_db)):
    db_mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
    if db_mcp is None:
        raise HTTPException(status_code=404, detail="MCP not found")
    
    db.delete(db_mcp)
    db.commit()
    return {"detail": "MCP deleted"}