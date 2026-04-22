"""
文件工具类
提供文件类型判断、缩略图生成、音频转换等功能
"""

import re
import base64
import threading
import sys
import os
import tempfile
import logging
from io import BytesIO
from pathlib import Path

from app.constants.knowledgebase_document_constants import FileType

logger = logging.getLogger(__name__)

FFMPEG_COMMON_LOCATIONS = [
    r"C:\Users\Admin\scoop\shims\ffmpeg.exe",
    r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    r"C:\ffmpeg\bin\ffmpeg.exe",
    r"D:\ffmpeg\bin\ffmpeg.exe",
    r"E:\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
    r"D:\Program Files\ffmpeg\bin\ffmpeg.exe",
    r"D:\anaconda\Library\bin\ffmpeg.exe",
    r"C:\Users\Admin\AppData\Local\Programs\ffmpeg\bin\ffmpeg.exe",
]

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

    if re.match(r".*\.(wav|flac|ape|alac|wavpack|wv|mp3|aac|ogg|vorbis|opus|m4a|wma|aiff|aif)$", filename):
        return FileType.AURAL

    if re.match(
        r".*\.(jpg|jpeg|png|tif|gif|pcx|tga|exif|fpx|svg|psd|cdr|pcd|dxf|ufo|eps|ai|raw|webp|avif|apng|icon|ico|mpg|mpeg|avi|rm|rmvb|mov|wmv|asf|dat|asx|wvx|mpe|mpa|mp4|mkv|webm|m4v|flv|ts|vob)$",
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
    import mimetypes
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


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


def find_ffmpeg():
    """查找ffmpeg可执行文件"""
    try:
        import subprocess
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
        if result.returncode == 0:
            logger.info("在系统PATH中找到ffmpeg")
            return 'ffmpeg'
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    
    for loc in FFMPEG_COMMON_LOCATIONS:
        if os.path.exists(loc):
            logger.info(f"在常见位置找到ffmpeg: {loc}")
            return loc
    
    logger.warning("未找到ffmpeg")
    return None


def get_ffmpeg_path():
    """获取ffmpeg路径"""
    ffmpeg_path = os.environ.get('FFMPEG_PATH')
    if ffmpeg_path and os.path.exists(ffmpeg_path):
        logger.info(f"从环境变量FFMPEG_PATH获取ffmpeg: {ffmpeg_path}")
        return ffmpeg_path
    return find_ffmpeg()


def cleanup_temp_files(*file_paths):
    """清理临时文件"""
    for file_path in file_paths:
        if file_path and os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except Exception:
                pass


def convert_to_wav(audio_path: str) -> tuple:
    """将音频文件转换为wav格式
    
    Args:
        audio_path: 原始音频文件路径
    
    Returns:
        tuple: (转换后的wav文件路径, 错误信息)，成功时错误信息为None
    """
    if os.path.splitext(audio_path)[1].lower() == '.wav':
        return audio_path, None
    
    ffmpeg_exe = get_ffmpeg_path()
    
    try:
        from pydub import AudioSegment
        if ffmpeg_exe and ffmpeg_exe != 'ffmpeg':
            ffmpeg_dir = os.path.dirname(ffmpeg_exe)
            if ffmpeg_dir not in os.environ.get('PATH', ''):
                os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
                logger.info(f"已将ffmpeg目录添加到PATH: {ffmpeg_dir}")
        
        temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_wav.close()
        
        audio = AudioSegment.from_file(audio_path)
        audio.export(temp_wav.name, format='wav')
        logger.info(f"成功使用pydub转换音频文件: {audio_path} -> {temp_wav.name}")
        return temp_wav.name, None
    except ImportError:
        logger.warning("pydub未安装，尝试使用ffmpeg")
        if not ffmpeg_exe:
            return None, "音频转换失败: 未找到ffmpeg。请安装ffmpeg或将音频文件转换为wav格式"
        
        try:
            import subprocess
            temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_wav.close()
            
            subprocess.run([ffmpeg_exe, '-i', audio_path, '-y', temp_wav.name], 
                          check=True, capture_output=True, text=True)
            logger.info(f"成功使用ffmpeg转换音频文件: {audio_path} -> {temp_wav.name}")
            return temp_wav.name, None
        except subprocess.CalledProcessError as e:
            return None, f"音频转换失败: ffmpeg转换失败 - {e.stderr}"
        except Exception as e:
            return None, f"音频转换失败: {str(e)}"
    except Exception as e:
        error_msg = f"音频转换失败: {str(e)}"
        if "ffmpeg" in str(e).lower() or "file not found" in str(e).lower():
            if not ffmpeg_exe:
                error_msg = "音频转换失败: pydub需要ffmpeg支持。请安装ffmpeg或将音频文件转换为wav格式"
        return None, error_msg


def convert_base64_audio_to_wav(base64_content: str, original_filename: str) -> tuple:
    """将base64编码的音频转换为wav格式
    
    Args:
        base64_content: base64编码的音频数据
        original_filename: 原始文件名，用于确定文件扩展名
    
    Returns:
        tuple: (转换后的wav文件的base64编码, 错误信息)，成功时错误信息为None
    """
    temp_file_path = None
    converted_audio_path = None
    
    try:
        # 先将base64保存为临时文件
        binary_data = base64.b64decode(base64_content)
        suffix = os.path.splitext(original_filename)[1].lower() or '.tmp'
        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        temp_file.write(binary_data)
        temp_file.close()
        temp_file_path = temp_file.name
        
        # 转换为wav
        converted_audio_path, error_msg = convert_to_wav(temp_file_path)
        if error_msg:
            return None, error_msg
        
        # 读取转换后的wav文件并编码为base64
        with open(converted_audio_path, 'rb') as f:
            wav_data = f.read()
        wav_base64 = base64.b64encode(wav_data).decode('utf-8')
        
        return wav_base64, None
    finally:
        cleanup_temp_files(temp_file_path)
        if converted_audio_path and converted_audio_path != temp_file_path:
            cleanup_temp_files(converted_audio_path)
