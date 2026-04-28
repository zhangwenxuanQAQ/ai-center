"""
MySQL数据源实现类

提供MySQL数据库的连接测试、查询和Schema信息获取功能
"""

from typing import Any, Dict, List, Optional
from app.core.datasource.base import DatasourceBase


class MySQLDatasource(DatasourceBase):
    """
    MySQL数据源实现类
    
    实现MySQL数据库的连接测试、查询执行和Schema信息获取
    """

    def test_connection(self) -> Dict[str, Any]:
        """
        测试MySQL数据库连接
        
        Returns:
            Dict[str, Any]: 连接测试结果
        """
        try:
            import pymysql
            connection = pymysql.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 3306)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=self.config.get('database', ''),
                charset=self.config.get('charset', 'utf8mb4'),
                connect_timeout=10,
            )
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            connection.close()
            return {"success": True, "message": "MySQL数据库连接成功"}
        except ImportError:
            return {"success": False, "message": "缺少pymysql依赖，请执行: pip install pymysql"}
        except Exception as e:
            return {"success": False, "message": f"MySQL数据库连接失败: {str(e)}"}

    def execute_query(self, query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        执行MySQL查询
        
        Args:
            query: SQL查询语句
            params: 查询参数
            
        Returns:
            Dict[str, Any]: 查询结果
        """
        try:
            import pymysql
            connection = pymysql.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 3306)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=self.config.get('database', ''),
                charset=self.config.get('charset', 'utf8mb4'),
                connect_timeout=10,
            )
            with connection.cursor(pymysql.cursors.DictCursor) as cursor:
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
                            "rows": results,
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
            return {"success": False, "message": "缺少pymysql依赖，请执行: pip install pymysql"}
        except Exception as e:
            return {"success": False, "message": f"查询执行失败: {str(e)}"}

    def get_schema_info(self) -> Dict[str, Any]:
        """
        获取MySQL数据库Schema信息
        
        Returns:
            Dict[str, Any]: Schema信息
        """
        try:
            import pymysql
            connection = pymysql.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 3306)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=self.config.get('database', ''),
                charset=self.config.get('charset', 'utf8mb4'),
                connect_timeout=10,
            )
            with connection.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT TABLE_NAME, TABLE_COMMENT FROM INFORMATION_SCHEMA.TABLES "
                    "WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME",
                    (self.config.get('database', ''),)
                )
                tables = cursor.fetchall()
                schema_info = []
                for table in tables:
                    table_name = table['TABLE_NAME']
                    cursor.execute(
                        "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT, IS_NULLABLE, COLUMN_KEY "
                        "FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s "
                        "ORDER BY ORDINAL_POSITION",
                        (self.config.get('database', ''), table_name)
                    )
                    columns = cursor.fetchall()
                    schema_info.append({
                        "table_name": table_name,
                        "table_comment": table.get('TABLE_COMMENT', ''),
                        "columns": columns,
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取Schema信息成功",
                    "data": {"tables": schema_info}
                }
        except ImportError:
            return {"success": False, "message": "缺少pymysql依赖，请执行: pip install pymysql"}
        except Exception as e:
            return {"success": False, "message": f"获取Schema信息失败: {str(e)}"}

    def list_tables(self, database: Optional[str] = None) -> Dict[str, Any]:
        """
        列出数据库表
        
        Args:
            database: 数据库名称（可选，不指定则使用配置中的数据库）
            
        Returns:
            Dict[str, Any]: 包含表列表的字典
        """
        try:
            import pymysql
            target_database = database or self.config.get('database', '')
            if not target_database:
                return {"success": False, "message": "数据库名称不能为空", "data": None}
            
            connection = pymysql.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 3306)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=target_database,
                charset=self.config.get('charset', 'utf8mb4'),
                connect_timeout=10,
            )
            with connection.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT TABLE_NAME, TABLE_COMMENT, TABLE_TYPE, CREATE_TIME, UPDATE_TIME "
                    "FROM INFORMATION_SCHEMA.TABLES "
                    "WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME",
                    (target_database,)
                )
                tables = cursor.fetchall()
                table_list = []
                for table in tables:
                    table_list.append({
                        "table_name": table.get('TABLE_NAME', ''),
                        "table_comment": table.get('TABLE_COMMENT', ''),
                        "table_type": table.get('TABLE_TYPE', ''),
                        "create_time": str(table.get('CREATE_TIME', '')) if table.get('CREATE_TIME') else '',
                        "update_time": str(table.get('UPDATE_TIME', '')) if table.get('UPDATE_TIME') else '',
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取表列表成功",
                    "data": {
                        "database": target_database,
                        "tables": table_list,
                        "total": len(table_list),
                    }
                }
        except ImportError:
            return {"success": False, "message": "缺少pymysql依赖，请执行: pip install pymysql"}
        except Exception as e:
            return {"success": False, "message": f"获取表列表失败: {str(e)}"}

    def get_table_columns(self, table_name: str, database: Optional[str] = None) -> Dict[str, Any]:
        """
        获取表的字段信息
        
        Args:
            table_name: 表名称
            database: 数据库名称（可选，不指定则使用配置中的数据库）
            
        Returns:
            Dict[str, Any]: 包含字段信息的字典
        """
        try:
            import pymysql
            target_database = database or self.config.get('database', '')
            if not target_database:
                return {"success": False, "message": "数据库名称不能为空", "data": None}
            if not table_name:
                return {"success": False, "message": "表名称不能为空", "data": None}
            
            connection = pymysql.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 3306)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=target_database,
                charset=self.config.get('charset', 'utf8mb4'),
                connect_timeout=10,
            )
            with connection.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute(
                    "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE, "
                    "COLUMN_KEY, EXTRA, COLUMN_COMMENT, ORDINAL_POSITION "
                    "FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s "
                    "ORDER BY ORDINAL_POSITION",
                    (target_database, table_name)
                )
                columns = cursor.fetchall()
                column_list = []
                for col in columns:
                    column_list.append({
                        "column_name": col.get('COLUMN_NAME', ''),
                        "column_type": col.get('COLUMN_TYPE', ''),
                        "column_default": col.get('COLUMN_DEFAULT', ''),
                        "is_nullable": col.get('IS_NULLABLE', ''),
                        "column_key": col.get('COLUMN_KEY', ''),
                        "extra": col.get('EXTRA', ''),
                        "column_comment": col.get('COLUMN_COMMENT', ''),
                        "ordinal_position": col.get('ORDINAL_POSITION', 0),
                    })
                connection.close()
                return {
                    "success": True,
                    "message": "获取表字段信息成功",
                    "data": {
                        "database": target_database,
                        "table_name": table_name,
                        "columns": column_list,
                        "total": len(column_list),
                    }
                }
        except ImportError:
            return {"success": False, "message": "缺少pymysql依赖，请执行: pip install pymysql"}
        except Exception as e:
            return {"success": False, "message": f"获取表字段信息失败: {str(e)}"}

    def get_monitor_info(self) -> Dict[str, Any]:
        """
        获取MySQL数据库监控信息
        
        Returns:
            Dict[str, Any]: 包含监控信息的字典
        """
        try:
            import pymysql
            connection = pymysql.connect(
                host=self.config.get('host', 'localhost'),
                port=int(self.config.get('port', 3306)),
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                database=self.config.get('database', ''),
                charset=self.config.get('charset', 'utf8mb4'),
                connect_timeout=10,
            )
            with connection.cursor(pymysql.cursors.DictCursor) as cursor:
                version = ""
                cursor.execute("SELECT VERSION() AS version")
                version_row = cursor.fetchone()
                if version_row:
                    version = version_row.get('version', '')

                cursor.execute("SHOW GLOBAL STATUS LIKE 'Threads_connected'")
                connected_row = cursor.fetchone()
                connections = int(connected_row.get('Value', 0)) if connected_row else 0

                cursor.execute("SHOW GLOBAL STATUS LIKE 'Max_used_connections'")
                max_conn_row = cursor.fetchone()
                max_connections = int(max_conn_row.get('Value', 0)) if max_conn_row else 0

                cursor.execute("SHOW GLOBAL STATUS LIKE 'Uptime'")
                uptime_row = cursor.fetchone()
                uptime_seconds = int(uptime_row.get('Value', 0)) if uptime_row else 0

                cursor.execute("SHOW GLOBAL STATUS LIKE 'Queries'")
                queries_row = cursor.fetchone()
                total_queries = int(queries_row.get('Value', 0)) if queries_row else 0

                cursor.execute("SHOW GLOBAL STATUS LIKE 'Slow_queries'")
                slow_row = cursor.fetchone()
                slow_queries = int(slow_row.get('Value', 0)) if slow_row else 0

                target_db = self.config.get('database', '')
                db_size = 0
                table_count = 0
                if target_db:
                    cursor.execute(
                        "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb "
                        "FROM information_schema.tables WHERE table_schema = %s",
                        (target_db,)
                    )
                    size_row = cursor.fetchone()
                    db_size = float(size_row.get('size_mb', 0) or 0) if size_row else 0

                    cursor.execute(
                        "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = %s",
                        (target_db,)
                    )
                    count_row = cursor.fetchone()
                    table_count = int(count_row.get('cnt', 0)) if count_row else 0

                cursor.execute("SHOW GLOBAL STATUS LIKE 'Bytes_received'")
                bytes_in_row = cursor.fetchone()
                bytes_in = int(bytes_in_row.get('Value', 0)) if bytes_in_row else 0

                cursor.execute("SHOW GLOBAL STATUS LIKE 'Bytes_sent'")
                bytes_out_row = cursor.fetchone()
                bytes_out = int(bytes_out_row.get('Value', 0)) if bytes_out_row else 0

            connection.close()

            days, remainder = divmod(uptime_seconds, 86400)
            hours, remainder = divmod(remainder, 3600)
            minutes, _ = divmod(remainder, 60)
            uptime_str = f"{days}天{hours}小时{minutes}分钟"

            return {
                "success": True,
                "message": "获取MySQL监控信息成功",
                "data": {
                    "status": "connected",
                    "version": version,
                    "metrics": [
                        {"name_en": "connections", "name_zh": "连接数", "value": connections, "unit": "个", "status": "normal" if connections < max_connections * 0.8 else "warning", "description": "当前活跃的数据库连接数"},
                        {"name_en": "max_used_connections", "name_zh": "最大使用连接数", "value": max_connections, "unit": "个", "status": "normal", "description": "历史最大同时使用连接数"},
                        {"name_en": "slow_queries", "name_zh": "慢查询数", "value": slow_queries, "unit": "次", "status": "normal" if slow_queries < 100 else "warning", "description": "执行时间超过阈值的慢查询累计次数"},
                        {"name_en": "total_queries", "name_zh": "总查询数", "value": total_queries, "unit": "次", "status": "normal", "description": "MySQL启动以来执行的SQL语句总次数"},
                    ],
                    "stats": [
                        {"name_en": "uptime", "name_zh": "运行时间", "value": uptime_str, "unit": "", "description": "MySQL服务自启动以来的连续运行时长"},
                        {"name_en": "database_size", "name_zh": "数据库大小", "value": db_size, "unit": "MB", "description": "当前数据库的数据和索引占用磁盘空间大小"},
                        {"name_en": "table_count", "name_zh": "表数量", "value": table_count, "unit": "个", "description": "当前数据库中的表总数"},
                        {"name_en": "bytes_received", "name_zh": "入站流量", "value": round(bytes_in / 1024 / 1024, 2), "unit": "MB", "description": "从客户端接收的数据总量"},
                        {"name_en": "bytes_sent", "name_zh": "出站流量", "value": round(bytes_out / 1024 / 1024, 2), "unit": "MB", "description": "发送给客户端的数据总量"},
                    ]
                }
            }
        except ImportError:
            return {"success": False, "message": "缺少pymysql依赖，请执行: pip install pymysql", "data": {"status": "disconnected"}}
        except Exception as e:
            return {"success": False, "message": f"获取MySQL监控信息失败: {str(e)}", "data": {"status": "disconnected"}}
