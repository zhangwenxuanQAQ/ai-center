"""
聊天机器人控制器，提供聊天机器人相关的API接口
"""

from fastapi import APIRouter
from app.services.chatbot.service import ChatbotService
from app.services.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotSchema
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.chatbot_constants import SOURCE_TYPE, SOURCE_CONFIG_FIELDS
from app.configs.config import config

router = APIRouter()


@router.get("/source_types", response_model=ApiResponse)
def get_source_types():
    """
    获取支持的机器人来源类型
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含来源类型和配置参数
    """
    configs = []
    for source_type, source_name in SOURCE_TYPE.items():
        config_fields = SOURCE_CONFIG_FIELDS.get(source_type, [])
        
        config_item = {
            "source_type": source_type,
            "source_name": source_name,
            "config_fields": config_fields
        }
        
        if source_type == "work_weixin":
            server_host = config.server.get('host', '0.0.0.0')
            server_port = config.server.get('http_port', 8081)
            callback_url = f"http://{server_host}:{server_port}/aicenter/v1/chat/work_weixin/callback/{{chatbot_id}}"
            for field in config_fields:
                if field.get('name') == 'callback_url':
                    field['default_value'] = callback_url
                    break
        
        configs.append(config_item)
    
    return ResponseUtil.success(data=configs, message="获取机器人来源类型成功")


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
