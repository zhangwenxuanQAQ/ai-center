"""
技能服务类 - 仅做数据库表的交互

业务逻辑（SKILL.md 文件构建、路径安全、文件上传/浏览/读写）全部委托给
app.core.skill 模块（skill_builder / file_manager / skill_file_utils）。
"""

import os
import json
import logging
from datetime import datetime
from app.database.models import Skill, SkillCategory
from app.services.skill.dto import SkillCreate, SkillCreateWithUpload, SkillUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError
from app.constants.skill_constants import SKILL_MD_FILENAME
from app.core.skill.skill_builder import (
    get_skill_abs_dir,
    ensure_skill_root,
    build_skill_md,
    sanitize_dir_name,
)
from app.core.skill.file_manager import (
    FileUploadManager,
    list_directory,
    read_file_content,
    write_file_content,
    delete_file_or_dir,
    create_directory,
)
from app.core.skill.skill_file_utils import (
    build_category_map,
    skill_to_dict,
    serialize_tags,
    serialize_metadata,
)

logger = logging.getLogger(__name__)


class SkillCategoryService_:
    """内部引用：避免循环导入 service 链"""

    @staticmethod
    def get_default_category_ref():
        return SkillCategory.select().where(
            (SkillCategory.is_default == True) & (SkillCategory.deleted == False)
        ).first()


