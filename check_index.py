#!/usr/bin/env python3
"""
简单检查knowledgebase表的code字段是否有唯一键约束
"""

import sys
sys.path.append('.')

from app.database.database import db

# 连接数据库
db.connect()

print("检查knowledgebase表的code字段索引...")

# 检查code字段的索引
cursor = db.execute_sql("SHOW INDEX FROM knowledgebase WHERE Column_name = 'code';")
indexes = cursor.fetchall()

print(f"找到 {len(indexes)} 个code字段的索引:")
for index in indexes:
    index_name = index[2]
    non_unique = index[1]
    print(f"  - 索引名: {index_name}, 非唯一: {non_unique}")
    if non_unique == 0:
        print(f"    发现唯一键约束: {index_name}")

# 关闭数据库连接
db.close()
print("\n数据库连接已关闭")