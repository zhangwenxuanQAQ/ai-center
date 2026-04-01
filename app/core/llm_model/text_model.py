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
        生成文本（非流式）
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数，如temperature、top_p、max_tokens、image、tools等
            
        Returns:
            生成结果
        """
        if not self._validate_config():
            return {'error': 'Invalid configuration'}
        
        try:
            image = kwargs.pop('image', None)
            tools = kwargs.pop('tools', None)
            
            if image:
                messages = [
                    {
                        'role': 'user', 
                        'content': [
                            {'type': 'text', 'text': prompt},
                            {
                                'type': 'image_url',
                                'image_url': {
                                    'url': f'data:image/jpeg;base64,{image}'
                                }
                            }
                        ]
                    }
                ]
            else:
                messages = [
                    {'role': 'user', 'content': prompt}
                ]
            
            params = {
                'model': self.model_name,
                'messages': messages,
                'temperature': 0.7,
                'max_tokens': 4096,
                'top_p': 0.1,
                'frequency_penalty': 0,
                'presence_penalty': 0
            }
            
            if tools:
                params['tools'] = tools
            
            params = self._handle_deep_thinking(params, kwargs)
            params.update(kwargs)
            
            response = self.client.chat.completions.create(**params)
            
            result = {
                'text': response.choices[0].message.content,
                'usage': response.usage.model_dump() if response.usage else {},
                'model': response.model
            }
            
            if hasattr(response.choices[0].message, 'reasoning_content') and response.choices[0].message.reasoning_content:
                result['reasoning_content'] = response.choices[0].message.reasoning_content
            
            if hasattr(response.choices[0].message, 'tool_calls') and response.choices[0].message.tool_calls:
                result['tool_calls'] = response.choices[0].message.tool_calls
            
            return result
        except Exception as e:
            return {'error': str(e)}
    
    def stream_generate(self, prompt: str, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        流式生成文本
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数，如temperature、top_p、max_tokens、image等
            
        Yields:
            流式生成的结果
        """
        if not self._validate_config():
            yield {'error': 'Invalid configuration'}
            return
        
        try:
            image = kwargs.pop('image', None)
            
            if image:
                messages = [
                    {
                        'role': 'user', 
                        'content': [
                            {'type': 'text', 'text': prompt},
                            {
                                'type': 'image_url',
                                'image_url': {
                                    'url': f'data:image/jpeg;base64,{image}'
                                }
                            }
                        ]
                    }
                ]
            else:
                messages = [
                    {'role': 'user', 'content': prompt}
                ]
            
            params = {
                'model': self.model_name,
                'messages': messages,
                'temperature': 0.7,
                'max_tokens': 4096,
                'top_p': 0.1,
                'frequency_penalty': 0,
                'presence_penalty': 0,
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
    
    def stream_generate_with_messages(self, messages: list, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        使用消息列表流式生成文本
        
        Args:
            messages: 消息列表，格式为[{'role': 'user'/'assistant', 'content': '...'}]
            **kwargs: 其他参数，如temperature、top_p、max_tokens、tools等
            
        Yields:
            流式生成的结果，包含text、reasoning_content（思考过程）、usage（token消耗）、tool_calls（工具调用）
        """
        if not self._validate_config():
            yield {'error': 'Invalid configuration'}
            return
        
        try:
            tools = kwargs.pop('tools', None)
            
            params = {
                'model': self.model_name,
                'messages': messages,
                'temperature': 0.7,
                'max_tokens': 4096,
                'top_p': 0.1,
                'frequency_penalty': 0,
                'presence_penalty': 0,
                'stream': True,
                'stream_options': {'include_usage': True}
            }
            
            if tools:
                params['tools'] = tools
            
            params = self._handle_deep_thinking(params, kwargs)
            params.update(kwargs)
            
            stream = self.client.chat.completions.create(**params)
            
            tool_calls_data = {}
            
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
                    
                    if hasattr(choice.delta, 'tool_calls') and choice.delta.tool_calls:
                        for tool_call in choice.delta.tool_calls:
                            idx = tool_call.index
                            if idx not in tool_calls_data:
                                tool_calls_data[idx] = {
                                    'id': tool_call.id,
                                    'type': tool_call.type,
                                    'function': {
                                        'name': '',
                                        'arguments': ''
                                    }
                                }
                            if tool_call.function:
                                if tool_call.function.name:
                                    tool_calls_data[idx]['function']['name'] += tool_call.function.name
                                if tool_call.function.arguments:
                                    tool_calls_data[idx]['function']['arguments'] += tool_call.function.arguments
                        
                        if tool_calls_data:
                            result['tool_calls'] = list(tool_calls_data.values())
                    
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
            'type': 'text',
            'capabilities': {
                'streaming': True,
                'non_streaming': True,
                'max_tokens': 4096
            }
        }
