from sqlalchemy.orm import Session
from app.database.models import MCP
from app.core.mcp.dto import MCPCreate, MCPUpdate

class MCPService:
    @staticmethod
    def create_mcp(db: Session, mcp: MCPCreate):
        db_mcp = MCP(**mcp.model_dump())
        db.add(db_mcp)
        db.commit()
        db.refresh(db_mcp)
        return db_mcp

    @staticmethod
    def get_mcps(db: Session, skip: int = 0, limit: int = 100):
        return db.query(MCP).offset(skip).limit(limit).all()

    @staticmethod
    def get_mcp(db: Session, mcp_id: int):
        return db.query(MCP).filter(MCP.id == mcp_id).first()

    @staticmethod
    def update_mcp(db: Session, mcp_id: int, mcp: MCPUpdate):
        db_mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
        if db_mcp:
            update_data = mcp.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_mcp, field, value)
            db.commit()
            db.refresh(db_mcp)
        return db_mcp

    @staticmethod
    def delete_mcp(db: Session, mcp_id: int):
        db_mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
        if db_mcp:
            db.delete(db_mcp)
            db.commit()
        return db_mcp