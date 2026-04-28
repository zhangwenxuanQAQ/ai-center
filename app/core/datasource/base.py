"""
数据源基类

定义数据源操作的抽象接口，所有数据源实现类都需要继承此基类
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class DatasourceBase(ABC):
    """
    数据源基类
    
    定义数据源的通用接口，包括测试连接、执行查询等操作
    所有具体数据源实现类都需要继承此基类并实现其抽象方法
    """

    def __init__(self, config: Dict[str, Any]):
        """
        初始化数据源
        
        Args:
            config: 数据源配置字典
        """
        self.config = config

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        测试数据源连接
        
        Returns:
            Dict[str, Any]: 包含连接测试结果的字典
                - success: 是否连接成功
                - message: 连接结果消息
        """
        pass

    @abstractmethod
    def execute_query(self, query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        执行查询操作
        
        Args:
            query: 查询语句
            params: 查询参数（可选）
            
        Returns:
            Dict[str, Any]: 包含查询结果的字典
                - success: 是否查询成功
                - message: 查询结果消息
                - data: 查询结果数据
        """
        pass

    @abstractmethod
    def get_schema_info(self) -> Dict[str, Any]:
        """
        获取数据源的Schema信息
        
        Returns:
            Dict[str, Any]: 包含Schema信息的字典
                - success: 是否获取成功
                - message: 结果消息
                - data: Schema信息数据
        """
        pass

    def list_files(self, bucket: Optional[str] = None, prefix: Optional[str] = None, max_keys: int = 100, search_keyword: Optional[str] = None) -> Dict[str, Any]:
        """
        列出文件（仅适用于文件存储类型数据源）
        
        Args:
            bucket: Bucket名称（可选）
            prefix: 文件前缀/目录（可选）
            max_keys: 最大返回数量
            search_keyword: 搜索关键词（可选）
            
        Returns:
            Dict[str, Any]: 包含文件列表的字典
                - success: 是否成功
                - message: 结果消息
                - data: 文件列表数据
        """
        return {
            "success": False,
            "message": "此数据源类型不支持列出文件操作",
            "data": None
        }

    def download_file(self, bucket: Optional[str] = None, object_name: str = "") -> Dict[str, Any]:
        """
        下载文件（仅适用于文件存储类型数据源）
        
        Args:
            bucket: Bucket名称（可选）
            object_name: 对象名称/文件路径
            
        Returns:
            Dict[str, Any]: 包含文件内容的字典
                - success: 是否成功
                - message: 结果消息
                - data: 文件数据
        """
        return {
            "success": False,
            "message": "此数据源类型不支持下载文件操作",
            "data": None
        }

    def list_tables(self, database: Optional[str] = None) -> Dict[str, Any]:
        """
        列出数据库表（仅适用于关系型数据库数据源）
        
        Args:
            database: 数据库名称（可选）
            
        Returns:
            Dict[str, Any]: 包含表列表的字典
                - success: 是否成功
                - message: 结果消息
                - data: 表列表数据
        """
        return {
            "success": False,
            "message": "此数据源类型不支持列出表操作",
            "data": None
        }

    def get_table_columns(self, table_name: str, database: Optional[str] = None) -> Dict[str, Any]:
        """
        获取表的字段信息（仅适用于关系型数据库数据源）
        
        Args:
            table_name: 表名称
            database: 数据库名称（可选）
            
        Returns:
            Dict[str, Any]: 包含字段信息的字典
                - success: 是否成功
                - message: 结果消息
                - data: 字段信息数据
        """
        return {
            "success": False,
            "message": "此数据源类型不支持获取表字段操作",
            "data": None
        }

    def get_monitor_info(self) -> Dict[str, Any]:
        """
        获取数据源监控信息
        
        返回数据源的运行状态、性能指标和统计数据，用于系统监控页面展示
        
        Returns:
            Dict[str, Any]: 包含监控信息的字典
                - success: 是否获取成功
                - message: 结果消息
                - data: 监控信息数据，包含以下字段：
                    - status: 连接状态 (connected/disconnected)
                    - version: 数据源版本号
                    - metrics: 性能指标列表，每项包含 name, value, unit, status
                    - stats: 统计数据列表，每项包含 name, value, unit
        """
        return {
            "success": False,
            "message": "此数据源类型不支持监控信息获取",
            "data": None
        }
