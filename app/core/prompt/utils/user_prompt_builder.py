"""
用户提示词构建工具

处理聊天中上传的文档内容提取和用户提示词构建
"""

import logging
from typing import List, Dict, Any, Optional

from app.services.chat.dto import QueryItem
from app.core.knowledgebase.utils.file_utils import get_mime_type

logger = logging.getLogger(__name__)


def _build_file_content_item(file_name: str, base64_content: str, mime_type: Optional[str] = None) -> Dict[str, Any]:
    """
    构建OpenAI格式的file内容项，使用base64编码

    Args:
        file_name: 文件名
        base64_content: base64编码的文件内容
        mime_type: MIME类型，未提供时根据文件名推断

    Returns:
        Dict: OpenAI格式的file内容项
    """
    if not mime_type:
        mime_type = get_mime_type(file_name)

    return {
        "type": "file",
        "file": {
            "filename": file_name,
            "file_data": f"data:{mime_type};base64,{base64_content}",
        }
    }


def build_user_prompt_with_documents(query: List[QueryItem], original_text: str, chunk_method: str = "naive") -> List[Dict[str, Any]]:
    """
    构建包含文档内容的用户提示词

    上传的文件默认不提取文本内容，直接以base64编码放入用户消息中，
    返回OpenAI多模态消息的content列表。

    本函数会将传入的所有文件（file_base64/document）转换为 file 内容项。
    若调用方需要将部分文件（如图片/音频）以 image_url/input_audio 形式发送，
    应在调用前从 query 中剔除这些文件，并将生成的内容项与本函数结果合并。

    Args:
        query: 查询数组
        original_text: 用户原始文本消息
        chunk_method: 文件切片方法（保留参数以兼容调用方，当前不再使用）

    Returns:
        List[Dict]: OpenAI格式的content列表，包含text和file类型项
    """
    from app.services.chat.file_utils import get_file_from_datasource

    content: List[Dict[str, Any]] = []

    # 文本部分
    text = original_text.strip() if original_text else ""
    if text:
        content.append({
            "type": "text",
            "text": text,
        })

    # 文件部分：直接以base64放入消息，不提取内容
    for item in query:
        if not isinstance(item, QueryItem):
            continue

        if item.type == 'file_base64':
            file_name = item.file_name or "unknown"
            mime_type = item.mime_type
            if not mime_type and file_name:
                mime_type = get_mime_type(file_name)

            base64_content = item.content if isinstance(item.content, str) else ""
            if not base64_content:
                continue

            content.append(_build_file_content_item(file_name, base64_content, mime_type))

        elif item.type == 'document':
            content_dict = item.content if isinstance(item.content, dict) else {}
            file_name = content_dict.get('file_name', 'unknown')

            mime_type = None
            if '.' in file_name:
                mime_type = get_mime_type(file_name)

            file_result = get_file_from_datasource(content_dict)
            if not file_result.get('success'):
                logger.warning(f"从数据源获取文件失败: {file_name}")
                continue

            file_data = file_result.get('data', {})
            base64_content = file_data.get('base64_content', '')
            if not base64_content:
                continue

            content.append(_build_file_content_item(file_name, base64_content, mime_type))

    return content
