"""
音频模型实现

使用OpenAI SDK实现语音转录接口
"""
from typing import Dict, Any, Generator, AsyncGenerator
from openai import OpenAI
from app.core.llm_model.base import BaseLLM
from pathlib import Path
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

        # 支持字符串路径和Path对象
        if isinstance(prompt, (str, Path)):
            file_path = str(prompt)  # 统一转换为字符串
            if not os.path.exists(file_path):
                return None, None, f'音频文件不存在: {file_path}'
            converted_audio_path, error_msg = convert_to_wav(file_path)
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

            params = {
                'model': self.model_name,
                'messages': [
                    {
                        'role': 'user',
                        'content': [
                            {
                                'type': 'input_audio',
                                'input_audio': {
                                    'data': audio_base64,
                                    'format': 'wav'
                                }
                            }
                        ]
                    }
                ],
                'temperature': 0.0
            }
            params.update(kwargs)

            # 第一次尝试使用纯base64
            try:
                response = self.client.chat.completions.create(**params)

                result = {
                    'text': response.choices[0].message.content,
                    'model': response.model
                }

                if hasattr(response, 'usage') and response.usage:
                    result['usage'] = response.usage.model_dump()

                return result
            except Exception as e:
                # 检查是否是400错误，尝试添加data URI前缀
                error_str = str(e)
                if '400' in error_str or 'Bad Request' in error_str:
                    logger.info(f"generate第一次调用失败(400)，尝试添加data URI前缀重试: {error_str}")
                    try:
                        # 添加data URI前缀后重试
                        params_with_prefix = params.copy()
                        params_with_prefix['messages'] = [
                            {
                                'role': 'user',
                                'content': [
                                    {
                                        'type': 'input_audio',
                                        'input_audio': {
                                            'data': f"data:audio/wav;base64,{audio_base64}",
                                            'format': 'wav'
                                        }
                                    }
                                ]
                            }
                        ]

                        response = self.client.chat.completions.create(**params_with_prefix)

                        result = {
                            'text': response.choices[0].message.content,
                            'model': response.model
                        }

                        if hasattr(response, 'usage') and response.usage:
                            result['usage'] = response.usage.model_dump()

                        return result
                    except Exception as e2:
                        logger.error(f"添加data URI前缀后仍然失败: {str(e2)}")
                        return {'error': str(e2)}

                return {'error': str(e)}
        finally:
            # 清理临时文件
            if isinstance(prompt, (str, Path)):
                file_path = str(prompt)
                if converted_audio_path == file_path:
                    cleanup_temp_files(temp_file_path)
                else:
                    cleanup_temp_files(temp_file_path, converted_audio_path)
            else:
                cleanup_temp_files(temp_file_path, converted_audio_path)

    def stream_generate(self, prompt: str, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        流式转录语音
        """
        if not self._validate_config():
            yield {'error': 'Invalid configuration'}
            return

        temp_file_path = None
        converted_audio_path = None

        try:
            temp_file_path, converted_audio_path, error_msg = self._prepare_audio_input(prompt)
            if error_msg:
                yield {'error': error_msg}
                return

            with open(converted_audio_path, 'rb') as f:
                audio_data = f.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')

            params = {
                'model': self.model_name,
                'messages': [
                    {
                        'role': 'user',
                        'content': [
                            {
                                'type': 'input_audio',
                                'input_audio': {
                                    'data': audio_base64,
                                    'format': 'wav'
                                }
                            }
                        ]
                    }
                ],
                'temperature': 0.0,
                'stream': True
            }
            params.update(kwargs)

            # 第一次尝试使用纯base64
            try:
                stream = self.client.chat.completions.create(**params)

                for chunk in stream:
                    if chunk.choices:
                        choice = chunk.choices[0]
                        result = {
                            'text': choice.delta.content or '',
                            'finish_reason': choice.finish_reason,
                            'usage': chunk.usage.model_dump() if chunk.usage else None
                        }
                        yield result

                return
            except Exception as e:
                # 检查是否是400错误，尝试添加data URI前缀
                error_str = str(e)
                if '400' in error_str or 'Bad Request' in error_str:
                    logger.info(f"stream_generate第一次调用失败(400)，尝试添加data URI前缀重试: {error_str}")
                    try:
                        # 添加data URI前缀后重试
                        params_with_prefix = params.copy()
                        params_with_prefix['messages'] = [
                            {
                                'role': 'user',
                                'content': [
                                    {
                                        'type': 'input_audio',
                                        'input_audio': {
                                            'data': f"data:audio/wav;base64,{audio_base64}",
                                            'format': 'wav'
                                        }
                                    }
                                ]
                            }
                        ]

                        stream = self.client.chat.completions.create(**params_with_prefix)

                        for chunk in stream:
                            if chunk.choices:
                                choice = chunk.choices[0]
                                result = {
                                    'text': choice.delta.content or '',
                                    'finish_reason': choice.finish_reason,
                                    'usage': chunk.usage.model_dump() if chunk.usage else None
                                }
                                yield result

                        return
                    except Exception as e2:
                        logger.error(f"添加data URI前缀后仍然失败: {str(e2)}")
                        yield {'error': str(e2)}
                        return

                yield {'error': str(e)}
        finally:
            # 清理临时文件
            if isinstance(prompt, (str, Path)):
                file_path = str(prompt)
                if converted_audio_path == file_path:
                    cleanup_temp_files(temp_file_path)
                else:
                    cleanup_temp_files(temp_file_path, converted_audio_path)
            else:
                cleanup_temp_files(temp_file_path, converted_audio_path)
    
    def generate_with_messages(self, messages: list, **kwargs) -> Dict[str, Any]:
        """
        使用消息列表生成文本（处理消息列表，user消息只保留input_audio）

        Args:
            messages: 消息列表（已在外部处理好音频文件）
            **kwargs: 其他参数

        Returns:
            包含生成结果的字典
        """
        if not self._validate_config():
            return {'error': 'Invalid configuration'}

        processed_messages = self._filter_user_messages(messages)

        params = {
            'model': self.model_name,
            'messages': processed_messages,
            'temperature': 0.0
        }
        params = self._handle_extra_body(params, kwargs)
        params.update(kwargs)

        # 第一次尝试使用纯base64
        try:
            response = self.client.chat.completions.create(**params)

            result = {
                'text': response.choices[0].message.content,
                'model': response.model
            }

            if hasattr(response, 'usage') and response.usage:
                result['usage'] = response.usage.model_dump()

            return result
        except Exception as e:
            # 检查是否是400错误，尝试添加data URI前缀
            error_str = str(e)
            if '400' in error_str or 'Bad Request' in error_str:
                logger.info(f"第一次调用失败(400)，尝试添加data URI前缀重试: {error_str}")
                try:
                    # 添加data URI前缀后重试
                    params_with_prefix = params.copy()
                    params_with_prefix['messages'] = self._add_data_uri_prefix(params['messages'])

                    response = self.client.chat.completions.create(**params_with_prefix)

                    result = {
                        'text': response.choices[0].message.content,
                        'model': response.model
                    }

                    if hasattr(response, 'usage') and response.usage:
                        result['usage'] = response.usage.model_dump()

                    return result
                except Exception as e2:
                    logger.error(f"添加data URI前缀后仍然失败: {str(e2)}")
                    return {'error': str(e2)}

            return {'error': str(e)}

    def _add_data_uri_prefix(self, messages: list) -> list:
        """
        为消息中的input_audio添加data URI前缀

        Args:
            messages: 消息列表

        Returns:
            处理后的消息列表
        """
        prefixed_messages = []
        for msg in messages:
            if msg.get('role') == 'user' and isinstance(msg.get('content'), list):
                prefixed_content = []
                for item in msg['content']:
                    if isinstance(item, dict) and item.get('type') == 'input_audio':
                        input_audio = item.get('input_audio', {})
                        data = input_audio.get('data', '')
                        # 如果没有data URI前缀，则添加
                        if data and not data.startswith('data:'):
                            prefixed_input_audio = input_audio.copy()
                            prefixed_input_audio['data'] = f"data:audio/wav;base64,{data}"
                            prefixed_content.append({
                                'type': 'input_audio',
                                'input_audio': prefixed_input_audio
                            })
                        else:
                            prefixed_content.append(item)
                    else:
                        prefixed_content.append(item)
                prefixed_messages.append({
                    'role': msg['role'],
                    'content': prefixed_content
                })
            else:
                prefixed_messages.append(msg)
        return prefixed_messages

    def _filter_user_messages(self, messages: list) -> list:
        """
        过滤消息：删除system消息，user消息只保留input_audio类型，只保留最后一条input_audio消息

        Args:
            messages: 原始消息列表

        Returns:
            处理后的消息列表
        """
        input_audio_indices = []
        temp_messages = []
        
        for idx, msg in enumerate(messages):
            role = msg.get('role', '')
            content = msg.get('content')

            if role == 'system':
                continue
            
            if role == 'user':
                if isinstance(content, list):
                    filtered_content = [
                        item for item in content
                        if isinstance(item, dict) and item.get('type') == 'input_audio'
                    ]
                    if filtered_content:
                        temp_messages.append({
                            'role': role,
                            'content': filtered_content
                        })
                        input_audio_indices.append(len(temp_messages) - 1)
                    else:
                        temp_messages.append(msg)
                elif isinstance(content, str):
                    temp_messages.append(msg)
                else:
                    temp_messages.append(msg)
            else:
                temp_messages.append(msg)

        if len(input_audio_indices) > 1:
            for idx in input_audio_indices[:-1]:
                temp_messages[idx] = None
        
        return [msg for msg in temp_messages if msg is not None]

    def stream_generate_with_messages(self, messages: list, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        使用消息列表流式生成（处理消息列表，user消息只保留input_audio）

        Args:
            messages: 消息列表（已在外部处理好音频文件）
            **kwargs: 其他参数

        Yields:
            流式生成结果
        """
        if not self._validate_config():
            yield {'error': 'Invalid configuration'}
            return

        processed_messages = self._filter_user_messages(messages)

        params = {
            'model': self.model_name,
            'messages': processed_messages,
            'temperature': 0.0,
            'stream': True
        }
        params = self._handle_extra_body(params, kwargs)
        params.update(kwargs)

        # 第一次尝试使用纯base64
        try:
            stream = self.client.chat.completions.create(**params)

            for chunk in stream:
                if chunk.choices:
                    choice = chunk.choices[0]
                    result = {
                        'text': choice.delta.content or '',
                        'finish_reason': choice.finish_reason,
                        'usage': chunk.usage.model_dump() if chunk.usage else None
                    }

                    reasoning_content = self._extract_reasoning_content(choice.delta)
                    if reasoning_content:
                        result['reasoning_content'] = reasoning_content

                    yield result

            return
        except Exception as e:
            # 检查是否是400错误，尝试添加data URI前缀
            error_str = str(e)
            if '400' in error_str or 'Bad Request' in error_str:
                logger.info(f"第一次流式调用失败(400)，尝试添加data URI前缀重试: {error_str}")
                try:
                    # 添加data URI前缀后重试
                    params_with_prefix = params.copy()
                    params_with_prefix['messages'] = self._add_data_uri_prefix(params['messages'])

                    stream = self.client.chat.completions.create(**params_with_prefix)

                    for chunk in stream:
                        if chunk.choices:
                            choice = chunk.choices[0]
                            result = {
                                'text': choice.delta.content or '',
                                'finish_reason': choice.finish_reason,
                                'usage': chunk.usage.model_dump() if chunk.usage else None
                            }

                            reasoning_content = self._extract_reasoning_content(choice.delta)
                            if reasoning_content:
                                result['reasoning_content'] = reasoning_content

                            yield result

                    return
                except Exception as e2:
                    logger.error(f"添加data URI前缀后仍然失败: {str(e2)}")
                    yield {'error': str(e2)}
                    return

            yield {'error': str(e)}

    async def astream_generate_with_messages(self, messages: list, **kwargs) -> AsyncGenerator[Dict[str, Any], None]:
        """
        使用消息列表异步流式生成

        通过线程池包装同步的 stream_generate_with_messages，避免阻塞事件循环。

        Args:
            messages: 消息列表（已在外部处理好音频文件）
            **kwargs: 其他参数

        Yields:
            流式生成结果
        """
        gen = self.stream_generate_with_messages(messages, **kwargs)
        async for chunk in BaseLLM._async_wrap_stream(gen):
            yield chunk

    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        return {
            'model_name': self.model_name,
            'provider': self.provider,
            'type': 'audio',
            'capabilities': {
                'streaming': True,
                'non_streaming': True,
                'transcription': True,
                'translation': False
            }
        }