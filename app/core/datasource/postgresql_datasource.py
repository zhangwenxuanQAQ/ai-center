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

    def get_monitor_info(self) -> Dict[str, Any]:
        """
        获取PostgreSQL数据库监控信息
        
        Returns:
            Dict[str, Any]: 包含监控信息的字典
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
                cursor.execute("SELECT version()")
                version_row = cursor.fetchone()
                version = version_row['version'] if version_row else ''

                cursor.execute("SELECT count(*) AS cnt FROM pg_stat_activity")
                conn_row = cursor.fetchone()
                connections = int(conn_row['cnt']) if conn_row else 0

                cursor.execute("SELECT setting AS max_conn FROM pg_settings WHERE name = 'max_connections'")
                max_conn_row = cursor.fetchone()
                max_connections = int(max_conn_row['max_conn']) if max_conn_row else 0

                cursor.execute(
                    "SELECT EXTRACT(EPOCH FROM now() - pg_postmaster_start_time())::bigint AS uptime"
                )
                uptime_row = cursor.fetchone()
                uptime_seconds = int(uptime_row['uptime']) if uptime_row else 0

                target_db = self.config.get('database', '')
                db_size = 0
                table_count = 0
                if target_db:
                    cursor.execute("SELECT pg_database_size(%s) AS size", (target_db,))
                    size_row = cursor.fetchone()
                    db_size = round(float(size_row['size']) / 1024 / 1024, 2) if size_row else 0

                    schema_name = self.config.get('schema', 'public')
                    cursor.execute(
                        "SELECT count(*) AS cnt FROM information_schema.tables "
                        "WHERE table_schema = %s AND table_type = 'BASE TABLE'",
                        (schema_name,)
                    )
                    count_row = cursor.fetchone()
                    table_count = int(count_row['cnt']) if count_row else 0

                cursor.execute("SELECT sum(xact_commit + xact_rollback) AS total_queries FROM pg_stat_database")
                queries_row = cursor.fetchone()
                total_queries = int(queries_row['total_queries'] or 0) if queries_row else 0

            connection.close()

            days, remainder = divmod(uptime_seconds, 86400)
            hours, remainder = divmod(remainder, 3600)
            minutes, _ = divmod(remainder, 60)
            uptime_str = f"{days}天{hours}小时{minutes}分钟"

            return {
                "success": True,
                "message": "获取PostgreSQL监控信息成功",
                "data": {
                    "status": "connected",
                    "version": version.split(',')[0] if version else '',
                    "metrics": [
                        {"name_en": "connections", "name_zh": "连接数", "value": connections, "unit": "个", "status": "normal" if connections < max_connections * 0.8 else "warning", "description": "当前活跃的数据库会话数"},
                        {"name_en": "max_connections", "name_zh": "最大连接数", "value": max_connections, "unit": "个", "status": "normal", "description": "允许的最大并发连接数配置值"},
                        {"name_en": "total_transactions", "name_zh": "总事务数", "value": total_queries, "unit": "次", "status": "normal", "description": "PostgreSQL启动以来提交和回滚的事务总数"},
                    ],
                    "stats": [
                        {"name_en": "uptime", "name_zh": "运行时间", "value": uptime_str, "unit": "", "description": "PostgreSQL服务自启动以来的连续运行时长"},
                        {"name_en": "database_size", "name_zh": "数据库大小", "value": db_size, "unit": "MB", "description": "当前数据库占用的磁盘空间大小"},
                        {"name_en": "table_count", "name_zh": "表数量", "value": table_count, "unit": "个", "description": "当前Schema中的数据表总数"},
                    ]
                }
            }
        except ImportError:
            return {"success": False, "message": "缺少psycopg2依赖，请执行: pip install psycopg2-binary", "data": {"status": "disconnected"}}
        except Exception as e:
            return {"success": False, "message": f"获取PostgreSQL监控信息失败: {str(e)}", "data": {"status": "disconnected"}}
