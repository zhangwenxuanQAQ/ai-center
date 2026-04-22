"""
模型工厂

根据模型类型创建对应的模型实例
"""

from typing import Dict, Any
from app.core.llm_model.base import BaseLLM
from app.core.llm_model.text_model import TextModel
from app.core.llm_model.embedding_model import EmbeddingModel
from app.core.llm_model.rerank_model import RerankModel
from app.core.llm_model.vision_model import VisionModel
from app.core.llm_model.tts_model import TTSModel
from app.core.llm_model.audio_model import AudioModel


class LLMFactory:
    """
    模型工厂类
    """
    
    @staticmethod
    def create_model(model_type: str, model_config: Dict[str, Any]) -> BaseLLM:
        """
        创建模型实例
        
        Args:
            model_type: 模型类型，如text、embedding、rerank、vision、voice、multimodal、tts、audio
            model_config: 模型配置
            
        Returns:
            模型实例
        """
        if model_type == 'text':
            return TextModel(model_config)
        elif model_type == 'embedding':
            return EmbeddingModel(model_config)
        elif model_type == 'rerank':
            return RerankModel(model_config)
        elif model_type == 'vision':
            return VisionModel(model_config)
        elif model_type == 'voice' or model_type == 'audio':
            return AudioModel(model_config)
        elif model_type == 'multimodal':
            # 全模态模型使用视觉模型实现，支持图片和音频
            return VisionModel(model_config)
        elif model_type == 'tts':
            return TTSModel(model_config)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")