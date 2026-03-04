from fastapi import APIRouter
from .chatbot import router as chatbot_router
from .mcp import router as mcp_router
from .knowledge import router as knowledge_router
from .llm_model import router as llm_model_router
from .prompt import router as prompt_router
from .user import router as user_router
from .chat import router as chat_router
from .work_weixin_chat import router as work_weixin_chat_router

router = APIRouter()

router.include_router(chatbot_router, prefix="/chatbot", tags=["chatbot"])
router.include_router(mcp_router, prefix="/mcp", tags=["mcp"])
router.include_router(knowledge_router, prefix="/knowledge", tags=["knowledge"])
router.include_router(llm_model_router, prefix="/llm_model", tags=["llm_model"])
router.include_router(prompt_router, prefix="/prompt", tags=["prompt"])
router.include_router(user_router, prefix="/user", tags=["user"])
router.include_router(chat_router, prefix="/chat", tags=["chat"])
router.include_router(work_weixin_chat_router, prefix="/chat/work_weixin", tags=["work_weixin"])