"""
API路由注册
根据版本配置条件性注册可用模块的API路由
"""

import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

# 导入所有路由模块
from .chatbot import router as chatbot_router
from .chatbot_category import router as chatbot_category_router
from .knowledgebase import router as knowledgebase_router
from .llm_model import router as llm_model_router
from .prompt import router as prompt_router
from .user import router as user_router
from .chat import router as chat_router
from .datasource import router as datasource_router
from .datasource_category import router as datasource_category_router
from .system.monitor import router as system_monitor_router
from .agent import router as agent_router
from .mcp import router as mcp_router
from .toolkit import router as toolkit_router
from .integration.management import router as integration_management_router
from .integration.api import router as integration_api_router
from .ontology import router as ontology_router

# 版本配置路由（始终注册，不依赖任何模块）
_version_router = APIRouter()

@_version_router.get("/version/config")
async def get_version_config():
    """获取当前版本的模块配置信息（始终可用）"""
    try:
        from app.versioning import version_manager
        version_info = version_manager.get_version_info()
        from app.utils.response import ResponseUtil
        return ResponseUtil.success(data=version_info, message="获取版本配置成功")
    except Exception as e:
        from app.utils.response import ResponseUtil
        return ResponseUtil.error(message=f"获取版本配置失败: {str(e)}")

# 模块路由映射定义
# key为模块名称，value为 (router, prefix, tag) 元组
_module_routes = {
    'chatbot': [(chatbot_router, "/chatbot", "chatbot"), (chatbot_category_router, "/chatbot_category", "chatbot_category")],
    'mcp': [(mcp_router, "/mcp", "mcp")],
    'toolkit': [(toolkit_router, "/toolkit", "toolkit")],
    'knowledgebase': [(knowledgebase_router, "/knowledgebase", "knowledgebase")],
    'llm_model': [(llm_model_router, "/llm_model", "llm_model")],
    'prompt': [(prompt_router, "/prompt", "prompt")],
    'user': [(user_router, "/user", "user")],
    'chat': [(chat_router, "/chat", "chat")],
    'datasource': [(datasource_router, "/datasource", "datasource"), (datasource_category_router, "/datasource_category", "datasource_category")],
    'system_monitor': [(system_monitor_router, "/system", "system")],
    'agent': [(agent_router, "/agent", "agent")],
    'integration': [(integration_management_router, "/integration", "integration")],
    'ontology': [(ontology_router, "/ontology", "ontology")],
}


def _get_enabled_modules():
    """
    获取当前版本启用的模块列表
    如果版本管理器未加载，则默认启用所有模块
    """
    try:
        from app.versioning import version_manager
        if version_manager._config_loaded:
            enabled = version_manager.get_enabled_modules()
            # 如果结果为空（不应发生），默认启用所有模块
            if enabled:
                return enabled
    except Exception:
        pass

    # 默认启用所有模块
    return list(_module_routes.keys())


def create_router() -> APIRouter:
    """
    根据版本配置创建并注册路由
    只有启用模块的路由才会被注册
    """
    router = APIRouter()
    enabled_modules = _get_enabled_modules()

    logger.info(f"[VERSION] 注册API路由，启用模块: {enabled_modules}")

    # 始终注册版本配置路由
    router.include_router(_version_router, tags=["version"])
    logger.debug("[VERSION] 已注册版本配置路由 (始终可用)")

    for module_name, routes in _module_routes.items():
        if module_name in enabled_modules:
            for route, prefix, tag in routes:
                router.include_router(route, prefix=prefix, tags=[tag])
                logger.debug(f"[VERSION]  已注册路由: {prefix} (模块: {module_name})")
        else:
            logger.info(f"[VERSION]  跳过路由注册: 模块 {module_name} 未启用")

    return router


# 创建路由器
router = create_router()

# 导出integration_api_router，在server.py中单独注册，使用/aicenter/api前缀
# 注意：integration_api_router的注册也需要检查
__all__ = ['router', 'integration_api_router', 'create_router']