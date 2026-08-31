"""
技能服务类，提供技能管理及文件操作
"""

import os
import json
import shutil
import uuid
import re
from datetime import datetime
from typing import Optional
from app.database.models import Skill, SkillCategory
from app.services.skill.dto import SkillCreate, SkillCreateWithUpload, SkillUpdate, FileNode, FileContent
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError
from app.constants.skill_constants import SKILL_ROOT_DIR, SKILL_MD_FILENAME, DEFAULT_SKILL_MD_TEMPLATE


def get_project_root() -> str:
    """获取项目根目录"""
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def get_skill_abs_dir(relative_dir: str) -> str:
    """获取skill目录的绝对路径"""
    return os.path.join(get_project_root(), SKILL_ROOT_DIR, relative_dir)


def ensure_skill_root():
    """确保skill根目录存在"""
    root = os.path.join(get_project_root(), SKILL_ROOT_DIR)
    os.makedirs(root, exist_ok=True)


def read_skill_md(relative_dir: str) -> Optional[str]:
    """读取skill目录下的SKILL.md内容"""
    skill_md_path = os.path.join(get_skill_abs_dir(relative_dir), SKILL_MD_FILENAME)
    if os.path.exists(skill_md_path) and os.path.isfile(skill_md_path):
        try:
            with open(skill_md_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            return None
    return None


def validate_skill_md(content: str) -> tuple[bool, str]:
    """
    验证SKILL.md是否满足AGENT SKILL规范
    至少需要包含一级标题
    """
    if not content or not content.strip():
        return False, "SKILL.md内容不能为空"
    lines = content.strip().split('\n')
    has_h1 = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('# ') and not stripped.startswith('## '):
            has_h1 = True
            break
    if not has_h1:
        return False, "SKILL.md必须包含一级标题（# 标题）"
    return True, "格式正确"


def _build_category_map():
    """构建分类ID到名称的映射"""
    categories = SkillCategory.select().where(SkillCategory.deleted == False)
    return {str(cat.id).replace('-', ''): cat.name for cat in categories}


def _skill_to_dict(skill: Skill, with_md: bool = False, category_map: dict = None):
    """将技能模型转为字典，附加分类名和SKILL.md内容"""
    data = skill.__data__.copy()
    data['id'] = str(data['id']).replace('-', '')
    if data.get('category_id'):
        data['category_id'] = str(data['category_id']).replace('-', '')
    # tags 从 JSON 字符串转为列表
    if data.get('tags'):
        try:
            data['tags'] = json.loads(data['tags'])
        except (json.JSONDecodeError, TypeError):
            data['tags'] = []
    else:
        data['tags'] = []
    # metadata 从 JSON 字符串转为对象
    if data.get('metadata'):
        try:
            data['metadata'] = json.loads(data['metadata'])
        except (json.JSONDecodeError, TypeError):
            data['metadata'] = {}
    else:
        data['metadata'] = {}
    if category_map and data.get('category_id'):
        data['category_name'] = category_map.get(data['category_id'])
    else:
        data['category_name'] = None
    if with_md:
        data['skill_md_content'] = read_skill_md(skill.directory)
    return data


def _sanitize_dir_name(name: str) -> str:
    """将名称转为安全的目录名：不能有空格，替换特殊字符"""
    safe = re.sub(r'[\s]+', '_', name.strip())
    safe = re.sub(r'[^\w\-]', '_', safe)
    return safe


def _serialize_tags(tags) -> str:
    """将标签列表转为JSON字符串存储"""
    if tags is None:
        return None
    if isinstance(tags, str):
        return tags
    return json.dumps(tags, ensure_ascii=False)


def _serialize_metadata(metadata) -> str:
    """将元数据对象转为JSON字符串存储"""
    if metadata is None:
        return None
    if isinstance(metadata, str):
        return metadata
    return json.dumps(metadata, ensure_ascii=False)


class SkillService:
    """技能服务类"""

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

        category_map = _build_category_map()
        data_list = [_skill_to_dict(s, category_map=category_map) for s in skills]

        return {
            'data': data_list,
            'total': total,
            'page': page,
            'page_size': page_size
        }

    @staticmethod
    def get_skill(skill_id: str, with_md: bool = True):
        """获取单个技能详情"""
        try:
            skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            return None
        category_map = _build_category_map()
        return _skill_to_dict(skill, with_md=with_md, category_map=category_map)

    @staticmethod
    @handle_transaction
    def create_skill(skill_data: SkillCreate):
        """手动创建技能（自动创建目录和SKILL.md）"""
        # 名称不能有空格
        if ' ' in skill_data.name:
            raise ValueError("技能名称不能包含空格")

        ensure_skill_root()

        # 生成目录名：name安全化 + 短uuid后缀
        short_id = uuid.uuid4().hex[:8]
        safe_name = _sanitize_dir_name(skill_data.name)
        relative_dir = f"{safe_name}_{short_id}"
        abs_dir = get_skill_abs_dir(relative_dir)
        os.makedirs(abs_dir, exist_ok=True)

        # 确定SKILL.md内容：优先使用用户输入的content，否则使用模板
        skill_md_content = skill_data.content or DEFAULT_SKILL_MD_TEMPLATE.format(
            skill_name=skill_data.name,
            description=skill_data.description or skill_data.name
        )
        skill_md_path = os.path.join(abs_dir, SKILL_MD_FILENAME)
        with open(skill_md_path, 'w', encoding='utf-8') as f:
            f.write(skill_md_content)

        # 确定分类
        category_id = skill_data.category_id
        if not category_id:
            default_cat = SkillCategoryService_.get_default_category_ref()
            if default_cat:
                category_id = default_cat.id

        db_skill = Skill(
            name=skill_data.name,
            title=skill_data.title,
            description=skill_data.description,
            tags=_serialize_tags(skill_data.tags),
            avatar=skill_data.avatar,
            metadata=_serialize_metadata(skill_data.metadata),
            content=skill_data.content,
            category_id=category_id,
            directory=relative_dir,
            status=skill_data.status if skill_data.status is not None else True
        )
        db_skill.save(force_insert=True)
        return _skill_to_dict(db_skill, with_md=True)

    @staticmethod
    @handle_transaction
    def create_skill_from_upload(skill_data: SkillCreateWithUpload, directory_name: str):
        """从上传的文件/文件夹创建技能（目录已存在，仅入库）"""
        if ' ' in skill_data.name:
            raise ValueError("技能名称不能包含空格")

        # 检查SKILL.md是否存在，不存在则创建
        abs_dir = get_skill_abs_dir(directory_name)
        skill_md_path = os.path.join(abs_dir, SKILL_MD_FILENAME)
        if not os.path.exists(skill_md_path):
            skill_md_content = skill_data.content or DEFAULT_SKILL_MD_TEMPLATE.format(
                skill_name=skill_data.name,
                description=skill_data.description or skill_data.name
            )
            with open(skill_md_path, 'w', encoding='utf-8') as f:
                f.write(skill_md_content)

        category_id = skill_data.category_id
        if not category_id:
            default_cat = SkillCategoryService_.get_default_category_ref()
            if default_cat:
                category_id = default_cat.id

        db_skill = Skill(
            name=skill_data.name,
            title=skill_data.title,
            description=skill_data.description,
            tags=_serialize_tags(skill_data.tags),
            avatar=skill_data.avatar,
            metadata=_serialize_metadata(skill_data.metadata),
            content=skill_data.content,
            category_id=category_id,
            directory=directory_name,
            status=skill_data.status if skill_data.status is not None else True
        )
        db_skill.save(force_insert=True)
        return _skill_to_dict(db_skill, with_md=True)

    @staticmethod
    @handle_transaction
    def update_skill(skill_id: str, skill_data: SkillUpdate):
        """更新技能基本信息"""
        try:
            db_skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")

        update_data = skill_data.model_dump(exclude_unset=True)

        # tags 转为 JSON 字符串
        if 'tags' in update_data:
            update_data['tags'] = _serialize_tags(update_data['tags'])

        # metadata 转为 JSON 字符串
        if 'metadata' in update_data:
            update_data['metadata'] = _serialize_metadata(update_data['metadata'])

        # 如果更新了content，同步写入SKILL.md
        if 'content' in update_data and update_data['content']:
            skill_md_path = os.path.join(get_skill_abs_dir(db_skill.directory), SKILL_MD_FILENAME)
            with open(skill_md_path, 'w', encoding='utf-8') as f:
                f.write(update_data['content'])

        for field, value in update_data.items():
            setattr(db_skill, field, value)
        db_skill.updated_at = datetime.now()
        db_skill.save()
        return _skill_to_dict(db_skill, with_md=True)

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

        # 物理删除对应目录
        try:
            abs_dir = get_skill_abs_dir(directory)
            if os.path.exists(abs_dir) and os.path.isdir(abs_dir):
                shutil.rmtree(abs_dir)
        except Exception as e:
            # 目录删除失败不影响记录删除，但记录日志
            import logging
            logging.getLogger(__name__).warning(f"删除技能目录失败: {directory}, 错误: {e}")

        return db_skill

    # ==================== 文件管理相关 ====================

    @staticmethod
    def prepare_upload_directory(skill_id: str = None) -> str:
        """
        为上传准备临时目录，返回相对目录名
        如果指定skill_id，使用已有skill目录；否则生成新临时目录
        """
        ensure_skill_root()
        if skill_id:
            try:
                skill = Skill.get_by_id(skill_id)
                return skill.directory
            except Skill.DoesNotExist:
                pass
        short_id = uuid.uuid4().hex
        temp_dir = f"upload_{short_id}"
        abs_dir = get_skill_abs_dir(temp_dir)
        os.makedirs(abs_dir, exist_ok=True)
        return temp_dir

    @staticmethod
    def save_uploaded_file(relative_dir: str, file_name: str, file_content: bytes, sub_path: str = None):
        """保存上传的文件到skill目录"""
        abs_dir = get_skill_abs_dir(relative_dir)
        if sub_path:
            abs_dir = os.path.join(abs_dir, sub_path)
        os.makedirs(abs_dir, exist_ok=True)
        file_path = os.path.join(abs_dir, file_name)
        with open(file_path, 'wb') as f:
            f.write(file_content)
        return True

    @staticmethod
    def list_directory(skill_id: str, sub_path: str = None) -> list:
        """列出skill目录下的文件和文件夹"""
        try:
            skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")

        abs_dir = get_skill_abs_dir(skill.directory)
        if sub_path:
            abs_target = os.path.normpath(os.path.join(abs_dir, sub_path))
            if not abs_target.startswith(os.path.normpath(abs_dir)):
                raise ValueError("非法的子路径")
            abs_dir = abs_target

        if not os.path.exists(abs_dir):
            return []

        result = []
        try:
            entries = sorted(os.listdir(abs_dir))
        except Exception:
            return []

        for entry in entries:
            full_path = os.path.join(abs_dir, entry)
            is_dir = os.path.isdir(full_path)
            stat_info = os.stat(full_path)
            rel_path = os.path.relpath(full_path, get_skill_abs_dir(skill.directory))
            rel_path = rel_path.replace('\\', '/')
            node = {
                'name': entry,
                'path': rel_path,
                'is_dir': is_dir,
                'size': None if is_dir else stat_info.st_size,
                'modified_at': datetime.fromtimestamp(stat_info.st_mtime),
                'children': None
            }
            result.append(node)

        result.sort(key=lambda x: (0 if x['is_dir'] else 1, x['name'].lower()))
        return result

    @staticmethod
    def read_file_content(skill_id: str, file_path: str) -> FileContent:
        """读取skill目录下的文件内容"""
        try:
            skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")

        base_dir = get_skill_abs_dir(skill.directory)
        abs_file_path = os.path.normpath(os.path.join(base_dir, file_path))
        if not abs_file_path.startswith(os.path.normpath(base_dir)):
            raise ValueError("非法的文件路径")

        if not os.path.exists(abs_file_path) or not os.path.isfile(abs_file_path):
            raise ResourceNotFoundError(message=f"文件 {file_path} 不存在")

        name = os.path.basename(abs_file_path)
        text_extensions = {'.md', '.txt', '.py', '.json', '.yaml', '.yml', '.js', '.ts', '.tsx', '.jsx',
                           '.html', '.css', '.csv', '.xml', '.sh', '.bat', '.ini', '.cfg', '.conf',
                           '.toml', '.env', '.sql', '.java', '.c', '.cpp', '.h', '.go', '.rs',
                           '.rb', '.php', '.vue', '.less', '.scss'}
        ext = os.path.splitext(name)[1].lower()
        is_text = ext in text_extensions or ext == ''

        content = ''
        if is_text:
            try:
                with open(abs_file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                try:
                    with open(abs_file_path, 'r', encoding='gbk') as f:
                        content = f.read()
                except Exception:
                    is_text = False
                    content = '[二进制文件，无法显示内容]'
        else:
            content = '[二进制文件，无法显示内容]'

        return {
            'path': file_path.replace('\\', '/'),
            'name': name,
            'content': content,
            'is_text': is_text
        }

    @staticmethod
    def write_file_content(skill_id: str, file_path: str, content: str) -> bool:
        """写入文件内容"""
        try:
            skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")

        base_dir = get_skill_abs_dir(skill.directory)
        abs_file_path = os.path.normpath(os.path.join(base_dir, file_path))
        if not abs_file_path.startswith(os.path.normpath(base_dir)):
            raise ValueError("非法的文件路径")

        os.makedirs(os.path.dirname(abs_file_path), exist_ok=True)

        with open(abs_file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        if os.path.basename(abs_file_path) == SKILL_MD_FILENAME:
            ok, msg = validate_skill_md(content)
            if not ok:
                import logging
                logging.getLogger(__name__).warning(f"SKILL.md格式警告: {msg}")

        return True

    @staticmethod
    def delete_file_or_dir(skill_id: str, path: str) -> bool:
        """删除skill目录下的文件或文件夹"""
        try:
            skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")

        base_dir = get_skill_abs_dir(skill.directory)
        abs_path = os.path.normpath(os.path.join(base_dir, path))
        if not abs_path.startswith(os.path.normpath(base_dir)) or abs_path == os.path.normpath(base_dir):
            raise ValueError("非法的删除路径或不能删除根目录")

        if not os.path.exists(abs_path):
            raise ResourceNotFoundError(message=f"路径 {path} 不存在")

        if os.path.isdir(abs_path):
            shutil.rmtree(abs_path)
        else:
            os.remove(abs_path)
        return True

    @staticmethod
    def create_directory(skill_id: str, parent_path: str, dir_name: str) -> bool:
        """在skill目录下创建子文件夹"""
        try:
            skill = Skill.get_by_id(skill_id)
        except Skill.DoesNotExist:
            raise ResourceNotFoundError(message=f"技能 {skill_id} 不存在")

        base_dir = get_skill_abs_dir(skill.directory)
        if parent_path:
            abs_parent = os.path.normpath(os.path.join(base_dir, parent_path))
        else:
            abs_parent = base_dir
        if not abs_parent.startswith(os.path.normpath(base_dir)):
            raise ValueError("非法的父路径")

        target_dir = os.path.join(abs_parent, dir_name)
        if os.path.exists(target_dir):
            raise ValueError(f"文件夹 '{dir_name}' 已存在")

        os.makedirs(target_dir, exist_ok=True)
        return True


class SkillCategoryService_:
    """内部引用：避免循环导入"""
    @staticmethod
    def get_default_category_ref():
        return SkillCategory.select().where(
            (SkillCategory.is_default == True) & (SkillCategory.deleted == False)
        ).first()
