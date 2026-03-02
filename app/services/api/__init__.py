from fastapi import APIRouter
from .chatbot import router as chatbot_router
from .mcp import router as mcp_router
from .knowledge import router as knowledge_router
from .llm_model import router as llm_model_router
from .prompt import router as prompt_router
from .user import router as user_router
from .chat import router as chat_router

router = APIRouter()

router.include_router(chatbot_router, prefix="/chatbots", tags=["chatbots"])
router.include_router(mcp_router, prefix="/mcps", tags=["mcps"])
router.include_router(knowledge_router, prefix="/knowledges", tags=["knowledges"])
router.include_router(llm_model_router, prefix="/llm_models", tags=["llm_models"])
router.include_router(prompt_router, prefix="/prompts", tags=["prompts"])
router.include_router(user_router, prefix="/users", tags=["users"])
router.include_router(chat_router, prefix="/chats", tags=["chats"])