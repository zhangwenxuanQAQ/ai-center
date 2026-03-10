"""
MCP服务类，提供MCP相关的CRUD操作
"""

from datetime import datetime
from app.database.models import MCP
from app.services.mcp.dto import MCPCreate, MCPUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class MCPService:
    """
    MCP服务类
    
    提供MCP的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_mcp(mcp: MCPCreate):
        """
        创建MCP
        
        Args:
            mcp: MCP创建DTO
            
        Returns:
            MCP: 创建的MCP对象
        """
        db_mcp = MCP(**mcp.model_dump())
        db_mcp.save()
        return db_mcp

    @staticmethod
    def get_mcps(skip: int = 0, limit: int = 100):
        """
        获取MCP列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[MCP]: MCP列表
        """
        return list(MCP.select().offset(skip).limit(limit))

    @staticmethod
    def get_mcp(mcp_id: int):
        """
        获取单个MCP
        
        Args:
            mcp_id: MCP ID
            
        Returns:
            MCP: MCP对象，不存在则返回None
        """
        try:
            return MCP.get_by_id(mcp_id)
        except MCP.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_mcp(mcp_id: int, mcp: MCPUpdate):
        """
        更新MCP
        
        Args:
            mcp_id: MCP ID
            mcp: MCP更新DTO
            
        Returns:
            MCP: 更新后的MCP对象
            
        Raises:
            ResourceNotFoundError: MCP不存在
        """
        try:
            db_mcp = MCP.get_by_id(mcp_id)
        except MCP.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"MCP {mcp_id} 不存在"
            )
        update_data = mcp.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_mcp, field, value)
        db_mcp.updated_at = datetime.now()
        db_mcp.save()
        return db_mcp

    @staticmethod
    @handle_transaction
    def delete_mcp(mcp_id: int):
        """
        删除MCP
        
        Args:
            mcp_id: MCP ID
            
        Returns:
            MCP: 被删除的MCP对象
            
        Raises:
            ResourceNotFoundError: MCP不存在
        """
        try:
            db_mcp = MCP.get_by_id(mcp_id)
        except MCP.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"MCP {mcp_id} 不存在"
            )
        db_mcp.delete_instance()
        return db_mcp
