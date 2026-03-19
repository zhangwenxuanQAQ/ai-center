"""
大模型基础抽象类

定义大模型调用的通用接口，所有具体模型实现都继承自此类
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Generator


class BaseLLM(ABC):
    """
    大模型基础抽象类
    """
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        初始化大模型
        
        Args:
            model_config: 模型配置，包含api_key、endpoint等信息
        """
        self.model_config = model_config
        self.api_key = model_config.get('api_key')
        self.endpoint = model_config.get('endpoint')
        self.model_name = model_config.get('name')
        self.provider = model_config.get('provider')
    
    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        生成文本（非流式）
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数
            
        Returns:
            生成结果
        """
        pass
    
    @abstractmethod
    def stream_generate(self, prompt: str, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        流式生成文本
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数
            
        Yields:
            流式生成的结果
        """
        pass
    
    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """
        获取模型信息
        
        Returns:
            模型信息
        """
        pass
    
    def _validate_config(self) -> bool:
        """
        验证配置
        
        Returns:
            是否验证通过
        """
        if not self.api_key:
            return False
        if not self.endpoint:
            return False
        return True