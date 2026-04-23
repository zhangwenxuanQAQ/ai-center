"""
图片/视频文档切片方法
支持图片OCR识别和视频内容理解
"""

import io
import re
import base64
import logging

try:
    import numpy as np
except ImportError:
    np = None

try:
    from PIL import Image
except ImportError:
    Image = None

from app.core.llm_model.factory import LLMFactory
from ..utils.model_selector import get_suitable_vision_model, get_suitable_audio_model

logger = logging.getLogger(__name__)

VIDEO_EXTS = [".mp4", ".mov", ".avi", ".flv", ".mpeg", ".mpg", ".webm", ".wmv", ".3gp", ".3gpp", ".mkv"]

_ocr_instance = None


def get_ocr():
    """获取OCR实例（懒加载）"""
    global _ocr_instance
    if _ocr_instance is None:
        try:
            from app.core.knowledgebase.deepdoc.vision.ocr import OCR
            _ocr_instance = OCR()
        except ImportError:
            logger.warning("OCR模块不可用，将使用简单的文本提取")
            _ocr_instance = None
    return _ocr_instance


def chunk(filename, binary, tenant_id="", lang="Chinese", callback=None, **kwargs):
    """
    图片/视频切片函数
    
    支持图片OCR识别和视频内容理解
    
    Args:
        filename: 文件名或文件路径
        binary: 文件二进制数据
        tenant_id: 租户ID（用于调用LLM）
        lang: 语言（"Chinese"或"English"）
        callback: 进度回调函数 callback(progress, message)
        **kwargs: 其他参数，包括：
            - image_context_size: 图片上下文大小
            
    Returns:
        list: 切片后的文档列表
    """
    from ..nlp import rag_tokenizer, tokenize_doc
    
    doc = {
        "docnm_kwd": filename,
        "title_tks": rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename)),
    }
    eng = lang.lower() == "english"
    
    parser_config = kwargs.get("parser_config", {}) or {}
    image_ctx = max(0, int(parser_config.get("image_context_size", 0) or 0))
    
    if any(filename.lower().endswith(ext) for ext in VIDEO_EXTS):
        return _process_video(filename, binary, tenant_id, lang, doc, eng, callback, **kwargs)
    else:
        return _process_image(filename, binary, tenant_id, lang, doc, eng, image_ctx, callback, **kwargs)


def _process_image(filename, binary, tenant_id, lang, doc, eng, image_ctx, callback, **kwargs):
    """处理图片文件"""
    from ..nlp import tokenize_doc
    callback = callback or (lambda prog, msg: None)
    
    if Image is None:
        raise ImportError("请安装Pillow: pip install Pillow")
    
    try:
        img = Image.open(io.BytesIO(binary)).convert("RGB")
    except Exception as e:
        logger.error(f"无法打开图片: {e}")
        callback(-1, f"无法打开图片: {e}")
        return []
    
    doc.update({
        "image": img,
        "doc_type_kwd": "image",
    })
    
    ocr = get_ocr()
    txt = ""
    
    if ocr and np is not None:
        try:
            bxs = ocr(np.array(img))
            txt = "\n".join([t[0] for _, t in bxs if t[0]])
            callback(0.4, f"OCR完成: {txt[:32]}...")
        except Exception as e:
            logger.warning(f"OCR识别失败: {e}")
            txt = ""
    else:
        try:
            if hasattr(img, 'text'):
                txt = getattr(img, 'text', '')
        except:
            txt = ""
    
    if txt and ((eng and len(txt.split()) > 32) or len(txt) > 32):
        tokenize_doc(doc, txt, eng)
        callback(0.8, "OCR结果较长，跳过VLM增强")
        return attach_media_context([doc], 0, image_ctx)
    
    try:
        callback(0.4, "使用CV LLM描述图片")
        ans = _describe_with_vision_model(img, **kwargs)
        callback(0.8, f"CV LLM响应: {ans[:32]}...")
        txt += "\n" + ans
        tokenize_doc(doc, txt, eng)
        return attach_media_context([doc], 0, image_ctx)
    except Exception as e:
        logger.warning(f"视觉LLM描述失败: {e}")
        if txt:
            tokenize_doc(doc, txt, eng)
            return attach_media_context([doc], 0, image_ctx)
        callback(-1, str(e))
        return []


def _process_video(filename, binary, tenant_id, lang, doc, eng, callback, **kwargs):
    """处理视频文件"""
    from ..nlp import tokenize_doc
    callback = callback or (lambda prog, msg: None)
    
    doc.update({
        "doc_type_kwd": "video",
    })
    
    try:
        ans = _transcribe_audio(binary, **kwargs)
        callback(0.8, f"Sequence2Txt LLM响应: {ans[:32]}...")
        ans += "\n" + ans
        
        tokenize_doc(doc, ans, eng)
        return [doc]
        
    except Exception as e:
        logger.error(f"视频转录失败: {e}")
        callback(-1, str(e))
        return []


