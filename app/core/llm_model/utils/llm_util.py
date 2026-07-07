"""
模型通用工具类
"""

import re
from typing import Optional, Dict, Any, List, Tuple
from jinja2 import Environment


def get_output_json_content(response: str) -> str:
    """
    提取模型输出中的json内容
    
    Args:
        response: 模型回复字符串
        
    Returns:
        如果匹配到json块则返回去除前后空白的json字符串，否则返回原始输出
    """
    pattern = r"```json(.*?)```"
    match = re.search(pattern, response, re.DOTALL)
    if match:
        return match.group(1).strip()
    return response


def get_output_tag_content(response: str, tag_name: str) -> str:
    """
    提取模型输出中指定标签内容
    
    Args:
        response: 模型回复字符串
        tag_name: 标签名称
        
    Returns:
        如果匹配到标签内容则返回标签内的内容，否则返回原始输出
    """
    pattern = rf"<{tag_name}>(.*?)</{tag_name}>"
    match = re.search(pattern, response, re.DOTALL)
    if match:
        return match.group(1).strip()
    return response


def get_stream_output_tag_content(response: str, tag_name: str) -> str:
    """
    提取模型流式输出中指定标签内容
    
    Args:
        response: 本次流式输出字符串
        tag_name: 标签名称
        
    Returns:
        标签中的内容
    """
    start_tag = f"<{tag_name}>"
    end_tag = f"</{tag_name}>"
    
    start_idx = response.find(start_tag)
    if start_idx == -1:
        return ""
    
    content_start = start_idx + len(start_tag)
    end_idx = response.find(end_tag, content_start)
    
    if end_idx == -1:
        return response[content_start:]
    
    return response[content_start:end_idx]


def format_prompt(prompt: str, params: dict) -> str:
    """
    格式化提示词
    
    使用jinja2的render方法替换参数字典中的参数
    
    Args:
        prompt: 提示字符串，参数占位符为"{{参数名}}"
        params: 需要替换的参数字典
        
    Returns:
        格式化后的提示字符串
    """
    env = Environment()
    template = env.from_string(prompt)
    return template.render(params)


def model_supports_images(model_type: str, model_id: Optional[str] = None) -> bool:
    """
    判断模型是否支持处理图片
    
    Args:
        model_type: 模型类型
        model_id: 模型ID，用于查询数据库中的support_image字段
        
    Returns:
        bool: 是否支持图片
    """
    if model_type in ('vision', 'multimodal'):
        return True
    elif model_type == 'text' and model_id:
        try:
            from app.database.models import LLMModel
            model = LLMModel.get(
                (LLMModel.id == model_id) &
                (LLMModel.deleted == False)
            )
            return model.support_image if hasattr(model, 'support_image') else False
        except LLMModel.DoesNotExist:
            return False
    return False


def model_supports_audio(model_type: str) -> bool:
    """
    判断模型是否支持处理音频
    
    Args:
        model_type: 模型类型
        
    Returns:
        bool: 是否支持音频
    """
    return model_type in ('audio', 'multimodal')


