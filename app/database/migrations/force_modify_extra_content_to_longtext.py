"""
数据库迁移：强制修改chat_message表中extra_content字段类型为LONGTEXT
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database.database import db


def migrate():
    """
    执行迁移：强制将extra_content字段改为LONGTEXT
    """
    print("开始执行迁移：强制修改chat_message表extra_content字段类型...")

    try:
        with db.atomic():
            # 先查看当前字段类型
            cursor = db.execute_sql("""
                SELECT column_name, data_type, column_type
                FROM information_schema.columns
                WHERE table_name = 'chat_message'
                AND column_name = 'extra_content'
            """)
            result = cursor.fetchone()
            
            if result:
                print(f"当前字段类型: {result[1]}, {result[2]}")
                
                # 强制修改为 LONGTEXT
                db.execute_sql("ALTER TABLE chat_message MODIFY COLUMN extra_content LONGTEXT")
                print("字段 extra_content 已成功修改为 LONGTEXT 类型")
                
                # 再次验证
                cursor = db.execute_sql("""
                    SELECT column_name, data_type, column_type
                    FROM information_schema.columns
                    WHERE table_name = 'chat_message'
                    AND column_name = 'extra_content'
                """)
                result = cursor.fetchone()
                print(f"修改后字段类型: {result[1]}, {result[2]}")
            else:
                print("字段 extra_content 不存在")

        print("迁移完成！")
        return True
    except Exception as e:
        print(f"迁移失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    migrate()
