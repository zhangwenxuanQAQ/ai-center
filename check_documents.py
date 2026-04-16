#!/usr/bin/env python3
"""
检查文档信息的脚本
"""

from app.database.models import KnowledgebaseDocument

try:
    docs = KnowledgebaseDocument.select().where(KnowledgebaseDocument.deleted == False).limit(5)
    print("文档列表:")
    for doc in docs:
        print(f'ID: {doc.id}')
        print(f'  Name: {doc.file_name}')
        print(f'  Category: {doc.category_id}')
        print(f'  Location: {doc.location}')
        print(f'  Source type: {doc.source_type}')
        print(f'  Source config: {doc.source_config}')
        print()
except Exception as e:
    print('Error:', str(e))
