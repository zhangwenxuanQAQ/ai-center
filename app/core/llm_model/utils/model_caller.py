"""
模型调用工具类

提供统一的模型调用接口
"""

from typing import Dict, Any, Optional, Generator
import json
from app.database.models import LLMModel
from app.core.llm_model.factory import LLMFactory
from app.core.exceptions import ResourceNotFoundError
import logging


class ChatModelWrapper:
    """
    聊天模型包装类
    
    提供与 LLMBundle 兼容的接口
    """
    
    def __init__(self, model_instance: Any, model_config: Dict[str, Any]):
        """
        初始化聊天模型包装类
        
        Args:
            model_instance: 模型实例
            model_config: 模型配置
        """
        self.model = model_instance
        self.max_length = model_config.get('max_length', 8191)
        self.model_name = model_config.get('name', '')
        self._tool_session = None
        self._tools = None
    
    def bind_tools(self, tool_session, tools):
        """
        绑定工具
        
        Args:
            tool_session: 工具会话
            tools: 工具列表
        """
        self._tool_session = tool_session
        self._tools = tools
    
    def chat(self, sys_msg: str, hist: list, conf: dict = None) -> str:
        """
        聊天（非流式）
        
        Args:
            sys_msg: 系统消息
            hist: 历史消息列表
            conf: 配置参数
            
        Returns:
            回复内容
        """
        messages = [{'role': 'system', 'content': sys_msg}] + hist
        
        kwargs = {}
        if conf:
            kwargs.update(conf)
        
        if self._tools:
            kwargs['tools'] = self._tools
        
        result = self.model.generate(messages, **kwargs)
        
        if 'error' in result:
            raise Exception(result['error'])
        
        return result.get('content', '')
    
    def chat_streamly(self, sys_msg: str, hist: list, conf: dict = None) -> Generator[str, None, None]:
        """
        聊天（流式）
        
        Args:
            sys_msg: 系统消息
            hist: 历史消息列表
            conf: 配置参数
            
        Yields:
            回复内容片段
        """
        messages = [{'role': 'system', 'content': sys_msg}] + hist
        
        kwargs = {}
        if conf:
            kwargs.update(conf)
        
        if self._tools:
            kwargs['tools'] = self._tools
        
        for chunk in self.model.generate_stream(messages, **kwargs):
            if 'error' in chunk:
                raise Exception(chunk['error'])
            yield chunk.get('content', '')


class ModelCaller:
    """
    模型调用工具类
    
    提供通过模型ID获取模型实例并调用的方法
    """
    
    @staticmethod
    def get_chat_model(llm_id: str) -> ChatModelWrapper:
        """
        通过模型ID获取聊天模型实例
        
        Args:
            llm_id: 模型ID
            
        Returns:
            ChatModelWrapper: 聊天模型包装实例
            
        Raises:
            ResourceNotFoundError: 模型不存在
        """
        try:
            llm_model = LLMModel.get_by_id(llm_id)
            if llm_model.deleted or not llm_model.status:
                raise ResourceNotFoundError(message=f"模型 {llm_id} 不存在或已禁用")
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(message=f"模型 {llm_id} 不存在")
        
        model_config = {
            'api_key': llm_model.api_key,
            'endpoint': llm_model.endpoint,
            'name': llm_model.name,
            'provider': llm_model.provider,
        }
        
        if llm_model.config:
            try:
                config_data = json.loads(llm_model.config)
                model_config.update(config_data)
            except Exception as e:
                logging.warning(f"解析模型配置失败: {str(e)}")
        
        model_instance = LLMFactory.create_model(llm_model.model_type, model_config)
        
        return ChatModelWrapper(model_instance, model_config)
    
    @staticmethod
    def get_model_by_id(llm_id: str) -> Any:
        """
        通过模型ID获取模型实例
        
        Args:
            llm_id: 模型ID
            
        Returns:
            模型实例
            
        Raises:
            ResourceNotFoundError: 模型不存在
        """
        try:
            llm_model = LLMModel.get_by_id(llm_id)
            if llm_model.deleted or not llm_model.status:
                raise ResourceNotFoundError(message=f"模型 {llm_id} 不存在或已禁用")
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(message=f"模型 {llm_id} 不存在")
        
        model_config = {
            'api_key': llm_model.api_key,
            'endpoint': llm_model.endpoint,
            'name': llm_model.name,
            'provider': llm_model.provider,
        }
        
        if llm_model.config:
            try:
                config_data = json.loads(llm_model.config)
                model_config.update(config_data)
            except Exception as e:
                logging.warning(f"解析模型配置失败: {str(e)}")
        
        return LLMFactory.create_model(llm_model.model_type, model_config)
