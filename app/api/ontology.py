"""
本体工作台控制器，提供本体对象和数据抽取任务相关API接口
"""

import json
import logging
import asyncio
from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.services.ontology.dto import (
    OntologyObjectUpdate, OntologyObjectBatchCreate, OntologyTaskCreate, OntologyTaskUpdate
)
from app.services.ontology.service import OntologyService
from app.core.ontology import OntologyObjectCore, OntologyTaskCore
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.ontology_constants import (
    OntologyTaskStatus,
    ONTOLOGY_TASK_STREAM_PREFIX, ONTOLOGY_TASK_STATUS_PREFIX,
    ONTOLOGY_TASK_REDIS_EXPIRE
)
from app.database.redis_utils import redis_utils
from app.database.models import OntologyTask

router = APIRouter()
logger = logging.getLogger(__name__)


# ==================== 本体对象 API ====================

@router.get("/object/list", response_model=ApiResponse)
def get_ontology_objects(
    datasource_id: str = Query(None, description="数据源ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: str = Query('name', description="排序字段：name/title/description/created_at"),
    sort_order: str = Query('asc', description="排序方式：asc/desc"),
    name: str = Query(None, description="名称模糊查询")
):
    """获取本体对象列表"""
    objects, total = OntologyService.get_ontology_objects(datasource_id, page, page_size, sort_by, sort_order, name)
    return ResponseUtil.success(data={"data": objects, "total": total})


@router.get("/object/{object_id}", response_model=ApiResponse)
def get_ontology_object(object_id: str):
    """获取单个本体对象"""
    obj = OntologyService.get_ontology_object(object_id)
    if not obj:
        return ResponseUtil.not_found(message="本体对象不存在")
    return ResponseUtil.success(data=obj)


@router.post("/object/batch", response_model=ApiResponse)
def batch_create_ontology_objects(dto: OntologyObjectBatchCreate):
    """批量创建本体对象"""
    results = OntologyService.batch_create_ontology_objects(dto)
    return ResponseUtil.success(
        data=results,
        message=f"成功创建{len(results)}个本体对象"
    )


@router.post("/object/batch_delete", response_model=ApiResponse)
def batch_delete_ontology_objects(data: dict):
    """批量删除本体对象"""
    object_ids = data.get('object_ids', [])
    if not object_ids:
        return ResponseUtil.error(code=400, message="请选择要删除的本体对象")
    deleted_count = OntologyService.batch_delete_ontology_objects(object_ids)
    return ResponseUtil.success(message=f"成功删除{deleted_count}个本体对象")


@router.post("/object/batch_export", response_model=ApiResponse)
def batch_export_ontology_objects(data: dict):
    """批量导出本体对象元数据到一个文件"""
    object_ids = data.get('object_ids', [])
    export_format = data.get('export_format', 'json')
    if not object_ids:
        return ResponseUtil.error(code=400, message="请选择要导出的本体对象")
    content = OntologyObjectCore.batch_export_ontology_metadata(object_ids, export_format)
    if content is None:
        return ResponseUtil.error(code=400, message="导出失败")
    return ResponseUtil.success(data={"content": content, "format": export_format})


@router.post("/object/{object_id}", response_model=ApiResponse)
def update_ontology_object(object_id: str, dto: OntologyObjectUpdate):
    """更新本体对象"""
    obj = OntologyService.update_ontology_object(object_id, dto)
    if not obj:
        return ResponseUtil.not_found(message="本体对象不存在")
    return ResponseUtil.success(data=obj, message="更新成功")


@router.post("/object/{object_id}/delete", response_model=ApiResponse)
def delete_ontology_object(object_id: str):
    """删除本体对象"""
    success = OntologyService.delete_ontology_object(object_id)
    if not success:
        return ResponseUtil.not_found(message="本体对象不存在")
    return ResponseUtil.success(message="删除成功")


@router.post("/object/{object_id}/sync", response_model=ApiResponse)
def sync_ontology_object(object_id: str):
    """同步本体对象字段（调用core层）"""
    obj = OntologyObjectCore.sync_ontology_object(object_id)
    if not obj:
        return ResponseUtil.not_found(message="本体对象不存在")
    return ResponseUtil.success(data=obj, message="同步成功")


@router.get("/object/{object_id}/query", response_model=ApiResponse)
def query_ontology_data(
    object_id: str,
    limit: int = Query(10, ge=1, le=100, description="查询条数"),
    custom_sql: str = Query(None, description="自定义SQL语句")
):
    """查询本体对象数据（调用core层，支持自定义SQL）"""
    result = OntologyObjectCore.query_ontology_data(object_id, limit, custom_sql)
    if result.get('success'):
        return ResponseUtil.success(data=result.get('data'), message=result.get('message', '查询成功'))
    return ResponseUtil.error(code=400, message=result.get('message', '查询失败'))


@router.get("/object/{object_id}/export", response_model=ApiResponse)
def export_ontology_metadata(object_id: str, export_format: str = Query(..., description="导出格式：json/markdown")):
    """导出本体对象元数据（调用core层）"""
    content = OntologyObjectCore.export_ontology_metadata(object_id, export_format)
    if content is None:
        return ResponseUtil.not_found(message="本体对象不存在")
    return ResponseUtil.success(data={"content": content, "format": export_format})


# ==================== 导出格式 ====================

@router.get("/export_formats", response_model=ApiResponse)
def get_export_formats():
    """获取导出格式列表"""
    return ResponseUtil.success(data=OntologyService.get_export_formats())


# ==================== 数据抽取任务 API ====================

@router.get("/task/list", response_model=ApiResponse)
def get_tasks(
    name: str = Query(None, description="任务名称（模糊查询）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """获取任务列表"""
    tasks, total = OntologyService.get_tasks(name, page, page_size)
    return ResponseUtil.success(data={"data": tasks, "total": total})


@router.get("/task/{task_id}", response_model=ApiResponse)
def get_task(task_id: str):
    """获取单个任务"""
    task = OntologyService.get_task(task_id)
    if not task:
        return ResponseUtil.not_found(message="任务不存在")
    return ResponseUtil.success(data=task)


@router.post("/task", response_model=ApiResponse)
def create_task(dto: OntologyTaskCreate):
    """创建数据抽取任务"""
    task = OntologyService.create_task(dto)
    return ResponseUtil.success(data=task, message="任务创建成功")


@router.post("/task/{task_id}", response_model=ApiResponse)
def update_task(task_id: str, dto: OntologyTaskUpdate):
    """更新数据抽取任务"""
    task = OntologyService.update_task(task_id, dto)
    if not task:
        return ResponseUtil.error(code=400, message="任务不存在或当前状态不可编辑")
    return ResponseUtil.success(data=task, message="任务更新成功")


@router.post("/task/batch_delete", response_model=ApiResponse)
def batch_delete_tasks(data: dict):
    """批量删除任务"""
    task_ids = data.get('task_ids', [])
    if not task_ids:
        return ResponseUtil.bad_request(message="请选择要删除的任务")
    deleted_count = OntologyService.batch_delete_tasks(task_ids)
    return ResponseUtil.success(message=f"成功删除{deleted_count}个任务")


@router.post("/task/{task_id}/start")
async def start_task(task_id: str):
    """启动任务（流式接口，调用core层执行）"""
    task = OntologyTask.select().where(
        OntologyTask.id == task_id,
        OntologyTask.deleted == False
    ).first()
    if not task:
        return ResponseUtil.not_found(message="任务不存在")

    if task.status == OntologyTaskStatus.RUNNING:
        return ResponseUtil.bad_request(message="任务正在运行中")

    success = OntologyTaskCore.execute_task(task_id)
    if not success:
        return ResponseUtil.error(code=400, message="启动任务失败")

    return ResponseUtil.success(message="任务已启动")


@router.post("/task/{task_id}/stop")
def stop_task(task_id: str):
    """停止任务（调用core层）"""
    success = OntologyTaskCore.stop_task(task_id)
    if not success:
        return ResponseUtil.bad_request(message="任务未在运行中")

    return ResponseUtil.success(message="任务已停止")


@router.post("/task/{task_id}/rerun")
async def rerun_task(task_id: str):
    """重新执行任务"""
    return await start_task(task_id)


@router.get("/task/{task_id}/stream")
async def stream_task(task_id: str):
    """SSE流式获取任务状态与进度（调用core层获取Redis键）"""
    stream_key, status_key = OntologyTaskCore.get_stream_keys(task_id)

    async def event_generator():
        try:
            if redis_utils.is_available:
                buffered = redis_utils.client.lrange(stream_key, 0, -1) or []
                last_len = len(buffered)
                for raw in buffered:
                    if isinstance(raw, bytes):
                        raw = raw.decode('utf-8')
                    yield f"data: {raw}\n\n"
                    await asyncio.sleep(0)

                while True:
                    status = redis_utils.get(status_key) or ''
                    current_len = redis_utils.client.llen(stream_key) or 0

                    if current_len > last_len:
                        new_raw = redis_utils.client.lrange(stream_key, last_len, -1) or []
                        for raw in new_raw:
                            if isinstance(raw, bytes):
                                raw = raw.decode('utf-8')
                            yield f"data: {raw}\n\n"
                            await asyncio.sleep(0)
                        last_len = current_len

                    if status in (OntologyTaskStatus.DONE, OntologyTaskStatus.FAIL, OntologyTaskStatus.CANCEL):
                        if current_len > last_len:
                            continue
                        yield "data: [DONE]\n\n"
                        return

                    await asyncio.sleep(0.5)

            else:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Redis不可用'})}\n\n"
                yield "data: [DONE]\n\n"

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"SSE流式异常: task_id={task_id}, error={e}")
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/task/{task_id}/result", response_model=ApiResponse)
def get_task_result(task_id: str):
    """获取任务执行结果（调用core层）"""
    result = OntologyTaskCore.get_task_result(task_id)
    if result is None:
        return ResponseUtil.not_found(message="任务不存在")
    return ResponseUtil.success(data=result)


@router.delete("/task/{task_id}", response_model=ApiResponse)
def delete_task(task_id: str):
    """删除单个任务"""
    task = OntologyTask.select().where(
        OntologyTask.id == task_id,
        OntologyTask.deleted == False
    ).first()
    if not task:
        return ResponseUtil.not_found(message="任务不存在")
    if task.status == OntologyTaskStatus.RUNNING:
        return ResponseUtil.bad_request(message="任务正在运行中，无法删除")
    task.delete_instance()
    return ResponseUtil.success(message="删除成功")