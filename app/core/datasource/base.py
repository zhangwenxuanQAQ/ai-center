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
