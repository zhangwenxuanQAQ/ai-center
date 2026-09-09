"""
file_manager.py - skill 文件上传/浏览/读写管理器

包含：
- 路径安全检查（防止 ../ 等路径穿越）
- 文本文件扩展名判定
- 单/批量文件上传
- zip / tar / tar.gz / tar.bz2 解压（带 __MACOSX 跳过 + 顶层单文件夹扁平化）
- 目录浏览
- 文件内容读写（UTF-8 → GBK → 二进制自动降级）
- 文件/文件夹删除
- 创建子文件夹

Business logic 全部集中在此处，service/skill/service.py 仅调用本模块做磁盘操作。
"""

import os
import shutil
import uuid
import tarfile
import zipfile
import logging
from datetime import datetime

from app.core.exceptions import ResourceNotFoundError
from app.constants.skill_constants import SKILL_MD_FILENAME
from app.core.skill.skill_builder import (
    get_skill_abs_dir,
    ensure_skill_root,
    validate_skill_md,
)

logger = logging.getLogger(__name__)

# 文本文件扩展名白名单（其它视为二进制）
TEXT_EXTENSIONS = {
    '.md', '.txt', '.py', '.json', '.yaml', '.yml', '.js', '.ts', '.tsx', '.jsx',
    '.html', '.css', '.csv', '.xml', '.sh', '.bat', '.ini', '.cfg', '.conf',
    '.toml', '.env', '.sql', '.java', '.c', '.cpp', '.h', '.go', '.rs',
    '.rb', '.php', '.vue', '.less', '.scss',
}


def is_text_file(name: str) -> bool:
    """判断文件是否为文本文件"""
    ext = os.path.splitext(name)[1].lower()
    return ext in TEXT_EXTENSIONS or ext == ''


def resolve_absolute_path(base_dir: str, relative_path: str, base_dir_must_start: bool = True) -> str:
    """
    解析相对路径为绝对路径，并校验是否在 base_dir 之内

    参数：
        base_dir: 基准目录（绝对路径）
        relative_path: 相对路径（允许为空，返回 base_dir 本身）
        base_dir_must_start: 是否要求绝对路径必须以 base_dir 开头（防 ../ 穿越）

    返回：
        绝对路径
    """
    if relative_path:
        abs_target = os.path.normpath(os.path.join(base_dir, relative_path))
    else:
        abs_target = os.path.normpath(base_dir)
    if base_dir_must_start and not abs_target.startswith(os.path.normpath(base_dir)):
        raise ValueError(f"非法路径 '{relative_path}'，超出基准目录")
    return abs_target


def prepare_upload_directory(skill_directory: str = None) -> str:
    """
    为上传准备临时目录，返回相对目录名

    如果指定 skill_directory（已有技能目录），直接复用；
    否则在 data/skill 下新建 upload_<uuid> 临时目录
    """
    ensure_skill_root()
    if skill_directory:
        return skill_directory
    short_id = uuid.uuid4().hex
    temp_dir = f"upload_{short_id}"
    abs_dir = get_skill_abs_dir(temp_dir)
    os.makedirs(abs_dir, exist_ok=True)
    return temp_dir


def save_uploaded_file(relative_dir: str, file_name: str, file_content: bytes, sub_path: str = None) -> bool:
    """保存上传的单文件到 skill 目录（支持 sub_path 子路径）"""
    abs_dir = get_skill_abs_dir(relative_dir)
    if sub_path:
        abs_dir = resolve_absolute_path(abs_dir, sub_path)
    os.makedirs(abs_dir, exist_ok=True)
    abs_dir = resolve_absolute_path(abs_dir, os.path.dirname(file_name) or '.').replace(os.sep, os.sep)
    # 文件名可能携带多级目录（文件夹上传），逐级创建父目录
    os.makedirs(abs_dir, exist_ok=True)
    # 防止文件名包含路径分隔符
    safe_file_name = os.path.basename(file_name)
    file_path = os.path.join(abs_dir, safe_file_name)
    with open(file_path, 'wb') as f:
        f.write(file_content)
    return True


