"""
插件集成对外API接口

提供OpenAI兼容的聊天接口和聊天记录查询接口
路由挂载在 /aicenter/api 前缀下
"""

import json
import logging
import asyncio
from fastapi import APIRouter, Request, Header
from fastapi.responses import StreamingResponse
from typing import Optional, List
from pydantic import BaseModel, Field

from app.services.chat.dto import QueryItem
from app.services.integration.service import ChatbotIntegrationService
from app.core.integration.api_chat import IntegrationChatCoreService
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()
logger = logging.getLogger(__name__)


class IntegrationChatRequest(BaseModel):
    """
    集成聊天请求体
    
    Attributes:
        query: 查询数组，每个元素包含type、content、mime_type
        chat_id: 对话ID（可选，不传则创建新对话）
        stream: 是否流式输出
        temporary: 临时会话模式，不保存对话和消息到数据库
    """
    query: List[QueryItem] = Field(..., description="查询数组")
    chat_id: Optional[str] = Field(None, max_length=40, description="对话ID")
    stream: bool = Field(True, description="是否流式输出")
    temporary: bool = Field(False, description="临时会话模式，不保存到数据库")


def get_api_key_from_header(authorization: Optional[str]) -> Optional[str]:
    """
    从Authorization请求头中提取API密钥
    
    Args:
        authorization: Authorization请求头值
        
    Returns:
        str: API密钥，提取失败返回None
    """
    if not authorization:
        return None
    if authorization.startswith("Bearer "):
        return authorization[7:]
    return authorization


@router.post("/v1/chat/completions", summary="聊天接口（OpenAI兼容）")
async def chat_completions(
    request: Request,
    chat_request: IntegrationChatRequest,
    authorization: Optional[str] = Header(None, description="Authorization: Bearer <api_key>")
):
    """
    聊天接口，支持流式和非流式输出
    
    请求头需要包含Authorization字段，值为Bearer + 机器人API密钥
    
    Args:
        request: 请求对象
        chat_request: 聊天请求参数
        authorization: Authorization请求头
        
    Returns:
        流式输出时返回StreamingResponse，否则返回ApiResponse
    """
    # 提取API密钥
    api_key = get_api_key_from_header(authorization)
    if not api_key:
        return ResponseUtil.error(code=401, message="缺少Authorization请求头或格式不正确")
    
    # 根据API密钥查找集成配置
    integration = ChatbotIntegrationService.get_by_api_key(api_key)
    if not integration:
        return ResponseUtil.error(code=401, message="API密钥无效")
    
    # 验证query不为空
    if not chat_request.query:
        return ResponseUtil.error(message="query参数不能为空")
    
    logger.info(f"集成聊天接口请求 - chatbot_id: {integration.chatbot_id}, chat_id: {chat_request.chat_id}, stream: {chat_request.stream}")
    
    try:
        if chat_request.stream:
            async def generate():
                try:
                    async for chunk in IntegrationChatCoreService.chat_stream(
                        query=chat_request.query,
                        chat_id=chat_request.chat_id,
                        integration=integration,
                        stream=True,
                        temporary=chat_request.temporary
                    ):
                        yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                        await asyncio.sleep(0)
                    yield "data: [DONE]\n\n"
                except Exception as e:
                    logger.error(f"集成聊天流式输出异常: {str(e)}", exc_info=True)
                    error_chunk = {"error": str(e)}
                    yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                    "Transfer-Encoding": "chunked"
                }
            )
        else:
            result = await IntegrationChatCoreService.chat(
                query=chat_request.query,
                chat_id=chat_request.chat_id,
                integration=integration,
                temporary=chat_request.temporary
            )
            
            if 'error' in result:
                return ResponseUtil.error(message=result['error'])
            
            return ResponseUtil.success(data=result)
    
    except Exception as e:
        logger.error(f"集成聊天接口异常: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"聊天失败: {str(e)}")


@router.get("/v1/chat/{chat_id}/messages", summary="获取聊天记录")
async def get_chat_messages(
    request: Request,
    chat_id: str,
    authorization: Optional[str] = Header(None, description="Authorization: Bearer <api_key>")
):
    """
    获取聊天记录
    
    请求头需要包含Authorization字段，值为Bearer + 机器人API密钥
    
    Args:
        request: 请求对象
        chat_id: 对话ID
        authorization: Authorization请求头
        
    Returns:
        ApiResponse: 消息列表
    """
    # 提取API密钥
    api_key = get_api_key_from_header(authorization)
    if not api_key:
        return ResponseUtil.error(code=401, message="缺少Authorization请求头或格式不正确")
    
    # 根据API密钥查找集成配置
    integration = ChatbotIntegrationService.get_by_api_key(api_key)
    if not integration:
        return ResponseUtil.error(code=401, message="API密钥无效")
    
    try:
        result = IntegrationChatCoreService.get_chat_messages(chat_id, integration)
        return ResponseUtil.success(data=result)
    except Exception as e:
        logger.error(f"获取聊天记录异常: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"获取聊天记录失败: {str(e)}")


@router.get("/v1/chats", summary="获取对话列表")
async def list_chats(
    request: Request,
    authorization: Optional[str] = Header(None, description="Authorization: Bearer <api_key>")
):
    """
    获取当前集成下的所有对话列表
    
    Args:
        request: 请求对象
        authorization: Authorization请求头
        
    Returns:
        ApiResponse: 对话列表
    """
    api_key = get_api_key_from_header(authorization)
    if not api_key:
        return ResponseUtil.error(code=401, message="缺少Authorization请求头或格式不正确")
    
    try:
        chats = ChatbotIntegrationService.list_chats(api_key)
        return ResponseUtil.success(data={"items": chats, "total": len(chats)})
    except Exception as e:
        logger.error(f"获取对话列表失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"获取对话列表失败: {str(e)}")
