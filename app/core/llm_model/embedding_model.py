"""
Embedding模型实现

使用OpenAI SDK实现文本嵌入接口
"""

from typing import Dict, Any
from openai import OpenAI
from app.core.llm_model.base import BaseLLM


class EmbeddingModel(BaseLLM):
    """
    Embedding模型实现
    """
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        初始化大模型
        
        Args:
            model_config: 模型配置，包含api_key、endpoint等信息
        """
        super().__init__(model_config)
        # 初始化OpenAI客户端
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.endpoint
        )
    
    def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        生成文本嵌入
        
        Args:
            prompt: 要嵌入的文本
            **kwargs: 其他参数
            
        Returns:
            嵌入结果
        """
        if not self._validate_config():
            return {'error': 'Invalid configuration'}
        
        try:
            # 构建参数字典，包含默认值和用户传入的参数
            params = {
                'model': self.model_name,
                'input': prompt,
                'encoding_format': 'float'
            }
            # 更新为用户传入的参数
            params.update(kwargs)
            
            # 使用OpenAI SDK生成嵌入
            response = self.client.embeddings.create(**params)
            
            # 格式化响应
            return {
                'embedding': response.data[0].embedding,
                'usage': response.usage.model_dump() if response.usage else {},
                'model': response.model
            }
        except Exception as e:
            return {'error': str(e)}
    
    def stream_generate(self, prompt: str, **kwargs) -> Any:
        """
        流式生成嵌入（通常嵌入不需要流式）
        
        Args:
            prompt: 要嵌入的文本
            **kwargs: 其他参数
            
        Yields:
            流式生成的结果
        """
        # 嵌入通常不需要流式，直接调用非流式方法
        result = self.generate(prompt, **kwargs)
        yield result
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        获取模型信息
        
        Returns:
            模型信息
        """
        return {
            'model_name': self.model_name,
            'provider': self.provider,
            'type': 'embedding',
            'capabilities': {
                'streaming': False,
                'non_streaming': True
            }
        }