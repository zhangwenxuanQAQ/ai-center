"""
视觉模型实现

使用OpenAI SDK实现视觉接口
"""

from typing import Dict, Any, Generator
from openai import OpenAI
from app.core.llm_model.base import BaseLLM


class VisionModel(BaseLLM):
    """
    视觉模型实现
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
    
    def _handle_deep_thinking(self, params: dict, kwargs: dict) -> dict:
        """
        处理深度思考参数
        
        Args:
            params: 当前参数字典
            kwargs: 用户传入的参数
            
        Returns:
            更新后的参数字典
        """
        deep_thinking = kwargs.pop('deep_thinking', False)
        if self.provider and self.provider.lower() == 'qwen' and not bool(deep_thinking):
            params['extra_body'] = {"enable_thinking": False}
        return params
    
    def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        分析图像（非流式）
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数，如image_url等
            
        Returns:
            分析结果
        """
        if not self._validate_config():
            return {'error': 'Invalid configuration'}
        
        image_url = kwargs.get('image_url')
        if not image_url:
            return {'error': 'No image URL provided'}
        
        try:
            params = {
                'model': self.model_name,
                'messages': [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url
                                }
                            }
                        ]
                    }
                ],
                'temperature': 0.7,
                'max_tokens': 4096,
                'stream': True,
                'stream_options': {'include_usage': True}
            }
            
            params = self._handle_deep_thinking(params, kwargs)
            params.update(kwargs)
            params.pop('image_url', None)
            
            response = self.client.chat.completions.create(**params)
            
            result = {
                'text': response.choices[0].message.content,
                'usage': response.usage.model_dump() if response.usage else {},
                'model': response.model
            }
            
            if hasattr(response.choices[0].message, 'reasoning_content') and response.choices[0].message.reasoning_content:
                result['reasoning_content'] = response.choices[0].message.reasoning_content
            
            return result
        except Exception as e:
            return {'error': str(e)}
    
    def stream_generate(self, prompt: str, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        流式分析图像
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数
            
        Yields:
            流式分析结果
        """
        if not self._validate_config():
            yield {'error': 'Invalid configuration'}
            return
        
        image_url = kwargs.get('image_url')
        if not image_url:
            yield {'error': 'No image URL provided'}
            return
        
        try:
            params = {
                'model': self.model_name,
                'messages': [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url
                                }
                            }
                        ]
                    }
                ],
                'temperature': 0.7,
                'max_tokens': 4096,
                'stream': True,
                'stream_options': {'include_usage': True}
            }
            
            params = self._handle_deep_thinking(params, kwargs)
            params.update(kwargs)
            params.pop('image_url', None)
            
            stream = self.client.chat.completions.create(**params)
            
            for chunk in stream:
                if chunk.choices:
                    choice = chunk.choices[0]
                    result = {
                        'text': choice.delta.content or '',
                        'finish_reason': choice.finish_reason,
                        'usage': chunk.usage.model_dump() if chunk.usage else None
                    }
                    if hasattr(choice.delta, 'reasoning_content') and choice.delta.reasoning_content:
                        result['reasoning_content'] = choice.delta.reasoning_content
                    yield result
                elif chunk.usage:
                    yield {
                        'text': '',
                        'usage': chunk.usage.model_dump()
                    }
        except Exception as e:
            yield {'error': str(e)}
    
    def stream_generate_with_messages(self, messages: list, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        使用消息列表流式生成文本
        
        Args:
            messages: 消息列表
            **kwargs: 其他参数
            
        Yields:
            流式生成的结果
        """
        if not self._validate_config():
            yield {'error': 'Invalid configuration'}
            return
        
        try:
            params = {
                'model': self.model_name,
                'messages': messages,
                'temperature': 0.7,
                'max_tokens': 4096,
                'stream': True,
                'stream_options': {'include_usage': True}
            }
            
            params = self._handle_deep_thinking(params, kwargs)
            params.update(kwargs)
            
            stream = self.client.chat.completions.create(**params)
            
            for chunk in stream:
                if chunk.choices:
                    choice = chunk.choices[0]
                    result = {
                        'text': choice.delta.content or '',
                        'finish_reason': choice.finish_reason,
                        'usage': chunk.usage.model_dump() if chunk.usage else None
                    }
                    if hasattr(choice.delta, 'reasoning_content') and choice.delta.reasoning_content:
                        result['reasoning_content'] = choice.delta.reasoning_content
                    yield result
                elif chunk.usage:
                    yield {
                        'text': '',
                        'usage': chunk.usage.model_dump()
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
            'type': 'vision',
            'capabilities': {
                'streaming': True,
                'non_streaming': True
            }
        }
