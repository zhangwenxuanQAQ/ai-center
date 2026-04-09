#!/usr/bin/env python3
"""
检查数据库中是否存在编码为'test'的知识库
"""

import sys
sys.path.append('.')

from app.database.database import db
from app.database.models import Knowledgebase

# 连接数据库
db.connect()

# 检查是否存在编码为'test'的知识库
print("检查数据库中编码为'test'的知识库...")

try:
    # 查询所有编码为'test'的知识库，包括已删除的
    knowledges = Knowledgebase.select().where(Knowledgebase.code == 'test')
    
    if not knowledges:
        print("数据库中不存在编码为'test'的知识库")
    else:
        print(f"找到 {len(knowledges)} 个编码为'test'的知识库:")
        for kb in knowledges:
            print(f"ID: {kb.id}, 名称: {kb.name}, 编码: {kb.code}, 已删除: {kb.deleted}")
            
finally:
    # 关闭数据库连接
    db.close()
    print("数据库连接已关闭")