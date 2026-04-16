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
