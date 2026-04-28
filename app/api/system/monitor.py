"""
系统监控控制器，提供系统监控相关的API接口
"""

from fastapi import APIRouter
from app.services.system.service import MonitorService
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


@router.get("/monitor/version", response_model=ApiResponse)
def get_system_version():
    """
    获取系统版本号
    
    从PROJECT_VERSION文件读取系统版本信息
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含版本号
    """
    version = MonitorService.get_version()
    return ResponseUtil.success(data={"version": version}, message="获取系统版本号成功")


@router.get("/monitor/servers", response_model=ApiResponse)
def get_server_status():
    """
    获取系统服务状态
    
    读取server_config.yaml中的服务配置，并获取各服务的监控信息（包括MCP Server）
    敏感信息（密码等）不会返回
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含服务状态列表
    """
    servers = MonitorService.get_server_status()
    return ResponseUtil.success(data=servers, message="获取服务状态成功")


@router.get("/monitor/modules", response_model=ApiResponse)
def get_module_stats():
    """
    获取功能模块统计信息
    
    统计各功能模块的数量，包括机器人、知识库、文档、MCP服务、提示词、模型、数据源等
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含模块统计数据
    """
    stats = MonitorService.get_module_stats()
    return ResponseUtil.success(data=stats, message="获取模块统计信息成功")


@router.get("/monitor/overview", response_model=ApiResponse)
def get_system_overview():
    """
    获取系统监控概览
    
    一次性获取系统版本号、服务状态和功能模块统计信息
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含完整的监控概览数据
    """
    version = MonitorService.get_version()
    servers = MonitorService.get_server_status()
    modules = MonitorService.get_module_stats()
    return ResponseUtil.success(
        data={
            "version": version,
            "servers": servers,
            "modules": modules,
        },
        message="获取系统监控概览成功"
    )


@router.get("/monitor/stats/chatbot", response_model=ApiResponse)
def get_chatbot_stats():
    """
    获取机器人分类统计信息
    
    按照机器人分类显示每个分类下的机器人数量
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类统计数据
    """
    stats = MonitorService.get_chatbot_stats()
    return ResponseUtil.success(data=stats, message="获取机器人统计信息成功")


@router.get("/monitor/stats/knowledgebase", response_model=ApiResponse)
def get_knowledgebase_stats():
    """
    获取知识库分类统计信息
    
    按照知识库分类显示每个分类下的知识库数量，以及每个知识库的文档数量
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类和详情统计数据
    """
    stats = MonitorService.get_knowledgebase_stats()
    return ResponseUtil.success(data=stats, message="获取知识库统计信息成功")


@router.get("/monitor/stats/mcp", response_model=ApiResponse)
def get_mcp_stats():
    """
    获取MCP服务分类统计信息
    
    按照MCP服务分类显示每个分类下的MCP服务数量
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类统计数据
    """
    stats = MonitorService.get_mcp_stats()
    return ResponseUtil.success(data=stats, message="获取MCP服务统计信息成功")


@router.get("/monitor/stats/prompt", response_model=ApiResponse)
def get_prompt_stats():
    """
    获取提示词分类统计信息
    
    按照提示词分类显示每个分类下的提示词数量
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类统计数据
    """
    stats = MonitorService.get_prompt_stats()
    return ResponseUtil.success(data=stats, message="获取提示词统计信息成功")


@router.get("/monitor/stats/model", response_model=ApiResponse)
def get_model_stats():
    """
    获取模型分类和类型统计信息
    
    按照模型分类显示每个分类下的模型数量，以及每个模型类型下的模型数量
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类和类型统计数据
    """
    stats = MonitorService.get_model_stats()
    return ResponseUtil.success(data=stats, message="获取模型统计信息成功")


@router.get("/monitor/stats/datasource", response_model=ApiResponse)
def get_datasource_stats():
    """
    获取数据源分类和类型统计信息
    
    按照数据源分类显示每个分类下的数据源数量，以及每个数据源类型下的数据源数量
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类和类型统计数据
    """
    stats = MonitorService.get_datasource_stats()
    return ResponseUtil.success(data=stats, message="获取数据源统计信息成功")