def extract_archive(abs_target_dir: str, archive_path: str, archive_name: str) -> int:
    """
    解压 zip/tar/tar.gz/tar.bz2 到指定目录

    特性：
    - 跳过 __MACOSX 等隐藏目录
    - 自动检测到顶层单一文件夹时进行扁平化（去掉前缀）
    - 解压 tar 时重命名文件以剥离顶层前缀

    返回：成功提取的文件数量
    """
    os.makedirs(abs_target_dir, exist_ok=True)
    archive_name = (archive_name or '').lower()

    extracted_count = 0
    try:
        if archive_name.endswith('.zip'):
            with zipfile.ZipFile(archive_path, 'r') as zf:
                names = zf.namelist()
                common_prefix = _detect_common_prefix(names)
                for member in names:
                    if _is_hidden_entry(member):
                        continue
                    target_name = _strip_prefix(member, common_prefix)
                    if not target_name:
                        continue
                    target_path = os.path.join(abs_target_dir, target_name)
                    if member.endswith('/'):
                        os.makedirs(target_path, exist_ok=True)
                    else:
                        os.makedirs(os.path.dirname(target_path) or abs_target_dir, exist_ok=True)
                        with zf.open(member) as src, open(target_path, 'wb') as dst:
                            shutil.copyfileobj(src, dst)
                        extracted_count += 1
        elif archive_name.endswith(('.tar', '.tar.gz', '.tgz', '.tar.bz2')):
            mode = 'r:gz' if archive_name.endswith(('.tar.gz', '.tgz')) else 'r:bz2' if archive_name.endswith('.tar.bz2') else 'r:'
            with tarfile.open(archive_path, mode) as tf:
                members = tf.getmembers()
                common_prefix = _detect_common_prefix([m.name for m in members])
                for member in members:
                    if _is_hidden_entry(member.name):
                        continue
                    target_name = _strip_prefix(member.name, common_prefix)
                    if not target_name:
                        continue
                    target_path = os.path.join(abs_target_dir, target_name)
                    if member.isdir():
                        os.makedirs(target_path, exist_ok=True)
                    else:
                        os.makedirs(os.path.dirname(target_path) or abs_target_dir, exist_ok=True)
                        tf.extract(member, abs_target_dir)
                        # 重定向到去除前缀后的位置
                        if common_prefix:
                            src = os.path.join(abs_target_dir, member.name)
                            if os.path.exists(src):
                                shutil.move(src, target_path)
                        extracted_count += 1
        else:
            raise ValueError(f"不支持的压缩格式 '{archive_name}'")
    finally:
        # 清理可能残留的顶层空文件夹
        try:
            for item in os.listdir(abs_target_dir):
                item_path = os.path.join(abs_target_dir, item)
                if os.path.isdir(item_path) and not os.listdir(item_path):
                    os.rmdir(item_path)
        except Exception:
            pass
    return extracted_count


def _is_hidden_entry(path_name: str) -> bool:
    """判断解压条目是否为隐藏/系统条目（如 __MACOSX, .git 等）"""
    parts = path_name.split('/')
    return any(p.startswith('__') or p.startswith('.') for p in parts if p)


def _detect_common_prefix(namelist: list) -> str:
    """
    检测顶层单一文件夹作为共同前缀
    返回 "first/" 或 None
    """
    if not namelist:
        return None
    first = namelist[0].split('/')[0] if '/' in namelist[0] else None
    if not first:
        return None
    # 所有非空条目都必须以 first/ 开头
    if all(n.startswith(first + '/') for n in namelist if n):
        return first + '/'
    return None


def _strip_prefix(name: str, prefix: str) -> str:
    """剥离条目名中的顶层前缀"""
    if prefix and name.startswith(prefix):
        return name[len(prefix):]
    return name


def list_directory(skill_directory: str, sub_path: str = None) -> list:
    """列出 skill 目录下的文件和文件夹（文件夹在前，按名称升序）"""
    abs_dir = get_skill_abs_dir(skill_directory)
    if sub_path:
        abs_dir = resolve_absolute_path(abs_dir, sub_path)
    if not os.path.exists(abs_dir) or not os.path.isdir(abs_dir):
        return []
    result = []
    try:
        entries = sorted(os.listdir(abs_dir))
    except Exception:
        return []
    for entry in entries:
        full_path = os.path.join(abs_dir, entry)
        try:
            is_dir = os.path.isdir(full_path)
            stat_info = os.stat(full_path)
            rel_path = os.path.relpath(full_path, get_skill_abs_dir(skill_directory))
            rel_path = rel_path.replace('\\', '/')
            node = {
                'name': entry,
                'path': rel_path,
                'is_dir': is_dir,
                'size': None if is_dir else stat_info.st_size,
                'modified_at': datetime.fromtimestamp(stat_info.st_mtime),
                'children': None,
            }
            result.append(node)
        except Exception:
            continue
    result.sort(key=lambda x: (0 if x['is_dir'] else 1, x['name'].lower()))
    return result


