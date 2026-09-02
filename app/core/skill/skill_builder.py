"""
skill_builder.py - SKILL.md 文件构建工具

包含：
- 项目根路径与 skill 目录路径解析
- SKILL.md 构建（标准 AGENT SKILL 模板，frontmatter + 正文）
- SKILL.md 校验（frontmatter 必填 name/description）
- 目录名净化（去除非法字符）
"""

import os
import re
from typing import Optional, Tuple

from app.constants.skill_constants import (
    SKILL_ROOT_DIR,
    SKILL_MD_FILENAME,
    DEFAULT_SKILL_MD_TEMPLATE,
)


def get_project_root() -> str:
    """获取项目根目录（项目根 = app/constants/skill_constants.py 向上 4 级）"""
    # app/core/skill/skill_builder.py -> app/core/skill -> app/core -> app -> project_root
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def get_skill_abs_dir(relative_dir: str) -> str:
    """获取skill目录的绝对路径"""
    return os.path.normpath(os.path.join(get_project_root(), SKILL_ROOT_DIR, relative_dir))


def ensure_skill_root() -> None:
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


def validate_skill_md(content: str) -> Tuple[bool, str]:
    """
    验证SKILL.md是否满足AGENT SKILL标准模板规范

    要求：
    - 必须以 --- frontmatter 开头
    - frontmatter 内必须包含 name、description 字段（必填）
    - 其它元数据字段可放在 frontmatter 内

    格式示例：
    ---
    name: 技能名称
    description: 技能描述
    其他元数据字段: 值
    ---

    内容
    """
    if not content or not content.strip():
        return False, "SKILL.md内容不能为空"

    stripped = content.strip()
    if not stripped.startswith('---'):
        return False, "SKILL.md必须以 --- 开头"

    # 找到第二个 --- 结束frontmatter
    end_idx = stripped.find('---', 3)
    if end_idx == -1:
        return False, "SKILL.md的frontmatter必须以 --- 结尾"

    frontmatter = stripped[3:end_idx]

    # 解析frontmatter字段
    fields: dict = {}
    for line in frontmatter.split('\n'):
        line = line.rstrip()
        if not line or line.startswith('#'):
            continue
        if ':' in line:
            key, _, value = line.partition(':')
            fields[key.strip()] = value.strip()

    # 必填项检查
    if not fields.get('name'):
        return False, "SKILL.md的frontmatter缺少必填字段 name（技能名称）"
    if not fields.get('description'):
        return False, "SKILL.md的frontmatter缺少必填字段 description（技能描述）"

    return True, "格式正确"


def build_skill_md(skill_name: str, description: str, metadata: dict = None, body_content: str = "") -> str:
    """
    按AGENT SKILL标准模板格式构建SKILL.md内容

    名称、描述填入 frontmatter 的 name/description（模板已预置占位符）
    额外元数据字段追加在 frontmatter 中（自动跳过 name/description，跳过空值）
    body_content 写入正文（frontmatter 之后）
    """
    meta_lines = []
    for key, value in (metadata or {}).items():
        if key in ('name', 'description'):
            continue
        if value is None or value == '':
            continue
        meta_lines.append(f"{key}: {value}")
    body = (body_content or '').strip()
    # 正文为空时不默认填充 skill_name 作为二级标题
    section = f"## {skill_name}\n\n{body}\n" if body else ""
    return (
        "---\n"
        f"name: {skill_name}\n"
        f"description: {description}\n"
        f"{chr(10).join(meta_lines) + chr(10) if meta_lines else ''}"
        "---\n\n"
        f"{section}"
    )


def sanitize_dir_name(name: str) -> str:
    """将技能名称安全化为目录名（去除路径分隔符，空格→下划线）"""
    return re.sub(r'[\s/\\:*?"<>|]+', '_', name).strip('_')


def split_skill_md(content: str) -> Tuple[dict, str]:
    """
    解析SKILL.md内容为 (frontmatter_dict, 正文)

    frontmatter_dict 是去除 '---' 后的 key/value 字典（保留原始顺序）
    """
    if not content or not content.strip():
        return {}, ''
    stripped = content.strip()
    if not stripped.startswith('---'):
        return {}, stripped
    end_idx = stripped.find('---', 3)
    if end_idx == -1:
        return {}, stripped
    frontmatter_raw = stripped[3:end_idx]
    body = stripped[end_idx + 3:].strip()
    fields: dict = {}
    for line in frontmatter_raw.split('\n'):
        line = line.rstrip()
        if not line or line.startswith('#'):
            continue
        if ':' in line:
            key, _, value = line.partition(':')
            fields[key.strip()] = value.strip()
    return fields, body
