"""
用户提示词构建工具

处理聊天中上传的文档内容提取和用户提示词构建
"""

import base64
import logging
import re
from typing import List, Dict, Any, Optional

from app.services.chat.dto import QueryItem
from app.core.knowledgebase.rag.app import CHUNK_STRATEGIES
from app.core.knowledgebase.utils.file_utils import filename_type, get_chunk_method_by_file_type
from app.constants.knowledgebase_document_constants import FileType

logger = logging.getLogger(__name__)

def _needs_text_extraction(mime_type: Optional[str], file_name: Optional[str]) -> bool:
    """
    判断文件是否需要文本提取
    
    图片和音频文件不需要文本提取，其他文件需要
    
    Args:
        mime_type: MIME类型
        file_name: 文件名
        
    Returns:
        bool: 是否需要文本提取
    """
    if not file_name:
        return True
    
    file_type = filename_type(file_name)
    if file_type in (FileType.VISUAL, FileType.AURAL):
        return False
    return True


def extract_text_from_file(file_name: str, base64_content: str, chunk_method: str = "naive") -> Optional[str]:
    """
    从文件中提取文本内容，使用RAG切片方法

    Args:
        file_name: 文件名
        base64_content: base64编码的文件内容
        chunk_method: 切片方法，默认为naive

    Returns:
        str: 提取的文本内容，不同chunk之间用换行符隔开；提取失败返回None
    """
    try:
        binary = base64.b64decode(base64_content)
    except Exception as e:
        logger.error(f"base64解码失败: {file_name}, error: {e}")
        return None

    chunk_func = CHUNK_STRATEGIES.get(chunk_method)
    if not chunk_func:
        logger.error(f"不支持的切片策略: {chunk_method}")
        return None

    try:
        chunks = chunk_func(
            filename=file_name,
            binary=binary,
            from_page=0,
            to_page=100000,
            lang="Chinese",
        )
        logger.info(f"文件切片结果: {file_name}, chunks数量: {len(chunks) if chunks else 0}")
        if chunks and len(chunks) > 0:
            logger.info(f"第一个chunk的keys: {chunks[0].keys() if isinstance(chunks[0], dict) else type(chunks[0])}")
    except Exception as e:
        logger.error(f"文件切片失败: {file_name}, method: {chunk_method}, error: {e}")
        import traceback
        traceback.print_exc()
        return None

    if not chunks:
        logger.warning(f"文件切片结果为空: {file_name}")
        return None

    text_parts = []
    for i, chunk in enumerate(chunks):
        content = chunk.get("content_with_weight", "")
        logger.info(f"chunk {i}: content_with_weight长度: {len(content) if content else 0}")
        if content and content.strip():
            text_parts.append(content.strip())

    result = "\n".join(text_parts) if text_parts else None
    logger.info(f"最终提取的文本长度: {len(result) if result else 0}")
    return result


def get_chunk_method_for_file(file_name: str) -> str:
    """
    根据文件类型获取切片方法

    Args:
        file_name: 文件名

    Returns:
        str: 切片方法名称
    """
    file_type = filename_type(file_name)
    return get_chunk_method_by_file_type(file_type, file_name)


def build_file_content_text(file_name: str, file_size: Optional[int], extracted_text: str, index: int = 1) -> str:
    """
    构建文件内容文本，按照指定格式

    Args:
        file_name: 文件名
        file_size: 文件大小（字节）
        extracted_text: 提取的文本内容
        index: 文件索引，用于多个文件时区分

    Returns:
        str: 格式化后的文件内容文本
    """
    if index == 1:
        name_label = "文件名"
        size_label = "文件大小"
        content_label = "文件内容"
    else:
        name_label = f"文件名{index}"
        size_label = f"文件{index}大小"
        content_label = f"文件{index}内容"
    
    parts = [f"【{name_label}】：{file_name}"]
    if file_size is not None:
        parts.append(f"【{size_label}】：{file_size}（字节）")
    parts.append(f"【{content_label}】：{extracted_text}")
    return "\n".join(parts)


def build_user_prompt_with_documents(query: List[QueryItem], original_text: str) -> str:
    """
    构建包含文档内容的用户提示词

    当聊天上传的文档不是图片或音频时，提取文档内容文本，
    拼接到用户提示词中作为模型的输入。

    Args:
        query: 查询数组
        original_text: 用户原始文本消息

    Returns:
        str: 构建后的用户提示词
    """
    from app.services.chat.file_utils import get_file_from_datasource

    document_texts = []
    file_index = 1

    for item in query:
        if item.type == 'file_base64':
            if not _needs_text_extraction(item.mime_type, item.file_name):
                continue

            file_name = item.file_name or "unknown"
            file_size = item.file_size
            base64_content = item.content if isinstance(item.content, str) else ""

            if not base64_content:
                continue

            chunk_method = get_chunk_method_for_file(file_name)
            extracted_text = extract_text_from_file(file_name, base64_content, chunk_method)

            if extracted_text:
                file_text = build_file_content_text(file_name, file_size, extracted_text, file_index)
                # 每个文件内容用 ``` 包裹
                document_texts.append(f"```\n{file_text}\n```")
                file_index += 1
            else:
                logger.warning(f"文件内容提取为空: {file_name}")

        elif item.type == 'document':
            content_dict = item.content if isinstance(item.content, dict) else {}
            file_name = content_dict.get('file_name', 'unknown')

            mime_type = None
            if '.' in file_name:
                import mimetypes
                mime_type, _ = mimetypes.guess_type(file_name)

            if not _needs_text_extraction(mime_type, file_name):
                continue

            file_result = get_file_from_datasource(content_dict)
            if not file_result.get('success'):
                logger.warning(f"从数据源获取文件失败: {file_name}")
                continue

            file_data = file_result.get('data', {})
            base64_content = file_data.get('base64_content', '')
            file_size = content_dict.get('file_size') or file_data.get('file_size')

            if not base64_content:
                continue

            chunk_method = get_chunk_method_for_file(file_name)
            extracted_text = extract_text_from_file(file_name, base64_content, chunk_method)

            if extracted_text:
                file_text = build_file_content_text(file_name, file_size, extracted_text, file_index)
                # 每个文件内容用 ``` 包裹
                document_texts.append(f"```\n{file_text}\n```")
                file_index += 1
            else:
                logger.warning(f"文件内容提取为空: {file_name}")

    if not document_texts:
        return original_text

    # 构建完整的文件部分
    file_section = "上传的文件信息如下：\n\n" + "\n\n".join(document_texts)

    if original_text.strip():
        return f"{file_section}\n\n{original_text.strip()}"
    else:
        return file_section
