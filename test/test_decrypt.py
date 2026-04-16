"""
测试解密功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.crypto_util import encrypt_password, decrypt_password


def test_decrypt():
    """测试解密功能"""
    print("=" * 50)
    print("测试解密功能")
    print("=" * 50)
    
    # 测试1：加密然后解密
    plain_password = "123456"
    print(f"\n原始密码: {plain_password}")
    
    encrypted_password = encrypt_password(plain_password)
    print(f"加密后: {encrypted_password}")
    
    decrypted_password = decrypt_password(encrypted_password)
    print(f"解密后: {decrypted_password}")
    
    if decrypted_password == plain_password:
        print("✓ 测试1通过")
    else:
        print("✗ 测试1失败")
    
    # 测试2：解密数据库中的密码
    print("\n" + "=" * 50)
    print("测试解密数据库中的密码")
    print("=" * 50)
    
    db_password = "gAAAAABp4Fv4dqRdWQL7gmgIAUNomuMkE5rIICzZJFy_ScZH-JXGMb-m2x5FFWWcBHXn8JN5BIWZk1OxzXOzO7RfYzLUqotsjTmCDlK0sZh775CwdBrFQG4s68TdOtdVa-DCK6LeOaytoAK-O3_BgpZU2TfaSNygOfboYnJCh22XRrcTXKC1dXMLksSCaoCEvBDT4V2YH7uoECYQ-oJCtXEW9Ym5EQODZ20An_GsjDfhUA_p-3PEm1NDmjooTadE-hhRzbirV0tGB_452vWU_X_zLahGNB3-gU9a4AbjKxrupMXxEL9oNpCvnd6vS4wbIk3xNZDQHvpW0RlHzrc50AlHfafFujIehKr30rnhzF_z1RHBRCyUSTT7rj4d5nWJvl5MuTmv4JJ6"
    
    print(f"\n数据库密码: {db_password[:50]}...")
    
    decrypted_db_password = decrypt_password(db_password)
    print(f"解密后: {decrypted_db_password[:50]}...")
    
    # 再次解密
    decrypted_again = decrypt_password(decrypted_db_password)
    print(f"再次解密: {decrypted_again[:50]}...")
    
    # 检查是否是明文
    if decrypted_again == "123456":
        print("✓ 数据库密码解密成功，明文是: 123456")
    else:
        print(f"✗ 数据库密码解密失败，解密后仍然是加密的")


if __name__ == "__main__":
    test_decrypt()
