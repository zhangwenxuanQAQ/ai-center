"""
skill_file_utils.py - Skill 数据序列化与转换工具

包含：
- tags 标签列表 ↔ JSON 字符串
- metadata 元数据对象 ↔ JSON 字符串
- 构建分类ID到名称的映射
- Skill ORM 模型 → 字典（附带分类名和SKILL.md内容）
"""

import json

from app.database.models import Skill, SkillCategory
from app.core.skill.skill_builder import read_skill_md


def serialize_tags(tags) -> str:
    """将标签列表转为JSON字符串存储"""
    if tags is None:
        return None
    if isinstance(tags, str):
        return tags
    return json.dumps(tags, ensure_ascii=False)


def serialize_metadata(metadata) -> str:
    """将元数据对象转为JSON字符串存储"""
    if metadata is None:
        return None
    if isinstance(metadata, str):
        return metadata
    return json.dumps(metadata, ensure_ascii=False)


def _build_category_map() -> dict:
    """构建分类ID到名称的映射"""
    categories = SkillCategory.select().where(SkillCategory.deleted == False)
    return {str(cat.id).replace('-', ''): cat.name for cat in categories}


def build_category_map() -> dict:
    """对外暴露的分类ID到名称映射"""
    return _build_category_map()


def _parse_json_field(raw_value, default):
    """安全解析 JSON 字符串字段，失败时返回 default"""
    if not raw_value:
        return default
    try:
        return json.loads(raw_value)
    except (json.JSONDecodeError, TypeError, ValueError):
        return default


def skill_to_dict(skill: Skill, with_md: bool = False, category_map: dict = None) -> dict:
    """
    将 Skill ORM 模型转为字典

    处理：
    - id / category_id 去除 UUID 连字符
    - tags 字段（JSON 字符串）→ 列表
    - metadata 字段（JSON 字符串）→ 字典
    - category_name 自动填充（基于 category_map）
    - skill_md_content 读取 SKILL.md 文件（with_md=True 时）
    """
    data = skill.__data__.copy()
    data['id'] = str(data['id']).replace('-', '')
    if data.get('category_id'):
        data['category_id'] = str(data['category_id']).replace('-', '')

    data['tags'] = _parse_json_field(data.get('tags'), [])
    data['metadata'] = _parse_json_field(data.get('metadata'), {})

    if category_map and data.get('category_id'):
        data['category_name'] = category_map.get(data['category_id'])
    else:
        data['category_name'] = None

    if with_md:
        data['skill_md_content'] = read_skill_md(skill.directory)
    return data
