"""
测试数据源测试连接接口
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.models import Datasource
from app.services.datasource.service import DatasourceService
from app.utils.crypto_util import decrypt_password
import json


def test_datasource_in_database():
    """测试数据库中的数据源配置"""
    print("=" * 50)
    print("测试数据库中的数据源配置")
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
                print(f"配置: {config}")
                
                # 检查密码字段
                if 'password' in config:
                    password = config['password']
                    print(f"密码字段: {password}")
                    
                    # 尝试解密
                    try:
                        decrypted = decrypt_password(password)
                        print(f"解密后密码: {decrypted}")
                        
                        # 检查是否是有效的Fernet加密文本
                        if password.startswith('gAAAA'):
                            print("✓ 密码已被正确加密")
                        else:
                            print("✗ 密码可能未被加密")
                    except Exception as e:
                        print(f"✗ 解密失败: {e}")
                
                # 检查secret_key字段
                if 'secret_key' in config:
                    secret_key = config['secret_key']
                    print(f"Secret Key字段: {secret_key}")
                    
                    # 尝试解密
                    try:
                        decrypted = decrypt_password(secret_key)
                        print(f"解密后Secret Key: {decrypted}")
                        
                        # 检查是否是有效的Fernet加密文本
                        if secret_key.startswith('gAAAA'):
                            print("✓ Secret Key已被正确加密")
                        else:
                            print("✗ Secret Key可能未被加密")
                    except Exception as e:
                        print(f"✗ 解密失败: {e}")
                        
            except Exception as e:
                print(f"✗ 解析配置失败: {e}")
        
        print("-" * 50)


def test_datasource_connection():
    """测试数据源连接功能"""
    print("\n" + "=" * 50)
    print("测试数据源连接功能")
    print("=" * 50)
    
    # 查询所有数据源
    datasources = Datasource.select().where(Datasource.deleted == False)
    
    for ds in datasources:
        print(f"\n测试数据源: {ds.name} ({ds.type})")
        print(f"数据源ID: {ds.id}")
        
        # 测试连接
        try:
            result = DatasourceService.test_connection(str(ds.id))
            print(f"测试结果: {result}")
            
            if result.get('success'):
                print("✓ 连接测试成功")
            else:
                print(f"✗ 连接测试失败: {result.get('message')}")
        except Exception as e:
            print(f"✗ 测试连接异常: {e}")
            import traceback
            traceback.print_exc()
        
        print("-" * 50)


if __name__ == "__main__":
    test_datasource_in_database()
    test_datasource_connection()
