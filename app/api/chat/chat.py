"""
对话控制器，提供对话相关的API接口
"""

import json
import logging
from fastapi import APIRouter, Request, Query, Depends
from fastapi.responses import StreamingResponse
from typing import Optional

from app.services.chat.dto import (
    ChatCreate, ChatUpdate, Chat as ChatDTO,
    ChatRequest, ChatListResponse, ChatMessageListResponse
)
from app.services.chat.service import ChatService, ChatMessageService
from app.core.chat.chat_service import ChatCoreService
from app.utils.response import ResponseUtil, ApiResponse
from app.core.exceptions import ResourceNotFoundError

router = APIRouter()
logger = logging.getLogger(__name__)


def get_user_id(request: Request) -> str:
    """
    获取用户ID
    
    Args:
        request: 请求对象
        
    Returns:
        str: 用户ID
    """
    return request.headers.get('X-User-ID', 'default_user')


@router.get("/list", summary="获取对话列表")
async def get_chat_list(
    request: Request,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="搜索关键词")
) -> ApiResponse:
    """
    获取用户的对话列表（分页）
    
    Args:
        request: 请求对象
        page: 页码
        page_size: 每页数量
        keyword: 搜索关键词
        
    Returns:
        ApiResponse: 对话列表响应
        
    错误码:
        - 200: 成功
    """
    user_id = get_user_id(request)
    result = ChatService.get_chat_list(user_id, page, page_size, keyword)
    return ResponseUtil.success(data=result.model_dump())


@router.get("/{chat_id}", summary="获取对话详情")
async def get_chat(
    request: Request,
    chat_id: str
) -> ApiResponse:
    """
    获取单个对话详情
    
    Args:
        request: 请求对象
        chat_id: 对话ID
        
    Returns:
        ApiResponse: 对话详情
        
    错误码:
        - 200: 成功
        - 404: 对话不存在
    """
    user_id = get_user_id(request)
    chat = ChatService.get_chat(chat_id, user_id)
    
    if not chat:
        return ResponseUtil.not_found(message="对话不存在")
    
    return ResponseUtil.success(data=ChatDTO.model_validate(chat).model_dump())


@router.post("/create", summary="创建对话")
async def create_chat(
    request: Request,
    chat_create: ChatCreate
) -> ApiResponse:
    """
    创建新对话
    
    Args:
        request: 请求对象
        chat_create: 对话创建参数
        
    Returns:
        ApiResponse: 创建的对话信息
        
    错误码:
        - 200: 成功
    """
    user_id = get_user_id(request)
    chat = ChatService.create_chat(user_id, chat_create)
    return ResponseUtil.success(data=ChatDTO.model_validate(chat).model_dump())


@router.post("/update/{chat_id}", summary="更新对话")
async def update_chat(
    request: Request,
    chat_id: str,
    chat_update: ChatUpdate
) -> ApiResponse:
    """
    更新对话信息
    
    Args:
        request: 请求对象
        chat_id: 对话ID
        chat_update: 对话更新参数
        
    Returns:
        ApiResponse: 更新后的对话信息
        
    错误码:
        - 200: 成功
        - 404: 对话不存在
    """
    user_id = get_user_id(request)
    try:
        chat = ChatService.update_chat(chat_id, user_id, chat_update)
        return ResponseUtil.success(data=ChatDTO.model_validate(chat).model_dump())
    except ResourceNotFoundError as e:
        return ResponseUtil.not_found(message=e.message)


@router.post("/delete/{chat_id}", summary="删除对话")
async def delete_chat(
    request: Request,
    chat_id: str
) -> ApiResponse:
    """
    删除对话（软删除）
    
    Args:
        request: 请求对象
        chat_id: 对话ID
        
    Returns:
        ApiResponse: 删除结果
        
    错误码:
        - 200: 成功
        - 404: 对话不存在
    """
    user_id = get_user_id(request)
    try:
        ChatService.delete_chat(chat_id, user_id)
        return ResponseUtil.success(message="对话已删除")
    except ResourceNotFoundError as e:
        return ResponseUtil.not_found(message=e.message)


