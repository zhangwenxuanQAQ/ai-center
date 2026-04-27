#!/usr/bin/env python3
"""
检查并删除knowledgebase表的code字段唯一键约束
"""

import sys
sys.path.append('.')

from app.database.database import db

# 连接数据库
db.connect()

print("检查knowledgebase表的结构...")

# 获取knowledgebase表的信息
cursor = db.execute_sql("SHOW CREATE TABLE knowledgebase;")
result = cursor.fetchone()

if result:
    create_table_sql = result[1]
    print("当前knowledgebase表结构:")
    print(create_table_sql)
    
    # 检查是否存在code字段的唯一键约束
    if 'UNIQUE KEY' in create_table_sql and 'code' in create_table_sql:
        print("\n发现code字段的唯一键约束，准备删除...")
        
        # 尝试删除唯一键约束
        try:
            # 查找唯一键的名称
            cursor = db.execute_sql("SHOW INDEX FROM knowledgebase WHERE Column_name = 'code' AND Non_unique = 0;")
            index_info = cursor.fetchone()
            
            if index_info:
                index_name = index_info[2]
                print(f"找到唯一键约束: {index_name}")
                
                # 删除唯一键约束
                db.execute_sql(f"ALTER TABLE knowledgebase DROP INDEX {index_name};")
                print("唯一键约束删除成功！")
            else:
                print("未找到code字段的唯一键约束")
                
        except Exception as e:
            print(f"删除唯一键约束时出错: {e}")
    else:
        print("\n未发现code字段的唯一键约束")
else:
    print("无法获取knowledgebase表结构")

# 关闭数据库连接
db.close()
print("\n数据库连接已关闭")