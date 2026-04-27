#!/usr/bin/env python3
"""
检查分类信息的脚本
"""

from app.database.models import KnowledgebaseDocumentCategory

try:
    categories = KnowledgebaseDocumentCategory.select().where(KnowledgebaseDocumentCategory.deleted == False)
    print("分类列表:")
    for cat in categories:
        print(f'ID: {cat.id}')
        print(f'  Name: {cat.name}')
        print(f'  Parent ID: {cat.parent_id}')
        print(f'  KB ID: {cat.kb_id}')
        print()
except Exception as e:
    print('Error:', str(e))
