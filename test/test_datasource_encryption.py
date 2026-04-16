"""
数据源加密解密功能测试
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.crypto_util import encrypt_password, decrypt_password


def test_encrypt_decrypt():
    """测试加密解密功能"""
    print("=" * 50)
    print("测试加密解密功能")
    print("=" * 50)
    
    # 测试明文密码
    plain_password = "123456"
    print(f"\n原始密码: {plain_password}")
    
    # 加密密码
    encrypted_password = encrypt_password(plain_password)
    print(f"加密后: {encrypted_password}")
    print(f"加密后长度: {len(encrypted_password)}")
    
    # 解密密码
    decrypted_password = decrypt_password(encrypted_password)
    print(f"解密后: {decrypted_password}")
    
    # 验证解密是否正确
    if decrypted_password == plain_password:
        print("✓ 加密解密测试通过")
    else:
        print("✗ 加密解密测试失败")
    
    # 测试空密码
    print("\n" + "=" * 50)
    print("测试空密码")
    print("=" * 50)
    empty_password = ""
    encrypted_empty = encrypt_password(empty_password)
    print(f"空密码加密后: '{encrypted_empty}'")
    decrypted_empty = decrypt_password(encrypted_empty)
    print(f"空密码解密后: '{decrypted_empty}'")
    
    # 测试None密码
    print("\n" + "=" * 50)
    print("测试None密码")
    print("=" * 50)
    none_password = None
    encrypted_none = encrypt_password(none_password)
    print(f"None密码加密后: '{encrypted_none}'")
    decrypted_none = decrypt_password(encrypted_none)
    print(f"None密码解密后: '{decrypted_none}'")
    
    # 测试无效的加密文本
    print("\n" + "=" * 50)
    print("测试无效的加密文本")
    print("=" * 50)
    invalid_encrypted = "invalid_encrypted_text"
    decrypted_invalid = decrypt_password(invalid_encrypted)
    print(f"无效加密文本: '{invalid_encrypted}'")
    print(f"解密后: '{decrypted_invalid}'")
    if decrypted_invalid == invalid_encrypted:
        print("✓ 无效加密文本解密返回原文本")
    else:
        print("✗ 无效加密文本解密未返回原文本")


def test_datasource_config_encryption():
    """测试数据源配置加密解密"""
    print("\n" + "=" * 50)
    print("测试数据源配置加密解密")
    print("=" * 50)
    
    from app.services.datasource.service import DatasourceService
    from app.constants.datasource_constants import DatasourceType
    
    # 测试MySQL配置
    mysql_config = {
        "host": "localhost",
        "port": 3306,
        "database": "test_db",
        "username": "root",
        "password": "123456",
        "charset": "utf8mb4"
    }
    
    print(f"\n原始MySQL配置: {mysql_config}")
    
    # 加密敏感字段
    encrypted_config = DatasourceService._encrypt_sensitive_config(mysql_config, DatasourceType.MYSQL)
    print(f"\n加密后配置: {encrypted_config}")
    
    # 解密敏感字段
    decrypted_config = DatasourceService._decrypt_sensitive_config(encrypted_config, DatasourceType.MYSQL)
    print(f"\n解密后配置: {decrypted_config}")
    
    # 验证解密是否正确
    if decrypted_config["password"] == mysql_config["password"]:
        print("✓ MySQL配置加密解密测试通过")
    else:
        print("✗ MySQL配置加密解密测试失败")
    
    # 测试RustFS配置
    rustfs_config = {
        "endpoint_url": "http://127.0.0.1:9000",
        "access_key": "rustfsadmin",
        "secret_key": "rustfsadmin",
        "bucket": "test-bucket",
        "secure": False
    }
    
    print(f"\n原始RustFS配置: {rustfs_config}")
    
    # 加密敏感字段
    encrypted_config = DatasourceService._encrypt_sensitive_config(rustfs_config, DatasourceType.RUSTFS)
    print(f"\n加密后配置: {encrypted_config}")
    
    # 解密敏感字段
    decrypted_config = DatasourceService._decrypt_sensitive_config(encrypted_config, DatasourceType.RUSTFS)
    print(f"\n解密后配置: {decrypted_config}")
    
    # 验证解密是否正确
    if decrypted_config["secret_key"] == rustfs_config["secret_key"]:
        print("✓ RustFS配置加密解密测试通过")
    else:
        print("✗ RustFS配置加密解密测试失败")


if __name__ == "__main__":
    test_encrypt_decrypt()
    test_datasource_config_encryption()
