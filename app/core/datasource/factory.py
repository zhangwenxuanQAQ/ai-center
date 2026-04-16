"""
数据源工厂类

根据数据源类型创建对应的数据源实现类实例
"""

from typing import Dict, Any
from app.core.datasource.base import DatasourceBase
from app.core.datasource.mysql_datasource import MySQLDatasource
from app.core.datasource.postgresql_datasource import PostgreSQLDatasource
from app.core.datasource.oracle_datasource import OracleDatasource
from app.core.datasource.sql_server_datasource import SQLServerDatasource
from app.core.datasource.s3_datasource import S3Datasource
from app.core.datasource.minio_datasource import MinIODatasource
from app.core.datasource.rustfs_datasource import RustFSDatasource
from app.constants.datasource_constants import DatasourceType


_datasource_registry: Dict[str, type] = {
    DatasourceType.MYSQL: MySQLDatasource,
    DatasourceType.POSTGRESQL: PostgreSQLDatasource,
    DatasourceType.ORACLE: OracleDatasource,
    DatasourceType.SQL_SERVER: SQLServerDatasource,
    DatasourceType.S3: S3Datasource,
    DatasourceType.MINIO: MinIODatasource,
    DatasourceType.RUSTFS: RustFSDatasource,
}


class DatasourceFactory:
    """
    数据源工厂类
    
    根据数据源类型创建对应的数据源实现类实例，使用工厂模式解耦创建逻辑
    """

    @staticmethod
    def create(datasource_type: str, config: Dict[str, Any]) -> DatasourceBase:
        """
        根据数据源类型创建数据源实例
        
        Args:
            datasource_type: 数据源类型，来自DatasourceType枚举
            config: 数据源配置字典
            
        Returns:
            DatasourceBase: 数据源实现类实例
            
        Raises:
            ValueError: 不支持的数据源类型
        """
        datasource_class = _datasource_registry.get(datasource_type)
        if datasource_class is None:
            supported_types = ', '.join(_datasource_registry.keys())
            raise ValueError(f"不支持的数据源类型: {datasource_type}，支持的类型: {supported_types}")
        return datasource_class(config)

    @staticmethod
    def get_supported_types() -> Dict[str, str]:
        """
        获取所有支持的数据源类型
        
        Returns:
            Dict[str, str]: 数据源类型到类名的映射
        """
        return {type_key: cls.__name__ for type_key, cls in _datasource_registry.items()}

    @staticmethod
    def is_supported(datasource_type: str) -> bool:
        """
        检查数据源类型是否受支持
        
        Args:
            datasource_type: 数据源类型
            
        Returns:
            bool: 是否支持
        """
        return datasource_type in _datasource_registry
