"""
MCP控制器，提供MCP相关的API接口
"""

from fastapi import APIRouter
from app.services.mcp.service import MCPService
from app.services.mcp.dto import MCPCreate, MCPUpdate, MCP as MCPSchema
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


@router.post("", response_model=ApiResponse)
def create_mcp(mcp: MCPCreate):
    """
    创建MCP
    
    Args:
        mcp: MCP创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_mcp = MCPService.create_mcp(mcp)
    return ResponseUtil.created(data=db_mcp.__data__, message="MCP创建成功")


@router.get("", response_model=ApiResponse)
def get_mcps(skip: int = 0, limit: int = 100):
    """
    获取MCP列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    mcps = MCPService.get_mcps(skip, limit)
    mcps_data = [mcp.__data__ for mcp in mcps]
    return ResponseUtil.success(data=mcps_data, message="获取MCP列表成功")


@router.get("/{mcp_id}", response_model=ApiResponse)
def get_mcp(mcp_id: int):
    """
    获取单个MCP
    
    Args:
        mcp_id: MCP ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    mcp = MCPService.get_mcp(mcp_id)
    if mcp is None:
        return ResponseUtil.not_found(message=f"MCP {mcp_id} 不存在")
    return ResponseUtil.success(data=mcp.__data__, message="获取MCP成功")


@router.post("/{mcp_id}", response_model=ApiResponse)
def update_mcp(mcp_id: int, mcp: MCPUpdate):
    """
    更新MCP
    
    Args:
        mcp_id: MCP ID
        mcp: MCP更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_mcp = MCPService.update_mcp(mcp_id, mcp)
    return ResponseUtil.success(data=db_mcp.__data__, message="MCP更新成功")


@router.post("/{mcp_id}/delete", response_model=ApiResponse)
def delete_mcp(mcp_id: int):
    """
    删除MCP
    
    Args:
        mcp_id: MCP ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_mcp = MCPService.delete_mcp(mcp_id)
    return ResponseUtil.success(data=db_mcp.__data__, message="MCP删除成功")
