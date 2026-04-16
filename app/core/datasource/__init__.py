"""
数据源核心模块

提供数据源连接测试和数据查询的工厂模式实现
"""

from app.core.datasource.base import DatasourceBase
from app.core.datasource.factory import DatasourceFactory
from app.core.datasource.mysql_datasource import MySQLDatasource
from app.core.datasource.postgresql_datasource import PostgreSQLDatasource
from app.core.datasource.oracle_datasource import OracleDatasource
from app.core.datasource.sql_server_datasource import SQLServerDatasource
from app.core.datasource.s3_datasource import S3Datasource
from app.core.datasource.minio_datasource import MinIODatasource
from app.core.datasource.rustfs_datasource import RustFSDatasource

__all__ = [
    'DatasourceBase',
    'DatasourceFactory',
    'MySQLDatasource',
    'PostgreSQLDatasource',
    'OracleDatasource',
    'SQLServerDatasource',
    'S3Datasource',
    'MinIODatasource',
    'RustFSDatasource',
]
