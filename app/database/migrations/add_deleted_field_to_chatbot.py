"""
数据库迁移脚本：为chatbot表添加deleted字段

此脚本用于在不影响现有数据的情况下，为chatbot表添加deleted字段，支持逻辑删除功能。
"""

import sqlite3
import os
from app.database.database import db
from app.database.models import Chatbot


def add_deleted_field():
    """
    为chatbot表添加deleted字段
    """
    try:
        # 检查数据库连接
        if not db.is_closed():
            db.close()
        
        # 获取数据库文件路径
        db_path = db.database
        
        # 使用sqlite3直接执行SQL语句添加字段
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查chatbot表是否存在deleted字段
        cursor.execute("PRAGMA table_info(chatbot)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'deleted' not in columns:
            # 添加deleted字段，默认值为0（False）
            cursor.execute("ALTER TABLE chatbot ADD COLUMN deleted INTEGER DEFAULT 0")
            print("成功为chatbot表添加deleted字段")
        else:
            print("chatbot表已存在deleted字段，跳过添加")
        
        conn.commit()
        conn.close()
        
        print("数据库迁移完成")
    except Exception as e:
        print(f"数据库迁移失败: {e}")


if __name__ == "__main__":
    add_deleted_field()
