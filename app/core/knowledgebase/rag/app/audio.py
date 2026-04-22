"""
音频文档切片方法
支持音频文件的语音转文字和内容提取
"""

import os
import re
import tempfile
import logging
import json

from app.database.models import LLMModel
from app.core.llm_model.factory import LLMFactory

logger = logging.getLogger(__name__)

# 支持的音频格式
SUPPORTED_AUDIO_EXTENSIONS = [
    ".da", ".wave", ".wav", ".mp3", ".aac", ".flac", 
    ".ogg", ".aiff", ".au", ".midi", ".wma", ".realaudio", 
    ".vqf", ".oggvorbis", ".ape"
]


def chunk(filename, binary, tenant_id="", lang="Chinese", callback=None, **kwargs):
    """
    音频切片函数
    
    支持多种音频格式，使用ASR模型进行语音转文字
    
    Args:
        filename: 文件名或文件路径
        binary: 文件二进制数据
        tenant_id: 租户ID（用于调用LLM）
        lang: 语言 ("Chinese" 或 "English")
        callback: 进度回调函数 callback(progress, message)
        **kwargs: 其他参数
        
    Returns:
        list: 切片后的文档列表
    """
    from ..nlp import rag_tokenizer, tokenize_doc
    
    doc = {"docnm_kwd": filename}
    doc["title_tks"] = rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename))
    doc["title_sm_tws"] = rag_tokenizer.fine_grained_tokenize(doc["title_tks"])
    
    is_english = lang.lower() == "english"
    callback = callback or (lambda prog, msg: None)
    
    try:
        _, ext = os.path.splitext(filename)
        if not ext:
            raise RuntimeError("未检测到文件扩展名")
        
        ext_lower = ext.lower()
        if ext_lower not in SUPPORTED_AUDIO_EXTENSIONS:
            raise RuntimeError(f"不支持的音频格式: {ext}")
        
        # 创建临时文件
        tmp_path = ""
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmpf:
            tmpf.write(binary)
            tmpf.flush()
            tmp_path = os.path.abspath(tmpf.name)
        
        callback(0.1, "使用Sequence2Txt LLM转录音频...")
        
        # 调用语音转文字模型
        ans = _transcribe_audio(tmp_path, **kwargs)
        callback(0.8, f"转录完成: {ans[:32]}...")
        
        tokenize_doc(doc, ans, is_english)
        return [doc]
        
    except Exception as e:
        logger.error(f"音频处理失败: {e}", exc_info=True)
        callback(-1, str(e))
        return []
    finally:
        # 清理临时文件
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning(f"无法删除临时文件: {tmp_path}, 错误: {e}")


def _get_suitable_model():
    """
    获取合适的音频转录模型
    
    优先级：
    1. 默认音频模型 (is_default=True, model_type='audio')
    2. 最新创建的音频模型 (model_type='audio')
    3. 默认全模态模型 (is_default=True, model_type='multimodal')
    4. 最新创建的全模态模型 (model_type='multimodal')
    
    Returns:
        LLMModel: 合适的模型对象，没有则抛出异常
        
    Raises:
        RuntimeError: 没有找到可用的模型
    """
    # 1. 查找默认音频模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'audio') &
        (LLMModel.is_default == True) &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).first()
    
    if model:
        logger.info(f"使用默认音频模型: %s", model.name)
        return model
    
    # 2. 查找最新创建的音频模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'audio') &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).order_by(LLMModel.created_at.desc()).first()
    
    if model:
        logger.info(f"使用最新音频模型: %s", model.name)
        return model
    
    # 3. 查找默认全模态模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'multimodal') &
        (LLMModel.is_default == True) &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).first()
    
    if model:
        logger.info(f"使用默认全模态模型: %s", model.name)
        return model
    
    # 4. 查找最新创建的全模态模型
    model = LLMModel.select().where(
        (LLMModel.model_type == 'multimodal') &
        (LLMModel.status == True) &
        (LLMModel.deleted == False)
    ).order_by(LLMModel.created_at.desc()).first()
    
    if model:
        logger.info(f"使用最新全模态模型: %s", model.name)
        return model
    
    # 都没有找到，抛出异常
    raise RuntimeError("请在模型库中创建音频模型或全模态模型")


def _transcribe_audio(file_path, **kwargs):
    """
    音频转文字
    
    使用ASR模型将音频转换为文字
    
    Args:
        file_path: 音频文件路径
        **kwargs: 额外参数
        
    Returns:
        str: 转录文本
        
    Raises:
        RuntimeError: 转录失败
    """
    try:
        # 获取合适的模型
        db_model = _get_suitable_model()
        
        # 构建模型配置
        model_config = {
            'api_key': db_model.api_key,
            'endpoint': db_model.endpoint,
            'name': db_model.name,
            'provider': db_model.provider,
            'model_name': db_model.name
        }
        
        # 创建模型实例
        model = LLMFactory.create_model(db_model.model_type, model_config)
        
        # 调用模型进行音频转录
        result = model.generate(file_path, **kwargs)
        
        if 'error' in result:
            raise RuntimeError(f"音频转录失败: %s", result['error'])
        
        # 返回转录文本
        return result.get('text', '')
        
    except Exception as e:
        logger.error(f"音频转录异常: %s", str(e), exc_info=True)
        raise RuntimeError(f"音频转录失败: {str(e)}")


if __name__ == "__main__":
    import sys
    
    def dummy_callback(prog=None, msg=""):
        print(f"[{prog}] {msg}" if prog else msg)
    
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'rb') as f:
            binary = f.read()
        result = chunk(sys.argv[1], binary, callback=dummy_callback)
        print(f"Total chunks: {len(result)}")
