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
            
            # 构建请求URL - 处理不同提供商的API格式
            endpoint = self.endpoint.rstrip('/')
            # 检查是否已经包含rerank路径
            if 'rerank' not in endpoint:
                # 根据常见API格式调整
                if 'compatible-api' in endpoint:
                    # 例如：https://dashscope.aliyuncs.com/compatible-api/v1/reranks/rerank
                    request_url = f'{endpoint}/reranks/rerank'
                else:
                    # 标准格式
                    request_url = f'{endpoint}/rerank'
            else:
                request_url = endpoint
            
            with httpx.Client(timeout=30) as client:
                response = client.post(
                    request_url,
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
                
                # 格式化响应，确保返回ranked_documents字段
                ranked_documents = result.get('results', [])
                # 转换结果格式以匹配测试期望
                formatted_results = []
                for item in ranked_documents:
                    formatted_item = {
                        'index': item.get('index'),
                        'document': item.get('document'),
                        'score': item.get('score')
                    }
                    formatted_results.append(formatted_item)
                
                return {
                    'ranked_documents': formatted_results,
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
        result = self.generate(prompt, **kwargs)
        yield result
    
    def stream_generate_with_messages(self, messages: list, **kwargs) -> Any:
        """
        使用消息列表流式生成（重排序模型不支持）
        
        Args:
            messages: 消息列表
            **kwargs: 其他参数
            
        Yields:
            错误信息
        """
        yield {'error': 'Rerank model does not support chat messages'}
    
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