def convert_query_to_message(query: List[Any], model_type: Optional[str] = None, model_id: Optional[str] = None, chunk_method: str = "naive") -> Dict[str, Any]:
    """
    将query数组转换为OpenAI格式的用户消息
    
    Args:
        query: 查询数组
        model_type: 模型类型，用于判断如何处理文件
        model_id: 模型ID，用于查询数据库中的support_image字段
        chunk_method: 文件切片方法，默认naive
        
    Returns:
        Dict: OpenAI格式的用户消息
    """
    import os
    from app.services.chat.dto import QueryItem
    from app.constants.knowledgebase_document_constants import FileType
    from app.core.knowledgebase.utils.file_utils import filename_type, convert_base64_audio_to_wav, get_mime_type
    from app.services.chat.file_utils import get_file_from_datasource
    from app.core.prompt.utils.user_prompt_builder import build_user_prompt_with_documents
    
    processed_query = []
    for item in query:
        if isinstance(item, QueryItem) and item.type == 'document':
            content_dict = item.content if isinstance(item.content, dict) else {}
            file_result = get_file_from_datasource(content_dict)
            
            if file_result.get('success'):
                file_data = file_result.get('data', {})
                base64_content = file_data.get('base64_content', '')
                file_name = content_dict.get('file_name')
                
                if file_name and filename_type(file_name) == FileType.AURAL:
                    wav_base64, error_msg = convert_base64_audio_to_wav(base64_content, file_name)
                    if wav_base64:
                        base64_content = wav_base64
                        name_without_ext = os.path.splitext(file_name)[0]
                        file_name = f"{name_without_ext}.wav"
                
                processed_query.append(QueryItem(
                    type='file_base64',
                    content=base64_content,
                    mime_type=file_data.get('mime_type'),
                    file_name=file_name,
                    file_size=content_dict.get('file_size') or file_data.get('file_size')
                ))
        elif isinstance(item, QueryItem) and item.type == 'file_base64':
            base64_content = item.content
            file_name = item.file_name
            mime_type = item.mime_type
            
            if not mime_type and file_name:
                mime_type = get_mime_type(file_name)
            
            if file_name and filename_type(file_name) == FileType.AURAL:
                wav_base64, error_msg = convert_base64_audio_to_wav(base64_content, file_name)
                if wav_base64:
                    base64_content = wav_base64
                    name_without_ext = os.path.splitext(file_name)[0]
                    file_name = f"{name_without_ext}.wav"
                    mime_type = 'audio/wav'
            
            processed_query.append(QueryItem(
                type='file_base64',
                content=base64_content,
                mime_type=mime_type,
                file_name=file_name,
                file_size=item.file_size
            ))
        else:
            processed_query.append(item)
    
    supports_images = model_supports_images(model_type, model_id) if model_type else False
    supports_audio = model_supports_audio(model_type) if model_type else False
    
    has_direct_image = supports_images and any(
        isinstance(item, QueryItem) and item.type == 'file_base64' and item.mime_type and item.mime_type.startswith('image/') 
        for item in processed_query
    )
    has_direct_audio = supports_audio and any(
        isinstance(item, QueryItem) and item.type == 'file_base64' and item.file_name and filename_type(item.file_name) == FileType.AURAL 
        for item in processed_query
    )
    
    if has_direct_image or has_direct_audio:
        content = []
        for item in processed_query:
            if isinstance(item, QueryItem) and item.type == 'text':
                content.append({
                    'type': 'text',
                    'text': item.content
                })
            elif isinstance(item, QueryItem) and item.type == 'file_base64' and item.mime_type and item.mime_type.startswith('image/'):
                if supports_images:
                    content.append({
                        'type': 'image_url',
                        'image_url': {
                            'url': f'data:{item.mime_type};base64,{item.content}'
                        }
                    })
            elif isinstance(item, QueryItem) and item.type == 'file_base64' and item.file_name and filename_type(item.file_name) == FileType.AURAL:
                if supports_audio:
                    content.append({
                        'type': 'input_audio',
                        'input_audio': {
                            'data': item.content,
                            'format': 'wav'
                        }
                    })
        
        has_other_files = any(
            isinstance(item, QueryItem) and item.type == 'file_base64' and item.file_name and 
            filename_type(item.file_name) not in (FileType.VISUAL, FileType.AURAL)
            for item in processed_query
        )
        
        has_unsupported_image = not supports_images and any(
            isinstance(item, QueryItem) and item.type == 'file_base64' and item.mime_type and item.mime_type.startswith('image/') 
            for item in processed_query
        )
        has_unsupported_audio = not supports_audio and any(
            isinstance(item, QueryItem) and item.type == 'file_base64' and item.file_name and filename_type(item.file_name) == FileType.AURAL 
            for item in processed_query
        )
        
        if has_other_files or has_unsupported_image or has_unsupported_audio:
            original_text = ' '.join(item.content for item in processed_query if isinstance(item, QueryItem) and item.type == 'text')
            document_text = build_user_prompt_with_documents(processed_query, original_text, chunk_method)
            return {
                'role': 'user',
                'content': document_text
            }
        else:
            return {
                'role': 'user',
                'content': content
            }
    else:
        original_text = ' '.join(item.content for item in processed_query if isinstance(item, QueryItem) and item.type == 'text')
        document_text = build_user_prompt_with_documents(processed_query, original_text, chunk_method)
        return {
            'role': 'user',
            'content': document_text
        }