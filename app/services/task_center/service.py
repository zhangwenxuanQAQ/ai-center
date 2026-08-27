"""
任务中心数据管理服务
负责任务信息和任务日志的基础增删改查，并按任务类型分发到对应业务模块：
    - 接口调用(api)：直接维护task_info记录
    - 数据抽取(data_extract)：委托本体工作台任务服务维护（由task_info_hook同步任务信息表）
    - 文档切片(doc_chunk)：委托知识库文档服务维护（由task_info_hook同步任务信息表）
"""

import json
import logging
from typing import Optional, List, Tuple

from app.database.models import TaskInfo, TaskLog
from app.services.task_center.dto import TaskInfoCreate, TaskInfoUpdate
from app.constants.task_center_constants import (
    TaskStatus, TaskType, TaskSourceType,
    TASK_STATUS_LABELS, TASK_TYPE_NAME, TASK_TYPE_CONFIG_FIELDS,
)
from app.core.task_center.utils import task_info_to_dict, task_log_to_dict

logger = logging.getLogger(__name__)


class TaskCenterService:
    """任务中心数据管理服务（按类型分发的增删改查）"""

    # ==================== 任务类型/状态字典 ====================

    @staticmethod
    def get_task_types() -> dict:
        """
        获取任务类型列表（含各类型所需配置字段定义）

        Returns:
            dict: {任务类型: {name: 显示名称, config_fields: 配置字段定义列表}}
        """
        return {
            task_type: {
                'name': name,
                'config_fields': TASK_TYPE_CONFIG_FIELDS.get(task_type, []),
            }
            for task_type, name in TASK_TYPE_NAME.items()
        }

    @staticmethod
    def get_task_statuses() -> dict:
        """获取任务状态及其显示名称"""
        return dict(TASK_STATUS_LABELS)

    # ==================== 任务信息 CRUD（按类型分发） ====================

    @staticmethod
    def get_task_infos(name: str = None, task_type: str = None, task_status: str = None,
                       page: int = 1, page_size: int = 20) -> Tuple[List[dict], int]:
        """
        获取任务列表（支持名称、任务类型、任务状态过滤）

        Args:
            name: 任务名称（模糊查询）
            task_type: 任务类型过滤
            task_status: 任务状态过滤
            page: 页码
            page_size: 每页数量

        Returns:
            (任务列表, 总数)
        """
        query = TaskInfo.select().where(TaskInfo.deleted == False)
        if name:
            query = query.where(TaskInfo.name.contains(name))
        if task_type:
            query = query.where(TaskInfo.task_type == task_type)
        if task_status:
            query = query.where(TaskInfo.task_status == task_status)
        total = query.count()
        tasks = query.order_by(TaskInfo.created_at.desc()).paginate(page, page_size)
        return [task_info_to_dict(task) for task in tasks], total

    @staticmethod
    def get_task_info(task_id: str) -> Optional[dict]:
        """获取单个任务信息"""
        task = TaskInfo.select().where(
            TaskInfo.id == task_id,
            TaskInfo.deleted == False
        ).first()
        return task_info_to_dict(task) if task else None

    @staticmethod
    def create_task_info(dto: TaskInfoCreate) -> dict:
        """
        创建任务（按类型分发）

        - 接口调用：直接创建task_info记录
        - 数据抽取：创建本体工作台任务，由task_info_hook同步任务信息表
        - 文档切片：创建知识库文档，由task_info_hook同步任务信息表

        Args:
            dto: 任务创建DTO

        Returns:
            dict: 创建后的任务信息

        Raises:
            ValueError: 任务类型不合法或缺少必填配置
        """
        if dto.task_type not in TASK_TYPE_NAME:
            raise ValueError(f"不支持的任务类型: {dto.task_type}")
        configs = dto.task_configs or {}

        # 校验必填配置字段
        for field in TASK_TYPE_CONFIG_FIELDS.get(dto.task_type, []):
            if field.get('required') and not configs.get(field['key']):
                raise ValueError(f"缺少必填配置字段: {field['label']}({field['key']})")

        # 数据抽取任务：委托本体工作台任务服务创建
        if dto.task_type == TaskType.DATA_EXTRACT:
            from app.services.ontology.service import OntologyService
            from app.services.ontology.dto import OntologyTaskCreate
            source_configs = dict(configs)
            source_configs.pop('datasource_id', None)
            OntologyService.create_task(OntologyTaskCreate(
                name=dto.name,
                datasource_id=configs.get('datasource_id', ''),
                configs=source_configs,
            ))
            # hook已同步创建task_info，按类型+名称查询最新记录返回
            task = TaskCenterService._get_latest_by_type(TaskType.DATA_EXTRACT, dto.name)
            TaskCenterService._update_task_description(task, dto.description)
            return task

        # 文档切片任务：委托知识库文档服务创建
        if dto.task_type == TaskType.DOC_CHUNK:
            from app.services.knowledgebase.service import KnowledgebaseDocumentService
            from app.services.knowledgebase.dto import KnowledgebaseDocumentCreate
            doc_configs = dict(configs)
            chunk_config = doc_configs.get('chunk_config')
            if isinstance(chunk_config, str):
                try:
                    chunk_config = json.loads(chunk_config) if chunk_config else None
                except (json.JSONDecodeError, TypeError):
                    chunk_config = None
            tags = doc_configs.get('tags')
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(',') if t.strip()] or None
            KnowledgebaseDocumentService.create_document(KnowledgebaseDocumentCreate(
                kb_id=doc_configs.get('kb_id', ''),
                title=doc_configs.get('title', ''),
                chunk_method=doc_configs.get('chunk_method', 'naive'),
                chunk_config=chunk_config,
                file_name=doc_configs.get('file_name') or None,
                tags=tags,
            ))
            task = TaskCenterService._get_latest_by_type(TaskType.DOC_CHUNK, doc_configs.get('title', ''))
            TaskCenterService._update_task_description(task, dto.description)
            return task

        # 接口调用任务：直接创建task_info
        task = TaskInfo(
            name=dto.name,
            description=dto.description,
            task_status=TaskStatus.PENDING,
            task_type=dto.task_type,
            task_configs=json.dumps(configs, ensure_ascii=False) if configs else None,
            task_progress=0,
            task_progress_message=None,
        )
        task.save(force_insert=True)
        logger.info(f"创建任务: name={dto.name}, type={dto.task_type}, id={task.id}")
        return task_info_to_dict(task)

    @staticmethod
    def _get_latest_by_type(task_type: str, name: str) -> dict:
        """按类型和名称查询最新创建的任务信息（用于hook同步创建后的返回）"""
        task = TaskInfo.select().where(
            TaskInfo.task_type == task_type,
            TaskInfo.name == name,
            TaskInfo.deleted == False
        ).order_by(TaskInfo.created_at.desc()).first()
        return task_info_to_dict(task) if task else {}

    @staticmethod
    def _update_task_description(task_dict: dict, description: str) -> None:
        """
        更新任务描述（源业务模块无描述字段，委托创建的任务在hook同步后补充描述）

        Args:
            task_dict: _get_latest_by_type返回的任务信息字典
            description: 任务描述（None时不更新）
        """
        if description is None or not task_dict or not task_dict.get('id'):
            return
        try:
            task = TaskInfo.select().where(TaskInfo.id == task_dict['id']).first()
            if task:
                task.description = description
                task.save()
                task_dict['description'] = description
        except Exception as e:
            logger.warning(f"更新任务描述失败: task_id={task_dict.get('id')}, error={e}")

    @staticmethod
    def update_task_info(task_id: str, dto: TaskInfoUpdate) -> Optional[dict]:
        """
        更新任务（按类型分发，运行中的任务不可编辑）

        Args:
            task_id: 任务ID
            dto: 任务更新DTO

        Returns:
            dict: 更新后的任务信息，任务不存在返回None

        Raises:
            ValueError: 任务运行中不可编辑
        """
        task = TaskInfo.select().where(
            TaskInfo.id == task_id,
            TaskInfo.deleted == False
        ).first()
        if not task:
            return None
        if task.task_status == TaskStatus.RUNNING:
            raise ValueError("任务运行中，暂不可编辑")
        configs = dto.task_configs if dto.task_configs is not None else json.loads(task.task_configs or '{}')

        # 数据抽取任务：委托本体工作台任务服务更新
        if task.task_type == TaskType.DATA_EXTRACT and task.source_type == TaskSourceType.ONTOLOGY_TASK and task.source_id:
            from app.services.ontology.service import OntologyService
            from app.services.ontology.dto import OntologyTaskUpdate
            source_configs = dict(configs)
            datasource_id = source_configs.pop('datasource_id', None)
            OntologyService.update_task(task.source_id, OntologyTaskUpdate(
                name=dto.name,
                datasource_id=datasource_id,
                configs=source_configs if dto.task_configs is not None else None,
            ))
            TaskCenterService._update_task_description({'id': task_id}, dto.description)
            return TaskCenterService.get_task_info(task_id)

        # 文档切片任务：委托知识库文档服务更新
        if task.task_type == TaskType.DOC_CHUNK and task.source_type == TaskSourceType.KNOWLEDGEBASE_DOCUMENT and task.source_id:
            from app.services.knowledgebase.service import KnowledgebaseDocumentService
            from app.services.knowledgebase.dto import KnowledgebaseDocumentUpdate
            doc_configs = dict(configs)
            chunk_config = doc_configs.get('chunk_config')
            if isinstance(chunk_config, str):
                try:
                    chunk_config = json.loads(chunk_config) if chunk_config else None
                except (json.JSONDecodeError, TypeError):
                    chunk_config = None
            update_kwargs = {}
            if dto.name is not None:
                update_kwargs['title'] = dto.name
            if 'chunk_method' in doc_configs and doc_configs.get('chunk_method'):
                update_kwargs['chunk_method'] = doc_configs.get('chunk_method')
            if 'chunk_config' in doc_configs:
                update_kwargs['chunk_config'] = chunk_config
            if 'file_name' in doc_configs and doc_configs.get('file_name'):
                update_kwargs['file_name'] = doc_configs.get('file_name')
            KnowledgebaseDocumentService.update_document(task.source_id, KnowledgebaseDocumentUpdate(**update_kwargs))
            TaskCenterService._update_task_description({'id': task_id}, dto.description)
            return TaskCenterService.get_task_info(task_id)

        # 接口调用任务：直接更新task_info
        if dto.name is not None:
            task.name = dto.name
        if dto.description is not None:
            task.description = dto.description
        if dto.task_configs is not None:
            task.task_configs = json.dumps(dto.task_configs, ensure_ascii=False)
        task.save()
        return task_info_to_dict(task)

    @staticmethod
    def delete_task_info(task_id: str) -> bool:
        """
        删除任务（按类型分发，软删除，运行中的任务不可删除）

        - 接口调用：删除task_info及其执行日志
        - 数据抽取：删除本体工作台任务（由hook同步删除任务信息）
        - 文档切片：删除知识库文档（由hook同步删除任务信息）

        Args:
            task_id: 任务ID

        Returns:
            bool: 是否删除成功

        Raises:
            ValueError: 任务运行中不可删除
        """
        task = TaskInfo.select().where(
            TaskInfo.id == task_id,
            TaskInfo.deleted == False
        ).first()
        if not task:
            return False
        if task.task_status == TaskStatus.RUNNING:
            raise ValueError("任务运行中，暂不可删除")

        # 数据抽取任务：委托本体工作台任务服务删除
        if task.task_type == TaskType.DATA_EXTRACT and task.source_type == TaskSourceType.ONTOLOGY_TASK and task.source_id:
            from app.services.ontology.service import OntologyService
            return OntologyService.batch_delete_tasks([task.source_id]) > 0

        # 文档切片任务：委托知识库文档服务删除
        if task.task_type == TaskType.DOC_CHUNK and task.source_type == TaskSourceType.KNOWLEDGEBASE_DOCUMENT and task.source_id:
            from app.services.knowledgebase.service import KnowledgebaseDocumentService
            KnowledgebaseDocumentService.delete_document(task.source_id)
            return True

        # 接口调用任务：直接删除task_info
        task.delete_instance()
        # 任务删除时同步软删除其执行日志
        TaskLog.update(
            deleted=True
        ).where(
            TaskLog.task_id == task_id,
            TaskLog.deleted == False
        ).execute()
        logger.info(f"删除任务: id={task_id}")
        return True

    # ==================== 任务日志查询 ====================

    @staticmethod
    def get_task_logs(name: str = None, task_type: str = None, task_status: str = None,
                      page: int = 1, page_size: int = 20) -> Tuple[List[dict], int]:
        """
        获取任务日志列表（支持名称、任务类型、任务状态过滤）

        Args:
            name: 任务名称（模糊查询）
            task_type: 任务类型过滤
            task_status: 任务状态过滤
            page: 页码
            page_size: 每页数量

        Returns:
            (任务日志列表, 总数)
        """
        query = TaskLog.select().where(TaskLog.deleted == False)
        if name:
            query = query.where(TaskLog.name.contains(name))
        if task_type:
            query = query.where(TaskLog.task_type == task_type)
        if task_status:
            query = query.where(TaskLog.task_status == task_status)
        total = query.count()
        logs = query.order_by(TaskLog.created_at.desc()).paginate(page, page_size)
        return [task_log_to_dict(log) for log in logs], total

    @staticmethod
    def get_task_log(log_id: str) -> Optional[dict]:
        """获取单个任务日志"""
        log = TaskLog.select().where(
            TaskLog.id == log_id,
            TaskLog.deleted == False
        ).first()
        return task_log_to_dict(log) if log else None
