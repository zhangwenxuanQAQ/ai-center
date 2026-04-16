#!/usr/bin/env python3
"""
检查文档信息的脚本
"""

from app.database.models import KnowledgebaseDocument

# 文档ID
document_id = '5ff8f9cda9f245ce855ef29bdc5e346a'

try:
    doc = KnowledgebaseDocument.get_by_id(document_id)
    print('文档信息:')
    print('File name:', doc.file_name)
    print('Location:', doc.location)
    print('Mime type:', doc.mime_type)
    print('Source type:', doc.source_type)
    print('File size:', doc.file_size)
except Exception as e:
    print('Error:', str(e))
