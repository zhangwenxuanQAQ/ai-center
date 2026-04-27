#!/usr/bin/env python3
"""
测试文档下载服务
"""

from app.services.knowledgebase.document.service import DocumentService

# 文档ID
document_id = '5ff8f9cda9f245ce855ef29bdc5e346a'

try:
    result = DocumentService.download_document(document_id)
    print('下载结果:')
    print('File name:', result['file_name'])
    print('Mime type:', result['mime_type'])
    print('File size:', len(result['blob']))
    print('Blob type:', type(result['blob']))
except Exception as e:
    print('Error:', str(e))
