"""
切片方法中的模型选择工具

提供统一的模型选择逻辑，供各切片方法使用
"""

import logging

from app.database.models import LLMModel

logger = logging.getLogger(__name__)


def get_suitable_vision_model():
    """
    获取合适的视觉描述模型
    
    优先级：
    1. 默认视觉模型 (is_default=True, model_type='vision')
    2. 最新创建的视觉模型 (model_type='vision')
    3. 支持图片的文本模型 (model_type='text', support_image=True)
    4. 默认全模态模型 (is_default=True, model_type='multimodal')
    5. 最新创建的全模态模型 (model_type='multimodal')
    
    Returns:
        LLMModel: 合适的模型对象，没有则返回None
    """
    # 1. 查找默认视觉模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'vision') &
        (LLMModel.is_default == True) &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).first()
    
    if model:
        logger.info(f"使用默认视觉模型: {model.name}")
        return model
    
    # 2. 查找最新创建的视觉模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'vision') &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).order_by(LLMModel.created_at.desc()).first()
    
    if model:
        logger.info(f"使用最新视觉模型: {model.name}")
        return model
    
    # 3. 查找支持图片的文本模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'text') &
        (LLMModel.support_image == True) &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).order_by(LLMModel.created_at.desc()).first()
    
    if model:
        logger.info(f"使用支持图片的文本模型: {model.name}")
        return model
    
    # 4. 查找默认全模态模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'multimodal') &
        (LLMModel.is_default == True) &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).first()
    
    if model:
        logger.info(f"使用默认全模态模型: {model.name}")
        return model
    
    # 5. 查找最新创建的全模态模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'multimodal') &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).order_by(LLMModel.created_at.desc()).first()
    
    if model:
        logger.info(f"使用最新全模态模型: {model.name}")
        return model
    
    return None


def get_suitable_audio_model():
    """
    获取合适的音频转录模型
    
    优先级：
    1. 默认音频模型 (is_default=True, model_type='audio')
    2. 最新创建的音频模型 (model_type='audio')
    3. 默认全模态模型 (is_default=True, model_type='multimodal')
    4. 最新创建的全模态模型 (model_type='multimodal')
    
    Returns:
        LLMModel: 合适的模型对象，没有则返回None
    """
    # 1. 查找默认音频模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'audio') &
        (LLMModel.is_default == True) &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).first()
    
    if model:
        logger.info(f"使用默认音频模型: {model.name}")
        return model
    
    # 2. 查找最新创建的音频模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'audio') &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).order_by(LLMModel.created_at.desc()).first()
    
    if model:
        logger.info(f"使用最新音频模型: {model.name}")
        return model
    
    # 3. 查找默认全模态模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'multimodal') &
        (LLMModel.is_default == True) &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).first()
    
    if model:
        logger.info(f"使用默认全模态模型: {model.name}")
        return model
    
    # 4. 查找最新创建的全模态模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'multimodal') &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).order_by(LLMModel.created_at.desc()).first()
    
    if model:
        logger.info(f"使用最新全模态模型: {model.name}")
        return model
    
    return None
