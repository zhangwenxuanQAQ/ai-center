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
