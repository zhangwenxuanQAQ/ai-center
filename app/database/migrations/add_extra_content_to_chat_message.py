"""
数据库迁移：在chat_message表添加extra_content字段
"""

import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database.database import db
from app.database.models import ChatMessage


def migrate():
    """
    执行迁移
    """
    print("开始执行迁移：在chat_message表添加extra_content字段...")
    
    try:
        with db.atomic():
            # 检查字段是否已存在（MySQL语法）
            cursor = db.execute_sql("""
                SELECT COUNT(*) 
                FROM information_schema.columns 
                WHERE table_name = 'chat_message' 
                AND column_name = 'extra_content'
            """)
            exists = cursor.fetchone()[0]
            
            if exists == 0:
                # 添加extra_content字段
                db.execute_sql("ALTER TABLE chat_message ADD COLUMN extra_content TEXT")
                print("字段 extra_content 已成功添加到 chat_message 表")
            else:
                print("字段 extra_content 已存在，跳过添加")
        
        print("迁移完成！")
        return True
    except Exception as e:
        print(f"迁移失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    migrate()
