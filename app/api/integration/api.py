"""
插件集成对外API接口

提供OpenAI兼容的聊天接口和聊天记录查询接口
路由挂载在 /aicenter/api 前缀下
"""

import json
import logging
import asyncio
import uuid
import base64
from fastapi import APIRouter, Request, Header, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, Response
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import Query

from app.services.chat.dto import QueryItem
from app.services.integration.service import ChatbotIntegrationService
from app.core.integration.api_chat import IntegrationChatCoreService
from app.core.integration.temp_chat_store import TempChatStore
from app.core.chat.stream_manager import ChatStreamManager
from app.database.redis_utils import redis_utils
from app.database.models import ChatbotChat
from app.utils.response import ResponseUtil, ApiResponse
from app.services.chat.file_utils import get_file_from_datasource

router = APIRouter()
logger = logging.getLogger(__name__)


class IntegrationChatRequest(BaseModel):
    """
    集成聊天请求体

    Attributes:
        config: 对话配置JSON，包含deep_thinking等配置项
        query: 查询数组，每个元素包含type、content、mime_type
        chat_id: 对话ID（可选，不传则创建新对话）
        stream: 是否流式输出
        temporary: 临时会话模式，不保存对话和消息到数据库
        edit_message_id: 编辑消息ID，表示编辑的是哪条用户消息，会删除该消息及其后续所有消息
    """
    config: Optional[dict] = Field(None, description="对话配置JSON，包含deep_thinking等配置项")
    query: List[QueryItem] = Field(..., description="查询数组")
    chat_id: Optional[str] = Field(None, max_length=40, description="对话ID")
    stream: bool = Field(True, description="是否流式输出")
    temporary: bool = Field(False, description="临时会话模式，不保存到数据库")
    edit_message_id: Optional[str] = Field(None, description="编辑消息ID，删除该消息及其后续消息")
    preview_token: Optional[str] = Field(None, description="预览token，用于临时会话数据隔离")


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


async def verify_api_key(authorization: Optional[str] = Header(None, description="Authorization: Bearer <api_key>")):
    """
    通用API密钥鉴权依赖项
    
    从Authorization请求头中提取并验证API密钥，验证通过返回集成配置对象。
    验证失败抛出HTTPException，错误信息包含正确格式说明。
    
    Args:
        authorization: Authorization请求头
        
    Returns:
        ChatbotIntegration: 集成配置对象
        
    Raises:
        HTTPException: 401 未授权
    """
    api_key = get_api_key_from_header(authorization)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少API KEY请求头或格式不正确，正确格式为：Authorization: Bearer <your_api_key>"
        )

    integration = ChatbotIntegrationService.get_by_api_key(api_key)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API密钥无效"
        )

    return integration


