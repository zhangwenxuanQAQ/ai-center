"""
聊天控制器，提供聊天相关的API接口
"""

from fastapi import APIRouter
from app.services.chat.service import ChatService
from app.services.chat.dto import ChatCreate, ChatUpdate, Chat as ChatSchema
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


@router.post("", response_model=ApiResponse)
def create_chat(chat: ChatCreate):
    """
    创建聊天记录
    
    Args:
        chat: 聊天创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_chat = ChatService.create_chat(chat)
    return ResponseUtil.created(data=db_chat.__data__, message="聊天记录创建成功")


@router.get("", response_model=ApiResponse)
def get_chats(skip: int = 0, limit: int = 100):
    """
    获取聊天记录列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    chats = ChatService.get_chats(skip, limit)
    chats_data = [chat.__data__ for chat in chats]
    return ResponseUtil.success(data=chats_data, message="获取聊天记录列表成功")


@router.get("/{chat_id}", response_model=ApiResponse)
def get_chat(chat_id: int):
    """
    获取单个聊天记录
    
    Args:
        chat_id: 聊天ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    chat = ChatService.get_chat(chat_id)
    if chat is None:
        return ResponseUtil.not_found(message=f"聊天记录 {chat_id} 不存在")
    return ResponseUtil.success(data=chat.__data__, message="获取聊天记录成功")


@router.post("/{chat_id}", response_model=ApiResponse)
def update_chat(chat_id: int, chat: ChatUpdate):
    """
    更新聊天记录
    
    Args:
        chat_id: 聊天ID
        chat: 聊天更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_chat = ChatService.update_chat(chat_id, chat)
    return ResponseUtil.success(data=db_chat.__data__, message="聊天记录更新成功")


@router.post("/{chat_id}/delete", response_model=ApiResponse)
def delete_chat(chat_id: int):
    """
    删除聊天记录
    
    Args:
        chat_id: 聊天ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_chat = ChatService.delete_chat(chat_id)
    return ResponseUtil.success(data=db_chat.__data__, message="聊天记录删除成功")
