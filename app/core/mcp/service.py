from peewee import MySQLDatabase
from app.database.models import MCP
from app.core.mcp.dto import MCPCreate, MCPUpdate
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class MCPService:
    @staticmethod
    @handle_transaction
    def create_mcp(db: MySQLDatabase, mcp: MCPCreate):
        """创建MCP"""
        db_mcp = MCP(**mcp.model_dump())
        db_mcp.save()
        return db_mcp

    @staticmethod
    def get_mcps(db: MySQLDatabase, skip: int = 0, limit: int = 100):
        """获取MCP列表（只读操作，不需要事务）"""
        return list(MCP.select().offset(skip).limit(limit))

    @staticmethod
    def get_mcp(db: MySQLDatabase, mcp_id: int):
        """获取单个MCP（只读操作，不需要事务）"""
        try:
            return MCP.get_by_id(mcp_id)
        except MCP.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_mcp(db: MySQLDatabase, mcp_id: int, mcp: MCPUpdate):
        """更新MCP"""
        try:
            db_mcp = MCP.get_by_id(mcp_id)
        except MCP.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"MCP {mcp_id} 不存在"
            )
        update_data = mcp.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_mcp, field, value)
        db_mcp.save()
        return db_mcp

    @staticmethod
    @handle_transaction
    def delete_mcp(db: MySQLDatabase, mcp_id: int):
        """删除MCP"""
        try:
            db_mcp = MCP.get_by_id(mcp_id)
        except MCP.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"MCP {mcp_id} 不存在"
            )
        db_mcp.delete_instance()
        return db_mcp