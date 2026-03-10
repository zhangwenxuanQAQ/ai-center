"""
聊天机器人控制器，提供聊天机器人相关的API接口
"""

import socket
from fastapi import APIRouter
from app.services.chatbot.service import ChatbotService
from app.services.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotSchema
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.chatbot_constants import SOURCE_TYPE, SOURCE_CONFIG_FIELDS
from app.configs.config import config

router = APIRouter()


def get_local_ip():
    """
    获取本机IP地址
    
    Returns:
        str: 本机IP地址
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'


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
            server_host = get_local_ip()
            server_port = config.server.get('http_port', 8081)
            callback_url = f"http://{server_host}:{server_port}/aicenter/v1/chat/work_weixin/callback/{{code}}"
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
def get_chatbots(category_id: str = None, page: int = 1, page_size: int = 12, name: str = None, source_type: str = None, code: str = None):
    """
    获取聊天机器人列表
    
    Args:
        category_id: 分类ID（可选）
        page: 页码，默认1
        page_size: 每页数量，默认12
        name: 机器人名称（模糊查询）
        source_type: 来源类型
        code: 机器人编码（模糊查询）
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    # 计算skip值
    skip = (page - 1) * page_size
    # 获取机器人列表
    chatbots = ChatbotService.get_chatbots(skip, page_size, category_id, name, source_type, code)
    # 计算总记录数
    total = len(ChatbotService.get_chatbots(0, 10000, category_id, name, source_type, code))  # 暂时获取所有记录来计算总数
    return ResponseUtil.success(data={"data": chatbots, "total": total}, message="获取聊天机器人列表成功")


@router.get("/{chatbot_id}", response_model=ApiResponse)
def get_chatbot(chatbot_id: str):
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
def update_chatbot(chatbot_id: str, chatbot: ChatbotUpdate):
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
def delete_chatbot(chatbot_id: str):
    """
    删除聊天机器人
    
    Args:
        chatbot_id: 聊天机器人ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_chatbot = ChatbotService.delete_chatbot(chatbot_id)
    return ResponseUtil.success(data=db_chatbot.__data__, message="聊天机器人删除成功")
