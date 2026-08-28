"""
任务信息钩子

在被勾的业务模块方法执行后，将本体工作台数据抽取任务、知识库文档（知识）
的状态同步更新到任务信息表（task_info），实现任务中心的统一任务视图。

同步范围：
    1. 本体工作台数据抽取任务新增/更新 -> 同步任务信息表（新增/更新）
    2. 抽取任务执行中（状态/进度变更）-> 同步任务信息表
    3. 知识库新增/编辑知识 -> 同步任务信息表
    4. 任务运行中更新knowledgebase_document -> 同步任务信息表

关联方式：task_info.source_type + task_id.source_id 指向源业务记录。
所有同步方法均为幂等upsert，失败仅记录日志，不影响业务主流程。
"""

import json
import logging

from app.constants.task_center_constants import (
    TaskType, TaskSourceType, TASK_CENTER_EVENTS_CHANNEL,
)
from app.constants.ontology_constants import OntologyTaskStatus, ONTOLOGY_TASK_RESULT_PREFIX
from app.constants.knowledgebase_document_constants import RunningStatus
from app.database.models import TaskInfo, TaskLog, Knowledgebase, KnowledgebaseDocument
from app.database.redis_utils import redis_utils
from app.core.task_center.task_output import (
    DataExtractTaskOutput, DocChunkTaskOutput, create_task_output, format_duration_ms,
)

logger = logging.getLogger(__name__)

# 本体任务状态 -> 任务中心状态
_ONTOLOGY_STATUS_MAP = {
    OntologyTaskStatus.PENDING: "pending",
    OntologyTaskStatus.WAITING: "pending",
    OntologyTaskStatus.RUNNING: "running",
    OntologyTaskStatus.DONE: "done",
    OntologyTaskStatus.FAIL: "fail",
    OntologyTaskStatus.CANCEL: "cancel",
}

# 文档运行状态 -> 任务中心状态
_DOC_STATUS_MAP = {
    RunningStatus.PENDING: "pending",
    RunningStatus.WAITING: "pending",
    RunningStatus.SCHEDULE: "pending",
    RunningStatus.RUNNING: "running",
    RunningStatus.DONE: "done",
    RunningStatus.FAIL: "fail",
    RunningStatus.CANCEL: "cancel",
}


