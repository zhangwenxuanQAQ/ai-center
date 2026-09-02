"""
core/skill - SKILL核心逻辑层

职责：
- SKILL.md文件构建与校验
- 文件上传/解压/目录浏览/文件读写
- 技能命名/目录名净化
- 路径安全检查

service/skill/service.py 仅做数据库表的交互，业务逻辑全部下沉到这里。
"""

from app.core.skill.skill_builder import (
    get_project_root,
    get_skill_abs_dir,
    ensure_skill_root,
    read_skill_md,
    validate_skill_md,
    build_skill_md,
    sanitize_dir_name,
)
from app.core.skill.file_manager import (
    FileUploadManager,
    prepare_upload_directory,
    save_uploaded_file,
    extract_archive,
    list_directory,
    read_file_content,
    write_file_content,
    delete_file_or_dir,
    create_directory,
    resolve_absolute_path,
    is_text_file,
)
from app.core.skill.skill_file_utils import (
    build_category_map,
    skill_to_dict,
    serialize_tags,
    serialize_metadata,
)

__all__ = [
    # skill_builder
    'get_project_root', 'get_skill_abs_dir', 'ensure_skill_root',
    'read_skill_md', 'validate_skill_md', 'build_skill_md', 'sanitize_dir_name',
    # file_manager
    'FileUploadManager', 'prepare_upload_directory', 'save_uploaded_file',
    'extract_archive', 'list_directory', 'read_file_content',
    'write_file_content', 'delete_file_or_dir', 'create_directory',
    'resolve_absolute_path', 'is_text_file',
    # skill_file_utils
    'build_category_map', 'skill_to_dict',
    'serialize_tags', 'serialize_metadata',
]
