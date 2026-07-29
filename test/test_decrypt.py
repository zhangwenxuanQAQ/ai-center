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
    test_val = "123456"
    print(f"\n原始测试值: 已脱敏")
    
    enc_result = encrypt_password(test_val)
    print(f"加密后长度: {len(enc_result)}")
    
    dec_result = decrypt_password(enc_result)
    print(f"解密结果: 已脱敏")
    
    if dec_result == test_val:
        print("✓ 测试1通过")
    else:
        print("✗ 测试1失败")
    
    # 测试2：解密数据库中的密码
    print("\n" + "=" * 50)
    print("测试解密数据库中的密码")
    print("=" * 50)
    
    db_token = "gAAAAABp4Fv4dqRdWQL7gmgIAUNomuMkE5rIICzZJFy_ScZH-JXGMb-m2x5FFWWcBHXn8JN5BIWZk1OxzXOzO7RfYzLUqotsjTmCDlK0sZh775CwdBrFQG4s68TdOtdVa-DCK6LeOaytoAK-O3_BgpZU2TfaSNygOfboYnJCh22XRrcTXKC1dXMLksSCaoCEvBDT4V2YH7uoECYQ-oJCtXEW9Ym5EQODZ20An_GsjDfhUA_p-3PEm1NDmjooTadE-hhRzbirV0tGB_452vWU_X_zLahGNB3-gU9a4AbjKxrupMXxEL9oNpCvnd6vS4wbIk3xNZDQHvpW0RlHzrc50AlHfafFujIehKr30rnhzF_z1RHBRCyUSTT7rj4d5nWJvl5MuTmv4JJ6"
    
    print(f"\n数据库Token长度: {len(db_token)}")
    
    dec1 = decrypt_password(db_token)
    print(f"第一次解密后长度: {len(str(dec1))}")
    
    # 再次解密
    dec2 = decrypt_password(dec1)
    print(f"第二次解密后长度: {len(str(dec2))}")
    
    # 检查是否是明文
    if dec2 == "123456":
        print("✓ 数据库Token解密成功")
    else:
        print(f"✗ 数据库Token解密失败")


if __name__ == "__main__":
    test_decrypt()
