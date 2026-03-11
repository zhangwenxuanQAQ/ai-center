"""
MCP控制器，提供MCP相关的API接口
"""

from fastapi import APIRouter, Body, Query
from app.services.mcp.service import MCPCategoryService, MCPServerService, MCPToolService
from app.services.mcp.dto import MCPCategoryCreate, MCPCategoryUpdate, MCPCategory, MCPServerCreate, MCPServerUpdate, MCPServer, MCPToolCreate, MCPToolUpdate, MCPTool
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


# MCP分类相关接口
@router.post("/category", response_model=ApiResponse)
def create_mcp_category(category: MCPCategoryCreate):
    """
    创建MCP分类
    
    Args:
        category: MCP分类创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = MCPCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="MCP分类创建成功")


@router.get("/category", response_model=ApiResponse)
def get_mcp_categories(skip: int = 0, limit: int = 100):
    """
    获取MCP分类列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = MCPCategoryService.get_categories(skip, limit)
    categories_data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取MCP分类列表成功")


@router.get("/category/tree", response_model=ApiResponse)
def get_mcp_category_tree():
    """
    获取MCP分类树形结构
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类树形结构
    """
    tree = MCPCategoryService.get_category_tree()
    return ResponseUtil.success(data=tree, message="获取MCP分类树成功")


@router.get("/category/{category_id}", response_model=ApiResponse)
def get_mcp_category(category_id: str):
    """
    获取单个MCP分类
    
    Args:
        category_id: MCP分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = MCPCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"MCP分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取MCP分类成功")


@router.post("/category/{category_id}", response_model=ApiResponse)
def update_mcp_category(category_id: str, category: MCPCategoryUpdate):
    """
    更新MCP分类
    
    Args:
        category_id: MCP分类ID
        category: MCP分类更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = MCPCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=db_category.__data__, message="MCP分类更新成功")


@router.post("/category/{category_id}/delete", response_model=ApiResponse)
def delete_mcp_category(category_id: str):
    """
    删除MCP分类
    
    Args:
        category_id: MCP分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = MCPCategoryService.delete_category(category_id)
    return ResponseUtil.success(data=db_category.__data__, message="MCP分类删除成功")


# MCP服务相关接口
@router.get("/server/source_types", response_model=ApiResponse)
def get_mcp_source_types():
    """
    获取MCP服务来源类型
    
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    source_types = MCPServerService.get_source_types()
    return ResponseUtil.success(data=source_types, message="获取来源类型成功")


@router.get("/server/transport_types", response_model=ApiResponse)
def get_mcp_transport_types():
    """
    获取MCP服务传输类型
    
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    transport_types = MCPServerService.get_transport_types()
    return ResponseUtil.success(data=transport_types, message="获取传输类型成功")


@router.get("/server/local_config", response_model=ApiResponse)
def get_mcp_local_config():
    """
    获取本地MCP服务配置
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含本地MCP配置
    """
    local_config = MCPServerService.get_local_mcp_config()
    return ResponseUtil.success(data=local_config, message="获取本地MCP配置成功")


@router.post("/server", response_model=ApiResponse)
def create_mcp_server(server: MCPServerCreate):
    """
    创建MCP服务
    
    Args:
        server: MCP服务创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_server = MCPServerService.create_server(server)
    return ResponseUtil.created(data=db_server.__data__, message="MCP服务创建成功")


