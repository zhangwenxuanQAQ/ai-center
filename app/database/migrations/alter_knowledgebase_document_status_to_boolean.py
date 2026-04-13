"""
数据库迁移脚本：将knowledgebase_document表的status字段从字符串类型改为布尔类型
"""

import os
import sys

# 获取项目根目录
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, base_dir)

from app.database.database import get_db_connection

def migrate():
    """
    执行数据库迁移
    """
    print("开始执行数据库迁移：将knowledgebase_document表的status字段从字符串类型改为布尔类型")
    
    try:
        # 获取数据库连接
        db = get_db_connection()
        
        # 检查status字段是否存在并获取其类型
        cursor = db.execute_sql("DESCRIBE knowledgebase_document;")
        columns = cursor.fetchall()
        status_column = None
        for column in columns:
            if column[0] == 'status':
                status_column = column
                break
        
        if not status_column:
            print("status字段不存在，跳过迁移")
            return
        
        # 检查字段类型
        if status_column[1].upper() == 'BOOLEAN':
            print("status字段已经是布尔类型，跳过迁移")
            return
        
        # 添加临时字段
        print("添加临时字段...")
        db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN status_temp BOOLEAN DEFAULT TRUE;")
        
        # 更新临时字段值
        print("更新临时字段值...")
        db.execute_sql("UPDATE knowledgebase_document SET status_temp = CASE WHEN status = 'active' THEN TRUE ELSE FALSE END;")
        
        # 删除原字段
        print("删除原字段...")
        db.execute_sql("ALTER TABLE knowledgebase_document DROP COLUMN status;")
        
        # 重命名临时字段
        print("重命名临时字段...")
        db.execute_sql("ALTER TABLE knowledgebase_document CHANGE COLUMN status_temp status BOOLEAN DEFAULT TRUE;")
        
        # 提交事务
        db.commit()
        print("数据库迁移完成：将knowledgebase_document表的status字段从字符串类型改为布尔类型")
        
    except Exception as e:
        print(f"数据库迁移失败：{e}")
        try:
            if 'db' in locals():
                db.rollback()
        except:
            pass
    finally:
        try:
            if 'db' in locals():
                if not db.is_closed():
                    db.close()
        except:
            pass

if __name__ == "__main__":
    migrate()
