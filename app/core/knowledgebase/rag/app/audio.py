"""
音频文档切片方法
支持音频文件的语音转文字和内容提取
"""

import os
import re
import tempfile
import logging

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
    from ..nlp import rag_tokenizer, tokenize
    
    doc = {"docnm_kwd": filename}
    doc["title_tks"] = rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename))
    doc["title_sm_tws"] = rag_tokenizer.fine_grained_tokenize(doc["title_tks"])
    
    is_english = lang.lower() == "english"
    
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
        
        tokenize(doc, ans, is_english)
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


def _transcribe_audio(file_path, **kwargs):
    """
    音频转文字
    
    使用ASR模型将音频转换为文本
    
    Args:
        file_path: 音频文件路径
        **kwargs: 额外参数
        
    Returns:
        str: 转录文本
    """
    # TODO: 集成实际的ASR模型
    # 可选方案：
    # 1. OpenAI Whisper API
    # 2. 本地 Whisper 模型
    # 3. Azure Speech Service
    # 4. 百度/阿里云/腾讯云 ASR API
    
    # 返回占位符文本
    return (
        "[音频转录内容]\n"
        "注意: 请配置语音转文字模型以启用自动转录功能。\n"
        "支持的模型：\n"
        "- OpenAI Whisper\n"
        "- Azure Speech Service\n"
        "- 本地Whisper模型"
    )


if __name__ == "__main__":
    import sys
    
    def dummy_callback(prog=None, msg=""):
        print(f"[{prog}] {msg}" if prog else msg)
    
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'rb') as f:
            binary = f.read()
        result = chunk(sys.argv[1], binary, callback=dummy_callback)
        print(f"Total chunks: {len(result)}")
