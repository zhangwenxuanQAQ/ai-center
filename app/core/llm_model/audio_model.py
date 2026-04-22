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

logger = logging.getLogger(__name__)

FFMPEG_COMMON_LOCATIONS = [
    r"C:\Users\Admin\scoop\shims\ffmpeg.exe",
    r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    r"C:\ffmpeg\bin\ffmpeg.exe",
    r"D:\ffmpeg\bin\ffmpeg.exe",
    r"E:\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
    r"D:\Program Files\ffmpeg\bin\ffmpeg.exe",
    r"D:\anaconda\Library\bin\ffmpeg.exe",
    r"C:\Users\Admin\AppData\Local\Programs\ffmpeg\bin\ffmpeg.exe",
]


def find_ffmpeg():
    """查找ffmpeg可执行文件"""
    try:
        import subprocess
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
        if result.returncode == 0:
            logger.info("在系统PATH中找到ffmpeg")
            return 'ffmpeg'
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    
    for loc in FFMPEG_COMMON_LOCATIONS:
        if os.path.exists(loc):
            logger.info(f"在常见位置找到ffmpeg: {loc}")
            return loc
    
    logger.warning("未找到ffmpeg")
    return None


def get_ffmpeg_path():
    """获取ffmpeg路径"""
    ffmpeg_path = os.environ.get('FFMPEG_PATH')
    if ffmpeg_path and os.path.exists(ffmpeg_path):
        logger.info(f"从环境变量FFMPEG_PATH获取ffmpeg: {ffmpeg_path}")
        return ffmpeg_path
    return find_ffmpeg()


class AudioModel(BaseLLM):
    """音频模型实现"""
    
    def __init__(self, model_config: Dict[str, Any]):
        """初始化大模型"""
        super().__init__(model_config)
        self.client = OpenAI(api_key=self.api_key, base_url=self.endpoint)
    
    def _cleanup_temp_files(self, *file_paths):
        """清理临时文件"""
        for file_path in file_paths:
            if file_path and os.path.exists(file_path):
                try:
                    os.unlink(file_path)
                except Exception:
                    pass
    
    def _convert_to_wav(self, audio_path: str) -> tuple:
        """将音频文件转换为wav格式"""
        if os.path.splitext(audio_path)[1].lower() == '.wav':
            return audio_path, None
        
        ffmpeg_exe = get_ffmpeg_path()
        
        try:
            from pydub import AudioSegment
            if ffmpeg_exe and ffmpeg_exe != 'ffmpeg':
                ffmpeg_dir = os.path.dirname(ffmpeg_exe)
                if ffmpeg_dir not in os.environ.get('PATH', ''):
                    os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
                    logger.info(f"已将ffmpeg目录添加到PATH: {ffmpeg_dir}")
            
            temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_wav.close()
            
            audio = AudioSegment.from_file(audio_path)
            audio.export(temp_wav.name, format='wav')
            logger.info(f"成功使用pydub转换音频文件: {audio_path} -> {temp_wav.name}")
            return temp_wav.name, None
        except ImportError:
            logger.warning("pydub未安装，尝试使用ffmpeg")
            if not ffmpeg_exe:
                return None, "音频转换失败: 未找到ffmpeg。请安装ffmpeg或将音频文件转换为wav格式"
            
            try:
                import subprocess
                temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                temp_wav.close()
                
                subprocess.run([ffmpeg_exe, '-i', audio_path, '-y', temp_wav.name], 
                              check=True, capture_output=True, text=True)
                logger.info(f"成功使用ffmpeg转换音频文件: {audio_path} -> {temp_wav.name}")
                return temp_wav.name, None
            except subprocess.CalledProcessError as e:
                return None, f"音频转换失败: ffmpeg转换失败 - {e.stderr}"
            except Exception as e:
                return None, f"音频转换失败: {str(e)}"
        except Exception as e:
            error_msg = f"音频转换失败: {str(e)}"
            if "ffmpeg" in str(e).lower() or "file not found" in str(e).lower():
                if not ffmpeg_exe:
                    error_msg = "音频转换失败: pydub需要ffmpeg支持。请安装ffmpeg或将音频文件转换为wav格式"
            return None, error_msg
    
    def _prepare_audio_input(self, prompt):
        """准备音频输入"""
        temp_file_path = None
        converted_audio_path = None
        
        if isinstance(prompt, str):
            if not os.path.exists(prompt):
                return None, None, f'音频文件不存在: {prompt}'
            converted_audio_path, error_msg = self._convert_to_wav(prompt)
            if error_msg:
                return None, None, error_msg
        else:
            if hasattr(prompt, 'read'):
                audio_data = prompt.read()
                temp_file = tempfile.NamedTemporaryFile(suffix='.tmp', delete=False)
                temp_file.write(audio_data)
                temp_file.close()
                temp_file_path = temp_file.name
                converted_audio_path, error_msg = self._convert_to_wav(temp_file_path)
                if error_msg:
                    self._cleanup_temp_files(temp_file_path)
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
                self._cleanup_temp_files(temp_file_path)
            else:
                self._cleanup_temp_files(temp_file_path, converted_audio_path)
    
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