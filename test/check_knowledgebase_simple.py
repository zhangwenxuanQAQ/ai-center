#!/usr/bin/env python3
"""
检查数据库中是否存在编码为'test'的非删除状态的知识库
"""

import sys
sys.path.append('.')

from app.database.database import db
from app.database.models import Knowledgebase

# 连接数据库
db.connect()

# 检查是否存在编码为'test'的非删除状态的知识库
print("检查数据库中编码为'test'的非删除状态的知识库...")

try:
    # 查询编码为'test'且未删除的知识库
    existing = Knowledgebase.select().where(
        (Knowledgebase.code == 'test') &
        (Knowledgebase.deleted == False)
    ).first()
    
    if existing:
        print(f"发现已存在的知识库: ID={existing.id}, 名称={existing.name}, 编码={existing.code}, 已删除={existing.deleted}")
    else:
        print("未发现编码为'test'的非删除状态的知识库")
        
    # 查询所有编码为'test'的知识库，包括已删除的
    all_knowledges = Knowledgebase.select().where(Knowledgebase.code == 'test')
    print(f"\n所有编码为'test'的知识库（包括已删除的）: {len(all_knowledges)}个")
    for kb in all_knowledges:
        print(f"ID={kb.id}, 名称={kb.name}, 编码={kb.code}, 已删除={kb.deleted}")
        
finally:
    # 关闭数据库连接
    db.close()
    print("\n数据库连接已关闭")