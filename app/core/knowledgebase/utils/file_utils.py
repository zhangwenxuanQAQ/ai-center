"""
文件工具类
参考ragflow项目的api/utils/file_utils.py实现
提供文件类型判断、缩略图生成等功能
"""

import re
import base64
import threading
import sys
from io import BytesIO
from pathlib import Path

from app.constants.knowledgebase_document_constants import FileType

LOCK_KEY_pdfplumber = "global_shared_lock_pdfplumber"
if LOCK_KEY_pdfplumber not in sys.modules:
    sys.modules[LOCK_KEY_pdfplumber] = threading.Lock()

IMG_BASE64_PREFIX = "data:image/png;base64,"

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    pdfplumber = None
    PDFPLUMBER_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    Image = None
    PIL_AVAILABLE = False


def filename_type(filename):
    """
    根据文件扩展名判断文件类型

    Args:
        filename: 文件名

    Returns:
        str: FileType枚举值
    """
    filename = filename.lower()
    if re.match(r".*\.pdf$", filename):
        return FileType.PDF

    if re.match(
        r".*\.(msg|eml|doc|docx|ppt|pptx|yml|xml|htm|json|jsonl|ldjson|csv|txt|ini|xls|xlsx|wps|rtf|hlp|pages|numbers|key|md|mdx|py|js|java|c|cpp|h|php|go|ts|sh|cs|kt|html|sql)$",
        filename
    ):
        return FileType.DOC

    if re.match(r".*\.(wav|flac|ape|alac|wavpack|wv|mp3|aac|ogg|vorbis|opus)$", filename):
        return FileType.AURAL

    if re.match(
        r".*\.(jpg|jpeg|png|tif|gif|pcx|tga|exif|fpx|svg|psd|cdr|pcd|dxf|ufo|eps|ai|raw|wmf|webp|avif|apng|icon|ico|mpg|mpeg|avi|rm|rmvb|mov|wmv|asf|dat|asx|wvx|mpe|mpa|mp4|mkv)$",
        filename
    ):
        return FileType.VISUAL

    return FileType.OTHER


def get_file_suffix(filename):
    """
    获取文件扩展名（不含点号）

    Args:
        filename: 文件名

    Returns:
        str: 文件扩展名
    """
    return Path(filename).suffix.lstrip(".").lower()


def get_mime_type(filename):
    """
    根据文件扩展名获取MIME类型

    Args:
        filename: 文件名

    Returns:
        str: MIME类型字符串
    """
    suffix = get_file_suffix(filename)
    mime_map = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'html': 'text/html',
        'htm': 'text/html',
        'xml': 'text/xml',
        'json': 'application/json',
        'md': 'text/markdown',
        'py': 'text/x-python',
        'js': 'text/javascript',
        'java': 'text/x-java-source',
        'c': 'text/x-c',
        'cpp': 'text/x-c++src',
        'h': 'text/x-chdr',
        'php': 'text/x-php',
        'go': 'text/x-go',
        'ts': 'text/typescript',
        'sh': 'text/x-shellscript',
        'cs': 'text/x-csharp',
        'kt': 'text/x-kotlin',
        'sql': 'text/x-sql',
        'yml': 'text/yaml',
        'yaml': 'text/yaml',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'ico': 'image/x-icon',
        'tif': 'image/tiff',
        'tiff': 'image/tiff',
        'bmp': 'image/bmp',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'aac': 'audio/aac',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'mov': 'video/quicktime',
        'eml': 'message/rfc822',
        'msg': 'application/vnd.ms-outlook',
        'rtf': 'application/rtf',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
    }
    return mime_map.get(suffix, 'application/octet-stream')


def thumbnail_img(filename, blob):
    """
    生成缩略图二进制数据，控制大小不超过65535字节

    Args:
        filename: 文件名
        blob: 文件二进制数据

    Returns:
        bytes or None: 缩略图二进制数据，不支持则返回None
    """
    filename = filename.lower()

    if re.match(r".*\.pdf$", filename):
        if not PDFPLUMBER_AVAILABLE:
            return None
        try:
            with sys.modules[LOCK_KEY_pdfplumber]:
                pdf = pdfplumber.open(BytesIO(blob))
                buffered = BytesIO()
                resolution = 32
                img = None
                for _ in range(10):
                    page = pdf.pages[0]
                    page_image = page.to_image(resolution=resolution)
                    page_image.annotated.save(buffered, format="png")
                    img = buffered.getvalue()
                    if len(img) >= 64000 and resolution >= 2:
                        resolution = resolution / 2
                        buffered = BytesIO()
                    else:
                        break
                pdf.close()
                return img
        except Exception:
            return None

    if re.match(r".*\.(jpg|jpeg|png|tif|gif|icon|ico|webp)$", filename):
        if not PIL_AVAILABLE:
            return None
        try:
            image = Image.open(BytesIO(blob))
            image.thumbnail((30, 30))
            buffered = BytesIO()
            image.save(buffered, format="png")
            return buffered.getvalue()
        except Exception:
            return None

    return None


def thumbnail(filename, blob):
    """
    生成base64编码的缩略图字符串

    Args:
        filename: 文件名
        blob: 文件二进制数据

    Returns:
        str: base64编码的缩略图字符串，不支持则返回空字符串
    """
    img = thumbnail_img(filename, blob)
    if img is not None:
        return IMG_BASE64_PREFIX + base64.b64encode(img).decode("utf-8")
    return ""


def duplicate_filename(kb_id, filename):
    """
    处理同名文件，在文件名后添加递增数字后缀

    如果文件目录中有相同文件则需要在文件名后面加（递增数字）：
    比如上传文件test.docx,如果存在则需要修改为test_(1).docx,
    如果存在test_(1).docx则修改为test_(2).docx

    Args:
        kb_id: 知识库ID
        filename: 原始文件名

    Returns:
        str: 去重后的文件名
    """
    from app.database.storage.rustfs_utils import rustfs_utils

    if not rustfs_utils.is_available:
        return filename

    bucket_name = kb_id
    if not rustfs_utils.bucket_exists(bucket_name):
        return filename

    base_name, ext = _split_filename(filename)
    object_key = f"{base_name}{ext}" if ext else base_name

    if not rustfs_utils.object_exists(bucket_name, object_key):
        return filename

    counter = 1
    while True:
        new_name = f"{base_name}_({counter}){ext}" if ext else f"{base_name}_({counter})"
        if not rustfs_utils.object_exists(bucket_name, new_name):
            return new_name
        counter += 1


def _split_filename(filename):
    """
    分割文件名为基础名和扩展名

    Args:
        filename: 文件名

    Returns:
        tuple: (base_name, extension) 如 ("test", ".docx")
    """
    path = Path(filename)
    base = path.stem
    ext = path.suffix
    return base, ext


def get_chunk_method_by_file_type(file_type, filename, default_chunk_method="naive"):
    """
    根据文件类型和文件名推断默认的chunk方法

    Args:
        file_type: FileType枚举值
        filename: 文件名
        default_chunk_method: 默认chunk方法

    Returns:
        str: chunk方法名称
    """
    if file_type == FileType.VISUAL:
        return "picture"
    if file_type == FileType.AURAL:
        return "audio"
    if re.search(r"\.(ppt|pptx|pages)$", filename, re.IGNORECASE):
        return "presentation"
    if re.search(r"\.(msg|eml)$", filename, re.IGNORECASE):
        return "email"
    return default_chunk_method
