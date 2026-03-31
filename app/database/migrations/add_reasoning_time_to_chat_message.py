"""
添加 reasoning_time 字段到 chat_message 表
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from app.database.database import db


def upgrade():
    """
    添加 reasoning_time 字段
    """
    try:
        db.connect()
    except:
        pass
    
    cursor = db.execute_sql("DESCRIBE chat_message;")
    columns = [column[0] for column in cursor.fetchall()]
    
    if 'reasoning_time' not in columns:
        db.execute_sql("ALTER TABLE chat_message ADD COLUMN reasoning_time INT NULL COMMENT '思考耗时（毫秒）';")
        print("成功添加 reasoning_time 字段")
    else:
        print("reasoning_time 字段已存在，跳过添加")
    
    db.close()


def downgrade():
    """
    移除 reasoning_time 字段
    """
    try:
        db.connect()
    except:
        pass
    
    cursor = db.execute_sql("DESCRIBE chat_message;")
    columns = [column[0] for column in cursor.fetchall()]
    
    if 'reasoning_time' in columns:
        db.execute_sql("ALTER TABLE chat_message DROP COLUMN reasoning_time;")
        print("成功移除 reasoning_time 字段")
    
    db.close()


if __name__ == '__main__':
    upgrade()
