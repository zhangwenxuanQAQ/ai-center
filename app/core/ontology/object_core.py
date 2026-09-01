"""
本体工作台核心逻辑 - 本体对象
包含本体对象同步、数据查询、元数据导出等核心业务逻辑
"""

import json
import logging
from typing import Optional, Dict, Any, List

from app.database.models import OntologyObject
from app.services.datasource.service import DatasourceService
from app.core.ontology.utils import ontology_object_to_dict
from app.core.hooks.ontology_task_hook import OntologyTaskHook

logger = logging.getLogger(__name__)


class OntologyObjectCore:
    """本体对象核心服务"""

    @staticmethod
    def get_ontology_object(object_id: str) -> Optional[dict]:
        """获取单个本体对象"""
        obj = OntologyObject.select().where(
            OntologyObject.id == object_id,
            OntologyObject.deleted == False
        ).first()
        return ontology_object_to_dict(obj) if obj else None

    @staticmethod
    def build_ontology_content(datasource_id: str, table_name: str, title: str = None, description: str = None) -> dict:
        """从数据源获取表字段信息，构建本体对象content"""
        columns_result = DatasourceService.get_table_columns(datasource_id, table_name)
        data = columns_result.get('data', {}) if columns_result.get('success') else {}
        if isinstance(data, dict):
            columns = data.get('columns', [])
            # 如果未传入title/description，尝试从数据源表信息获取
            if title is None:
                title = data.get('table_comment', '') or ''
            if description is None:
                description = data.get('table_comment', '') or ''
        else:
            columns = []

        return {
            'table_name': table_name,
            'title': title or '',
            'description': description or '',
            'columns': [
                {
                    'column_name': col.get('column_name', ''),
                    'column_name_cn': col.get('column_comment', '') or '',
                    'column_description': col.get('column_comment', '') or '',
                    'data_type': col.get('data_type', ''),
                    'is_primary_key': col.get('is_primary_key', False),
                    'is_nullable': col.get('is_nullable', True),
                    'foreign_key': col.get('foreign_key'),
                }
                for col in columns
            ]
        }

    @staticmethod
    def sync_ontology_object(object_id: str) -> Optional[dict]:
        """同步本体对象字段（只添加新字段和删除已移除的字段，已有字段不修改）"""
        obj = OntologyObject.select().where(
            OntologyObject.id == object_id,
            OntologyObject.deleted == False
        ).first()
        if not obj:
            return None

        # 获取最新的表字段信息
        columns_result = DatasourceService.get_table_columns(obj.datasource_id, obj.name)
        data = columns_result.get('data', {}) if columns_result.get('success') else {}
        new_columns = data.get('columns', []) if isinstance(data, dict) else []

        # 解析现有content
        content = json.loads(obj.content) if obj.content else {
            'table_name': obj.name, 'title': obj.title or '', 'description': obj.description or '', 'columns': []
        }
        # 保持content中title和description与本体对象字段一致
        content['title'] = obj.title or ''
        content['description'] = obj.description or ''
        existing_columns = content.get('columns', [])

        existing_column_names = {col['column_name'] for col in existing_columns}
        new_column_names = {col.get('column_name', '') for col in new_columns}

        result_columns = [col for col in existing_columns if col['column_name'] in new_column_names]

        for col in new_columns:
            col_name = col.get('column_name', '')
            if col_name not in existing_column_names:
                result_columns.append({
                    'column_name': col_name,
                    'column_name_cn': '',
                    'column_description': '',
                    'data_type': col.get('data_type', ''),
                    'is_primary_key': col.get('is_primary_key', False),
                    'is_nullable': col.get('is_nullable', True),
                    'foreign_key': None,
                })

        content['columns'] = result_columns
        obj.content = json.dumps(content, ensure_ascii=False)
        obj.save()
        return ontology_object_to_dict(obj)

    @staticmethod
    def query_ontology_data(object_id: str, limit: int = 10, custom_sql: str = None) -> dict:
        """查询本体对象数据（默认10条，支持自定义SQL）"""
        obj = OntologyObject.select().where(
            OntologyObject.id == object_id,
            OntologyObject.deleted == False
        ).first()
        if not obj:
            return {'success': False, 'message': '本体对象不存在'}

        if custom_sql and custom_sql.strip():
            # 使用OntologyTaskHook校验SQL安全性
            hook = OntologyTaskHook()
            # 清洗SQL：去除末尾分号与空白（Oracle ORA-00911 对末尾分号零容忍）
            cleaned_sql = custom_sql.strip()
            while cleaned_sql and cleaned_sql[-1] in (';', '；', '\n', '\r', '\t', ' '):
                cleaned_sql = cleaned_sql[:-1].rstrip()
            cleaned_sql = cleaned_sql.strip()
            hook.before(sql=cleaned_sql)
            query = cleaned_sql
        else:
            # 按数据源类型构建正确的分页SQL
            base_sql = f"SELECT * FROM {obj.name}"
            try:
                ds_instance = DatasourceService.get_datasource_instance(obj.datasource_id)
                if ds_instance:
                    query = ds_instance.build_page_query(base_sql, limit, 0)
                else:
                    return {'success': False, 'message': '数据源不存在'}
            except NotImplementedError:
                return {'success': False, 'message': '此数据源类型不支持分页查询'}
            except Exception as e:
                return {'success': False, 'message': f'构建查询SQL失败: {str(e)}'}

        result = DatasourceService.execute_query(obj.datasource_id, query)
        return result

    @staticmethod
    def export_ontology_metadata(object_id: str, export_format: str) -> Optional[str]:
        """导出本体对象元数据为JSON或Markdown"""
        ontology_obj = OntologyObjectCore.get_ontology_object(object_id)
        if not ontology_obj:
            return None

        content = ontology_obj.get('content', {})
        columns = content.get('columns', [])

        if export_format == 'json':
            export_data = {
                'table_name': ontology_obj['name'],
                'title': ontology_obj['title'],
                'description': ontology_obj['description'],
                'columns': columns,
            }
            return json.dumps(export_data, ensure_ascii=False, indent=2)

        elif export_format == 'markdown':
            return OntologyObjectCore._build_ontology_markdown(ontology_obj, columns)

        return None

    @staticmethod
    def _build_ontology_markdown(ontology_obj: dict, columns: list) -> str:
        """构建单个本体对象的 Markdown 文本"""
        lines = [
            f"# {ontology_obj['title'] or ontology_obj['name']}",
            "",
            f"- **表名**: {ontology_obj['name']}",
            f"- **中文名称**: {ontology_obj['title'] or '-'}",
            f"- **表描述**: {ontology_obj['description'] or '-'}",
            "",
            "## 字段列表",
            "",
            "| 字段名 | 中文名称 | 数据类型 | 主键 | 非空 | 外键 | 描述 |",
            "|--------|----------|----------|------|------|------|------|",
        ]
        for col in columns:
            fk_str = '-'
            if col.get('foreign_key'):
                fk = col['foreign_key']
                fk_str = f"{fk.get('referenced_table', '')}.{fk.get('referenced_column', '')}"
            lines.append(
                f"| {col['column_name']} "
                f"| {col.get('column_name_cn', '') or '-'} "
                f"| {col.get('data_type', '')} "
                f"| {'是' if col.get('is_primary_key') else '否'} "
                f"| {'是' if not col.get('is_nullable') else '否'} "
                f"| {fk_str} "
                f"| {col.get('column_description', '') or '-'} |"
            )
        return '\n'.join(lines)

    @staticmethod
    def batch_export_ontology_metadata(object_ids: List[str], export_format: str) -> Optional[str]:
        """批量导出多个本体对象元数据到一个文件内容"""
        if not object_ids:
            return None

        ontology_objs = []
        for object_id in object_ids:
            obj = OntologyObjectCore.get_ontology_object(object_id)
            if obj:
                ontology_objs.append(obj)

        if not ontology_objs:
            return None

        if export_format == 'json':
            export_data = [
                {
                    'table_name': obj['name'],
                    'title': obj['title'],
                    'description': obj['description'],
                    'columns': obj.get('content', {}).get('columns', []),
                }
                for obj in ontology_objs
            ]
            return json.dumps(export_data, ensure_ascii=False, indent=2)

        elif export_format == 'markdown':
            sections = []
            for idx, obj in enumerate(ontology_objs):
                if idx > 0:
                    sections.append("")
                    sections.append("---")
                    sections.append("")
                columns = obj.get('content', {}).get('columns', [])
                sections.append(OntologyObjectCore._build_ontology_markdown(obj, columns))
            return '\n'.join(sections)

        return None