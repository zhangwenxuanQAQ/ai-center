from fastapi import APIRouter
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

router = APIRouter()

router.include_router(chatbot_router, prefix="/chatbot", tags=["chatbot"])
router.include_router(chatbot_category_router, prefix="/chatbot_category", tags=["chatbot_category"])
router.include_router(mcp_router, prefix="/mcp", tags=["mcp"])
router.include_router(toolkit_router, prefix="/toolkit", tags=["toolkit"])

router.include_router(knowledgebase_router, prefix="/knowledgebase", tags=["knowledgebase"])
router.include_router(llm_model_router, prefix="/llm_model", tags=["llm_model"])
router.include_router(prompt_router, prefix="/prompt", tags=["prompt"])
router.include_router(user_router, prefix="/user", tags=["user"])
router.include_router(chat_router, prefix="/chat", tags=["chat"])
router.include_router(datasource_router, prefix="/datasource", tags=["datasource"])
router.include_router(datasource_category_router, prefix="/datasource_category", tags=["datasource_category"])
router.include_router(system_monitor_router, prefix="/system", tags=["system"])
router.include_router(agent_router, prefix="/agent", tags=["agent"])
router.include_router(integration_management_router, prefix="/integration", tags=["integration"])

# 导出integration_api_router，在server_run.py中单独注册，使用/aicenter/api前缀
__all__ = ['router', 'integration_api_router']