class TaskInfoHook:
    """任务信息同步钩子 - 将业务模块任务状态同步到task_info表"""

    # ==================== 通用内部方法 ====================

    @staticmethod
    def _build_common_output(task_info: TaskInfo, output):
        """填充任务输出公共字段（状态/错误/起止时间/耗时）"""
        status = task_info.task_status
        error = None
        if status == "fail":
            message = task_info.task_progress_message or ''
            # 取进度消息中最后一条错误信息
            for line in reversed(message.split('\n')):
                if '失败' in line or '异常' in line or '错误' in line:
                    error = line.strip()
                    break
            error = error or (message.split('\n')[-1].strip() if message else None) or '任务执行失败'
        output.set_common(
            status='success' if status == "done" else ('fail' if status == "fail" else status),
            error=error,
            start_time=task_info.task_begin_at.strftime('%Y-%m-%d %H:%M:%S') if task_info.task_begin_at else '',
            end_time=task_info.task_end_at.strftime('%Y-%m-%d %H:%M:%S') if task_info.task_end_at else '',
            duration=format_duration_ms(task_info.task_duration),
            executed_at=task_info.task_end_at.strftime('%Y-%m-%d %H:%M:%S') if task_info.task_end_at else '',
        )
        return output

    @staticmethod
    def _finalize_task_output(task_info: TaskInfo) -> None:
        """任务到达终态时构建任务输出结果并保存到task_output字段"""
        try:
            if task_info.task_status not in ("done", "fail", "cancel"):
                return
            if task_info.task_type == TaskType.DATA_EXTRACT:
                output = DataExtractTaskOutput()
                # 从Redis读取本体任务结果文件信息
                try:
                    result = redis_utils.get_obj(f"{ONTOLOGY_TASK_RESULT_PREFIX}{task_info.source_id}")
                    if result:
                        output.set('export_format', result.get('format', ''))
                        output.set('row_count', result.get('row_count', 0))
                        output.set('result_file', result.get('file_name', ''))
                        output.set('expire_at', result.get('expire_at', ''))
                except Exception:
                    pass
            elif task_info.task_type == TaskType.DOC_CHUNK:
                output = DocChunkTaskOutput()
                doc = KnowledgebaseDocument.select().where(
                    KnowledgebaseDocument.id == task_info.source_id
                ).first() if task_info.source_id else None
                if doc:
                    if doc.kb_id:
                        kb = Knowledgebase.select().where(Knowledgebase.id == doc.kb_id).first()
                        if kb:
                            output.set('kb_name', kb.name or '')
                    output.set('document', doc.title or doc.file_name or '')
                    output.set('chunk_method', doc.chunk_method or '')
                    output.set('chunk_count', doc.chunk_num or 0)
            else:
                output = create_task_output(task_info.task_type)

            TaskInfoHook._build_common_output(task_info, output)
            task_info.task_output = output.to_json()
            task_info.save()
        except Exception as e:
            logger.error(f"[TASK_INFO_HOOK] 构建任务输出结果失败: task_id={task_info.id}, error={e}")

    @staticmethod
    def _find_by_source(source_type: str, source_id: str):
        """按来源查找任务信息记录"""
        return TaskInfo.select().where(
            TaskInfo.source_type == source_type,
            TaskInfo.source_id == source_id,
            TaskInfo.deleted == False
        ).first()

    @staticmethod
    def _publish_task_center_event(task_info: TaskInfo) -> None:
        """推送任务中心实时状态事件到Redis频道（供任务列表页SSE订阅）

        数据抽取/文档切片任务由委托模块执行，其事件只发布到各自业务频道，
        此处同步到任务中心频道，保证任务中心列表可实时接收状态推送。
        """
        try:
            redis_utils.publish(TASK_CENTER_EVENTS_CHANNEL, {
                'task_id': task_info.id,
                'task_status': task_info.task_status,
                'task_progress': task_info.task_progress or 0,
                'task_progress_message': task_info.task_progress_message or '',
            })
        except Exception as e:
            logger.warning(f"[TASK_INFO_HOOK] 推送任务中心事件失败: task_id={task_info.id}, error={e}")

    @staticmethod
    def _delete_by_source(source_type: str, source_id: str) -> None:
        """按来源软删除任务信息及其执行日志"""
        task = TaskInfoHook._find_by_source(source_type, source_id)
        if not task:
            return
        task.delete_instance()
        TaskLog.update(deleted=True).where(
            TaskLog.task_id == task.id,
            TaskLog.deleted == False
        ).execute()
        logger.info(f"[TASK_INFO_HOOK] 已同步删除任务信息: source={source_type}/{source_id}, task_id={task.id}")

    @staticmethod
    def _sync_execution_log(task_info: TaskInfo, status: str) -> None:
        """
        任务执行时生成/更新任务日志（每次执行生成一条task_log记录）

        - 状态为running：无当前执行日志时新建一条，否则更新进度与进度消息
        - 终态（done/fail/cancel）：将当前执行中的日志收尾

        Args:
            task_info: 任务信息模型实例（已保存的最新状态）
            status: 映射后的任务中心状态
        """
        try:
            log = TaskLog.select().where(
                TaskLog.task_id == task_info.id,
                TaskLog.deleted == False
            ).order_by(TaskLog.created_at.desc()).first()

            if status == "running":
                if not log or log.task_status != "running":
                    # 新一轮执行开始，生成一条任务日志
                    log = TaskLog(
                        task_id=task_info.id,
                        name=task_info.name,
                        task_type=task_info.task_type,
                        task_configs=task_info.task_configs,
                        task_status=status,
                        task_progress=task_info.task_progress or 0,
                        task_progress_message=task_info.task_progress_message or '',
                        task_begin_at=task_info.task_begin_at,
                    )
                    log.save(force_insert=True)
                    logger.info(f"[TASK_INFO_HOOK] 生成任务执行日志: task_id={task_info.id}, log_id={log.id}")
                else:
                    # 更新当前执行日志的进度与进度消息
                    log.task_progress = task_info.task_progress or 0
                    log.task_progress_message = task_info.task_progress_message or ''
                    log.task_begin_at = task_info.task_begin_at or log.task_begin_at
                    log.save()
            elif log and log.task_status == "running" and status in ("done", "fail", "cancel"):
                # 结束当前执行日志
                log.task_status = status
                log.task_progress = task_info.task_progress or 0
                log.task_progress_message = task_info.task_progress_message or ''
                log.task_end_at = task_info.task_end_at
                log.task_duration = task_info.task_duration or 0
                log.task_output = task_info.task_output or None
                log.save()
        except Exception as e:
            logger.error(f"[TASK_INFO_HOOK] 同步任务执行日志失败: task_id={task_info.id}, error={e}")

    # ==================== 本体工作台数据抽取任务同步 ====================

    @staticmethod
    def sync_ontology_task(task) -> None:
        """
        本体工作台数据抽取任务新增/更新时同步任务信息表

        在 OntologyService.create_task / update_task 保存后调用。

        Args:
            task: OntologyTask模型实例
        """
        try:
            configs = json.loads(task.configs) if task.configs else {}
            # 补充数据源ID到任务配置（数据抽取任务的核心配置字段）
            task_configs = dict(configs)
            if task.datasource_id:
                task_configs['datasource_id'] = task.datasource_id

            task_info = TaskInfoHook._find_by_source(TaskSourceType.ONTOLOGY_TASK, task.id)
            if not task_info:
                task_info = TaskInfo(
                    name=task.name,
                    task_type=TaskType.DATA_EXTRACT,
                    source_type=TaskSourceType.ONTOLOGY_TASK,
                    source_id=task.id,
                )
                task_info.save(force_insert=True)
                logger.info(f"[TASK_INFO_HOOK] 数据抽取任务已同步至任务信息表: source_id={task.id}, task_id={task_info.id}")

            task_info.name = task.name
            task_info.task_configs = json.dumps(task_configs, ensure_ascii=False)
            # 更新配置时源任务会重置为PENDING，同步状态/进度
            if task_info.task_status == "running":
                # 运行中的源任务被编辑（理论上被禁止），保守处理：仅同步配置
                pass
            else:
                task_info.task_status = _ONTOLOGY_STATUS_MAP.get(task.status, "pending")
                task_info.task_progress = task.task_progress or 0
                task_info.task_progress_message = task.task_progress_message or ''
            task_info.save()
        except Exception as e:
            logger.error(f"[TASK_INFO_HOOK] 同步数据抽取任务失败: source_id={getattr(task, 'id', None)}, error={e}")

    @staticmethod
    def sync_ontology_task_runtime(task) -> None:
        """
        抽取任务执行中同步任务信息表（状态/进度/进度消息/起止时间/耗时）

        在 OntologyTaskCore 状态与进度更新保存后调用。

        Args:
            task: OntologyTask模型实例（已保存的最新状态）
        """
        try:
            task_info = TaskInfoHook._find_by_source(TaskSourceType.ONTOLOGY_TASK, task.id)
            if not task_info:
                return
            task_info.task_status = _ONTOLOGY_STATUS_MAP.get(task.status, task_info.task_status)
            task_info.task_progress = task.task_progress or 0
            task_info.task_progress_message = task.task_progress_message or ''
            task_info.task_begin_at = task.task_begin_at
            task_info.task_end_at = task.task_end_at
            task_info.task_duration = task.task_duration or 0
            task_info.save()
            # 推送任务中心频道事件（任务列表页SSE实时接收）
            TaskInfoHook._publish_task_center_event(task_info)
            # 终态时构建任务输出结果（含结果文件信息）
            TaskInfoHook._finalize_task_output(task_info)
            # 同步生成/更新任务执行日志（每次执行生成一条task_log）
            TaskInfoHook._sync_execution_log(task_info, task_info.task_status)
        except Exception as e:
            logger.error(f"[TASK_INFO_HOOK] 同步数据抽取任务运行状态失败: source_id={getattr(task, 'id', None)}, error={e}")

    @staticmethod
    def sync_ontology_task_delete(task_id: str) -> None:
        """
        数据抽取任务删除时同步删除任务信息

        Args:
            task_id: OntologyTask记录ID
        """
        try:
            TaskInfoHook._delete_by_source(TaskSourceType.ONTOLOGY_TASK, task_id)
        except Exception as e:
            logger.error(f"[TASK_INFO_HOOK] 同步删除数据抽取任务失败: source_id={task_id}, error={e}")

    # ==================== 知识库文档（知识）同步 ====================

    @staticmethod
    def sync_document(doc) -> None:
        """
        知识库新增/编辑知识（KnowledgebaseDocument）时同步任务信息表。
        任务运行中所有更新knowledgebase_document的地方也调用本方法同步。

        在 KnowledgebaseDocumentService.create_document / update_document 保存后，
        以及 TaskExecutor._update_document_status 等运行时更新保存后调用。

        Args:
            doc: KnowledgebaseDocument模型实例
        """
        try:
            configs = {
                'kb_id': doc.kb_id,
                'title': doc.title or '',
                'chunk_method': doc.chunk_method or '',
            }
            if doc.chunk_config:
                try:
                    configs['chunk_config'] = json.loads(doc.chunk_config) if isinstance(doc.chunk_config, str) else doc.chunk_config
                except (json.JSONDecodeError, TypeError):
                    configs['chunk_config'] = doc.chunk_config
            if doc.file_name:
                configs['file_name'] = doc.file_name
            if doc.tags:
                try:
                    tags = json.loads(doc.tags) if isinstance(doc.tags, str) else doc.tags
                    if isinstance(tags, list):
                        configs['tags'] = tags
                except (json.JSONDecodeError, TypeError):
                    pass

            status = _DOC_STATUS_MAP.get(doc.running_status, "pending")

            task_info = TaskInfoHook._find_by_source(TaskSourceType.KNOWLEDGEBASE_DOCUMENT, doc.id)
            if not task_info:
                task_info = TaskInfo(
                    name=doc.title or doc.file_name or doc.id,
                    task_type=TaskType.DOC_CHUNK,
                    source_type=TaskSourceType.KNOWLEDGEBASE_DOCUMENT,
                    source_id=doc.id,
                )
                task_info.save(force_insert=True)
                logger.info(f"[TASK_INFO_HOOK] 文档切片任务已同步至任务信息表: source_id={doc.id}, task_id={task_info.id}")

            task_info.name = doc.title or doc.file_name or task_info.name
            task_info.task_status = status
            task_info.task_configs = json.dumps(configs, ensure_ascii=False)
            task_info.task_progress = doc.task_progress or 0
            task_info.task_progress_message = doc.task_progress_message or ''
            task_info.task_begin_at = doc.task_begin_at
            task_info.task_end_at = doc.task_end_at
            task_info.task_duration = doc.task_duration or 0
            task_info.save()
            # 推送任务中心频道事件（任务列表页SSE实时接收）
            TaskInfoHook._publish_task_center_event(task_info)
            # 终态时构建任务输出结果（含文档切片统计）
            TaskInfoHook._finalize_task_output(task_info)
            # 同步生成/更新任务执行日志（每次执行生成一条task_log）
            TaskInfoHook._sync_execution_log(task_info, status)
        except Exception as e:
            logger.error(f"[TASK_INFO_HOOK] 同步文档切片任务失败: source_id={getattr(doc, 'id', None)}, error={e}")

    @staticmethod
    def sync_document_delete(doc_id: str) -> None:
        """
        知识（文档）删除时同步删除任务信息

        Args:
            doc_id: KnowledgebaseDocument记录ID
        """
        try:
            TaskInfoHook._delete_by_source(TaskSourceType.KNOWLEDGEBASE_DOCUMENT, doc_id)
        except Exception as e:
            logger.error(f"[TASK_INFO_HOOK] 同步删除文档切片任务失败: source_id={doc_id}, error={e}")
