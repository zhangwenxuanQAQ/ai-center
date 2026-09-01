"""
Oracle数据源实现类

提供Oracle数据库的连接测试、查询和Schema信息获取功能
"""

from typing import Any, Dict, Optional
from app.core.datasource.base import DatasourceBase


class OracleDatasource(DatasourceBase):
    """
    Oracle数据源实现类
    
    实现Oracle数据库的连接测试、查询执行和Schema信息获取
    """

    @staticmethod
    def _convert_value(value):
        """
        转换Oracle查询结果中的特殊类型值（如CLOB/BLOB等）为可序列化的字符串
        
        Args:
            value: 原始值
            
        Returns:
            可序列化的值
        """
        if value is None:
            return None
        # 处理oracledb LOB对象（CLOB/BLOB）
        if hasattr(value, 'read') and hasattr(value, 'getvalue'):
            try:
                # CLOB: 读取字符串内容
                return value.read()
            except Exception:
                try:
                    return value.getvalue()
                except Exception:
                    return str(value)
        # 处理oracledb LOB对象（通过类名判断，避免导入）
        class_name = value.__class__.__name__
        if class_name == 'LOB':
            try:
                return value.read()
            except Exception:
                try:
                    return value.getvalue()
                except Exception:
                    return str(value)
        # 处理bytes类型（BLOB）
        if isinstance(value, bytes):
            try:
                return value.decode('utf-8')
            except UnicodeDecodeError:
                return value.decode('utf-8', errors='replace')
        return value

    @staticmethod
    def _convert_row(row: tuple, columns: list) -> dict:
        """
        转换一行数据中的所有值
        
        Args:
            row: 原始行数据元组
            columns: 列名列表
            
        Returns:
            转换后的字典
        """
        return {col: OracleDatasource._convert_value(val) for col, val in zip(columns, row)}

    def test_connection(self) -> Dict[str, Any]:
        """
        测试Oracle数据库连接
        """
        try:
            import oracledb
            dsn = f"{self.config.get('host', 'localhost')}:{self.config.get('port', 1521)}/{self.config.get('service_name', '')}"
            connection = oracledb.connect(
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dsn=dsn,
            )
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 FROM DUAL")
            connection.close()
            return {"success": True, "message": "Oracle数据库连接成功"}
        except ImportError:
            return {"success": False, "message": "缺少oracledb依赖，请执行: pip install oracledb"}
        except Exception as e:
            return {"success": False, "message": f"Oracle数据库连接失败: {str(e)}"}

    def execute_query(self, query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        执行Oracle查询
        """
        try:
            import oracledb
            # Oracle 对末尾分号零容忍（ORA-00911）：清洗末尾中英文分号及空白
            if query:
                cleaned = query.strip()
                while cleaned and cleaned[-1] in (';', '；', '\n', '\r', '\t', ' '):
                    cleaned = cleaned[:-1].rstrip()
                query = cleaned.strip()
            dsn = f"{self.config.get('host', 'localhost')}:{self.config.get('port', 1521)}/{self.config.get('service_name', '')}"
            connection = oracledb.connect(
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dsn=dsn,
            )
            cursor = connection.cursor()
            cursor.execute(query, params)
            if query.strip().upper().startswith('SELECT'):
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                results = cursor.fetchall()
                rows = [OracleDatasource._convert_row(row, columns) for row in results]
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
            return {"success": False, "message": "缺少oracledb依赖，请执行: pip install oracledb"}
        except Exception as e:
            return {"success": False, "message": f"查询执行失败: {str(e)}"}

    def get_schema_info(self) -> Dict[str, Any]:
        """
        获取Oracle数据库Schema信息
        """
        try:
            import oracledb
            dsn = f"{self.config.get('host', 'localhost')}:{self.config.get('port', 1521)}/{self.config.get('service_name', '')}"
            connection = oracledb.connect(
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dsn=dsn,
            )
            cursor = connection.cursor()
            username = self.config.get('username', '').upper()
            cursor.execute(
                "SELECT TABLE_NAME, COMMENTS FROM USER_TAB_COMMENTS WHERE TABLE_TYPE = 'TABLE' ORDER BY TABLE_NAME"
            )
            tables = cursor.fetchall()
            schema_info = []
            for table in tables:
                table_name = table[0]
                cursor.execute(
                    "SELECT COLUMN_NAME, DATA_TYPE, NULLABLE, DATA_DEFAULT "
                    "FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :table_name ORDER BY COLUMN_ID",
                    {"table_name": table_name}
                )
                columns = cursor.fetchall()
                column_list = []
                for col in columns:
                    column_list.append({
                        "COLUMN_NAME": col[0],
                        "DATA_TYPE": col[1],
                        "IS_NULLABLE": "YES" if col[2] == "Y" else "NO",
                        "DATA_DEFAULT": str(col[3]) if col[3] else None,
                    })
                schema_info.append({
                    "table_name": table_name,
                    "table_comment": table[1] or '',
                    "columns": column_list,
                })
            connection.close()
            return {
                "success": True,
                "message": "获取Schema信息成功",
                "data": {"tables": schema_info}
            }
        except ImportError:
            return {"success": False, "message": "缺少oracledb依赖，请执行: pip install oracledb"}
        except Exception as e:
            return {"success": False, "message": f"获取Schema信息失败: {str(e)}"}

    def list_tables(self, database: Optional[str] = None) -> Dict[str, Any]:
        """
        获取Oracle数据库表列表
        """
        try:
            import oracledb
            dsn = f"{self.config.get('host', 'localhost')}:{self.config.get('port', 1521)}/{self.config.get('service_name', '')}"
            connection = oracledb.connect(
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dsn=dsn,
            )
            cursor = connection.cursor()
            username = self.config.get('username', '').upper()
            cursor.execute(
                "SELECT TABLE_NAME, COMMENTS FROM USER_TAB_COMMENTS WHERE TABLE_TYPE = 'TABLE' ORDER BY TABLE_NAME"
            )
            tables = cursor.fetchall()
            table_list = []
            for table in tables:
                table_list.append({
                    "table_name": table[0],
                    "table_comment": table[1] or ''
                })
            connection.close()
            return {
                "success": True,
                "message": "获取表列表成功",
                "data": {"tables": table_list}
            }
        except ImportError:
            return {"success": False, "message": "缺少oracledb依赖，请执行: pip install oracledb"}
        except Exception as e:
            return {"success": False, "message": f"获取表列表失败: {str(e)}"}

    def get_table_columns(self, table_name: str, database: Optional[str] = None) -> Dict[str, Any]:
        """
        获取Oracle数据库表字段信息（含外键关系）
        """
        try:
            import oracledb
            dsn = f"{self.config.get('host', 'localhost')}:{self.config.get('port', 1521)}/{self.config.get('service_name', '')}"
            connection = oracledb.connect(
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dsn=dsn,
            )
            cursor = connection.cursor()
            tbl = table_name.upper()
            cursor.execute(
                "SELECT COLUMN_NAME, DATA_TYPE, NULLABLE, DATA_DEFAULT "
                "FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tbl ORDER BY COLUMN_ID",
                {"tbl": tbl}
            )
            columns = cursor.fetchall()

            # 查询外键关系
            cursor.execute(
                "SELECT b.COLUMN_NAME, c.TABLE_NAME AS REFERENCED_TABLE, c.COLUMN_NAME AS REFERENCED_COLUMN "
                "FROM USER_CONSTRAINTS a "
                "JOIN USER_CONS_COLUMNS b ON a.CONSTRAINT_NAME = b.CONSTRAINT_NAME "
                "JOIN USER_CONS_COLUMNS c ON a.R_CONSTRAINT_NAME = c.CONSTRAINT_NAME "
                "WHERE a.CONSTRAINT_TYPE = 'R' AND b.TABLE_NAME = :tbl",
                {"tbl": tbl}
            )
            fk_rows = cursor.fetchall()
            fk_map = {}
            for fk in fk_rows:
                col_name = fk[0] if fk[0] else ''
                if col_name:
                    fk_map[col_name] = {
                        'referenced_table': fk[1] if fk[1] else '',
                        'referenced_column': fk[2] if fk[2] else '',
                    }

            column_list = []
            for col in columns:
                col_name = col[0]
                column_list.append({
                    "column_name": col_name,
                    "column_type": col[1],
                    "data_type": col[1],
                    "is_nullable": "YES" if col[2] == "Y" else "NO",
                    "column_default": str(col[3]) if col[3] else None,
                    "column_comment": "",
                    "foreign_key": fk_map.get(col_name),
                })
            connection.close()
            return {
                "success": True,
                "message": "获取表字段成功",
                "data": {"columns": column_list}
            }
        except ImportError:
            return {"success": False, "message": "缺少oracledb依赖，请执行: pip install oracledb"}
        except Exception as e:
            return {"success": False, "message": f"获取表字段失败: {str(e)}"}

    def get_monitor_info(self) -> Dict[str, Any]:
        """
        获取Oracle数据库监控信息
        
        Returns:
            Dict[str, Any]: 包含监控信息的字典
        """
        try:
            import oracledb
            dsn = f"{self.config.get('host', 'localhost')}:{self.config.get('port', 1521)}/{self.config.get('service_name', '')}"
            connection = oracledb.connect(
                user=self.config.get('username', ''),
                password=self.config.get('password', ''),
                dsn=dsn,
            )
            cursor = connection.cursor()

            cursor.execute("SELECT BANNER FROM v$version WHERE ROWNUM = 1")
            version_row = cursor.fetchone()
            version = version_row[0] if version_row else ''

            cursor.execute("SELECT count(*) FROM v$session WHERE status = 'ACTIVE'")
            conn_row = cursor.fetchone()
            active_connections = int(conn_row[0]) if conn_row else 0

            cursor.execute(
                "SELECT (SYSDATE - startup_time) * 86400 AS uptime_seconds FROM v$instance"
            )
            uptime_row = cursor.fetchone()
            uptime_seconds = int(uptime_row[0]) if uptime_row and uptime_row[0] else 0

            username = self.config.get('username', '').upper()
            cursor.execute(
                "SELECT count(*) FROM user_tables"
            )
            count_row = cursor.fetchone()
            table_count = int(count_row[0]) if count_row else 0

            cursor.execute(
                "SELECT sum(bytes) / 1024 / 1024 AS size_mb FROM user_segments"
            )
            size_row = cursor.fetchone()
            db_size = round(float(size_row[0] or 0), 2) if size_row else 0

            connection.close()

            days, remainder = divmod(uptime_seconds, 86400)
            hours, remainder = divmod(remainder, 3600)
            minutes, _ = divmod(remainder, 60)
            uptime_str = f"{days}天{hours}小时{minutes}分钟"

            return {
                "success": True,
                "message": "获取Oracle监控信息成功",
                "data": {
                    "status": "connected",
                    "version": version,
                    "metrics": [
                        {"name_en": "active_sessions", "name_zh": "活跃连接数", "value": active_connections, "unit": "个", "status": "normal", "description": "当前状态为ACTIVE的数据库会话数"},
                    ],
                    "stats": [
                        {"name_en": "uptime", "name_zh": "运行时间", "value": uptime_str, "unit": "", "description": "Oracle实例自启动以来的连续运行时长"},
                        {"name_en": "tablespace_size", "name_zh": "表空间大小", "value": db_size, "unit": "MB", "description": "当前用户下所有段对象占用的磁盘空间"},
                        {"name_en": "table_count", "name_zh": "表数量", "value": table_count, "unit": "个", "description": "当前用户下的数据表总数"},
                    ]
                }
            }
        except ImportError:
            return {"success": False, "message": "缺少oracledb依赖，请执行: pip install oracledb", "data": {"status": "disconnected"}}
        except Exception as e:
            return {"success": False, "message": f"获取Oracle监控信息失败: {str(e)}", "data": {"status": "disconnected"}}

    @staticmethod
    def _strip_ending(sql: str) -> str:
        """清洗SQL末尾：中英文分号与空白"""
        cleaned = (sql or '').strip()
        while cleaned and cleaned[-1] in (';', '；', '\n', '\r', '\t', ' '):
            cleaned = cleaned[:-1].rstrip()
        return cleaned.strip()

    def build_count_query(self, base_sql: str) -> str:
        """Oracle COUNT 查询：清洗后再子查询包装，表别名不加AS"""
        base = OracleDatasource._strip_ending(base_sql)
        return f"SELECT COUNT(*) AS total_count FROM ({base}) _count_wrapper"

    def build_page_query(self, base_sql: str, page_size: int, offset: int) -> str:
        """Oracle 兼容分页（9i~19c+ 全版本通吃）：ROWNUM 双层子查询

        不使用 12c+ 的 OFFSET/FETCH NEXT 语法，避免老版本 ORA-00933。
        """
        base = OracleDatasource._strip_ending(base_sql)
        return (
            "SELECT * FROM ( "
            "  SELECT _r.*, ROWNUM AS _rn FROM ( "
            f"   {base} "
            "  ) _r "
            f" WHERE ROWNUM <= {offset + page_size} "
            ") "
            f"WHERE _rn > {offset}"
        )
