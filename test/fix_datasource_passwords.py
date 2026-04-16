"""
修复数据库中重复加密的密码
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.models import Datasource
from app.services.datasource.service import DatasourceService
from app.utils.crypto_util import decrypt_password, encrypt_password
from app.constants.datasource_constants import DatasourceType
import json


def is_encrypted(value: str) -> bool:
    """检查值是否已被加密"""
    return isinstance(value, str) and value.startswith('gAAAA')


def decrypt_until_plain(encrypted_value: str, max_attempts: int = 10) -> str:
    """递归解密直到得到明文"""
    if not is_encrypted(encrypted_value):
        return encrypted_value
    
    current_value = encrypted_value
    attempts = 0
    
    while is_encrypted(current_value) and attempts < max_attempts:
        try:
            decrypted = decrypt_password(current_value)
            if decrypted == current_value:
                # 解密失败，返回当前值
                break
            current_value = decrypted
            attempts += 1
        except Exception as e:
            print(f"解密失败: {e}")
            break
    
    return current_value


def fix_datasource_passwords():
    """修复数据库中重复加密的密码"""
    print("=" * 50)
    print("修复数据库中重复加密的密码")
    print("=" * 50)
    
    # 查询所有数据源
    datasources = Datasource.select().where(Datasource.deleted == False)
    
    for ds in datasources:
        print(f"\n数据源ID: {ds.id}")
        print(f"数据源名称: {ds.name}")
        print(f"数据源类型: {ds.type}")
        
        # 解析配置
        if ds.config:
            try:
                config = json.loads(ds.config)
                print(f"原始配置: {config}")
                
                # 检查密码字段
                password_fields = []
                if ds.type in [DatasourceType.MYSQL, DatasourceType.POSTGRESQL, DatasourceType.ORACLE, DatasourceType.SQL_SERVER]:
                    password_fields = ['password']
                elif ds.type in [DatasourceType.S3, DatasourceType.MINIO, DatasourceType.RUSTFS]:
                    password_fields = ['secret_key']
                
                updated = False
                for field in password_fields:
                    if field in config:
                        encrypted_value = config[field]
                        print(f"\n{field}字段: {encrypted_value[:50]}...")
                        
                        # 递归解密直到得到明文
                        plain_value = decrypt_until_plain(encrypted_value)
                        print(f"明文{field}: {plain_value}")
                        
                        # 检查是否需要修复
                        if is_encrypted(encrypted_value) and is_encrypted(plain_value):
                            print(f"✗ {field}被重复加密，需要修复")
                            # 重新加密明文
                            config[field] = encrypt_password(plain_value)
                            updated = True
                            print(f"修复后的{field}: {config[field][:50]}...")
                        else:
                            print(f"✓ {field}正常")
                
                # 如果需要更新，保存到数据库
                if updated:
                    ds.config = json.dumps(config)
                    ds.save()
                    print(f"\n✓ 数据源 {ds.name} 已修复")
                else:
                    print(f"\n✓ 数据源 {ds.name} 无需修复")
                    
            except Exception as e:
                print(f"✗ 处理数据源失败: {e}")
                import traceback
                traceback.print_exc()
        
        print("-" * 50)


if __name__ == "__main__":
    fix_datasource_passwords()