def list_directory_tree(skill_directory: str, sub_path: str = None) -> list:
    """递归列出 skill 目录下的完整目录树（children 嵌套，文件夹在前按名称升序）"""
    root_abs = get_skill_abs_dir(skill_directory)
    abs_dir = resolve_absolute_path(root_abs, sub_path) if sub_path else root_abs
    if not os.path.exists(abs_dir) or not os.path.isdir(abs_dir):
        return []

    def _walk(dir_abs: str) -> list:
        try:
            entries = sorted(os.listdir(dir_abs))
        except Exception:
            return []
        nodes = []
        for entry in entries:
            full_path = os.path.join(dir_abs, entry)
            try:
                is_dir = os.path.isdir(full_path)
                stat_info = os.stat(full_path)
                rel_path = os.path.relpath(full_path, root_abs).replace('\\', '/')
                node = {
                    'name': entry,
                    'path': rel_path,
                    'is_dir': is_dir,
                    'size': None if is_dir else stat_info.st_size,
                    'modified_at': datetime.fromtimestamp(stat_info.st_mtime),
                    'children': _walk(full_path) if is_dir else None,
                }
                nodes.append(node)
            except Exception:
                continue
        nodes.sort(key=lambda x: (0 if x['is_dir'] else 1, x['name'].lower()))
        return nodes

    return _walk(abs_dir)


