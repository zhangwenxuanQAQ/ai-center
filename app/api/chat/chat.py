"""
对话控制器，提供对话相关的API接口
"""

import json
import logging
import base64
import asyncio
from fastapi import APIRouter, Request, Query, Depends
from fastapi.responses import StreamingResponse, Response
from typing import Optional
from pydantic import BaseModel, Field

from app.services.chat.dto import (
    ChatCreate, ChatUpdate, Chat as ChatDTO,
    ChatRequest, ChatListResponse, ChatMessageListResponse
)
from app.services.chat.service import ChatService, ChatMessageService
from app.core.chat.chat_service import ChatCoreService, ChatStopManager
from app.database.models import Chat
from app.utils.response import ResponseUtil, ApiResponse
from app.core.exceptions import ResourceNotFoundError
from app.services.chat.file_utils import get_file_from_datasource
from app.core.chat.stream_manager import ChatStreamManager
from app.database.redis_utils import redis_utils

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
    return ResponseUtil.success(data=result.model_dump(exclude_none=False))


@router.post("/{chat_id}/clear_messages", summary="清空对话消息")
async def clear_chat_messages(
    request: Request,
    chat_id: str
) -> ApiResponse:
    """
    清空对话的所有消息
    
    Args:
        request: 请求对象
        chat_id: 对话ID
        
    Returns:
        ApiResponse: 清空结果
        
    错误码:
        - 200: 成功
        - 404: 对话不存在
    """
    user_id = get_user_id(request)
    try:
        ChatMessageService.clear_messages_by_chat(chat_id)
        return ResponseUtil.success(message="对话消息已清空")
    except ResourceNotFoundError as e:
        return ResponseUtil.not_found(message=e.message)


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
    
    # 打印请求体日志
    logger.info(f"聊天接口请求体: {chat_request.model_dump()}")
    
    if not chat_request.query:
        return ResponseUtil.error(message="query参数不能为空")
    
    try:
        # 更新chat表数据，将对话的model_id, chatbot_id, config, system_prompt更新成最新的
        if chat_request.chat_id:
            update_fields = {}
            if chat_request.model_id:
                update_fields['model_id'] = chat_request.model_id
            if chat_request.chatbot_id:
                update_fields['chatbot_id'] = chat_request.chatbot_id
            if chat_request.config:
                update_fields['config'] = chat_request.config
            if chat_request.system_prompt:
                update_fields['system_prompt'] = chat_request.system_prompt
            
            if update_fields:
                try:
                    Chat.update(**update_fields).where(
                        (Chat.id == chat_request.chat_id) &
                        (Chat.user_id == user_id) &
                        (Chat.deleted == False)
                    ).execute()
                    logger.info(f"更新chat表成功 - chat_id: {chat_request.chat_id}, fields: {update_fields}")
                except Exception as e:
                    logger.error(f"更新chat表失败: {e}")
        
        if chat_request.stream:
            # 使用后台任务+Redis模式：后台任务持续运行chat_stream并将chunks存入Redis，
            # HTTP响应从Redis读取chunks发送给客户端。
            # 这样即使客户端断开连接（如F5刷新），后台任务仍继续运行，
            # 客户端可通过重连端点接着获取剩余输出。
            stream_chat_id = chat_request.chat_id

            if stream_chat_id and redis_utils.is_available:
                # 启动后台流式任务
                chat_stream_gen = ChatCoreService.chat_stream(
                    user_id=user_id,
                    query=chat_request.query,
                    model_id=chat_request.model_id,
                    chatbot_id=chat_request.chatbot_id,
                    chat_id=chat_request.chat_id,
                    config=chat_request.config,
                    message_id=chat_request.message_id,
                    system_prompt=chat_request.system_prompt
                )
                await ChatStreamManager.start_background_stream(stream_chat_id, chat_stream_gen)

                async def generate_from_redis():
                    """从Redis读取流式数据并发送给客户端"""
                    try:
                        async for sse_data in ChatStreamManager.stream_from_redis(stream_chat_id, 0):
                            yield sse_data
                            await asyncio.sleep(0)
                    except GeneratorExit:
                        # 客户端断开连接，正常退出（后台任务仍继续运行）
                        raise
                    except Exception as e:
                        print(f"Error in generate_from_redis: {e}")
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
                    current_chat_id = None
                    has_error = False
                    try:
                        async for chunk in ChatCoreService.chat_stream(
                            user_id=user_id,
                            query=chat_request.query,
                            model_id=chat_request.model_id,
                            chatbot_id=chat_request.chatbot_id,
                            chat_id=chat_request.chat_id,
                            config=chat_request.config,
                            message_id=chat_request.message_id,
                            system_prompt=chat_request.system_prompt
                        ):
                            if chunk.get('chat_id'):
                                current_chat_id = chunk['chat_id']
                            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                            await asyncio.sleep(0)
                            if 'error' in chunk:
                                has_error = True
                        yield "data: [DONE]\n\n"
                    except GeneratorExit:
                        raise
                    except Exception as e:
                        print(f"Error in generate: {e}")
                        yield "data: [DONE]\n\n"
                        raise

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
            result = ChatCoreService.chat(
                user_id=user_id,
                query=chat_request.query,
                model_id=chat_request.model_id,
                chatbot_id=chat_request.chatbot_id,
                chat_id=chat_request.chat_id,
                config=chat_request.config,
                message_id=chat_request.message_id,
                system_prompt=chat_request.system_prompt
            )

            if 'error' in result:
                return ResponseUtil.error(message=result['error'])

            return ResponseUtil.success(data=result)
            
    except ResourceNotFoundError as e:
        return ResponseUtil.not_found(message=e.message)
    except Exception as e:
        logger.error(f"聊天接口异常: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"聊天失败: {str(e)}")


class StopChatRequest(BaseModel):
    chat_id: str = Field(..., description="对话ID")


@router.post("/stop", summary="停止聊天")
async def stop_chat(
    request: Request,
    stop_request: StopChatRequest
):
    """
    停止聊天
    
    将对话中所有正在运行的消息更新为停止状态，
    并在content末尾拼接"已停止"
    
    Args:
        request: 请求对象
        stop_request: 停止请求参数
            - chat_id: 对话ID
            
    Returns:
        ApiResponse: 操作结果
    """
    user_id = get_user_id(request)
    
    try:
        chat = Chat.get(
            (Chat.id == stop_request.chat_id) &
            (Chat.user_id == user_id) &
            (Chat.deleted == False)
        )
    except Chat.DoesNotExist:
        return ResponseUtil.not_found(message="对话不存在")
    
    updated_count = ChatMessageService.stop_chat_messages(stop_request.chat_id)
    
    ChatStopManager().request_stop(stop_request.chat_id)
    
    return ResponseUtil.success(data={"updated_count": updated_count}, message="已停止回答")


@router.get("/streaming_status/{chat_id}", summary="查询流式状态")
async def get_streaming_status(
    request: Request,
    chat_id: str
):
    """
    查询指定对话的流式处理状态

    用于F5刷新后检测是否有正在进行的流式任务。

    Args:
        request: 请求对象
        chat_id: 对话ID

    Returns:
        ApiResponse: 包含is_streaming、status和chunks_count字段
    """
    status = ChatStreamManager.get_status(chat_id)
    chunks_count = ChatStreamManager.get_chunks_count(chat_id)

    return ResponseUtil.success(data={
        "is_streaming": status == "streaming",
        "status": status,
        "chunks_count": chunks_count
    })


@router.get("/reconnect_stream/{chat_id}", summary="重连流式输出")
async def reconnect_stream(
    request: Request,
    chat_id: str
):
    """
    重连流式输出

    在F5刷新后，前端通过此端点重新获取流式数据。
    从Redis list的开头读取所有已存储的chunks（包含历史输出），
    然后继续读取新产生的chunks，直到收到[DONE]标记。

    Args:
        request: 请求对象
        chat_id: 对话ID

    Returns:
        StreamingResponse: SSE流式响应
    """
    status = ChatStreamManager.get_status(chat_id)

    # 如果没有流式记录，返回空响应
    if not status:
        return ResponseUtil.error(message="没有找到流式记录")

    async def generate_reconnect():
        """从Redis读取所有历史chunks + 新chunks，发送给客户端"""
        try:
            # 从索引0开始读取，获取所有已存储的chunks + 继续读取新chunks
            async for sse_data in ChatStreamManager.stream_from_redis(chat_id, 0):
                yield sse_data
                await asyncio.sleep(0)
        except GeneratorExit:
            raise
        except Exception as e:
            print(f"Error in generate_reconnect: {e}")
            yield "data: [DONE]\n\n"
            raise

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


@router.post("/download_file", summary="下载聊天中的文件")
async def download_file(
    request: Request,
    params: Optional[DownloadFileRequest] = None,
    file_type: Optional[str] = Query(None, description="文件类型：local/datasource"),
    file_name: Optional[str] = Query(None, description="文件名"),
    base64_content: Optional[str] = Query(None, description="本地文件的base64内容"),
    datasource_id: Optional[str] = Query(None, description="数据源ID（datasource类型时必填）"),
    bucket: Optional[str] = Query(None, description="桶名称（datasource类型时可选）"),
    location: Optional[str] = Query(None, description="文件路径（datasource类型时必填）")
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
