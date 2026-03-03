"""
聊天机器人控制器，提供聊天机器人相关的API接口
"""

from fastapi import APIRouter
from app.services.chatbot.service import ChatbotService
from app.services.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotSchema
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


@router.post("", response_model=ApiResponse)
def create_chatbot(chatbot: ChatbotCreate):
    """
    创建聊天机器人
    
    Args:
        chatbot: 聊天机器人创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_chatbot = ChatbotService.create_chatbot(chatbot)
    return ResponseUtil.created(data=db_chatbot.__data__, message="聊天机器人创建成功")


@router.get("", response_model=ApiResponse)
def get_chatbots(skip: int = 0, limit: int = 100):
    """
    获取聊天机器人列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    chatbots = ChatbotService.get_chatbots(skip, limit)
    return ResponseUtil.success(data=chatbots, message="获取聊天机器人列表成功")


@router.get("/{chatbot_id}", response_model=ApiResponse)
def get_chatbot(chatbot_id: int):
    """
    获取单个聊天机器人
    
    Args:
        chatbot_id: 聊天机器人ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    chatbot = ChatbotService.get_chatbot(chatbot_id)
    if chatbot is None:
        return ResponseUtil.not_found(message=f"聊天机器人 {chatbot_id} 不存在")
    return ResponseUtil.success(data=chatbot, message="获取聊天机器人成功")


@router.post("/{chatbot_id}", response_model=ApiResponse)
def update_chatbot(chatbot_id: int, chatbot: ChatbotUpdate):
    """
    更新聊天机器人
    
    Args:
        chatbot_id: 聊天机器人ID
        chatbot: 聊天机器人更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_chatbot = ChatbotService.update_chatbot(chatbot_id, chatbot)
    return ResponseUtil.success(data=db_chatbot.__data__, message="聊天机器人更新成功")


@router.post("/{chatbot_id}/delete", response_model=ApiResponse)
def delete_chatbot(chatbot_id: int):
    """
    删除聊天机器人
    
    Args:
        chatbot_id: 聊天机器人ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_chatbot = ChatbotService.delete_chatbot(chatbot_id)
    return ResponseUtil.success(data=db_chatbot.__data__, message="聊天机器人删除成功")
