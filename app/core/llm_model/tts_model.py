"""
TTS模型实现

使用OpenAI SDK实现语音合成接口
"""

from typing import Dict, Any, Generator
from openai import OpenAI
from app.core.llm_model.base import BaseLLM


class TTSModel(BaseLLM):
    """
    TTS模型实现
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
        生成语音（非流式）
        
        Args:
            prompt: 要转换为语音的文本
            **kwargs: 其他参数，如voice、speed等
            
        Returns:
            生成结果
        """
        if not self._validate_config():
            return {'error': 'Invalid configuration'}
        
        try:
            # 构建参数字典，包含默认值和用户传入的参数
            params = {
                'model': self.model_name,
                'input': prompt,
                'voice': 'alloy',
                'speed': 1.0,
                'response_format': 'mp3'
            }
            # 更新为用户传入的参数
            params.update(kwargs)
            
            # 使用OpenAI SDK生成语音
            response = self.client.audio.speech.create(**params)
            
            # 保存语音数据
            audio_data = response.read()
            
            # 格式化响应
            return {
                'audio_data': audio_data,
                'model': params.get('model', self.model_name),
                'voice': params.get('voice', 'alloy'),
                'speed': params.get('speed', 1.0),
                'response_format': params.get('response_format', 'mp3')
            }
        except Exception as e:
            return {'error': str(e)}
    
    def stream_generate(self, prompt: str, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        流式生成语音
        
        Args:
            prompt: 要转换为语音的文本
            **kwargs: 其他参数
            
        Yields:
            流式生成的结果
        """
        if not self._validate_config():
            yield {'error': 'Invalid configuration'}
            return
        
        try:
            response = self.generate(prompt, **kwargs)
            if 'error' not in response:
                yield response
        except Exception as e:
            yield {'error': str(e)}
    
    def stream_generate_with_messages(self, messages: list, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        使用消息列表流式生成（TTS模型不支持）
        
        Args:
            messages: 消息列表
            **kwargs: 其他参数
            
        Yields:
            错误信息
        """
        yield {'error': 'TTS model does not support chat messages'}
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        获取模型信息
        
        Returns:
            模型信息
        """
        return {
            'model_name': self.model_name,
            'provider': self.provider,
            'type': 'tts',
            'capabilities': {
                'streaming': False,
                'non_streaming': True
            }
        }