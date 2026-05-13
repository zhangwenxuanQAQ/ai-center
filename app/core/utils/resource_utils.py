from pathlib import Path
import os

PROJECT_ROOT = Path(__file__).resolve().parents[3]

WEB_ASSETS_DIR = PROJECT_ROOT / 'web' / 'dist' / 'assets'
WEB_SRC_ASSETS_DIR = PROJECT_ROOT / 'web' / 'src' / 'assets'

def get_provider_avatar_url(provider: str) -> str:
    """
    获取提供商头像的URL路径
    
    Args:
        provider: 提供商名称
        
    Returns:
        头像URL路径
    """
    if not provider:
        return '/assets/default.svg'
    
    lowercase_provider = provider.lower()
    return f'/assets/{lowercase_provider}.svg'

def get_default_avatar_url() -> str:
    """
    获取默认头像URL路径
    
    Returns:
        默认头像URL路径
    """
    return '/assets/default.svg'

def get_file_icon_path(extension: str) -> Path:
    """
    获取文件图标路径
    
    Args:
        extension: 文件扩展名
        
    Returns:
        图标文件路径
    """
    icon_path = WEB_SRC_ASSETS_DIR / 'svg' / 'file-icon' / f'{extension}.svg'
    if icon_path.exists():
        return icon_path
    return WEB_SRC_ASSETS_DIR / 'svg' / 'file-icon' / 'txt.svg'

def get_test_image_path(image_name: str) -> Path:
    """
    获取测试图片路径
    
    Args:
        image_name: 图片文件名
        
    Returns:
        测试图片路径
    """
    return WEB_SRC_ASSETS_DIR / 'llm' / 'test' / image_name

def get_test_audio_path(audio_name: str) -> Path:
    """
    获取测试音频路径
    
    Args:
        audio_name: 音频文件名
        
    Returns:
        测试音频路径
    """
    return WEB_SRC_ASSETS_DIR / 'llm' / 'test' / audio_name

def get_asset_path(relative_path: str) -> Path:
    """
    获取资源文件路径
    
    Args:
        relative_path: 相对于assets目录的路径
        
    Returns:
        资源文件完整路径
    """
    path = WEB_SRC_ASSETS_DIR / relative_path
    if path.exists():
        return path
    
    dist_path = WEB_ASSETS_DIR / relative_path
    if dist_path.exists():
        return dist_path
    
    return path

def asset_exists(relative_path: str) -> bool:
    """
    检查资源文件是否存在
    
    Args:
        relative_path: 相对于assets目录的路径
        
    Returns:
        是否存在
    """
    return (WEB_SRC_ASSETS_DIR / relative_path).exists() or (WEB_ASSETS_DIR / relative_path).exists()