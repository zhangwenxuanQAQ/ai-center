"""
SQL Server数据源实现类

提供SQL Server数据库的连接测试、查询和Schema信息获取功能
"""

from typing import Any, Dict, Optional
from app.core.datasource.base import DatasourceBase


class SQLServerDatasource(DatasourceBase):
    """
    SQL Server数据源实现类
    
    实现SQL Server数据库的连接测试、查询执行和Schema信息获取
    """

    def test_connection(self) -> Dict[str, Any]:
        """
        测试SQL Server数据库连接
        """
        try:
            import pymssql
            connection = pymssql.connect(
                server=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 1433)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=self.config.get('database', ''),
                login_timeout=10,
            )
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            connection.close()
            return {"success": True, "message": "SQL Server数据库连接成功"}
        except ImportError:
            return {"success": False, "message": "缺少pymssql依赖，请执行: pip install pymssql"}
        except Exception as e:
            return {"success": False, "message": f"SQL Server数据库连接失败: {str(e)}"}

    def execute_query(self, query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        执行SQL Server查询
        """
        try:
            import pymssql
            connection = pymssql.connect(
                server=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 1433)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=self.config.get('database', ''),
                login_timeout=10,
            )
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                if query.strip().upper().startswith('SELECT'):
                    columns = [desc[0] for desc in cursor.description] if cursor.description else []
                    results = cursor.fetchall()
                    rows = [dict(zip(columns, row)) for row in results]
                    connection.close()
                    return {
                        "success": True,
                        "message": "查询执行成功",
                        "data": {
                            "columns": columns,
                            "rows": rows,
                            "total": len(rows),
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
            return {"success": False, "message": "缺少pymssql依赖，请执行: pip install pymssql"}
        except Exception as e:
            return {"success": False, "message": f"查询执行失败: {str(e)}"}

    def get_schema_info(self) -> Dict[str, Any]:
        """
        获取SQL Server数据库Schema信息
        """
        try:
            import pymssql
            connection = pymssql.connect(
                server=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 1433)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=self.config.get('database', ''),
                login_timeout=10,
            )
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES "
                    "WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
                )
                tables = cursor.fetchall()
                schema_info = []
                for table in tables:
                    table_name = table[0]
                    cursor.execute(
                        "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT "
                        "FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_NAME = %s ORDER BY ORDINAL_POSITION",
                        (table_name,)
                    )
                    columns = cursor.fetchall()
                    column_list = []
                    for col in columns:
                        column_list.append({
                            "COLUMN_NAME": col[0],
                            "DATA_TYPE": col[1],
                            "IS_NULLABLE": col[2],
                            "COLUMN_DEFAULT": col[3],
                        })
                    schema_info.append({
                        "table_name": table_name,
                        "table_comment": '',
                        "columns": column_list,
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取Schema信息成功",
                    "data": {"tables": schema_info}
                }
        except ImportError:
            return {"success": False, "message": "缺少pymssql依赖，请执行: pip install pymssql"}
        except Exception as e:
            return {"success": False, "message": f"获取Schema信息失败: {str(e)}"}
