"""
Rerank模型实现

使用OpenAI SDK结构实现文本重排序接口
"""

from typing import Dict, Any, List
from openai import OpenAI
from app.core.llm_model.base import BaseLLM


class RerankModel(BaseLLM):
    """
    Rerank模型实现
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
        文本重排序
        
        Args:
            prompt: 查询文本
            **kwargs: 其他参数，包括documents（待排序的文档列表）
            
        Returns:
            排序结果
        """
        if not self._validate_config():
            return {'error': 'Invalid configuration'}
        
        documents = kwargs.get('documents', [])
        if not documents:
            return {'error': 'No documents provided'}
        
        try:
            # 注意：OpenAI官方SDK可能没有直接的rerank接口
            # 这里使用HTTP客户端直接调用
            import httpx
            
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}'
            }
            
            with httpx.Client(timeout=30) as client:
                response = client.post(
                    f'{self.endpoint}/rerank',
                    headers=headers,
                    json={
                        'model': self.model_name,
                        'query': prompt,
                        'documents': documents,
                        'top_n': kwargs.get('top_n', 10),
                        'return_documents': kwargs.get('return_documents', True)
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                # 格式化响应
                return {
                    'results': result.get('results', []),
                    'usage': result.get('usage', {})
                }
        except Exception as e:
            return {'error': str(e)}
    
    def stream_generate(self, prompt: str, **kwargs) -> Any:
        """
        流式重排序（通常重排序不需要流式）
        
        Args:
            prompt: 查询文本
            **kwargs: 其他参数
            
        Yields:
            流式生成的结果
        """
        # 重排序通常不需要流式，直接调用非流式方法
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
            'type': 'rerank',
            'capabilities': {
                'streaming': False,
                'non_streaming': True
            }
        }