@router.post("/v1/chat/completions", summary="聊天接口（OpenAI兼容）")
async def chat_completions(
    chat_request: IntegrationChatRequest,
    integration = Depends(verify_api_key)
):
    """
    聊天接口，支持流式和非流式输出

    请求头需要包含Authorization字段，值为Bearer + 机器人API密钥

    Args:
        chat_request: 聊天请求参数
            - config: 对话配置JSON，包含deep_thinking等配置项
            - query: 查询数组，每个元素包含type、content、mime_type
            - chat_id: 对话ID（可选，不传则创建新对话）
            - stream: 是否流式输出
            - temporary: 临时会话模式，不保存对话和消息到数据库
        integration: 集成配置对象（由verify_api_key依赖项注入）

    Returns:
        流式输出时返回StreamingResponse，否则返回ApiResponse
    """
    if not chat_request.query:
        return ResponseUtil.error(message="query参数不能为空")

    logger.info(f"集成聊天接口请求 - chatbot_id: {integration.chatbot_id}, chat_id: {chat_request.chat_id}, stream: {chat_request.stream}")

    try:
        if chat_request.stream:
            stream_chat_id = chat_request.chat_id

            if stream_chat_id and redis_utils.is_available:
                # 使用后台任务+Redis模式：后台任务持续运行chat_stream并将chunks存入Redis，
                # HTTP响应从Redis读取chunks发送给客户端。
                # 这样即使客户端断开连接（如F5刷新），后台任务仍继续运行，
                # 客户端可通过重连端点接着获取剩余输出。
                chat_stream_gen = IntegrationChatCoreService.chat_stream(
                    query=chat_request.query,
                    chat_id=chat_request.chat_id,
                    integration=integration,
                    stream=True,
                    temporary=chat_request.temporary,
                    config=chat_request.config,
                    edit_message_id=chat_request.edit_message_id,
                    preview_token=chat_request.preview_token
                )
                await ChatStreamManager.start_background_stream(stream_chat_id, chat_stream_gen)

                async def generate_from_redis():
                    """从Redis读取流式数据并发送给客户端"""
                    try:
                        async for sse_data in ChatStreamManager.stream_from_redis(stream_chat_id, 0):
                            yield sse_data
                            await asyncio.sleep(0)
                    except GeneratorExit:
                        raise
                    except Exception as e:
                        logger.error(f"generate_from_redis异常: {e}")
                        yield "data: [DONE]\n\n"
                        raise

                return StreamingResponse(
                    generate_from_redis(),
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "X-Accel-Buffering": "no",
                        "Transfer-Encoding": "chunked"
                    }
                )
            else:
                # 无chat_id或Redis不可用时，回退到原始直接流式模式
                async def generate():
                    try:
                        async for chunk in IntegrationChatCoreService.chat_stream(
                            query=chat_request.query,
                            chat_id=chat_request.chat_id,
                            integration=integration,
                            stream=True,
                            temporary=chat_request.temporary,
                            config=chat_request.config,
                            edit_message_id=chat_request.edit_message_id,
                            preview_token=chat_request.preview_token
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
                temporary=chat_request.temporary,
                config=chat_request.config,
                edit_message_id=chat_request.edit_message_id,
                preview_token=chat_request.preview_token
            )

            if 'error' in result:
                return ResponseUtil.error(message=result['error'])

            return ResponseUtil.success(data=result)

    except Exception as e:
        logger.error(f"集成聊天接口异常: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"聊天失败: {str(e)}")


@router.get("/v1/chat/{chat_id}/messages", summary="获取聊天记录")
async def get_chat_messages(
    chat_id: str,
    preview_token: Optional[str] = Query(None, description="预览token，用于临时会话数据隔离"),
    integration = Depends(verify_api_key)
):
    """
    获取聊天记录
    
    请求头需要包含Authorization字段，值为Bearer + 机器人API密钥
    
    Args:
        chat_id: 对话ID
        integration: 集成配置对象（由verify_api_key依赖项注入）
        
    Returns:
        ApiResponse: 消息列表
    """
    try:
        result = IntegrationChatCoreService.get_chat_messages(chat_id, integration, preview_token=preview_token)
        return ResponseUtil.success(data=result)
    except Exception as e:
        logger.error(f"获取聊天记录异常: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"获取聊天记录失败: {str(e)}")


class CreateChatRequest(BaseModel):
    temporary: bool = Field(False, description="临时会话模式")
    preview_token: Optional[str] = Field(None, description="预览token，用于临时会话数据隔离")
    title: Optional[str] = Field(None, max_length=200, description="对话标题")


@router.post("/v1/chats", summary="创建新对话")
async def create_chat(
    request: CreateChatRequest,
    integration=Depends(verify_api_key)
):
    """
    创建新对话，返回对话ID。
    前端在发送第一条消息前应先调用此接口创建对话，确保对话已在列表中显示。
    """
    try:
        chat_title = request.title or "新对话"
        if request.temporary and TempChatStore.is_available():
            chat_id = f"temp_{uuid.uuid4().hex[:12]}"
            scope_id = f"{integration.id}:preview:{request.preview_token}" if request.preview_token else None
            TempChatStore.create_chat(
                integration_id=integration.id,
                chat_id=chat_id,
                chatbot_id=integration.chatbot_id,
                title=chat_title,
                scope_id=scope_id
            )
        else:
            chat = ChatbotChat.create(
                integration_id=integration.id,
                chatbot_id=integration.chatbot_id,
                title=chat_title
            )
            chat_id = chat.id

        return ResponseUtil.success(data={"id": chat_id, "temporary": request.temporary})
    except Exception as e:
        logger.error(f"创建对话失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"创建对话失败: {str(e)}")


@router.get("/v1/chats", summary="获取对话列表")
async def list_chats(
    keyword: Optional[str] = Query(None, description="搜索关键词"),
    preview_token: Optional[str] = Query(None, description="预览token，用于临时会话数据隔离"),
    integration = Depends(verify_api_key)
):
    """
    获取当前集成下的所有对话列表
    
    Args:
        keyword: 搜索关键词（可选）
        integration: 集成配置对象（由verify_api_key依赖项注入）
        
    Returns:
        ApiResponse: 对话列表
    """
    try:
        chats = ChatbotIntegrationService.list_chats(integration, keyword=keyword, preview_token=preview_token)
        return ResponseUtil.success(data={"items": chats, "total": len(chats)})
    except Exception as e:
        logger.error(f"获取对话列表失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"获取对话列表失败: {str(e)}")


class UpdateChatTitleRequest(BaseModel):
    title: str = Field(..., max_length=200, description="新的对话名称")


@router.patch("/v1/chat/{chat_id}", summary="修改对话名称")
async def update_chat_title(
    chat_id: str,
    request: UpdateChatTitleRequest,
    preview_token: Optional[str] = Query(None, description="预览token，用于临时会话数据隔离"),
    integration = Depends(verify_api_key)
):
    """
    修改对话名称
    
    Args:
        chat_id: 对话ID
        request: 请求体，包含新的对话名称
        preview_token: 预览token（可选）
        integration: 集成配置对象（由verify_api_key依赖项注入）
        
    Returns:
        ApiResponse: 更新后的对话信息
    """
    try:
        chat = ChatbotIntegrationService.update_chat_title(integration, chat_id, request.title, preview_token=preview_token)
        return ResponseUtil.success(data=chat)
    except Exception as e:
        logger.error(f"修改对话名称失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"修改对话名称失败: {str(e)}")


@router.delete("/v1/chat/{chat_id}", summary="删除对话")
async def delete_chat(
    chat_id: str,
    preview_token: Optional[str] = Query(None, description="预览token，用于临时会话数据隔离"),
    integration = Depends(verify_api_key)
):
    """
    删除对话及其所有消息
    
    Args:
        chat_id: 对话ID
        integration: 集成配置对象（由verify_api_key依赖项注入）
        
    Returns:
        ApiResponse: 删除结果
    """
    try:
        ChatbotIntegrationService.delete_chat(integration, chat_id, preview_token=preview_token)
        return ResponseUtil.success(data=True)
    except Exception as e:
        logger.error(f"删除对话失败: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"删除对话失败: {str(e)}")


@router.get("/v1/chat/streaming_status/{chat_id}", summary="查询流式状态")
async def get_streaming_status(
    chat_id: str,
    integration = Depends(verify_api_key)
):
    """
    查询指定对话的流式处理状态

    用于F5刷新后检测是否有正在进行的流式任务。

    Args:
        chat_id: 对话ID
        integration: 集成配置对象

    Returns:
        ApiResponse: 包含is_streaming、status和chunks_count字段
    """
    status_val = ChatStreamManager.get_status(chat_id)
    chunks_count = ChatStreamManager.get_chunks_count(chat_id)

    return ResponseUtil.success(data={
        "is_streaming": status_val == "streaming",
        "status": status_val,
        "chunks_count": chunks_count
    })


@router.get("/v1/chat/reconnect_stream/{chat_id}", summary="重连流式输出")
async def reconnect_stream(
    chat_id: str,
    integration = Depends(verify_api_key)
):
    """
    重连流式输出

    在F5刷新后，前端通过此端点重新获取流式数据。
    从Redis list的开头读取所有已存储的chunks（包含历史输出），
    然后继续读取新产生的chunks，直到收到[DONE]标记。

    Args:
        chat_id: 对话ID
        integration: 集成配置对象

    Returns:
        StreamingResponse: SSE流式响应
    """
    status_val = ChatStreamManager.get_status(chat_id)

    if not status_val:
        return ResponseUtil.error(message="没有找到流式记录")

    async def generate_reconnect():
        try:
            async for sse_data in ChatStreamManager.stream_from_redis(chat_id, 0):
                yield sse_data
                await asyncio.sleep(0)
        except GeneratorExit:
            raise
        except Exception as e:
            logger.error(f"重连流式输出异常: {e}")
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate_reconnect(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked"
        }
    )


class DownloadFileRequest(BaseModel):
    file_type: str = Field(..., description="文件类型：local/datasource")
    file_name: str = Field(..., description="文件名")
    base64_content: Optional[str] = Field(None, description="本地文件的base64内容")
    datasource_id: Optional[str] = Field(None, description="数据源ID（datasource类型时必填）")
    bucket: Optional[str] = Field(None, description="桶名称（datasource类型时可选）")
    location: Optional[str] = Field(None, description="文件路径（datasource类型时必填）")


@router.post("/v1/chat/download_file", summary="下载聊天中的文件")
async def download_file(
    request: Request,
    params: Optional[DownloadFileRequest] = None,
    file_type: Optional[str] = Query(None, description="文件类型：local/datasource"),
    file_name: Optional[str] = Query(None, description="文件名"),
    base64_content: Optional[str] = Query(None, description="本地文件的base64内容"),
    datasource_id: Optional[str] = Query(None, description="数据源ID（datasource类型时必填）"),
    bucket: Optional[str] = Query(None, description="桶名称（datasource类型时可选）"),
    location: Optional[str] = Query(None, description="文件路径（datasource类型时必填）"),
    integration = Depends(verify_api_key)
):
    """
    下载聊天中的文件
    
    Args:
        request: 请求对象
        params: 请求体参数（优先使用）
        file_type: 文件类型：local/datasource
        file_name: 文件名
        base64_content: 本地文件的base64内容（local类型时必填）
        datasource_id: 数据源ID（datasource类型时必填）
        bucket: 桶名称（datasource类型时可选）
        location: 文件路径（datasource类型时必填）
        integration: 集成配置对象
        
    Returns:
        文件内容
    """
    try:
        # 优先使用请求体参数
        if params:
            file_type = params.file_type
            file_name = params.file_name
            base64_content = params.base64_content
            datasource_id = params.datasource_id
            bucket = params.bucket
            location = params.location
        
        if not file_type or not file_name:
            return ResponseUtil.error(message="file_type和file_name不能为空")
        
        if file_type == "local":
            if not base64_content:
                return ResponseUtil.error(message="base64_content不能为空")
            
            # 解码base64内容
            file_content = base64.b64decode(base64_content)
            
            # 返回文件
            return Response(
                content=file_content,
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f"attachment; filename={file_name.encode('utf-8').decode('latin-1')}"
                }
            )
        elif file_type == "datasource":
            if not datasource_id or not location:
                return ResponseUtil.error(message="datasource_id和location不能为空")
            
            # 从数据源获取文件
            file_result = get_file_from_datasource({
                "datasource_id": datasource_id,
                "bucket": bucket,
                "location": location,
                "file_name": file_name
            })
            
            if not file_result.get("success"):
                return ResponseUtil.error(message=file_result.get("message", "文件获取失败"))
            
            file_data = file_result.get("data", {})
            file_content = file_data.get("file_content")
            mime_type = file_data.get("mime_type", "application/octet-stream")
            
            # 返回文件
            return Response(
                content=file_content,
                media_type=mime_type,
                headers={
                    "Content-Disposition": f"attachment; filename={file_name.encode('utf-8').decode('latin-1')}"
                }
            )
        else:
            return ResponseUtil.error(message="不支持的文件类型")
    except Exception as e:
        logger.error(f"下载文件异常: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"下载文件失败: {str(e)}")