def _describe_with_vision_model(image, **kwargs):
    """
    使用视觉语言模型描述图片
    
    自动选择合适的视觉模型进行图片描述
    
    Args:
        image: PIL Image对象
        **kwargs: 额外参数
        
    Returns:
        str: 图片描述文本
        
    Raises:
        RuntimeError: 没有找到可用的视觉模型
    """
    db_model = get_suitable_vision_model()
    
    if not db_model:
        width, height = image.size if hasattr(image, 'size') else (0, 0)
        return (
            f"[图片描述]\n"
            f"尺寸: {width}x{height}\n"
            f"模式: {image.mode if hasattr(image, 'mode') else 'unknown'}\n"
            f"注意: 未找到可用的视觉模型，请在模型库中创建视觉模型、支持图片的文本模型或全模态模型"
        )
    
    model_config = {
        'api_key': db_model.api_key,
        'endpoint': db_model.endpoint,
        'name': db_model.name,
        'provider': db_model.provider,
        'model_name': db_model.name
    }
    
    model = LLMFactory.create_model(db_model.model_type, model_config)
    
    with io.BytesIO() as img_binary:
        try:
            image.save(img_binary, format="JPEG")
        except Exception:
            img_binary.seek(0)
            img_binary.truncate()
            image.save(img_binary, format="PNG")
        
        img_binary.seek(0)
        img_data = img_binary.read()
        img_base64 = base64.b64encode(img_data).decode('utf-8')
        img_data_uri = f"data:image/jpeg;base64,{img_base64}"
    
    prompt = "请详细描述这张图片的内容。"
    
    # 过滤掉不应该传递给模型的参数，只保留模型支持的参数
    allowed_params = {'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
                      'presence_penalty', 'deep_thinking', 'tools', 'stream'}
    model_kwargs = {k: v for k, v in kwargs.items() if k in allowed_params}
    
    result = model.generate(prompt, image_url=img_data_uri, **model_kwargs)
    
    if 'error' in result:
        raise RuntimeError(f"视觉模型描述失败: {result['error']}")
    
    return result.get('text', '')


def _transcribe_audio(binary, **kwargs):
    """
    音频/视频转录
    
    自动选择合适的音频模型进行语音转录
    
    Args:
        binary: 音频/视频二进制数据
        **kwargs: 额外参数
        
    Returns:
        str: 转录文本
        
    Raises:
        RuntimeError: 没有找到可用的音频模型
    """
    import tempfile
    import os
    from app.core.knowledgebase.utils.file_utils import convert_to_wav, cleanup_temp_files
    
    db_model = get_suitable_audio_model()
    
    if not db_model:
        return "[视频/音频内容]\n注意: 未找到可用的音频模型，请在模型库中创建音频模型或全模态模型"
    
    model_config = {
        'api_key': db_model.api_key,
        'endpoint': db_model.endpoint,
        'name': db_model.name,
        'provider': db_model.provider,
        'model_name': db_model.name
    }
    
    model = LLMFactory.create_model(db_model.model_type, model_config)
    
    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmpf:
            tmpf.write(binary)
            tmpf.flush()
            tmp_path = os.path.abspath(tmpf.name)
        
        # 过滤掉不应该传递给模型的参数，只保留模型支持的参数
        allowed_params = {'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
                          'presence_penalty', 'deep_thinking', 'tools', 'stream'}
        model_kwargs = {k: v for k, v in kwargs.items() if k in allowed_params}
        
        result = model.generate(tmp_path, **model_kwargs)
        
        if 'error' in result:
            raise RuntimeError(f"音频转录失败: {result['error']}")
        
        return result.get('text', '')
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def vision_llm_chunk(binary, vision_model=None, prompt=None, callback=None):
    """
    通过视觉语言模型处理图片
    
    Args:
        binary: 图片数据或PIL Image对象
        vision_model: 视觉模型实例
        prompt: 自定义提示词
        callback: 进度回调
        
    Returns:
        str: Markdown格式的描述文本
    """
    callback = callback or (lambda prog, msg: None)
    
    img = binary
    txt = ""
    
    try:
        if hasattr(img, "size"):
            min_side = 11
            if img.size[0] < min_side or img.size[1] < min_side:
                callback(0.0, f"跳过过小的图片: {img.size[0]}x{img.size[1]}")
                return ""
        
        with io.BytesIO() as img_binary:
            try:
                img.save(img_binary, format="JPEG")
            except Exception:
                img_binary.seek(0)
                img_binary.truncate()
                img.save(img_binary, format="PNG")
            
            img_binary.seek(0)
            
            if vision_model:
                ans = vision_model.describe_with_prompt(img_binary.read(), prompt)
            else:
                ans = _describe_with_vision_model(Image.open(img_binary) if Image else None)
            
            if ans.startswith("```"):
                lines = ans.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                ans = "\n".join(lines)
            
            txt += "\n" + ans
            return txt
            
    except Exception as e:
        callback(-1, str(e))
        return ""


def attach_media_context(docs, start, image_ctx):
    """
    为媒体文档添加上下文信息
    
    Args:
        docs: 文档列表
        start: 起始位置
        image_ctx: 图片上下文大小
        
    Returns:
        list: 处理后的文档列表
    """
    return docs


if __name__ == "__main__":
    import sys
    
    def dummy_callback(prog=None, msg=""):
        print(f"[{prog}] {msg}" if prog else msg)
    
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'rb') as f:
            binary = f.read()
        result = chunk(sys.argv[1], binary, callback=dummy_callback)
        print(f"Total chunks: {len(result)}")
