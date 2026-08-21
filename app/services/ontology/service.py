"""
本体工作台数据管理服务
负责本体对象和任务的基础增删改查
"""

import json
import logging
from typing import Optional, List, Tuple

from app.database.models import OntologyObject, OntologyTask
from app.services.ontology.dto import (
    OntologyObjectUpdate, OntologyObjectBatchCreate, OntologyTaskCreate
)
from app.constants.ontology_constants import (
    OntologyTaskStatus, OntologyExportFormat,
    ONTOLOGY_TASK_STATUS_LABELS, ONTOLOGY_EXPORT_FORMAT_LABELS,
    ONTOLOGY_EXPORT_FORMAT_SAMPLES
)
from app.core.ontology.object_core import OntologyObjectCore
from app.core.ontology.utils import ontology_object_to_dict, task_to_dict

logger = logging.getLogger(__name__)


class OntologyService:
    """本体工作台数据管理服务（纯CRUD）"""

    # ==================== 本体对象 CRUD ====================

    @staticmethod
    def get_ontology_objects(datasource_id: str = None, page: int = 1, page_size: int = 20,
                             sort_by: str = 'name', sort_order: str = 'asc',
                             name: str = None) -> Tuple[List[dict], int]:
        """获取本体对象列表"""
        query = OntologyObject.select().where(OntologyObject.deleted == False)
        if datasource_id:
            query = query.where(OntologyObject.datasource_id == datasource_id)
        if name:
            query = query.where(OntologyObject.name.contains(name))
        total = query.count()
        # 支持排序字段：name / title / description / created_at
        sort_fields = {
            'name': OntologyObject.name,
            'title': OntologyObject.title,
            'description': OntologyObject.description,
            'created_at': OntologyObject.created_at,
        }
        field = sort_fields.get(sort_by, OntologyObject.name)
        if sort_order == 'desc':
            field = field.desc()
        else:
            field = field.asc()
        objects = query.order_by(field).paginate(page, page_size)
        return [ontology_object_to_dict(obj) for obj in objects], total

    @staticmethod
    def get_ontology_object(object_id: str) -> Optional[dict]:
        """获取单个本体对象"""
        obj = OntologyObject.select().where(
            OntologyObject.id == object_id,
            OntologyObject.deleted == False
        ).first()
        return ontology_object_to_dict(obj) if obj else None

    @staticmethod
    def batch_create_ontology_objects(dto: OntologyObjectBatchCreate) -> List[dict]:
        """批量创建本体对象"""
        datasource_id = dto.datasource_id
        results = []
        for item in dto.objects:
            table_name = item.name
            existing = OntologyObject.select().where(
                OntologyObject.datasource_id == datasource_id,
                OntologyObject.name == table_name,
                OntologyObject.deleted == False
            ).first()
            if existing:
                logger.info(f"表 {table_name} 已存在，跳过创建")
                continue

            # 如果前端传了content，直接使用；否则从数据源构建
            if item.content:
                content = item.content.model_dump()
                # 同步content中的title和description
                content['title'] = content.get('title') or item.title or ''
                content['description'] = content.get('description') or item.description or ''
            else:
                content = OntologyObjectCore.build_ontology_content(
                    datasource_id, table_name,
                    title=item.title, description=item.description
                )
            # 本体对象的title和description与content保持一致
            obj_title = item.title or content.get('title', '')
            obj_description = item.description or content.get('description', '')
            obj = OntologyObject(
                datasource_id=datasource_id,
                name=table_name,
                title=obj_title,
                description=obj_description,
                content=json.dumps(content, ensure_ascii=False)
            )
            saved = obj.save(force_insert=True)
            logger.info(f"创建本体对象: name={table_name}, saved={saved}, id={obj.id}")
            results.append(ontology_object_to_dict(obj))

        return results

    @staticmethod
    def update_ontology_object(object_id: str, dto: OntologyObjectUpdate) -> Optional[dict]:
        """更新本体对象"""
        obj = OntologyObject.select().where(
            OntologyObject.id == object_id,
            OntologyObject.deleted == False
        ).first()
        if not obj:
            return None

        # 更新title和description
        new_title = dto.title if dto.title is not None else obj.title
        new_description = dto.description if dto.description is not None else obj.description
        if dto.title is not None:
            obj.title = dto.title
        if dto.description is not None:
            obj.description = dto.description
        # 更新content，并同步title和description
        if dto.content is not None:
            content = dto.content.model_dump()
            content['title'] = new_title or ''
            content['description'] = new_description or ''
            obj.content = json.dumps(content, ensure_ascii=False)
        else:
            # 即使content未更新，也要保持title和description同步
            if obj.content:
                try:
                    content = json.loads(obj.content)
                    content['title'] = new_title or ''
                    content['description'] = new_description or ''
                    obj.content = json.dumps(content, ensure_ascii=False)
                except (json.JSONDecodeError, TypeError):
                    pass
        obj.save()
        return ontology_object_to_dict(obj)

    @staticmethod
    def delete_ontology_object(object_id: str) -> bool:
        """删除本体对象（物理删除）"""
        obj = OntologyObject.select().where(
            OntologyObject.id == object_id,
            OntologyObject.deleted == False
        ).first()
        if not obj:
            return False
        obj.delete_instance(permanently=True)
        return True

    @staticmethod
    def batch_delete_ontology_objects(object_ids: List[str]) -> int:
        """批量删除本体对象（物理删除）"""
        deleted_count = 0
        for object_id in object_ids:
            obj = OntologyObject.select().where(
                OntologyObject.id == object_id,
                OntologyObject.deleted == False
            ).first()
            if obj:
                obj.delete_instance(permanently=True)
                deleted_count += 1
        return deleted_count

    # ==================== 数据抽取任务 CRUD ====================

    @staticmethod
    def get_tasks(name: str = None, page: int = 1, page_size: int = 20) -> Tuple[List[dict], int]:
        """获取任务列表"""
        query = OntologyTask.select().where(OntologyTask.deleted == False)
        if name:
            query = query.where(OntologyTask.name.contains(name))
        total = query.count()
        tasks = query.order_by(OntologyTask.created_at.desc()).paginate(page, page_size)
        return [task_to_dict(t) for t in tasks], total

    @staticmethod
    def get_task(task_id: str) -> Optional[dict]:
        """获取单个任务"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        return task_to_dict(task) if task else None

    @staticmethod
    def create_task(dto: OntologyTaskCreate) -> dict:
        """创建任务"""
        configs = dto.configs or {}
        task = OntologyTask(
            name=dto.name,
            datasource_id=dto.datasource_id,
            configs=json.dumps(configs, ensure_ascii=False),
            status=OntologyTaskStatus.PENDING,
        )
        task.save()
        return task_to_dict(task)

    @staticmethod
    def batch_delete_tasks(task_ids: List[str]) -> int:
        """批量删除任务（跳过正在运行的任务）"""
        deleted_count = 0
        for task_id in task_ids:
            task = OntologyTask.select().where(
                OntologyTask.id == task_id,
                OntologyTask.deleted == False
            ).first()
            if task and task.status != OntologyTaskStatus.RUNNING:
                task.delete_instance()
                deleted_count += 1
        return deleted_count

    @staticmethod
    def update_task_status(task_id: str, status: str) -> bool:
        """更新任务状态"""
        task = OntologyTask.select().where(
            OntologyTask.id == task_id,
            OntologyTask.deleted == False
        ).first()
        if not task:
            return False
        task.status = status
        task.save()
        return True

    # ==================== 导出格式 ====================

    @staticmethod
    def get_export_formats() -> dict:
        """获取导出格式列表"""
        return {
            'formats': [
                {
                    'value': fmt,
                    'label': ONTOLOGY_EXPORT_FORMAT_LABELS[fmt],
                    'sample': ONTOLOGY_EXPORT_FORMAT_SAMPLES.get(fmt, ''),
                }
                for fmt in [OntologyExportFormat.JSON, OntologyExportFormat.EXCEL, OntologyExportFormat.MARKDOWN]
            ]
        }