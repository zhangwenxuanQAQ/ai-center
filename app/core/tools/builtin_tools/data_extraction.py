"""
数据抽取内置工具
基于数据源执行SQL查询并返回结果，支持JSON和Markdown格式输出
"""

import logging
from datetime import datetime
from typing import Any, Dict

from app.core.tools import BaseTool, BaseToolParam, ToolRegistry, ToolResult
from app.services.datasource.service import DatasourceService
from app.core.datasource.utils import quote_ident, normalize_rows, format_data_to_text

logger = logging.getLogger(__name__)


@ToolRegistry.register
class data_extraction(BaseTool):
    """数据抽取工具"""

    name = "data_extraction"
    title = "数据抽取"
    description = (
        "从指定数据源抽取数据。支持通过表名+字段列表自动构建SQL，或直接传入自定义SQL。"
        "返回数据行、行数和格式化结果（JSON或Markdown）。"
    )
    params = [
        BaseToolParam(
            name="datasource_id",
            type="string",
            description="数据源ID",
            required=True,
        ),
        BaseToolParam(
            name="table_name",
            type="string",
            description="表名（未传SQL时必填）",
            required=False,
        ),
        BaseToolParam(
            name="fields",
            type="string",
            description="字段列表，逗号分隔（未传SQL时使用，不传则查询所有字段）",
            required=False,
            default="",
        ),
        BaseToolParam(
            name="sql",
            type="string",
            description="自定义SQL语句（优先使用，若提供则忽略表名和字段）",
            required=False,
            default="",
        ),
        BaseToolParam(
            name="output_format",
            type="string",
            description="输出格式：json或markdown",
            required=False,
            default="json",
            enum=["json", "markdown"],
        ),
    ]

    def _run(self, **kwargs) -> ToolResult:
        datasource_id = kwargs.get("datasource_id", "")
        table_name = kwargs.get("table_name", "")
        fields_str = kwargs.get("fields", "")
        sql = kwargs.get("sql", "")
        output_format = kwargs.get("output_format", "json")

        # 校验参数
        if not datasource_id:
            return self._error(message="数据源ID不能为空", error="datasource_id is required")

        # 构建SQL
        if sql:
            final_sql = sql
        elif table_name:
            fields = [f.strip() for f in fields_str.split(",") if f.strip()] if fields_str else []
            if fields:
                column_list = ', '.join(quote_ident(f) for f in fields)
                final_sql = f"SELECT {column_list} FROM {quote_ident(table_name)}"
            else:
                final_sql = f"SELECT * FROM {quote_ident(table_name)}"
        else:
            return self._error(
                message="请提供自定义SQL或表名（table_name）",
                error="sql or table_name is required"
            )

        logger.info(f"数据抽取工具执行 - datasource_id={datasource_id}, sql={final_sql}")

        try:
            # 执行查询
            result = DatasourceService.execute_query(datasource_id, final_sql)

            if not result.get('success'):
                return self._error(
                    message=f"查询执行失败: {result.get('message', '未知错误')}",
                    error=result.get('message', 'unknown error'),
                    datasource_id=datasource_id,
                    sql=final_sql,
                )

            data = result.get('data')
            if isinstance(data, dict):
                rows = data.get('rows', []) or []
                row_count = data.get('total', len(rows))
            elif isinstance(data, list):
                rows = data
                row_count = len(rows)
            else:
                rows = []
                row_count = 0

            # 规范化数据（处理datetime、LOB等特殊类型）
            rows = normalize_rows(rows)

            # 格式化输出
            formatted = format_data_to_text(rows, output_format)
            fields_list = list(rows[0].keys()) if rows else []

            logger.info(f"数据抽取完成 - datasource_id={datasource_id}, row_count={row_count}")
            return self._success(
                result=formatted,
                message="数据抽取成功",
                datasource_id=datasource_id,
                sql=final_sql,
                row_count=row_count,
                fields=fields_list,
                output_format=output_format,
                executed_at=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            )

        except Exception as e:
            logger.error(f"数据抽取失败: datasource_id={datasource_id}, error={e}", exc_info=True)
            return self._error(
                message=f"数据抽取失败: {str(e)}",
                error=str(e),
                datasource_id=datasource_id,
                sql=final_sql,
                executed_at=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            )