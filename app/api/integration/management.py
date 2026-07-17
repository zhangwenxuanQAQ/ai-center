"""
插件集成管理接口

提供集成配置的创建、查询、更新等管理功能
路由挂载在 /aicenter/v1/integration 前缀下
"""

import json
import logging
import uuid
from fastapi import APIRouter, Request
from fastapi.responses import Response
from typing import Optional

from app.services.integration.service import ChatbotIntegrationService
from app.services.integration.dto import IntegrationResponse
from app.services.chatbot.service import ChatbotService
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.integration_constants import INTEGRATION_CONFIG_PARAMS
from app.database.redis_utils import redis_utils

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chatbot/{chatbot_id}/integration", summary="创建或更新集成配置")
async def create_or_update_integration(
    request: Request,
    chatbot_id: str
):
    """
    创建或更新机器人集成配置
    
    如果该机器人已有集成配置，则更新；否则创建新的。
    创建时自动生成API密钥。
    
    Args:
        request: 请求对象
        chatbot_id: 机器人ID
        
    Returns:
        ApiResponse: 集成配置信息
    """
    try:
        # 解析请求体（可选）
        body = None
        try:
            body = await request.json()
        except Exception:
            pass
        
        integration = ChatbotIntegrationService.create_or_update(chatbot_id, body)
        
        # 返回数据
        result = {
            "id": integration.id,
            "chatbot_id": integration.chatbot_id,
            "api_key": json.loads(integration.api_key) if integration.api_key else [],
            "openai_base_url": integration.openai_base_url,
            "configs": json.loads(integration.configs) if integration.configs else {},
            "created_at": integration.created_at.strftime("%Y-%m-%d %H:%M:%S") if integration.created_at else None,
            "updated_at": integration.updated_at.strftime("%Y-%m-%d %H:%M:%S") if integration.updated_at else None
        }
        
        return ResponseUtil.success(data=result)
    except Exception as e:
        logger.error(f"创建/更新集成配置失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"操作失败: {str(e)}")


@router.get("/chatbot/{chatbot_id}/integration", summary="获取集成配置")
async def get_integration(
    request: Request,
    chatbot_id: str
):
    """
    获取机器人的集成配置
    
    Args:
        request: 请求对象
        chatbot_id: 机器人ID
        
    Returns:
        ApiResponse: 集成配置信息
    """
    integration = ChatbotIntegrationService.get_by_chatbot_id(chatbot_id)
    
    if not integration:
        return ResponseUtil.success(data=None, message="尚未配置集成")
    
    result = {
        "id": integration.id,
        "chatbot_id": integration.chatbot_id,
        "api_key": json.loads(integration.api_key) if integration.api_key else [],
        "openai_base_url": integration.openai_base_url,
        "configs": json.loads(integration.configs) if integration.configs else {},
        "created_at": integration.created_at.strftime("%Y-%m-%d %H:%M:%S") if integration.created_at else None,
        "updated_at": integration.updated_at.strftime("%Y-%m-%d %H:%M:%S") if integration.updated_at else None
    }
    
    return ResponseUtil.success(data=result)


@router.post("/chatbot/{chatbot_id}/integration/regenerate_key", summary="重新生成API密钥")
async def regenerate_api_key(
    request: Request,
    chatbot_id: str
):
    """
    重新生成机器人的API密钥
    
    重新生成后，旧的API密钥将失效。
    
    Args:
        request: 请求对象
        chatbot_id: 机器人ID
        
    Returns:
        ApiResponse: 更新后的集成配置
    """
    try:
        integration = ChatbotIntegrationService.regenerate_api_key(chatbot_id)
        
        result = {
            "id": integration.id,
            "chatbot_id": integration.chatbot_id,
            "api_key": json.loads(integration.api_key) if integration.api_key else [],
            "openai_base_url": integration.openai_base_url,
            "created_at": integration.created_at.strftime("%Y-%m-%d %H:%M:%S") if integration.created_at else None,
            "updated_at": integration.updated_at.strftime("%Y-%m-%d %H:%M:%S") if integration.updated_at else None
        }
        
        return ResponseUtil.success(data=result, message="API密钥已重新生成")
    except Exception as e:
        logger.error(f"重新生成API密钥失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"操作失败: {str(e)}")


@router.get("/chatbot/{chatbot_id}/integration/html_code", summary="获取嵌入HTML代码")
async def get_html_code(
    request: Request,
    chatbot_id: str,
    type: str = "sidebar"
):
    """
    获取嵌入HTML代码
    
    Args:
        request: 请求对象
        chatbot_id: 机器人ID
        type: 集成类型（sidebar/iframe）
        
    Returns:
        ApiResponse: HTML嵌入代码
    """
    try:
        html_code = ChatbotIntegrationService.get_html_code(chatbot_id, type)
        return ResponseUtil.success(data={"html_code": html_code, "type": type})
    except Exception as e:
        logger.error(f"获取嵌入HTML代码失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"操作失败: {str(e)}")


@router.get("/chatbot/{chatbot_id}/integration/configs", summary="获取集成配置详情（含示例代码）")
async def get_integration_configs(
    request: Request,
    chatbot_id: str
):
    """
    获取集成配置详情，包含API示例代码、界面配置、HTML嵌入代码等
    
    Args:
        request: 请求对象
        chatbot_id: 机器人ID
        
    Returns:
        ApiResponse: 完整配置信息
    """
    try:
        result = ChatbotIntegrationService.get_configs_with_examples(chatbot_id)
        
        integration_data = None
        if result["integration"]:
            integration = result["integration"]
            integration_data = {
                "id": integration.id,
                "chatbot_id": integration.chatbot_id,
                "api_key": json.loads(integration.api_key) if integration.api_key else [],
                "openai_base_url": integration.openai_base_url,
                "created_at": integration.created_at.strftime("%Y-%m-%d %H:%M:%S") if integration.created_at else None,
                "updated_at": integration.updated_at.strftime("%Y-%m-%d %H:%M:%S") if integration.updated_at else None
            }
        
        return ResponseUtil.success(data={
            "integration": integration_data,
            "configs": result["configs"]
        })
    except Exception as e:
        logger.error(f"获取集成配置详情失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"操作失败: {str(e)}")


@router.get("/config_params", summary="获取集成配置参数定义")
async def get_config_params(
    request: Request,
    chatbot_id: str = None
):
    """
    获取集成界面配置参数定义，前端根据此定义渲染配置控件
    
    如果提供了 chatbot_id，会将机器人头像添加到机器人头像列表的第一项
    
    Args:
        request: 请求对象
        chatbot_id: 机器人ID（可选）
        
    Returns:
        ApiResponse: 配置参数定义列表
    """
    try:
        # 复制配置参数，避免修改原始数据
        import copy
        config_params = copy.deepcopy(INTEGRATION_CONFIG_PARAMS)
        
        # 获取机器人头像（如果提供了 chatbot_id）
        chatbot_avatar_src = None
        if chatbot_id:
            chatbot = ChatbotService.get_chatbot(chatbot_id)
            if chatbot and chatbot.get("avatar"):
                chatbot_avatar_src = chatbot.get("avatar")
        
        # 遍历配置参数，为头像配置项添加默认头像列表
        for param in config_params:
            if param.get("key") == "interface_config":
                for child in param.get("children", []):
                    if child.get("key") == "common_config":
                        for item in child.get("children", []):
                            if item.get("type") == "upload":
                                avatar_type = item.get("avatar_type")
                                # 「禁止」选项，选中表示不使用自定义头像
                                forbidden_option = {"key": "forbidden", "src": "", "label": "禁止"}
                                # 默认头像路径（使用 integration/assets 目录）
                                default_user_avatars = [
                                    {"key": "user-1", "src": "/assets/integration/user-1.svg", "label": "用户1"},
                                    {"key": "user-2", "src": "/assets/integration/user-2.svg", "label": "用户2"},
                                    {"key": "user-3", "src": "/assets/integration/user-3.svg", "label": "用户3"},
                                ]
                                default_bot_avatars = [
                                    {"key": "assistant-1", "src": "/assets/integration/assistant-1.svg", "label": "机器人1"},
                                    {"key": "assistant-2", "src": "/assets/integration/assistant-2.svg", "label": "机器人2"},
                                    {"key": "assistant-3", "src": "/assets/integration/assistant-3.svg", "label": "机器人3"},
                                ]
                                
                                if avatar_type == "user":
                                    # 用户头像列表：禁止 + 默认用户头像
                                    item["default_avatars"] = [forbidden_option] + default_user_avatars
                                elif avatar_type == "bot":
                                    # 机器人头像列表：禁止 + 机器人头像（如果有） + 默认机器人头像
                                    bot_avatars = [forbidden_option]
                                    if chatbot_avatar_src:
                                        bot_avatars.append({
                                            "key": "chatbot_avatar",
                                            "label": "机器人头像",
                                            "src": chatbot_avatar_src
                                        })
                                    bot_avatars.extend(default_bot_avatars)
                                    item["default_avatars"] = bot_avatars
        
        return ResponseUtil.success(data=config_params)
    except Exception as e:
        logger.error(f"获取配置参数失败: {str(e)}", exc_info=True)
        # 如果出错，返回原始配置参数
        return ResponseUtil.success(data=INTEGRATION_CONFIG_PARAMS)


@router.post("/chatbot/{chatbot_id}/integration/reset", summary="重置集成配置到默认状态")
async def reset_integration(
    request: Request,
    chatbot_id: str
):
    """
    重置集成配置到默认状态
    
    保留API密钥，重置所有配置参数为默认值
    
    Args:
        request: 请求对象
        chatbot_id: 机器人ID
        
    Returns:
        ApiResponse: 重置后的集成配置
    """
    try:
        integration = ChatbotIntegrationService.reset_to_defaults(chatbot_id)
        
        result = {
            "id": integration.id,
            "chatbot_id": integration.chatbot_id,
            "api_key": json.loads(integration.api_key) if integration.api_key else [],
            "openai_base_url": integration.openai_base_url,
            "configs": json.loads(integration.configs) if integration.configs else {},
            "created_at": integration.created_at.strftime("%Y-%m-%d %H:%M:%S") if integration.created_at else None,
            "updated_at": integration.updated_at.strftime("%Y-%m-%d %H:%M:%S") if integration.updated_at else None
        }
        
        return ResponseUtil.success(data=result, message="已恢复到初始状态")
    except Exception as e:
        logger.error(f"重置集成配置失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"操作失败: {str(e)}")


@router.get("/chatbot/{chatbot_id}/integration/download", summary="下载插件离线部署包")
async def download_integration_package(
    request: Request,
    chatbot_id: str,
    type: str = "iframe"
):
    """
    下载插件离线部署包（zip格式）
    
    包含自包含的 HTML 文件，可直接在浏览器中打开或通过 iframe 嵌入
    
    Args:
        request: 请求对象
        chatbot_id: 机器人ID
        type: 插件类型（iframe/sidebar）
        
    Returns:
        二进制zip文件下载响应
    """
    try:
        zip_data = ChatbotIntegrationService.generate_widget_package(chatbot_id, type)
        filename = f"ai-widget-{type}.zip"
        return Response(
            content=zip_data,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(zip_data)),
            }
        )
    except Exception as e:
        logger.error(f"生成插件部署包失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"下载失败: {str(e)}")


@router.post("/preview", summary="生成预览token")
async def generate_preview_token(
    request: Request
):
    """
    生成预览token，将配置参数存储到Redis，返回预览URL
    
    Args:
        request: 请求对象，包含预览配置参数
        
    Returns:
        ApiResponse: 包含预览token和预览URL
    """
    try:
        body = await request.json()
        preview_type = body.get("type", "sidebar")  # sidebar 或 iframe
        api_key = body.get("api_key", "")
        
        if not api_key:
            return ResponseUtil.error(message="缺少API密钥")
        
        # 根据 api_key 查询完整配置
        integration = ChatbotIntegrationService.get_by_api_key(api_key)
        if not integration:
            return ResponseUtil.error(message="无效的API密钥")
        
        # 解析配置
        configs = json.loads(integration.configs) if integration.configs else {}
        
        # 构建预览配置数据：直接返回 chat_config 和 interface_config
        preview_data = {
            "type": preview_type,
            "api_key": api_key,
            "chat_config": configs.get("chat_config", {}),
            "interface_config": configs.get("interface_config", {}),
        }
        
        # 生成唯一token
        token = str(uuid.uuid4())
        
        # 存储到Redis，有效期10分钟
        redis_key = f"integration:preview:{token}"
        redis_utils.set(redis_key, json.dumps(preview_data), exp=600)
        
        # 返回预览URL（相对路径，前端自己拼接域名）
        # 注意：预览页面在前端应用中，不在后端API服务中
        preview_url = f"/integration/preview/{token}"
        
        return ResponseUtil.success(data={
            "token": token,
            "preview_url": preview_url
        })
    except Exception as e:
        logger.error(f"生成预览token失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"操作失败: {str(e)}")


@router.get("/preview/{token}", summary="获取预览配置")
async def get_preview_config(
    request: Request,
    token: str
):
    """
    根据token获取预览配置参数
    
    Args:
        request: 请求对象
        token: 预览token
        
    Returns:
        ApiResponse: 预览配置参数
    """
    try:
        # 从Redis获取配置
        redis_key = f"integration:preview:{token}"
        config_str = redis_utils.get(redis_key)
        
        if not config_str:
            return ResponseUtil.error(message="配置不存在或已过期", code=404)
        
        config = json.loads(config_str)
        return ResponseUtil.success(data=config)
    except Exception as e:
        logger.error(f"获取预览配置失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"操作失败: {str(e)}")


@router.get("/config/{api_key}", summary="根据API密钥获取插件配置")
async def get_config_by_api_key(
    request: Request,
    api_key: str
):
    """
    根据API密钥获取插件的完整配置信息
    
    用于嵌入代码初始化时获取配置参数，避免在URL中暴露配置信息
    
    Args:
        request: 请求对象
        api_key: API密钥
        
    Returns:
        ApiResponse: 插件配置信息
    """
    try:
        # 根据api_key查询集成配置
        integration = ChatbotIntegrationService.get_by_api_key(api_key)
        
        if not integration:
            return ResponseUtil.error(message="无效的API密钥", code=404)
        
        # 解析配置
        configs = json.loads(integration.configs) if integration.configs else {}
        
        # 直接返回 chat_config 和 interface_config
        result = {
            "chatbot_id": integration.chatbot_id,
            "chat_config": configs.get("chat_config", {}),
            "interface_config": configs.get("interface_config", {}),
        }
        
        return ResponseUtil.success(data=result)
    except Exception as e:
        logger.error(f"获取插件配置失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"操作失败: {str(e)}")
