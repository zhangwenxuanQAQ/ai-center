"""
MCP控制器，提供MCP相关的API接口
"""

from fastapi import APIRouter, Body, Query
from app.services.mcp.service import MCPCategoryService, MCPServerService, MCPToolService
from app.services.mcp.dto import (
    MCPCategoryCreate, MCPCategoryUpdate, MCPCategory, 
    MCPServerCreate, MCPServerUpdate, MCPServer, 
    MCPToolCreate, MCPToolUpdate, MCPTool,
    MCPConnectionTest, MCPConnectionTestResult
)
from app.utils.response import ResponseUtil, ApiResponse
from app.core.mcp.utils import convert_swagger_url_to_mcp_tools, convert_swagger_json_to_mcp_tools

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
    try:
        db_category = MCPCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="MCP分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


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


@router.post("/server/test_connection", response_model=ApiResponse)
async def test_mcp_server_connection(connection_test: MCPConnectionTest):
    """
    测试MCP服务连接
    
    Args:
        connection_test: MCP连接测试请求DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含测试结果
    """
    result = await MCPServerService.test_connection(
        transport_type=connection_test.transport_type,
        url=connection_test.url,
        config=connection_test.config
    )
    if result.get("success"):
        return ResponseUtil.success(data=result, message="MCP服务连接成功")
    else:
        return ResponseUtil.success(data=result, message=result.get("message", "MCP服务连接失败"))


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


@router.post("/server/{server_id}/import_swagger", response_model=ApiResponse)
def import_swagger_tools(
    server_id: str,
    swagger_url: str = Body(None, embed=True),
    swagger_json: str = Body(None, embed=True),
    include_patterns: list = Body(None, embed=True),
    exclude_patterns: list = Body(None, embed=True)
):
    """
    从Swagger/OpenAPI文档导入MCP工具
    
    Args:
        server_id: MCP服务ID
        swagger_url: Swagger文档URL
        swagger_json: Swagger文档JSON字符串
        include_patterns: 包含的API路径模式列表
        exclude_patterns: 排除的API路径模式列表
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    from app.core.mcp.utils import convert_swagger_url_to_mcp_tools, convert_swagger_json_to_mcp_tools
    
    server = MCPServerService.get_server(server_id)
    if server is None:
        return ResponseUtil.not_found(message=f"MCP服务 {server_id} 不存在")
    
    try:
        if swagger_url:
            tools = convert_swagger_url_to_mcp_tools(
                swagger_url=swagger_url,
                server_id=server_id,
                base_url=server.url,
                include_patterns=include_patterns,
                exclude_patterns=exclude_patterns
            )
        elif swagger_json:
            tools = convert_swagger_json_to_mcp_tools(
                swagger_json=swagger_json,
                server_id=server_id,
                base_url=server.url,
                include_patterns=include_patterns,
                exclude_patterns=exclude_patterns
            )
        else:
            return ResponseUtil.error(message="请提供swagger_url或swagger_json参数")
        
        imported_tools = MCPServerService.import_tools(server_id, tools)
        tools_data = [tool.__data__ for tool in imported_tools]
        return ResponseUtil.success(data=tools_data, message=f"成功从Swagger导入 {len(tools_data)} 个MCP工具")
    except Exception as e:
        return ResponseUtil.error(message=f"Swagger导入失败: {str(e)}")


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
    page: int = Query(0, description="页码，从0开始"),
    page_size: int = Query(10, description="每页数量"),
    server_id: str = Query(None, description="MCP服务ID"),
    name: str = Query(None, description="工具名称（模糊查询）"),
    description: str = Query(None, description="工具描述（模糊查询）"),
    status: str = Query(None, description="状态（true/false）")
):
    """
    获取MCP工具列表（分页）
    
    Args:
        page: 页码，从0开始
        page_size: 每页数量，默认10
        server_id: MCP服务ID，可选
        name: 工具名称（模糊查询，可选）
        description: 工具描述（模糊查询，可选）
        status: 状态（true/false，可选）
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = page * page_size
    tools = MCPToolService.get_tools(skip, page_size, server_id, name, description, status)
    total = MCPToolService.count_tools(server_id, name, description, status)
    tools_data = [tool.__data__ for tool in tools]
    return ResponseUtil.success(data={"data": tools_data, "total": total}, message="获取MCP工具列表成功")


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
