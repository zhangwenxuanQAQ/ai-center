#!/usr/bin/env python3
"""
直接删除knowledgebase表的code字段唯一键约束
"""

import sys
sys.path.append('.')

from app.database.database import db

# 连接数据库
db.connect()

print("尝试删除knowledgebase表的code字段唯一键约束...")

# 直接尝试删除唯一键约束
try:
    # 首先查找code字段的唯一键约束名称
    cursor = db.execute_sql("SHOW INDEX FROM knowledgebase WHERE Column_name = 'code' AND Non_unique = 0;")
    index_info = cursor.fetchone()
    
    if index_info:
        index_name = index_info[2]
        print(f"找到唯一键约束: {index_name}")
        
        # 删除唯一键约束
        db.execute_sql(f"ALTER TABLE knowledgebase DROP INDEX {index_name};")
        print("唯一键约束删除成功！")
    else:
        print("未找到code字段的唯一键约束，可能已经被删除")
        
    # 检查是否还有code字段的索引
    cursor = db.execute_sql("SHOW INDEX FROM knowledgebase WHERE Column_name = 'code';")
    indexes = cursor.fetchall()
    
    print(f"\n当前code字段的索引:")
    for index in indexes:
        index_name = index[2]
        non_unique = index[1]
        print(f"  - 索引名: {index_name}, 非唯一: {non_unique}")
        
    # 确保code字段有一个普通索引
    cursor = db.execute_sql("SHOW INDEX FROM knowledgebase WHERE Column_name = 'code' AND Non_unique = 1;")
    if not cursor.fetchone():
        print("\n为code字段添加普通索引...")
        db.execute_sql("ALTER TABLE knowledgebase ADD INDEX idx_knowledgebase_code (code);")
        print("普通索引添加成功！")
        
except Exception as e:
    print(f"操作时出错: {e}")

# 关闭数据库连接
db.close()
print("\n数据库连接已关闭")