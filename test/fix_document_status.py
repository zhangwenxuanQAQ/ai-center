"""
修复 knowledgebase_document 表的 status 字段数据
将所有 status=0 的记录更新为 status=1
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.models import KnowledgebaseDocument

def fix_document_status():
    """
    修复文档状态数据
    """
    updated_count = KnowledgebaseDocument.update(status=True).where(
        KnowledgebaseDocument.status == False
    ).execute()
    
    print(f"已修复 {updated_count} 条文档记录的status字段")
    return updated_count

if __name__ == "__main__":
    fix_document_status()