@router.get("/server", response_model=ApiResponse)
def get_mcp_servers(
    page: int = Query(1, description="页码"),
    page_size: int = Query(12, description="每页数量"),
    category_id: str = Query(None, description="分类ID"),
    name: str = Query(None, description="服务名称（模糊查询）"),
    source_type: str = Query(None, description="来源类型"),
    code: str = Query(None, description="服务编码（模糊查询）")
):
    """
    获取MCP服务列表（分页）
    
    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        category_id: 分类ID（可选）
        name: 服务名称（模糊查询，可选）
        source_type: 来源类型（可选）
        code: 服务编码（模糊查询，可选）
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    servers = MCPServerService.get_servers(skip, page_size, category_id, name, source_type, code)
    total = MCPServerService.count_servers(category_id, name, source_type, code)
    servers_data = [server.__data__ for server in servers]
    return ResponseUtil.success(data={"data": servers_data, "total": total}, message="获取MCP服务列表成功")


@router.get("/server/{server_id}", response_model=ApiResponse)
def get_mcp_server(server_id: str):
    """
    获取单个MCP服务
    
    Args:
        server_id: MCP服务ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    server = MCPServerService.get_server(server_id)
    if server is None:
        return ResponseUtil.not_found(message=f"MCP服务 {server_id} 不存在")
    return ResponseUtil.success(data=server.__data__, message="获取MCP服务成功")


@router.post("/server/{server_id}", response_model=ApiResponse)
def update_mcp_server(server_id: str, server: MCPServerUpdate):
    """
    更新MCP服务
    
    Args:
        server_id: MCP服务ID
        server: MCP服务更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_server = MCPServerService.update_server(server_id, server)
    return ResponseUtil.success(data=db_server.__data__, message="MCP服务更新成功")


@router.post("/server/{server_id}/delete", response_model=ApiResponse)
def delete_mcp_server(server_id: str):
    """
    删除MCP服务
    
    Args:
        server_id: MCP服务ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_server = MCPServerService.delete_server(server_id)
    return ResponseUtil.success(data=db_server.__data__, message="MCP服务删除成功")


@router.post("/server/{server_id}/import_tools", response_model=ApiResponse)
def import_mcp_tools(server_id: str, tools: list = Body(...)):
    """
    导入MCP工具
    
    Args:
        server_id: MCP服务ID
        tools: 工具列表
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    imported_tools = MCPServerService.import_tools(server_id, tools)
    tools_data = [tool.__data__ for tool in imported_tools]
    return ResponseUtil.success(data=tools_data, message="MCP工具导入成功")


# MCP工具相关接口
@router.post("/tool", response_model=ApiResponse)
def create_mcp_tool(tool: MCPToolCreate):
    """
    创建MCP工具
    
    Args:
        tool: MCP工具创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_tool = MCPToolService.create_tool(tool)
    return ResponseUtil.created(data=db_tool.__data__, message="MCP工具创建成功")


@router.get("/tool", response_model=ApiResponse)
def get_mcp_tools(
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(100, description="返回的最大记录数"),
    server_id: str = Query(None, description="MCP服务ID")
):
    """
    获取MCP工具列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        server_id: MCP服务ID，可选
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    tools = MCPToolService.get_tools(skip, limit, server_id)
    tools_data = [tool.__data__ for tool in tools]
    return ResponseUtil.success(data=tools_data, message="获取MCP工具列表成功")


@router.get("/tool/{tool_id}", response_model=ApiResponse)
def get_mcp_tool(tool_id: str):
    """
    获取单个MCP工具
    
    Args:
        tool_id: MCP工具ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    tool = MCPToolService.get_tool(tool_id)
    if tool is None:
        return ResponseUtil.not_found(message=f"MCP工具 {tool_id} 不存在")
    return ResponseUtil.success(data=tool.__data__, message="获取MCP工具成功")


@router.post("/tool/{tool_id}", response_model=ApiResponse)
def update_mcp_tool(tool_id: str, tool: MCPToolUpdate):
    """
    更新MCP工具
    
    Args:
        tool_id: MCP工具ID
        tool: MCP工具更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_tool = MCPToolService.update_tool(tool_id, tool)
    return ResponseUtil.success(data=db_tool.__data__, message="MCP工具更新成功")


@router.post("/tool/{tool_id}/delete", response_model=ApiResponse)
def delete_mcp_tool(tool_id: str):
    """
    删除MCP工具
    
    Args:
        tool_id: MCP工具ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_tool = MCPToolService.delete_tool(tool_id)
    return ResponseUtil.success(data=db_tool.__data__, message="MCP工具删除成功")
