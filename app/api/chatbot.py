"""
聊天机器人控制器，提供聊天机器人相关的API接口
"""

import socket
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Optional
from app.services.chatbot.service import ChatbotService
from app.services.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotSchema
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.chatbot_constants import SOURCE_TYPE, SOURCE_CONFIG_FIELDS
from app.configs.config import config

router = APIRouter()


class BindModelRequest(BaseModel):
    """
    绑定模型请求DTO
    """
    model_id: str = Field(..., description="模型ID")
    model_type: str = Field(..., description="模型类型")
    config: Optional[dict] = Field(None, description="模型配置")


class UnbindModelRequest(BaseModel):
    """
    解绑模型请求DTO
    """
    model_type: str = Field(..., description="模型类型")


class UpdateModelConfigRequest(BaseModel):
    """
    更新模型配置请求DTO
    """
    model_type: str = Field(..., description="模型类型")
    config: dict = Field(..., description="模型配置")


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


@router.get("/{chatbot_id}/models", response_model=ApiResponse)
def get_chatbot_models(chatbot_id: str):
    """
    获取机器人绑定的模型列表
    
    Args:
        chatbot_id: 机器人ID
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含绑定的模型列表
    """
    models = ChatbotService.get_chatbot_models(chatbot_id)
    return ResponseUtil.success(data=models, message="获取机器人绑定模型成功")


@router.get("/{chatbot_id}/models/{model_type}", response_model=ApiResponse)
def get_chatbot_model_by_type(chatbot_id: str, model_type: str):
    """
    获取机器人指定类型的绑定模型
    
    Args:
        chatbot_id: 机器人ID
        model_type: 模型类型
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含绑定的模型信息
    """
    model = ChatbotService.get_chatbot_model_by_type(chatbot_id, model_type)
    if model is None:
        return ResponseUtil.success(data=None, message="该类型模型未绑定")
    return ResponseUtil.success(data=model, message="获取机器人绑定模型成功")


@router.post("/{chatbot_id}/models/bind", response_model=ApiResponse)
def bind_model_to_chatbot(chatbot_id: str, request: BindModelRequest):
    """
    绑定模型到机器人
    
    Args:
        chatbot_id: 机器人ID
        request: 绑定模型请求DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    chatbot_model = ChatbotService.bind_model_to_chatbot(chatbot_id, request.model_id, request.model_type, request.config)
    return ResponseUtil.success(data={"binding_id": str(chatbot_model.id)}, message="模型绑定成功")


@router.post("/{chatbot_id}/models/unbind", response_model=ApiResponse)
def unbind_model_from_chatbot(chatbot_id: str, request: UnbindModelRequest):
    """
    解绑机器人的模型
    
    Args:
        chatbot_id: 机器人ID
        request: 解绑模型请求DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    ChatbotService.unbind_model_from_chatbot(chatbot_id, request.model_type)
    return ResponseUtil.success(message="模型解绑成功")


@router.post("/{chatbot_id}/models/config", response_model=ApiResponse)
def update_model_config(chatbot_id: str, request: UpdateModelConfigRequest):
    """
    更新机器人模型配置
    
    Args:
        chatbot_id: 机器人ID
        request: 更新模型配置请求DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    chatbot_model = ChatbotService.update_model_config(chatbot_id, request.model_type, request.config)
    return ResponseUtil.success(data={"binding_id": str(chatbot_model.id)}, message="模型配置更新成功")


class BindPromptRequest(BaseModel):
    """
    绑定提示词请求DTO
    """
    prompt_type: str = Field(..., description="提示词类型：system/user")
    prompt_source: str = Field(..., description="提示词来源：library/manual")
    prompt_id: Optional[str] = Field(None, description="提示词ID（来自提示词库时必填）")
    prompt_name: Optional[str] = Field(None, description="提示词名称（手动输入时必填）")
    prompt_content: Optional[str] = Field(None, description="提示词内容（手动输入时必填）")
    sort_order: Optional[int] = Field(0, description="排序序号")
    prompt_binding_id: Optional[str] = Field(None, description="提示词绑定ID（编辑时必填）")


class UnbindPromptRequest(BaseModel):
    """
    解绑提示词请求DTO
    """
    prompt_binding_id: str = Field(..., description="提示词绑定ID")


class UpdatePromptSortOrderRequest(BaseModel):
    """
    更新提示词排序请求DTO
    """
    prompt_binding_id: str = Field(..., description="提示词绑定ID")
    sort_order: int = Field(..., description="排序序号")


@router.get("/{chatbot_id}/prompts", response_model=ApiResponse)
def get_chatbot_prompts(chatbot_id: str, prompt_type: str = None):
    """
    获取机器人绑定的提示词列表
    
    Args:
        chatbot_id: 机器人ID
        prompt_type: 提示词类型（可选）：system/user
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含绑定的提示词列表
    """
    prompts = ChatbotService.get_chatbot_prompts(chatbot_id, prompt_type)
    return ResponseUtil.success(data=prompts, message="获取机器人绑定提示词成功")


@router.post("/{chatbot_id}/prompts/bind", response_model=ApiResponse)
def bind_prompt_to_chatbot(chatbot_id: str, request: BindPromptRequest):
    """
    绑定提示词到机器人
    
    Args:
        chatbot_id: 机器人ID
        request: 绑定提示词请求DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    chatbot_prompt = ChatbotService.bind_prompt_to_chatbot(
        chatbot_id, 
        request.prompt_type, 
        request.prompt_source,
        request.prompt_id,
        request.prompt_name,
        request.prompt_content,
        request.sort_order,
        request.prompt_binding_id
    )
    return ResponseUtil.success(data={"binding_id": str(chatbot_prompt.id)}, message="提示词绑定成功")


@router.post("/{chatbot_id}/prompts/unbind", response_model=ApiResponse)
def unbind_prompt_from_chatbot(chatbot_id: str, request: UnbindPromptRequest):
    """
    解绑机器人的提示词
    
    Args:
        chatbot_id: 机器人ID
        request: 解绑提示词请求DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    ChatbotService.unbind_prompt_from_chatbot(chatbot_id, request.prompt_binding_id)
    return ResponseUtil.success(message="提示词解绑成功")


@router.post("/{chatbot_id}/prompts/sort", response_model=ApiResponse)
def update_prompt_sort_order(chatbot_id: str, request: UpdatePromptSortOrderRequest):
    """
    更新提示词排序
    
    Args:
        chatbot_id: 机器人ID
        request: 更新提示词排序请求DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    chatbot_prompt = ChatbotService.update_prompt_sort_order(chatbot_id, request.prompt_binding_id, request.sort_order)
    return ResponseUtil.success(data={"binding_id": str(chatbot_prompt.id)}, message="提示词排序更新成功")
