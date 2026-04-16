"""
加密工具类

提供密码加密和解密功能，确保敏感信息不以明文存储
"""

import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


_SECRET_KEY = os.environ.get('DATASOURCE_ENCRYPT_KEY', 'ai-center-datasource-encryption-key-2026')


def _get_fernet() -> Fernet:
    """
    根据固定密钥派生Fernet加密器
    
    Returns:
        Fernet: Fernet加密器实例
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'ai-center-datasource-salt',
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(_SECRET_KEY.encode()))
    return Fernet(key)


_fernet_instance = None


def _get_fernet_instance() -> Fernet:
    """
    获取Fernet单例实例
    
    Returns:
        Fernet: Fernet加密器实例
    """
    global _fernet_instance
    if _fernet_instance is None:
        _fernet_instance = _get_fernet()
    return _fernet_instance


def encrypt_password(plain_text: str) -> str:
    """
    加密密码
    
    Args:
        plain_text: 明文密码
        
    Returns:
        str: 加密后的密文（Base64编码）
    """
    if not plain_text:
        return plain_text
    fernet = _get_fernet_instance()
    encrypted = fernet.encrypt(plain_text.encode())
    return encrypted.decode()


def decrypt_password(encrypted_text: str) -> str:
    """
    解密密码
    
    Args:
        encrypted_text: 加密的密文（Base64编码）
        
    Returns:
        str: 解密后的明文
    """
    if not encrypted_text:
        return encrypted_text
    try:
        fernet = _get_fernet_instance()
        decrypted = fernet.decrypt(encrypted_text.encode())
        return decrypted.decode()
    except Exception:
        return encrypted_text


def is_encrypted(value: str) -> bool:
    """
    判断值是否已加密
    
    Args:
        value: 待判断的值
        
    Returns:
        bool: 是否已加密
    """
    if not value:
        return False
    try:
        fernet = _get_fernet_instance()
        fernet.decrypt(value.encode())
        return True
    except Exception:
        return False
