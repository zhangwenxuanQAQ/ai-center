"""
音频模型实现

使用OpenAI SDK实现语音转录接口
"""
from typing import Dict, Any, Generator
from openai import OpenAI
from app.core.llm_model.base import BaseLLM
import os
import tempfile
import logging
import base64

from app.core.knowledgebase.utils.file_utils import (
    find_ffmpeg,
    get_ffmpeg_path,
    cleanup_temp_files,
    convert_to_wav,
)

logger = logging.getLogger(__name__)


class AudioModel(BaseLLM):
    """音频模型实现"""
    
    def __init__(self, model_config: Dict[str, Any]):
        """初始化大模型"""
        super().__init__(model_config)
        self.client = OpenAI(api_key=self.api_key, base_url=self.endpoint)
    
    def _prepare_audio_input(self, prompt):
        """准备音频输入"""
        temp_file_path = None
        converted_audio_path = None
        
        if isinstance(prompt, str):
            if not os.path.exists(prompt):
                return None, None, f'音频文件不存在: {prompt}'
            converted_audio_path, error_msg = convert_to_wav(prompt)
            if error_msg:
                return None, None, error_msg
        else:
            if hasattr(prompt, 'read'):
                audio_data = prompt.read()
                temp_file = tempfile.NamedTemporaryFile(suffix='.tmp', delete=False)
                temp_file.write(audio_data)
                temp_file.close()
                temp_file_path = temp_file.name
                converted_audio_path, error_msg = convert_to_wav(temp_file_path)
                if error_msg:
                    cleanup_temp_files(temp_file_path)
                    return None, None, error_msg
            else:
                return None, None, "不支持的音频输入格式"
        
        return temp_file_path, converted_audio_path, None
    
    def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """转录语音（非流式）"""
        if not self._validate_config():
            return {'error': 'Invalid configuration'}
        
        temp_file_path = None
        converted_audio_path = None
        
        try:
            temp_file_path, converted_audio_path, error_msg = self._prepare_audio_input(prompt)
            if error_msg:
                return {'error': error_msg}
            
            with open(converted_audio_path, 'rb') as f:
                audio_data = f.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            audio_data_uri = f"data:audio/wav;base64,{audio_base64}"
            
            params = {
                'model': self.model_name,
                'messages': [
                    {
                        'role': 'user',
                        'content': [
                            {
                                'type': 'input_audio',
                                'input_audio': {
                                    'data': audio_data_uri,
                                    'format': 'wav'
                                }
                            }
                        ]
                    }
                ],
                'temperature': 0.0
            }
            params.update(kwargs)
            
            response = self.client.chat.completions.create(**params)
            
            result = {
                'text': response.choices[0].message.content,
                'model': response.model
            }
            
            if hasattr(response, 'usage') and response.usage:
                result['usage'] = response.usage.model_dump()
            
            return result
        except Exception as e:
            return {'error': str(e)}
        finally:
            if isinstance(prompt, str) and converted_audio_path == prompt:
                cleanup_temp_files(temp_file_path)
            else:
                cleanup_temp_files(temp_file_path, converted_audio_path)
    
    def stream_generate(self, prompt: str, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """流式转录语音（语音转录暂不支持流式）"""
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
        """使用消息列表流式生成（音频模型不支持）"""
        yield {'error': 'Audio model does not support chat messages'}
    
    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        return {
            'model_name': self.model_name,
            'provider': self.provider,
            'type': 'audio',
            'capabilities': {
                'streaming': False,
                'non_streaming': True,
                'transcription': True,
                'translation': False
            }
        }