@router.post("/toggle_top/{chat_id}", summary="切换置顶状态")
async def toggle_top(
    request: Request,
    chat_id: str
) -> ApiResponse:
    """
    切换对话置顶状态
    
    Args:
        request: 请求对象
        chat_id: 对话ID
        
    Returns:
        ApiResponse: 更新后的对话信息
        
    错误码:
        - 200: 成功
        - 404: 对话不存在
    """
    user_id = get_user_id(request)
    try:
        chat = ChatService.toggle_top(chat_id, user_id)
        return ResponseUtil.success(data=ChatDTO.model_validate(chat).model_dump())
    except ResourceNotFoundError as e:
        return ResponseUtil.not_found(message=e.message)


@router.post("/sort/{chat_id}", summary="更新排序")
async def update_sort(
    request: Request,
    chat_id: str,
    sort_order: int = Query(..., description="排序序号")
) -> ApiResponse:
    """
    更新对话排序序号
    
    Args:
        request: 请求对象
        chat_id: 对话ID
        sort_order: 排序序号
        
    Returns:
        ApiResponse: 更新后的对话信息
        
    错误码:
        - 200: 成功
        - 404: 对话不存在
    """
    user_id = get_user_id(request)
    try:
        chat = ChatService.update_sort_order(chat_id, user_id, sort_order)
        return ResponseUtil.success(data=ChatDTO.model_validate(chat).model_dump())
    except ResourceNotFoundError as e:
        return ResponseUtil.not_found(message=e.message)


@router.get("/{chat_id}/messages", summary="获取对话消息列表")
async def get_chat_messages(
    request: Request,
    chat_id: str
) -> ApiResponse:
    """
    获取对话的消息列表
    
    Args:
        request: 请求对象
        chat_id: 对话ID
        
    Returns:
        ApiResponse: 消息列表
        
    错误码:
        - 200: 成功
    """
    result = ChatMessageService.get_messages_by_chat(chat_id)
    return ResponseUtil.success(data=result.model_dump())


@router.post("/completions", summary="聊天接口")
async def chat_completions(
    request: Request,
    chat_request: ChatRequest
):
    """
    聊天接口，支持流式和非流式输出
    
    Args:
        request: 请求对象
        chat_request: 聊天请求参数
            - config: 对话配置JSON
            - query: 查询数组，每个元素包含type、content、mime_type
            - model_id: 模型ID
            - chatbot_id: 机器人ID
            - chat_id: 对话ID（可选，不传则创建新对话）
            - stream: 是否流式输出
            
    Returns:
        流式输出时返回StreamingResponse，否则返回ApiResponse
        
    错误码:
        - 200: 成功
        - 400: 参数错误
        - 404: 资源不存在
    """
    user_id = get_user_id(request)
    
    if not chat_request.query:
        return ResponseUtil.error(message="query参数不能为空")
    
    try:
        if chat_request.stream:
            def generate():
                for chunk in ChatCoreService.chat_stream(
                    user_id=user_id,
                    query=chat_request.query,
                    model_id=chat_request.model_id,
                    chatbot_id=chat_request.chatbot_id,
                    chat_id=chat_request.chat_id,
                    config=chat_request.config
                ):
                    if 'error' in chunk:
                        yield f"data: {json.dumps({'error': chunk['error'], 'chat_id': chunk.get('chat_id')}, ensure_ascii=False)}\n\n"
                        return
                    
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                
                yield "data: [DONE]\n\n"
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"
                }
            )
        else:
            result = ChatCoreService.chat(
                user_id=user_id,
                query=chat_request.query,
                model_id=chat_request.model_id,
                chatbot_id=chat_request.chatbot_id,
                chat_id=chat_request.chat_id,
                config=chat_request.config
            )
            
            if 'error' in result:
                return ResponseUtil.error(message=result['error'])
            
            return ResponseUtil.success(data=result)
            
    except ResourceNotFoundError as e:
        return ResponseUtil.not_found(message=e.message)
    except Exception as e:
        logger.error(f"聊天接口异常: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"聊天失败: {str(e)}")
