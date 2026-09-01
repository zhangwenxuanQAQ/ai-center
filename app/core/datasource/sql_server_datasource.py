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

    def list_tables(self, database: Optional[str] = None) -> Dict[str, Any]:
        """
        获取SQL Server数据库表列表
        """
        try:
            import pymssql
            target_database = database or self.config.get('database', '')
            if not target_database:
                return {"success": False, "message": "数据库名称不能为空", "data": None}
            connection = pymssql.connect(
                server=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 1433)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=target_database,
                login_timeout=10,
            )
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES "
                    "WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
                )
                tables = cursor.fetchall()
                table_list = []
                for table in tables:
                    table_list.append({
                        "table_name": table[0],
                        "table_comment": '',
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取表列表成功",
                    "data": {"tables": table_list}
                }
        except ImportError:
            return {"success": False, "message": "缺少pymssql依赖，请执行: pip install pymssql"}
        except Exception as e:
            return {"success": False, "message": f"获取表列表失败: {str(e)}"}

    def get_table_columns(self, table_name: str, database: Optional[str] = None) -> Dict[str, Any]:
        """
        获取SQL Server数据库表字段信息（含外键关系）
        """
        try:
            import pymssql
            target_database = database or self.config.get('database', '')
            if not target_database:
                return {"success": False, "message": "数据库名称不能为空", "data": None}
            if not table_name:
                return {"success": False, "message": "表名称不能为空", "data": None}
            connection = pymssql.connect(
                server=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 1433)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=target_database,
                login_timeout=10,
            )
            with connection.cursor(as_dict=True) as cursor:
                # 查询字段信息
                cursor.execute(
                    "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, "
                    "COLUMNPROPERTY(OBJECT_ID(%s), COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY "
                    "FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_NAME = %s ORDER BY ORDINAL_POSITION",
                    (table_name, table_name)
                )
                columns = cursor.fetchall()

                # 查询主键
                cursor.execute(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE "
                    "WHERE TABLE_NAME = %s AND OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1",
                    (table_name,)
                )
                pk_rows = cursor.fetchall()
                pk_set = {pk.get('COLUMN_NAME', '') for pk in pk_rows}

                # 查询外键关系
                cursor.execute(
                    "SELECT fkc.COLUMN_NAME, OBJECT_NAME(fkc.referenced_object_id) AS REFERENCED_TABLE, "
                    "COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS REFERENCED_COLUMN "
                    "FROM sys.foreign_key_columns fkc "
                    "JOIN sys.tables t ON fkc.parent_object_id = t.object_id "
                    "WHERE t.name = %s",
                    (table_name,)
                )
                fk_rows = cursor.fetchall()
                fk_map = {}
                for fk in fk_rows:
                    col_name = fk.get('COLUMN_NAME', '')
                    if col_name:
                        fk_map[col_name] = {
                            'referenced_table': fk.get('REFERENCED_TABLE', ''),
                            'referenced_column': fk.get('REFERENCED_COLUMN', ''),
                        }

                column_list = []
                for col in columns:
                    col_name = col.get('COLUMN_NAME', '')
                    column_list.append({
                        "column_name": col_name,
                        "column_type": col.get('DATA_TYPE', ''),
                        "data_type": col.get('DATA_TYPE', ''),
                        "is_nullable": col.get('IS_NULLABLE', ''),
                        "column_default": col.get('COLUMN_DEFAULT', None),
                        "is_primary_key": col_name in pk_set,
                        "foreign_key": fk_map.get(col_name),
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取表字段成功",
                    "data": {"columns": column_list}
                }
        except ImportError:
            return {"success": False, "message": "缺少pymssql依赖，请执行: pip install pymssql"}
        except Exception as e:
            return {"success": False, "message": f"获取表字段失败: {str(e)}"}

    def get_monitor_info(self) -> Dict[str, Any]:
        """
        获取SQL Server数据库监控信息
        
        Returns:
            Dict[str, Any]: 包含监控信息的字典
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
                cursor.execute("SELECT @@VERSION AS version")
                version_row = cursor.fetchone()
                version = version_row[0] if version_row else ''

                cursor.execute("SELECT count(*) FROM sys.dm_exec_connections")
                conn_row = cursor.fetchone()
                connections = int(conn_row[0]) if conn_row else 0

                cursor.execute(
                    "SELECT DATEDIFF(SECOND, sqlserver_start_time, GETDATE()) AS uptime_seconds "
                    "FROM sys.dm_os_sys_info"
                )
                uptime_row = cursor.fetchone()
                uptime_seconds = int(uptime_row[0]) if uptime_row else 0

                target_db = self.config.get('database', '')
                db_size = 0
                table_count = 0
                if target_db:
                    cursor.execute(
                        "SELECT SUM(size) * 8 / 1024 AS size_mb FROM sys.master_files WHERE database_id = DB_ID(%s)",
                        (target_db,)
                    )
                    size_row = cursor.fetchone()
                    db_size = float(size_row[0] or 0) if size_row else 0

                    cursor.execute(
                        "SELECT count(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
                    )
                    count_row = cursor.fetchone()
                    table_count = int(count_row[0]) if count_row else 0

            connection.close()

            days, remainder = divmod(uptime_seconds, 86400)
            hours, remainder = divmod(remainder, 3600)
            minutes, _ = divmod(remainder, 60)
            uptime_str = f"{days}天{hours}小时{minutes}分钟"

            return {
                "success": True,
                "message": "获取SQL Server监控信息成功",
                "data": {
                    "status": "connected",
                    "version": version.split('\n')[0] if version else '',
                    "metrics": [
                        {"name_en": "connections", "name_zh": "连接数", "value": connections, "unit": "个", "status": "normal", "description": "当前正在执行的连接数"},
                    ],
                    "stats": [
                        {"name_en": "uptime", "name_zh": "运行时间", "value": uptime_str, "unit": "", "description": "SQL Server自启动以来的连续运行时长"},
                        {"name_en": "database_size", "name_zh": "数据库大小", "value": db_size, "unit": "MB", "description": "当前数据库的数据文件占用空间大小"},
                        {"name_en": "table_count", "name_zh": "表数量", "value": table_count, "unit": "个", "description": "当前数据库中的用户表总数"},
                    ]
                }
            }
        except ImportError:
            return {"success": False, "message": "缺少pymssql依赖，请执行: pip install pymssql", "data": {"status": "disconnected"}}
        except Exception as e:
            return {"success": False, "message": f"获取SQL Server监控信息失败: {str(e)}", "data": {"status": "disconnected"}}

    def build_page_query(self, base_sql: str, page_size: int, offset: int) -> str:
        """SQL Server 2012+ 分页查询：OFFSET {offset} ROWS FETCH NEXT {page_size} ROWS ONLY"""
        return f"{base_sql} OFFSET {offset} ROWS FETCH NEXT {page_size} ROWS ONLY"
