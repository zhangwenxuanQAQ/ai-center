"""
移除chatbot表中code字段的唯一约束
"""

from app.database.database import db


def remove_chatbot_code_unique_constraint():
    """
    移除chatbot表中code字段的唯一约束
    """
    try:
        # 连接数据库
        if db.is_closed():
            db.connect()
        
        # 检查chatbot表是否存在
        cursor = db.execute_sql("SHOW TABLES LIKE 'chatbot';")
        if not cursor.fetchone():
            print("chatbot表不存在，跳过移除唯一约束")
            return
        
        # 检查表结构，查看code字段的约束
        cursor = db.execute_sql("DESCRIBE chatbot;")
        columns = cursor.fetchall()
        code_column = None
        for column in columns:
            if column[0] == 'code':
                code_column = column
                break
        
        if not code_column:
            print("chatbot表中不存在code字段，跳过移除唯一约束")
            return
        
        # 查看表的索引
        cursor = db.execute_sql("SHOW INDEX FROM chatbot;")
        indexes = cursor.fetchall()
        
        # 查找code字段的唯一索引
        unique_index_name = None
        for index in indexes:
            if index[4] == 'code' and index[2] == 'UNI':
                unique_index_name = index[2]
                break
        
        if unique_index_name:
            # 移除唯一约束
            db.execute_sql("ALTER TABLE chatbot DROP INDEX code;")
            print("成功移除chatbot表中code字段的唯一约束")
        else:
            print("chatbot表中code字段没有唯一约束，跳过移除")
            
    except Exception as e:
        print(f"移除chatbot表中code字段的唯一约束失败: {e}")
    finally:
        if not db.is_closed():
            db.close()


if __name__ == "__main__":
    remove_chatbot_code_unique_constraint()
