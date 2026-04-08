"""
工具类模块
提供文件处理、ES连接等工具函数
"""

import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def extract_embed_file(binary: bytes) -> list:
    """
    从二进制数据中提取嵌入文件
    
    Args:
        binary: 文件二进制数据
        
    Returns:
        list: 嵌入文件列表 [(filename, bytes), ...]
    """
    embeds = []
    
    try:
        if binary.startswith(b'PK'):
            # ZIP/DOCX/PPTX格式
            try:
                from zipfile import ZipFile
                from io import BytesIO
                
                with ZipFile(BytesIO(binary)) as zf:
                    for name in zf.namelist():
                        if name.lower().endswith(('.pdf', '.docx', '.xlsx', '.txt', '.md')):
                            try:
                                embed_data = zf.read(name)
                                embeds.append((name, embed_data))
                            except Exception as e:
                                logger.warning(f"Failed to extract {name}: {e}")
            except Exception as e:
                logger.warning(f"Failed to extract embedded files: {e}")
                
    except Exception as e:
        logger.error(f"Error in extract_embed_file: {e}")
        
    return embeds


def extract_links_from_pdf(binary: bytes) -> set:
    """
    从PDF中提取链接
    
    Args:
        binary: PDF二进制数据
        
    Returns:
        set: 链接集合
    """
    urls = set()
    
    try:
        import PyPDF2
        from io import BytesIO
        
        pdf_reader = PyPDF2.PdfReader(BytesIO(binary))
        
        for page in pdf_reader.pages:
            if '/Annots' in page:
                for annot in page['/Annots']:
                    annot_obj = annot.get_object()
                    if annot_obj.get('/Subtype') == '/Link':
                        if '/A' in annot_obj:
                            action = annot_obj['/A']
                            if '/URI' in action:
                                urls.add(action['/URI'])
                                
    except ImportError:
        logger.warning("PyPDF2 not installed, cannot extract links from PDF")
    except Exception as e:
        logger.error(f"Error extracting links from PDF: {e}")
        
    return urls


def extract_links_from_docx(binary: bytes) -> list:
    """
    从DOCX中提取链接
    
    Args:
        binary: DOCX二进制数据
        
    Returns:
        list: 链接列表
    """
    urls = []
    
    try:
        from docx import Document
        from io import BytesIO
        
        doc = Document(BytesIO(binary))
        
        for rel in doc.part.rels.values():
            if "hyperlink" in rel.reltype:
                urls.append(rel.target_ref if hasattr(rel, 'target_ref') else rel._target)
                
    except Exception as e:
        logger.error(f"Error extracting links from DOCX: {e}")
        
    return urls


def extract_html(url: str) -> tuple:
    """
    提取HTML内容
    
    Args:
        url: URL地址
        
    Returns:
        tuple: (html_bytes, metadata)
    """
    try:
        import requests
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=30, verify=False)
        
        if response.status_code == 200:
            return response.content, {'url': url, 'status': response.status_code}
        else:
            return None, {'url': url, 'status': response.status_code}
            
    except Exception as e:
        logger.error(f"Error fetching URL {url}: {e}")
        return None, {'url': url, 'error': str(e)}


def get_file_extension(filename: str) -> str:
    """获取文件扩展名"""
    _, ext = os.path.splitext(filename)
    return ext.lower()


def is_supported_format(filename: str) -> bool:
    """检查是否为支持的文件格式"""
    supported_extensions = {
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.ppt', '.pptx', '.txt', '.md', '.markdown',
        '.html', '.htm', '.json', '.csv'
    }
    return get_file_extension(filename) in supported_extensions


def normalize_overlapped_percent(percent) -> float:
    """标准化重叠百分比"""
    try:
        p = float(percent)
        if p < 0:
            return 0.0
        elif p > 100:
            return 100.0
        return p
    except (ValueError, TypeError):
        return 0.0


def normalize_layout_recognizer(layout_recognizer):
    """标准化布局识别器配置"""
    if isinstance(layout_recognizer, bool):
        return ("DeepDOC" if layout_recognizer else "Plain Text", None)
    
    if isinstance(layout_recognizer, str):
        layout = layout_recognizer.strip()
        
        # 映射常见的布局识别器名称
        mapping = {
            'deepdoc': 'DeepDOC',
            'deep_doc': 'DeepDOC',
            'deep-doc': 'DeepDOC',
            'plaintext': 'Plain Text',
            'plain_text': 'Plain Text',
            'plain-text': 'Plain Text',
            'vision': 'Vision',
            'mineru': 'MinerU',
            'docling': 'Docling',
        }
        
        normalized = mapping.get(layout.lower(), layout)
        return (normalized, None)
        
    return (layout_recognizer, None)


class ProgressCallback:
    """进度回调类"""
    
    def __init__(self, callback_func=None):
        self.callback = callback_func or self._default_callback
        
    def __call__(self, progress=None, msg=""):
        self.callback(progress, msg)
        
    @staticmethod
    def _default_callback(progress=None, msg=""):
        """默认回调实现"""
        if progress is not None and progress >= 0:
            logger.info(f"[{progress:.1%}] {msg}")


__all__ = [
    'extract_embed_file',
    'extract_links_from_pdf',
    'extract_links_from_docx',
    'extract_html',
    'get_file_extension',
    'is_supported_format',
    'normalize_overlapped_percent',
    'normalize_layout_recognizer',
    'ProgressCallback',
]
