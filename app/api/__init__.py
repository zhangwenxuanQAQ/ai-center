from fastapi import APIRouter
from .chatbot import router as chatbot_router
from .chatbot_category import router as chatbot_category_router
from .knowledgebase import router as knowledgebase_router
from .llm_model import router as llm_model_router
from .prompt import router as prompt_router
from .user import router as user_router
from .chat import router as chat_router
from .chat.work_weixin_chat import router as work_weixin_router
from .datasource import router as datasource_router
from .datasource_category import router as datasource_category_router
from .system.monitor import router as system_monitor_router

# 只有当MCP服务启用时才导入mcp模块
from app.configs.config import config
mcp_enabled = config.config.get('mcp', {}).get('enabled', False)

if mcp_enabled:
    from .mcp import router as mcp_router

router = APIRouter()

router.include_router(chatbot_router, prefix="/chatbot", tags=["chatbot"])
router.include_router(chatbot_category_router, prefix="/chatbot_category", tags=["chatbot_category"])

if mcp_enabled:
    router.include_router(mcp_router, prefix="/mcp", tags=["mcp"])

router.include_router(knowledgebase_router, prefix="/knowledgebase", tags=["knowledgebase"])
router.include_router(llm_model_router, prefix="/llm_model", tags=["llm_model"])
router.include_router(prompt_router, prefix="/prompt", tags=["prompt"])
router.include_router(user_router, prefix="/user", tags=["user"])
router.include_router(chat_router, prefix="/chat", tags=["chat"])
router.include_router(work_weixin_router, prefix="/chat/work_weixin", tags=["work_weixin_chat"])
router.include_router(datasource_router, prefix="/datasource", tags=["datasource"])
router.include_router(datasource_category_router, prefix="/datasource_category", tags=["datasource_category"])
router.include_router(system_monitor_router, prefix="/system", tags=["system"])