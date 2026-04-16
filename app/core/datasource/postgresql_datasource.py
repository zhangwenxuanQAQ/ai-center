"""
PostgreSQL数据源实现类

提供PostgreSQL数据库的连接测试、查询和Schema信息获取功能
"""

from typing import Any, Dict, Optional
from app.core.datasource.base import DatasourceBase


class PostgreSQLDatasource(DatasourceBase):
    """
    PostgreSQL数据源实现类
    
    实现PostgreSQL数据库的连接测试、查询执行和Schema信息获取
    """

    def test_connection(self) -> Dict[str, Any]:
        """
        测试PostgreSQL数据库连接
        """
        try:
            import psycopg2
            connection = psycopg2.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 5432)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dbname=self.config.get('database', ''),
                connect_timeout=10,
            )
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            connection.close()
            return {"success": True, "message": "PostgreSQL数据库连接成功"}
        except ImportError:
            return {"success": False, "message": "缺少psycopg2依赖，请执行: pip install psycopg2-binary"}
        except Exception as e:
            return {"success": False, "message": f"PostgreSQL数据库连接失败: {str(e)}"}

    def execute_query(self, query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        执行PostgreSQL查询
        """
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            connection = psycopg2.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 5432)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dbname=self.config.get('database', ''),
                connect_timeout=10,
            )
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                if query.strip().upper().startswith('SELECT'):
                    results = cursor.fetchall()
                    columns = [desc[0] for desc in cursor.description] if cursor.description else []
                    connection.close()
                    return {
                        "success": True,
                        "message": "查询执行成功",
                        "data": {
                            "columns": columns,
                            "rows": [dict(row) for row in results],
                            "total": len(results),
                        }
                    }
                else:
                    connection.commit()
                    affected_rows = cursor.rowcount
                    connection.close()
                    return {
                        "success": True,
                        "message": f"操作成功，影响行数: {affected_rows}",
                        "data": {"affected_rows": affected_rows}
                    }
        except ImportError:
            return {"success": False, "message": "缺少psycopg2依赖，请执行: pip install psycopg2-binary"}
        except Exception as e:
            return {"success": False, "message": f"查询执行失败: {str(e)}"}

    def get_schema_info(self) -> Dict[str, Any]:
        """
        获取PostgreSQL数据库Schema信息
        """
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            schema_name = self.config.get('schema', 'public')
            connection = psycopg2.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 5432)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dbname=self.config.get('database', ''),
                connect_timeout=10,
            )
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT table_name, obj_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass, 'pg_class') as table_comment "
                    "FROM information_schema.tables "
                    "WHERE table_schema = %s AND table_type = 'BASE TABLE' ORDER BY table_name",
                    (schema_name,)
                )
                tables = cursor.fetchall()
                schema_info = []
                for table in tables:
                    table_name = table['table_name']
                    cursor.execute(
                        "SELECT column_name, data_type, col_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass, ordinal_position) as column_comment, "
                        "is_nullable, column_default "
                        "FROM information_schema.columns "
                        "WHERE table_schema = %s AND table_name = %s "
                        "ORDER BY ordinal_position",
                        (schema_name, table_name)
                    )
                    columns = cursor.fetchall()
                    schema_info.append({
                        "table_name": table_name,
                        "table_comment": table.get('table_comment', ''),
                        "columns": [dict(col) for col in columns],
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取Schema信息成功",
                    "data": {"tables": schema_info}
                }
        except ImportError:
            return {"success": False, "message": "缺少psycopg2依赖，请执行: pip install psycopg2-binary"}
        except Exception as e:
            return {"success": False, "message": f"获取Schema信息失败: {str(e)}"}

    def list_tables(self) -> Dict[str, Any]:
        """
        获取PostgreSQL数据库表列表
        """
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            schema_name = self.config.get('schema', 'public')
            connection = psycopg2.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 5432)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dbname=self.config.get('database', ''),
                connect_timeout=10,
            )
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT table_name, obj_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass, 'pg_class') as table_comment "
                    "FROM information_schema.tables "
                    "WHERE table_schema = %s AND table_type = 'BASE TABLE' ORDER BY table_name",
                    (schema_name,)
                )
                tables = cursor.fetchall()
                table_list = []
                for table in tables:
                    table_list.append({
                        "table_name": table['table_name'],
                        "table_comment": table.get('table_comment', '')
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取表列表成功",
                    "data": {"tables": table_list}
                }
        except ImportError:
            return {"success": False, "message": "缺少psycopg2依赖，请执行: pip install psycopg2-binary"}
        except Exception as e:
            return {"success": False, "message": f"获取表列表失败: {str(e)}"}

    def get_table_columns(self, table_name: str) -> Dict[str, Any]:
        """
        获取PostgreSQL数据库表字段信息
        """
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            schema_name = self.config.get('schema', 'public')
            connection = psycopg2.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 5432)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dbname=self.config.get('database', ''),
                connect_timeout=10,
            )
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT column_name, data_type, col_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass, ordinal_position) as column_comment, "
                    "is_nullable, column_default "
                    "FROM information_schema.columns "
                    "WHERE table_schema = %s AND table_name = %s "
                    "ORDER BY ordinal_position",
                    (schema_name, table_name)
                )
                columns = cursor.fetchall()
                column_list = []
                for col in columns:
                    column_list.append({
                        "column_name": col['column_name'],
                        "column_type": col['data_type'],
                        "is_nullable": col['is_nullable'],
                        "column_default": col.get('column_default', None),
                        "column_comment": col.get('column_comment', '')
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取表字段成功",
                    "data": {"columns": column_list}
                }
        except ImportError:
            return {"success": False, "message": "缺少psycopg2依赖，请执行: pip install psycopg2-binary"}
        except Exception as e:
            return {"success": False, "message": f"获取表字段失败: {str(e)}"}
