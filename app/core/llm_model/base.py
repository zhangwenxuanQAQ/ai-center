"""
大模型基础抽象类

定义大模型调用的通用接口，所有具体模型实现都继承自此类
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Generator, AsyncGenerator
import asyncio


class BaseLLM(ABC):
    """
    大模型基础抽象类
    """
    
    def __init__(self, model_config: Dict[str, Any]):
        """
        初始化大模型
        
        Args:
            model_config: 模型配置，包含api_key、endpoint等信息
        """
        self.model_config = model_config
        self.api_key = model_config.get('api_key')
        self.endpoint = model_config.get('endpoint')
        self.model_name = model_config.get('name')
        self.provider = model_config.get('provider')
    
    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """
        生成文本（非流式）
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数
            
        Returns:
            生成结果
        """
        pass
    
    @abstractmethod
    def stream_generate(self, prompt: str, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        流式生成文本
        
        Args:
            prompt: 提示词
            **kwargs: 其他参数
            
        Yields:
            流式生成的结果
        """
        pass
    
    @abstractmethod
    def generate_with_messages(self, messages: list, **kwargs) -> Dict[str, Any]:
        """
        使用消息列表生成文本（非流式）
        
        Args:
            messages: 消息列表，格式为[{'role': 'user'/'assistant', 'content': '...'}]
            **kwargs: 其他参数
            
        Returns:
            生成结果
        """
        pass
    
    @abstractmethod
    def stream_generate_with_messages(self, messages: list, **kwargs) -> Generator[Dict[str, Any], None, None]:
        """
        使用消息列表流式生成文本

        Args:
            messages: 消息列表，格式为[{'role': 'user'/'assistant', 'content': '...'}]
            **kwargs: 其他参数

        Yields:
            流式生成的结果
        """
        pass

    @abstractmethod
    async def astream_generate_with_messages(self, messages: list, **kwargs) -> AsyncGenerator[Dict[str, Any], None]:
        """
        使用消息列表异步流式生成文本

        Args:
            messages: 消息列表，格式为[{'role': 'user'/'assistant', 'content': '...'}]
            **kwargs: 其他参数

        Yields:
            流式生成的结果
        """
        pass
        yield  # pylint: disable=unreachable
    
    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """
        获取模型信息
        
        Returns:
            模型信息
        """
        pass

    @staticmethod
    async def _async_wrap_stream(gen) -> AsyncGenerator[Dict[str, Any], None]:
        """
        将同步生成器包装为异步生成器，
        通过 asyncio.to_thread 在线程池中执行 next() 调用，避免阻塞事件循环。
        """
        while True:
            try:
                chunk = await asyncio.to_thread(next, gen)
                yield chunk
            except StopIteration:
                break
    
    def _validate_config(self) -> bool:
        """
        验证配置
        
        Returns:
            是否验证通过
        """
        if not self.api_key:
            return False
        if not self.endpoint:
            return False
        return True

    def _extract_reasoning_content(self, message_or_delta) -> str:
        """
        从消息或delta中提取思考内容

        不同模型厂商使用不同的字段名来表示思考内容：
        - reasoning_content (通用字段)
        - reasoning (某些厂商)
        - think (某些厂商)
        - thinking_content (某些厂商)

        Args:
            message_or_delta: 消息对象或delta对象

        Returns:
            思考内容字符串，如果没有则返回空字符串
        """
        # 定义可能的思考内容字段名列表
        reasoning_fields = ['reasoning_content', 'reasoning', 'think', 'thinking_content']

        for field in reasoning_fields:
            # 检查对象是否有该属性且值不为空
            if hasattr(message_or_delta, field):
                content = getattr(message_or_delta, field)
                if content:
                    return content

        return ''

    def _handle_extra_body(self, params: dict, kwargs: dict) -> dict:
        """
        处理extra_body参数，兼容不同模型厂商的开关字段

        不同模型厂商使用不同的参数来控制深度思考：
        - Qwen: extra_body.enable_thinking, thinking_budget
        - DeepSeek: 不需要特殊设置，模型自动开启
        - 其他厂商可能有不同的字段名

        Args:
            params: 当前参数字典
            kwargs: 用户传入的参数

        Returns:
            更新后的参数字典
        """
        deep_thinking = kwargs.pop('deep_thinking', True)

        # 根据不同厂商设置不同的深度思考开关
        if self.provider:
            provider_lower = self.provider.lower()

            # Qwen系列模型的深度思考开关
            if provider_lower == 'qwen':
                # extra_body用于传递非标准参数
                if 'extra_body' not in params:
                    params['extra_body'] = {}
                params['extra_body']['enable_thinking'] = bool(deep_thinking)

                # 深度思考打开时添加thinking_budget参数（max_tokens的三分之一）
                if bool(deep_thinking):
                    max_tokens = params.get('max_tokens', 4096)
                    thinking_budget = int(max_tokens / 3)
                    params['extra_body']['thinking_budget'] = thinking_budget

            # DeepSeek模型深度思考开关（如果需要）
            # elif provider_lower == 'deepseek':
            #     # DeepSeek可能需要特定的参数，根据实际情况添加
            #     pass

            # 其他厂商的深度思考开关可以在这里继续添加
            # 例如：
            # elif provider_lower == 'anthropic':
            #     params['extra_body']['thinking'] = bool(deep_thinking)
            else:
                params['extra_body'] = {}
                params['extra_body']['thinking'] = {"type": "disabled" if not bool(deep_thinking) else "enabled"}
                params['extra_body']['reasoning'] = bool(deep_thinking)
        return params