class SkillService:
    """技能服务类（仅数据库交互，文件操作委托给 core/skill/file_manager）"""

    # ==================== 查询 ====================

    @staticmethod
    def get_skills(page: int = 1, page_size: int = 20, category_id: str = None,
                   keyword: str = None, status: bool = None):
        """获取技能列表（分页）"""
        query = Skill.select().where(Skill.deleted == False)
        if category_id:
            query = query.where(Skill.category_id == category_id)
        if keyword:
            query = query.where((Skill.name.contains(keyword)) | (Skill.title.contains(keyword)))
        if status is not None:
            query = query.where(Skill.status == status)

        total = query.count()
        query = query.order_by(Skill.created_at.desc())
        offset = (page - 1) * page_size
        skills = list(query.offset(offset).limit(page_size))

        category_map = build_category_map()
        data_list = [skill_to_dict(s, category_map=category_map) for s in skills]
        return {
            'data': data_list,
            'total': total,
            'page': page,
            'page_size': page_size,
        }

    @staticmethod
    def get_skill(skill_id: str, with_md: bool = True):
        """获取单个技能详情"""
        try:
            skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            return None
        category_map = build_category_map()
        return skill_to_dict(skill, with_md=with_md, category_map=category_map)

    # ==================== 创建 ====================

    @staticmethod
    @handle_transaction
    def create_skill(skill_data: SkillCreate):
        """
        手动创建技能
        - 校验名称不能有空格
        - 目录名 = 技能名称净化后的结果，并检查是否被占用
        - 按标准模板生成 SKILL.md
        - 入库
        """
        if ' ' in skill_data.name:
            raise ValueError("技能名称不能包含空格")

        ensure_skill_root()
        relative_dir = sanitize_dir_name(skill_data.name)

        # 检查目录是否已被其他技能占用
        existing = Skill.select().where(
            (Skill.directory == relative_dir) & (Skill.deleted == False)
        ).first()
        if existing:
            raise ValueError(f"已存在同名技能目录 '{relative_dir}'，请使用其他名称")

        abs_dir = get_skill_abs_dir(relative_dir)
        os.makedirs(abs_dir, exist_ok=True)

        body_content = (skill_data.content or "").strip()
        skill_md_content = build_skill_md(
            skill_name=skill_data.name,
            description=skill_data.description or "",
            metadata=skill_data.metadata or {},
            body_content=body_content,
        )
        with open(os.path.join(abs_dir, SKILL_MD_FILENAME), 'w', encoding='utf-8') as f:
            f.write(skill_md_content)

        category_id = _resolve_category_id(skill_data.category_id)
        db_skill = Skill(
            name=skill_data.name,
            title=skill_data.title,
            description=skill_data.description,
            tags=serialize_tags(skill_data.tags),
            avatar=skill_data.avatar,
            metadata=serialize_metadata(skill_data.metadata),
            content=body_content,
            category_id=category_id,
            directory=relative_dir,
            status=skill_data.status if skill_data.status is not None else True,
        )
        db_skill.save(force_insert=True)
        return skill_to_dict(db_skill, with_md=True)

    @staticmethod
    @handle_transaction
    def create_skill_from_upload(skill_data: SkillCreateWithUpload, directory_name: str):
        """
        从上传的文件/文件夹创建技能（目录已存在，仅入库）
        若 SKILL.md 不存在则按标准模板生成
        """
        if ' ' in skill_data.name:
            raise ValueError("技能名称不能包含空格")

        abs_dir = get_skill_abs_dir(directory_name)
        skill_md_path = os.path.join(abs_dir, SKILL_MD_FILENAME)
        if not os.path.exists(skill_md_path):
            body_content = (skill_data.content or "").strip()
            skill_md_content = build_skill_md(
                skill_name=skill_data.name,
                description=skill_data.description or "",
                metadata=skill_data.metadata or {},
                body_content=body_content,
            )
            with open(skill_md_path, 'w', encoding='utf-8') as f:
                f.write(skill_md_content)

        category_id = _resolve_category_id(skill_data.category_id)
        db_skill = Skill(
            name=skill_data.name,
            title=skill_data.title,
            description=skill_data.description,
            tags=serialize_tags(skill_data.tags),
            avatar=skill_data.avatar,
            metadata=serialize_metadata(skill_data.metadata),
            content=skill_data.content,
            category_id=category_id,
            directory=directory_name,
            status=skill_data.status if skill_data.status is not None else True,
        )
        db_skill.save(force_insert=True)
        return skill_to_dict(db_skill, with_md=True)

    # ==================== 更新 ====================

    @staticmethod
    @handle_transaction
    def update_skill(skill_id: str, skill_data: SkillUpdate):
        """
        更新技能基本信息
        只要 name/description/metadata/content 任一变更，就按标准模板重新生成 SKILL.md
        """
        try:
            db_skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")

        update_data = skill_data.model_dump(exclude_unset=True)

        if 'tags' in update_data:
            update_data['tags'] = serialize_tags(update_data['tags'])
        if 'metadata' in update_data:
            update_data['metadata'] = serialize_metadata(update_data['metadata'])

        keys_affect_md = ('name', 'description', 'metadata', 'content')
        if any(k in update_data for k in keys_affect_md):
            merged_name = update_data.get('name') or db_skill.name
            merged_desc = update_data.get('description', db_skill.description) or ''

            merged_meta = _parse_meta_or_empty(db_skill.metadata)
            new_meta = update_data.get('metadata')
            if new_meta is not None:
                if isinstance(new_meta, dict):
                    for k, v in new_meta.items():
                        if k in ('name', 'description'):
                            continue
                        merged_meta[k] = v
                elif isinstance(new_meta, str):
                    try:
                        parsed = json.loads(new_meta)
                        if isinstance(parsed, dict):
                            for k, v in parsed.items():
                                if k in ('name', 'description'):
                                    continue
                                merged_meta[k] = v
                    except (ValueError, TypeError):
                        pass

            body_content = (update_data['content'] if 'content' in update_data else (db_skill.content or '')).strip()
            skill_md_path = os.path.join(get_skill_abs_dir(db_skill.directory), SKILL_MD_FILENAME)
            with open(skill_md_path, 'w', encoding='utf-8') as f:
                f.write(build_skill_md(
                    skill_name=merged_name,
                    description=merged_desc,
                    metadata=merged_meta,
                    body_content=body_content,
                ))
            update_data['content'] = body_content

        for field, value in update_data.items():
            setattr(db_skill, field, value)
        db_skill.updated_at = datetime.now()
        db_skill.save()
        return skill_to_dict(db_skill, with_md=True)

    # ==================== 删除 ====================

    @staticmethod
    @handle_transaction
    def delete_skill(skill_id: str):
        """删除技能（软删除 + 物理删除目录）"""
        try:
            db_skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")

        directory = db_skill.directory
        db_skill.delete_instance()

        # 物理删除对应目录（失败仅记录日志）
        try:
            abs_dir = get_skill_abs_dir(directory)
            if os.path.exists(abs_dir) and os.path.isdir(abs_dir):
                import shutil as _shutil
                _shutil.rmtree(abs_dir)
        except Exception as e:
            logger.warning(f"删除技能目录失败: {directory}, 错误: {e}")

        return db_skill

    # ==================== 文件管理（委托给 core/skill/file_manager） ====================

    @staticmethod
    def prepare_upload_directory(skill_id: str = None) -> str:
        """
        为上传准备临时目录，返回相对目录名
        如果指定 skill_id 复用其目录；否则新建 upload_<uuid>
        """
        skill_directory = None
        if skill_id:
            try:
                skill = Skill.get_by_id(skill_id)
                skill_directory = skill.directory
            except Skill.DoesNotExist:
                pass
        return FileUploadManager.prepare(skill_directory)

    @staticmethod
    def list_directory(skill_id: str, sub_path: str = None) -> list:
        """列出技能目录下的文件和文件夹"""
        skill = _get_or_404(skill_id)
        return list_directory(skill.directory, sub_path)

    @staticmethod
    def read_file_content(skill_id: str, file_path: str) -> dict:
        """读取技能目录下的文件内容"""
        skill = _get_or_404(skill_id)
        return read_file_content(skill.directory, file_path)

    @staticmethod
    def write_file_content(skill_id: str, file_path: str, content: str) -> bool:
        """写入技能目录下的文件内容"""
        skill = _get_or_404(skill_id)
        return write_file_content(skill.directory, file_path, content)

    @staticmethod
    def delete_file_or_dir(skill_id: str, path: str) -> bool:
        """删除技能目录下的文件或文件夹"""
        skill = _get_or_404(skill_id)
        return delete_file_or_dir(skill.directory, path)

    @staticmethod
    def create_directory(skill_id: str, parent_path: str, dir_name: str) -> bool:
        """在技能目录下创建子文件夹"""
        skill = _get_or_404(skill_id)
        return create_directory(skill.directory, parent_path, dir_name)


def _get_or_404(skill_id: str) -> Skill:
    """从数据库取出技能，不存在则抛 ResourceNotFoundError"""
    try:
        return Skill.get_by_id(skill_id)
    except Skill.DoesNotExist:
        raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")


def _resolve_category_id(category_id: str):
    """若 category_id 为空，使用默认分类"""
    if category_id:
        return category_id
    default_cat = SkillCategoryService_.get_default_category_ref()
    return default_cat.id if default_cat else None


def _parse_meta_or_empty(raw) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (ValueError, TypeError):
        return {}
