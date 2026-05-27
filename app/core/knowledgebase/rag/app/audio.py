"""
音频文档切片方法
支持音频文件的语音转文字和内容提取
"""

import os
import re
import tempfile
import logging
import json

from app.core.llm_model.factory import LLMFactory
from ..utils.model_selector import get_suitable_audio_model

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


def chunk_streamly(filename, binary, tenant_id="", lang="Chinese", callback=None, **kwargs):
    """
    音频切片流式函数
    
    支持多种音频格式，使用ASR模型进行语音转文字，流式返回结果
    
    Args:
        filename: 文件名或文件路径
        binary: 文件二进制数据
        tenant_id: 租户ID（用于调用LLM）
        lang: 语言 ("Chinese" 或 "English")
        callback: 进度回调函数 callback(progress, message)
        **kwargs: 其他参数
        
    Yields:
        dict: 切片后的文档或进度信息
    """
    from ..nlp import rag_tokenizer, tokenize_doc
    
    doc = {"docnm_kwd": filename}
    doc["title_tks"] = rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename))
    doc["title_sm_tws"] = rag_tokenizer.fine_grained_tokenize(doc["title_tks"])
    
    is_english = lang.lower() == "english"
    callback = callback or (lambda prog, msg: None)
    
    tmp_path = ""
    try:
        _, ext = os.path.splitext(filename)
        if not ext:
            raise RuntimeError("未检测到文件扩展名")
        
        ext_lower = ext.lower()
        if ext_lower not in SUPPORTED_AUDIO_EXTENSIONS:
            raise RuntimeError(f"不支持的音频格式: {ext}")
        
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmpf:
            tmpf.write(binary)
            tmpf.flush()
            tmp_path = os.path.abspath(tmpf.name)
        
        callback(0.1, "使用Sequence2Txt LLM转录音频...")
        
        txt = ""
        for chunk in _transcribe_audio_stream(tmp_path, **kwargs):
            if isinstance(chunk, dict) and chunk.get("type") == "content":
                txt += chunk.get("content", "")
                yield {"type": "content", "content": chunk.get("content", "")}
            elif isinstance(chunk, str):
                txt += chunk
                yield {"type": "content", "content": chunk}
        
        callback(0.8, f"转录完成: {txt[:32]}...")
        
        tokenize_doc(doc, txt, is_english)
        yield {"type": "doc", "doc": doc}
        
    except Exception as e:
        logger.error(f"音频处理失败: {e}", exc_info=True)
        callback(-1, str(e))
        yield {"type": "error", "message": str(e)}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning(f"无法删除临时文件: {tmp_path}, 错误: {e}")


def _transcribe_audio(file_path, **kwargs):
    """
    音频转文字
    
    使用ASR模型将音频转换为文字
    
    Args:
        file_path: 音频文件路径
        **kwargs: 额外参数，包括 llm_id
        
    Returns:
        str: 转录文本
        
    Raises:
        RuntimeError: 转录失败
    """
    try:
        llm_id = kwargs.get('llm_id')
        db_model = get_suitable_audio_model(llm_id)
        
        if not db_model:
            raise RuntimeError("请在模型库中创建音频模型或全模态模型")
        
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
        
        # 过滤掉不应该传递给模型的参数，只保留模型支持的参数
        allowed_params = {'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
                          'presence_penalty', 'deep_thinking', 'tools', 'stream'}
        model_kwargs = {k: v for k, v in kwargs.items() if k in allowed_params}
        
        # 调用模型进行音频转录
        result = model.generate(file_path, **model_kwargs)
        
        if 'error' in result:
            raise RuntimeError(f"音频转录失败: %s", result['error'])
        
        # 返回转录文本
        return result.get('text', '')
        
    except Exception as e:
        logger.error(f"音频转录异常: %s", str(e), exc_info=True)
        raise RuntimeError(f"音频转录失败: {str(e)}")


def _transcribe_audio_stream(file_path, **kwargs):
    """
    音频转文字（流式）
    
    使用ASR模型将音频转换为文字，流式返回结果
    
    Args:
        file_path: 音频文件路径
        **kwargs: 额外参数，包括 llm_id
        
    Yields:
        str: 转录文本片段
        
    Raises:
        RuntimeError: 转录失败
    """
    try:
        llm_id = kwargs.get('llm_id')
        db_model = get_suitable_audio_model(llm_id)
        
        if not db_model:
            raise RuntimeError("请在模型库中创建音频模型或全模态模型")
        
        model_config = {
            'api_key': db_model.api_key,
            'endpoint': db_model.endpoint,
            'name': db_model.name,
            'provider': db_model.provider,
            'model_name': db_model.name
        }
        
        model = LLMFactory.create_model(db_model.model_type, model_config)
        
        allowed_params = {'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
                          'presence_penalty', 'deep_thinking', 'tools'}
        model_kwargs = {k: v for k, v in kwargs.items() if k in allowed_params}
        
        for chunk in model.stream_generate(file_path, **model_kwargs):
            if 'error' in chunk:
                raise RuntimeError(f"音频转录失败: {chunk['error']}")
            yield chunk.get('text', '')
        
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