def read_file_content(skill_directory: str, file_path: str) -> dict:
    """
    读取 skill 目录下的文件内容

    返回：
        {
            path: 相对路径（/ 分隔）,
            name: 文件名,
            content: 文本内容（二进制时为 '[二进制文件，无法显示内容]'）,
            is_text: 是否为文本文件
        }
    """
    base_dir = get_skill_abs_dir(skill_directory)
    abs_file_path = resolve_absolute_path(base_dir, file_path)

    if not os.path.exists(abs_file_path) or not os.path.isfile(abs_file_path):
        raise ResourceNotFoundError(message=f"文件 '{file_path}' 不存在")

    name = os.path.basename(abs_file_path)
    text_mode = is_text_file(name)

    content = ''
    if text_mode:
        try:
            with open(abs_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(abs_file_path, 'r', encoding='gbk') as f:
                    content = f.read()
            except Exception:
                text_mode = False
                content = '[二进制文件，无法显示内容]'
    else:
        content = '[二进制文件，无法显示内容]'

    return {
        'path': file_path.replace('\\', '/'),
        'name': name,
        'content': content,
        'is_text': text_mode,
        'modified_at': datetime.fromtimestamp(os.path.getmtime(abs_file_path)).isoformat(),
    }


def write_file_content(skill_directory: str, file_path: str, content: str) -> bool:
    """
    写入文件内容（UTF-8）

    仅当写入 SKILL.md 时调用 validate_skill_md 校验 AGENT SKILL 规范，
    不符合规范仅打 warning 日志，不阻断写盘
    """
    base_dir = get_skill_abs_dir(skill_directory)
    abs_file_path = resolve_absolute_path(base_dir, file_path)
    if os.path.dirname(abs_file_path):
        os.makedirs(os.path.dirname(abs_file_path), exist_ok=True)

    with open(abs_file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    if os.path.basename(abs_file_path) == SKILL_MD_FILENAME:
        ok, msg = validate_skill_md(content)
        if not ok:
            logger.warning(f"SKILL.md 格式警告: {msg}")

    return True


def delete_file_or_dir(skill_directory: str, path: str) -> bool:
    """删除 skill 目录下的文件或文件夹（禁止删除根目录）"""
    base_dir = get_skill_abs_dir(skill_directory)
    abs_path = resolve_absolute_path(base_dir, path)

    # 根目录保护
    if os.path.normpath(abs_path) == os.path.normpath(base_dir):
        raise ValueError("不能删除技能根目录")

    if not os.path.exists(abs_path):
        raise ResourceNotFoundError(message=f"路径 '{path}' 不存在")

    if os.path.isdir(abs_path):
        shutil.rmtree(abs_path)
    else:
        os.remove(abs_path)
    return True


def create_directory(skill_directory: str, parent_path: str, dir_name: str) -> bool:
    """在 skill 目录下创建子文件夹（已存在时抛 ValueError）"""
    base_dir = get_skill_abs_dir(skill_directory)
    abs_parent = resolve_absolute_path(base_dir, parent_path) if parent_path else base_dir

    target_dir = os.path.join(abs_parent, dir_name)
    if os.path.exists(target_dir):
        raise ValueError(f"文件夹 '{dir_name}' 已存在")
    os.makedirs(target_dir, exist_ok=True)
    return True


def rename_file_or_dir(skill_directory: str, path: str, new_name: str) -> bool:
    """
    重命名 skill 目录下的文件或文件夹（同目录内改名）

    - 禁止重命名根目录 SKILL.md（技能必要文件）
    - 新名称含路径分隔符或非法字符时抛 ValueError
    - 目标已存在时抛 ValueError
    - 重命名根目录下一级目录时，若目录与技能名不一致则同步技能目录名（可选，保持简单：仅重命名物理目录）
    """
    base_dir = get_skill_abs_dir(skill_directory)
    abs_path = resolve_absolute_path(base_dir, path)

    if not os.path.exists(abs_path):
        raise ResourceNotFoundError(message=f"路径 '{path}' 不存在")

    new_name = (new_name or '').strip()
    if not new_name:
        raise ValueError("新名称不能为空")
    if '/' in new_name or '\\' in new_name:
        raise ValueError("新名称不能包含路径分隔符")
    if new_name in ('.', '..'):
        raise ValueError("非法名称")

    normalized = (path or '').replace('\\', '/').strip('/')
    if normalized == SKILL_MD_FILENAME:
        raise ValueError("根目录下的 SKILL.md 为技能必要文件，不能重命名")

    abs_new = os.path.join(os.path.dirname(abs_path), new_name)
    if os.path.normpath(abs_new) == os.path.normpath(abs_path):
        return True  # 名称未变化
    if os.path.exists(abs_new):
        raise ValueError(f"名称 '{new_name}' 已被占用")

    os.rename(abs_path, abs_new)
    return True


def check_upload_conflicts(skill_directory: str, sub_path: str, names: list) -> list:
    """
    检查上传条目（文件/文件夹名列表）与目标目录是否同名冲突

    返回冲突的名称列表（文件夹上传时整个文件夹名作为一个条目）
    """
    base_dir = get_skill_abs_dir(skill_directory)
    abs_dir = resolve_absolute_path(base_dir, sub_path) if sub_path else base_dir
    if not os.path.isdir(abs_dir):
        return []

    conflicts = []
    for name in names:
        if not name:
            continue
        # 文件夹上传时浏览器可能带上 webkitRelativePath 前缀，取顶层名称
        top = name.replace('\\', '/').split('/')[0]
        if os.path.exists(os.path.join(abs_dir, top)):
            conflicts.append(top)
    return conflicts


class FileUploadManager:
    """
    文件上传管理器（供 API 层调用）
    封装 zip 解压、批量上传等需要复杂逻辑的上传能力
    """

    @staticmethod
    def prepare(skill_directory: str = None) -> str:
        """准备上传临时目录"""
        return prepare_upload_directory(skill_directory)

    @staticmethod
    def save_file(relative_dir: str, file_name: str, file_content: bytes, sub_path: str = None) -> bool:
        """保存单个上传文件"""
        return save_uploaded_file(relative_dir, file_name, file_content, sub_path)

    @staticmethod
    async def save_files(directory: str, files: list, sub_path: str = None) -> dict:
        """
        批量保存上传文件（接受 fastapi UploadFile 列表）

        返回：
            {
                'success_count': int,
                'failed_files': List[str]
            }
        """
        ensure_skill_root()
        success_count = 0
        failed_files = []
        for file in files:
            try:
                content = await file.read()
                filename = file.filename or "uploaded_file"
                save_uploaded_file(directory, filename, content, sub_path)
                success_count += 1
            except Exception as e:
                failed_files.append(f"{file.filename}: {str(e)}")
        return {
            'success_count': success_count,
            'failed_files': failed_files,
        }

    @staticmethod
    async def save_archive(directory: str, archive_content: bytes, archive_name: str, sub_path: str = None) -> int:
        """
        解压上传的压缩包（zip/tar/tar.gz/tar.bz2）

        返回：成功提取的文件数量
        """
        ensure_skill_root()
        abs_dir = get_skill_abs_dir(directory)
        if sub_path:
            abs_dir = resolve_absolute_path(abs_dir, sub_path)
        abs_dir = os.path.normpath(abs_dir)
        os.makedirs(abs_dir, exist_ok=True)

        temp_id = uuid.uuid4().hex
        temp_file_path = os.path.join(abs_dir, f"_temp_{temp_id}_{archive_name}")
        try:
            with open(temp_file_path, 'wb') as f:
                f.write(archive_content)
            extracted_count = extract_archive(abs_dir, temp_file_path, archive_name)
        finally:
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except OSError:
                    pass
        return extracted_count
