"""
Embedding模型实现

使用OpenAI SDK实现文本嵌入接口
"""

import re
from typing import Dict, Any, List, Tuple
import numpy as np
from openai import OpenAI
from app.core.llm_model.base import BaseLLM
from app.utils.token_utils import truncate


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
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.endpoint
        )
        self.max_length = model_config.get("max_length", 8191)
    
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
            params = {
                'model': self.model_name,
                'input': prompt,
                'encoding_format': 'float'
            }
            params.update(kwargs)
            
            response = self.client.embeddings.create(**params)
            
            return {
                'embedding': response.data[0].embedding,
                'usage': response.usage.model_dump() if response.usage else {},
                'model': response.model
            }
        except Exception as e:
            return {'error': str(e)}
    
    def encode(self, texts: List[str]) -> Tuple[np.ndarray, int, List[int]]:
        """
        批量编码文本，返回向量数组、总token数和每个文本的token数列表
        
        Args:
            texts: 文本列表
            
        Returns:
            Tuple[np.ndarray, int, List[int]]: 向量数组、总token数、每个文本的token数列表
        """
        from app.core.knowledgebase.rag.settings import EMBEDDING_BATCH_SIZE
        
        texts = [truncate(t, self.max_length) for t in texts]
        embeddings = []
        total_tokens = 0
        token_counts = []
        
        for i in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[i:i + EMBEDDING_BATCH_SIZE]
            try:
                response = self.client.embeddings.create(
                    input=batch,
                    model=self.model_name,
                    encoding_format="float"
                )
                embeddings.extend([d.embedding for d in response.data])
                batch_tokens = self._total_token_count(response)
                total_tokens += batch_tokens
                per_text_tokens = batch_tokens // len(batch) if len(batch) > 0 else 0
                token_counts.extend([per_text_tokens] * len(batch))
            except Exception as e:
                raise e
        
        return np.array(embeddings), total_tokens, token_counts
    
    def encode_queries(self, text: str) -> Tuple[np.ndarray, int]:
        """
        编码单个查询文本
        
        Args:
            text: 查询文本
            
        Returns:
            Tuple[np.ndarray, int]: 向量和token数
        """
        text = truncate(text, self.max_length)
        response = self.client.embeddings.create(
            input=[text],
            model=self.model_name,
            encoding_format="float"
        )
        return np.array(response.data[0].embedding), self._total_token_count(response)
    
    def _total_token_count(self, response) -> int:
        """
        从响应中获取总token数
        
        Args:
            response: OpenAI响应对象
            
        Returns:
            int: 总token数
        """
        if response.usage:
            return response.usage.total_tokens
        return 0
    
    def stream_generate(self, prompt: str, **kwargs) -> Any:
        """
        流式生成嵌入（通常嵌入不需要流式）
        
        Args:
            prompt: 要嵌入的文本
            **kwargs: 其他参数
            
        Yields:
            流式生成的结果
        """
        result = self.generate(prompt, **kwargs)
        yield result
    
    def stream_generate_with_messages(self, messages: list, **kwargs) -> Any:
        """
        使用消息列表流式生成（嵌入模型不支持）
        
        Args:
            messages: 消息列表
            **kwargs: 其他参数
            
        Yields:
            错误信息
        """
        yield {'error': 'Embedding model does not support chat messages'}
    
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
