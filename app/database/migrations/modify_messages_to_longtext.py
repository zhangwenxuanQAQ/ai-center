"""
数据库迁移：修改chat表和chat_message表中messages字段类型为LONGTEXT
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database.database import db


def migrate():
    """
    执行迁移：将chat表和chat_message表中的messages字段从TEXT改为LONGTEXT
    """
    print("开始执行迁移：修改messages字段类型...")

    try:
        with db.atomic():
            # 检查并修改chat表的messages字段
            cursor = db.execute_sql("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_name = 'chat'
                AND column_name = 'messages'
                AND data_type = 'text'
            """)
            result = cursor.fetchone()

            if result[0] > 0:
                db.execute_sql("ALTER TABLE chat MODIFY COLUMN messages LONGTEXT")
                print("字段 chat.messages 已成功修改为 LONGTEXT 类型")
            else:
                print("字段 chat.messages 不是 TEXT 类型或已修改，跳过")

            # 检查并修改chat_message表的messages字段
            cursor = db.execute_sql("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_name = 'chat_message'
                AND column_name = 'messages'
                AND data_type = 'text'
            """)
            result = cursor.fetchone()

            if result[0] > 0:
                db.execute_sql("ALTER TABLE chat_message MODIFY COLUMN messages LONGTEXT")
                print("字段 chat_message.messages 已成功修改为 LONGTEXT 类型")
            else:
                print("字段 chat_message.messages 不是 TEXT 类型或已修改，跳过")

        print("迁移完成！")
        return True
    except Exception as e:
        print(f"迁移失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    migrate()
