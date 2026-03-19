"""
文本模型实现

使用OpenAI SDK实现文本生成接口
"""

from typing import Dict, Any, Generator
from openai import OpenAI
from app.core.llm_model.base import BaseLLM


class TextModel(BaseLLM):
    """
    文本模型实现
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
        生成文本（非流式）
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数，如temperature、top_p、max_tokens等
            
        Returns:
            生成结果
        """
        if not self._validate_config():
            return {'error': 'Invalid configuration'}
        
        try:
            # 构建参数字典，包含默认值和用户传入的参数
            params = {
                'model': self.model_name,
                'messages': [
                    {'role': 'user', 'content': prompt}
                ],
                'temperature': 0.7,
                'max_tokens': 4096,
                'top_p': 0.9,
                'frequency_penalty': 0,
                'presence_penalty': 0
            }
            # 更新为用户传入的参数
            params.update(kwargs)
            
            # 使用OpenAI SDK生成文本
            response = self.client.chat.completions.create(**params)
            
            # 格式化响应
            return {
                'text': response.choices[0].message.content,
                'usage': response.usage.model_dump() if response.usage else {},
                'model': response.model
            }
        except Exception as e:
            return {'error': str(e)}
    
    def stream_generate(self, prompt: str, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        流式生成文本
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数
            
        Yields:
            流式生成的结果
        """
        if not self._validate_config():
            yield {'error': 'Invalid configuration'}
            return
        
        try:
            # 构建参数字典，包含默认值和用户传入的参数
            params = {
                'model': self.model_name,
                'messages': [
                    {'role': 'user', 'content': prompt}
                ],
                'temperature': 0.7,
                'max_tokens': 4096,
                'top_p': 0.9,
                'frequency_penalty': 0,
                'presence_penalty': 0,
                'stream': True
            }
            # 更新为用户传入的参数
            params.update(kwargs)
            
            # 使用OpenAI SDK流式生成文本
            stream = self.client.chat.completions.create(**params)
            
            for chunk in stream:
                if chunk.choices:
                    choice = chunk.choices[0]
                    yield {
                        'text': choice.delta.content or '',
                        'finish_reason': choice.finish_reason,
                        'usage': chunk.usage.model_dump() if chunk.usage else None
                    }
        except Exception as e:
            yield {'error': str(e)}
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        获取模型信息
        
        Returns:
            模型信息
        """
        return {
            'model_name': self.model_name,
            'provider': self.provider,
            'type': 'text',
            'capabilities': {
                'streaming': True,
                'non_streaming': True,
                'max_tokens': 4096
            }
        }