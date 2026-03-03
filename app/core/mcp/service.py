from sqlalchemy.orm import Session
from app.database.models import MCP
from app.core.mcp.dto import MCPCreate, MCPUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class MCPService:
    @staticmethod
    @handle_transaction
    def create_mcp(db: Session, mcp: MCPCreate):
        """创建 MCP"""
        db_mcp = MCP(**mcp.model_dump())
        db.add(db_mcp)
        db.refresh(db_mcp)
        return db_mcp

    @staticmethod
    def get_mcps(db: Session, skip: int = 0, limit: int = 100):
        """获取 MCP 列表（只读操作，不需要事务）"""
        return db.query(MCP).offset(skip).limit(limit).all()

    @staticmethod
    def get_mcp(db: Session, mcp_id: int):
        """获取单个 MCP（只读操作，不需要事务）"""
        return db.query(MCP).filter(MCP.id == mcp_id).first()

    @staticmethod
    @handle_transaction
    def update_mcp(db: Session, mcp_id: int, mcp: MCPUpdate):
        """更新 MCP"""
        db_mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
        if not db_mcp:
            raise ResourceNotFoundError(
                message=f"MCP {mcp_id} 不存在"
            )
        update_data = mcp.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_mcp, field, value)
        db.refresh(db_mcp)
        return db_mcp

    @staticmethod
    @handle_transaction
    def delete_mcp(db: Session, mcp_id: int):
        """删除 MCP"""
        db_mcp = db.query(MCP).filter(MCP.id == mcp_id).first()
        if not db_mcp:
            raise ResourceNotFoundError(
                message=f"MCP {mcp_id} 不存在"
            )
        db.delete(db_mcp)
        return db_mcp