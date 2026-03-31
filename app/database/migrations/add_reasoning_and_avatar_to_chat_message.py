"""
添加 reasoning_content 和 avatar 字段到 chat_message 表
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from app.database.database import db


def upgrade():
    """
    添加 reasoning_content 和 avatar 字段
    """
    try:
        db.connect()
    except:
        pass
    
    cursor = db.execute_sql("DESCRIBE chat_message;")
    columns = [column[0] for column in cursor.fetchall()]
    
    if 'reasoning_content' not in columns:
        db.execute_sql("ALTER TABLE chat_message ADD COLUMN reasoning_content TEXT NULL COMMENT '思考过程内容';")
        print("成功添加 reasoning_content 字段")
    else:
        print("reasoning_content 字段已存在，跳过添加")
    
    if 'avatar' not in columns:
        db.execute_sql("ALTER TABLE chat_message ADD COLUMN avatar VARCHAR(500) NULL COMMENT '头像URL';")
        print("成功添加 avatar 字段")
    else:
        print("avatar 字段已存在，跳过添加")
    
    db.close()


def downgrade():
    """
    移除 reasoning_content 和 avatar 字段
    """
    try:
        db.connect()
    except:
        pass
    
    cursor = db.execute_sql("DESCRIBE chat_message;")
    columns = [column[0] for column in cursor.fetchall()]
    
    if 'avatar' in columns:
        db.execute_sql("ALTER TABLE chat_message DROP COLUMN avatar;")
        print("成功移除 avatar 字段")
    
    if 'reasoning_content' in columns:
        db.execute_sql("ALTER TABLE chat_message DROP COLUMN reasoning_content;")
        print("成功移除 reasoning_content 字段")
    
    db.close()


if __name__ == '__main__':
    upgrade()
