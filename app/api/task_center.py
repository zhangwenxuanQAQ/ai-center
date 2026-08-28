"""
任务中心控制器，提供任务信息和任务日志相关的API接口
"""

import logging
import asyncio
import base64
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse, Response

from app.services.task_center.dto import TaskInfoCreate, TaskInfoUpdate
from app.services.task_center.service import TaskCenterService
from app.core.task_center import TaskCenterCore
from app.database.models import TaskInfo
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.task_center_constants import (
    TASK_STATUS_LABELS, TASK_TYPE_NAME, TASK_CENTER_EVENTS_CHANNEL, TaskSourceType, TaskType,
    API_EXPORT_FORMAT_FILE_EXT,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ==================== 任务类型/状态字典 ====================

@router.get("/task_types", response_model=ApiResponse)
def get_task_types():
    """
    获取任务类型列表（含各类型所需配置字段定义）

    Returns:
        ApiResponse: 统一格式的响应对象，包含任务类型、显示名称及配置字段定义
    """
    return ResponseUtil.success(data=TaskCenterService.get_task_types(), message="获取任务类型列表成功")


@router.get("/task_statuses", response_model=ApiResponse)
def get_task_statuses():
    """
    获取任务状态列表

    Returns:
        ApiResponse: 统一格式的响应对象，包含任务状态及其显示名称
    """
    return ResponseUtil.success(data=TaskCenterService.get_task_statuses(), message="获取任务状态列表成功")


# ==================== 任务信息 API ====================

@router.get("/task/events")
async def task_events():
    """
    SSE端点：推送任务状态更新事件（前端EventSource订阅后实时更新任务状态/进度）

    Returns:
        StreamingResponse: SSE事件流
    """
    from redis.asyncio import Redis
    from app.configs.config import config as app_config

    async def event_generator():
        redis_client = None
        pubsub = None
        channel = TASK_CENTER_EVENTS_CHANNEL

        try:
            redis_config = app_config.config.get('redis', {})
            host = redis_config.get('host', '127.0.0.1')
            port = redis_config.get('port', 6379)
            db = redis_config.get('db', 1)
            username = redis_config.get('username', '')
            password = redis_config.get('password', '')

            conn_params = {
                'host': host,
                'port': port,
                'db': db,
                'decode_responses': True,
            }
            if username:
                conn_params['username'] = username
            if password:
                conn_params['password'] = password

            redis_client = Redis(**conn_params)
            await redis_client.ping()

            pubsub = redis_client.pubsub()
            await pubsub.subscribe(channel)

            yield f"event: connected\ndata: {{\"message\": \"Connected to task center events\"}}\n\n"

            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    yield f"event: update\ndata: {data}\n\n"

        except asyncio.CancelledError:
            logger.info(f"SSE连接关闭: {channel}")
        except Exception as e:
            logger.error(f"SSE事件流异常: {e}")
            yield f"event: error\ndata: {{\"message\": \"{str(e)}\"}}\n\n"
        finally:
            if pubsub:
                try:
                    await pubsub.close()
                except Exception:
                    pass
            if redis_client:
                try:
                    await redis_client.close()
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/task/list", response_model=ApiResponse)
def get_task_infos(
    name: str = Query(None, description="任务名称（模糊查询）"),
    task_type: str = Query(None, description="任务类型过滤：data_extract/api/doc_chunk"),
    task_status: str = Query(None, description="任务状态过滤：pending/running/cancel/done/fail"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """
    获取任务列表（支持名称、任务类型、任务状态过滤）

    Args:
        name: 任务名称（模糊查询）
        task_type: 任务类型过滤
        task_status: 任务状态过滤
        page: 页码
        page_size: 每页数量

    Returns:
        ApiResponse: 统一格式的响应对象，包含任务列表和总数
    """
    tasks, total = TaskCenterService.get_task_infos(name, task_type, task_status, page, page_size)
    return ResponseUtil.success(data={"data": tasks, "total": total})


@router.get("/task/{task_id}", response_model=ApiResponse)
def get_task_info(task_id: str):
    """
    获取单个任务信息

    Args:
        task_id: 任务ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    task = TaskCenterService.get_task_info(task_id)
    if not task:
        return ResponseUtil.not_found(message="任务不存在")
    return ResponseUtil.success(data=task)


@router.post("/task", response_model=ApiResponse)
def create_task_info(dto: TaskInfoCreate):
    """
    创建任务

    Args:
        dto: 任务创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        task = TaskCenterService.create_task_info(dto)
        return ResponseUtil.created(data=task, message="任务创建成功")
    except ValueError as e:
        return ResponseUtil.error(code=400, message=str(e))


@router.post("/task/{task_id}", response_model=ApiResponse)
def update_task_info(task_id: str, dto: TaskInfoUpdate):
    """
    更新任务

    Args:
        task_id: 任务ID
        dto: 任务更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        task = TaskCenterService.update_task_info(task_id, dto)
        if not task:
            return ResponseUtil.not_found(message="任务不存在")
        return ResponseUtil.success(data=task, message="任务更新成功")
    except ValueError as e:
        return ResponseUtil.error(code=400, message=str(e))


@router.post("/task/{task_id}/delete", response_model=ApiResponse)
def delete_task_info(task_id: str):
    """
    删除任务（软删除，同时软删除其执行日志）

    Args:
        task_id: 任务ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        success = TaskCenterService.delete_task_info(task_id)
        if not success:
            return ResponseUtil.not_found(message="任务不存在")
        return ResponseUtil.success(message="任务删除成功")
    except ValueError as e:
        return ResponseUtil.error(code=400, message=str(e))


@router.post("/task/{task_id}/start", response_model=ApiResponse)
def start_task(task_id: str):
    """
    开始执行任务（生成执行日志并后台执行）

    Args:
        task_id: 任务ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    success = TaskCenterCore.execute_task(task_id)
    if not success:
        return ResponseUtil.error(code=400, message="任务不存在或已在执行中")
    return ResponseUtil.success(message="任务已开始执行")


@router.post("/task/{task_id}/rerun", response_model=ApiResponse)
def rerun_task(task_id: str):
    """
    重新执行任务（重新生成执行日志并后台执行）

    Args:
        task_id: 任务ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    success = TaskCenterCore.execute_task(task_id)
    if not success:
        return ResponseUtil.error(code=400, message="任务不存在或已在执行中")
    return ResponseUtil.success(message="任务已重新执行")


@router.post("/task/{task_id}/stop", response_model=ApiResponse)
def stop_task(task_id: str):
    """
    停止任务

    Args:
        task_id: 任务ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    success = TaskCenterCore.stop_task(task_id)
    if not success:
        return ResponseUtil.error(code=400, message="任务不在执行中")
    return ResponseUtil.success(message="任务已停止")


@router.get("/task/{task_id}/result", response_model=ApiResponse)
def get_task_result(task_id: str):
    """
    获取任务执行结果（任务信息 + 最近一次执行日志，不同任务类型结果内容不同）

    Args:
        task_id: 任务ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    result = TaskCenterCore.get_task_result(task_id)
    if not result:
        return ResponseUtil.not_found(message="任务不存在")
    return ResponseUtil.success(data=result)


@router.get("/task/{task_id}/download", summary="下载任务结果文件")
def download_task_result(task_id: str):
    """下载任务结果文件（接口调用/数据抽取任务，从Redis读取base64解码为二进制，含过期判断）"""
    task = TaskInfo.select().where(
        TaskInfo.id == task_id,
        TaskInfo.deleted == False
    ).first()
    if not task:
        # 兼容本体任务ID（本体工作台SSE事件中的task_id为本体任务ID）：按来源关联查找
        task = TaskInfo.select().where(
            TaskInfo.source_type == TaskSourceType.ONTOLOGY_TASK,
            TaskInfo.source_id == task_id,
            TaskInfo.deleted == False
        ).first()
    if not task:
        return ResponseUtil.not_found(message="任务不存在")

    # 数据抽取任务：从本体任务结果Redis读取
    file_info = None
    if task.task_type == TaskType.DATA_EXTRACT and task.source_type == TaskSourceType.ONTOLOGY_TASK and task.source_id:
        from app.core.ontology.task_core import OntologyTaskCore
        file_info = OntologyTaskCore._get_result_file(task.source_id)
    elif task.task_type == TaskType.API:
        file_info = TaskCenterCore._get_api_result_file(task_id)

    if not file_info or not file_info.get('file_base64'):
        return ResponseUtil.not_found(message="结果文件不存在或已过期")

    file_bytes = base64.b64decode(file_info['file_base64'])
    file_name = file_info.get('file_name', 'result')
    # file_name已含扩展名（如api_result_xxx.xlsx）；无后缀时按导出格式映射补全
    if '.' in file_name:
        ext = file_name.rsplit('.', 1)[-1].lower()
    else:
        ext = API_EXPORT_FORMAT_FILE_EXT.get(file_info.get('format', 'json'), 'json')
        file_name = f"{file_name}.{ext}"

    mime_map = {
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'md': 'text/markdown',
        'json': 'application/json',
        'csv': 'text/csv',
        'sql': 'application/sql',
    }
    media_type = mime_map.get(ext, 'application/octet-stream')

    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={'Content-Disposition': f'attachment; filename="{file_name}"'}
    )


@router.get("/task/{task_id}/logs", response_model=ApiResponse)
def get_task_logs(
    task_id: str,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """
    获取任务的执行历史日志列表

    Args:
        task_id: 任务ID
        page: 页码
        page_size: 每页数量

    Returns:
        ApiResponse: 统一格式的响应对象，包含执行历史列表和总数
    """
    logs, total = TaskCenterCore.get_task_logs(task_id, page, page_size)
    return ResponseUtil.success(data={"data": logs, "total": total})


# ==================== 任务日志 API ====================

@router.get("/log/list", response_model=ApiResponse)
def get_task_log_list(
    name: str = Query(None, description="任务名称（模糊查询）"),
    task_type: str = Query(None, description="任务类型过滤：data_extract/api/doc_chunk"),
    task_status: str = Query(None, description="任务状态过滤：pending/running/cancel/done/fail"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """
    获取任务日志列表（支持名称、任务类型、任务状态过滤）

    Args:
        name: 任务名称（模糊查询）
        task_type: 任务类型过滤
        task_status: 任务状态过滤
        page: 页码
        page_size: 每页数量

    Returns:
        ApiResponse: 统一格式的响应对象，包含任务日志列表和总数
    """
    logs, total = TaskCenterService.get_task_logs(name, task_type, task_status, page, page_size)
    return ResponseUtil.success(data={"data": logs, "total": total})


@router.get("/log/{log_id}", response_model=ApiResponse)
def get_task_log(log_id: str):
    """
    获取单个任务日志详情

    Args:
        log_id: 任务日志ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    log = TaskCenterService.get_task_log(log_id)
    if not log:
        return ResponseUtil.not_found(message="任务日志不存在")
    return ResponseUtil.success(data=log)
