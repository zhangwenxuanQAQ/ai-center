"""
数据库迁移脚本：为所有表添加逻辑删除字段

此脚本用于在不影响现有数据的情况下，为所有表添加逻辑删除相关字段：
- deleted: 是否删除
- deleted_at: 删除时间
- deleted_user_id: 删除用户ID
"""

from app.database.database import db


def add_soft_delete_fields():
    """
    为所有表添加逻辑删除字段
    """
    try:
        # 确保数据库连接
        if db.is_closed():
            db.connect()
        
        # 获取所有表名
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]
        
        print(f"发现以下表: {table_names}")
        
        for table_name in table_names:
            print(f"\n处理表: {table_name}")
            
            # 检查表是否已存在逻辑删除字段
            cursor = db.execute_sql(f"DESCRIBE {table_name};")
            columns = [column[0] for column in cursor.fetchall()]
            
            # 添加deleted字段
            if 'deleted' not in columns:
                try:
                    db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted TINYINT DEFAULT 0")
                    print(f"  成功添加deleted字段")
                except Exception as e:
                    print(f"  添加deleted字段失败: {e}")
            else:
                print(f"  deleted字段已存在，跳过")
            
            # 添加deleted_at字段
            if 'deleted_at' not in columns:
                try:
                    db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted_at DATETIME DEFAULT NULL")
                    print(f"  成功添加deleted_at字段")
                except Exception as e:
                    print(f"  添加deleted_at字段失败: {e}")
            else:
                print(f"  deleted_at字段已存在，跳过")
            
            # 添加deleted_user_id字段
            if 'deleted_user_id' not in columns:
                try:
                    db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted_user_id VARCHAR(36) DEFAULT NULL")
                    print(f"  成功添加deleted_user_id字段")
                except Exception as e:
                    print(f"  添加deleted_user_id字段失败: {e}")
            else:
                print(f"  deleted_user_id字段已存在，跳过")
        
        print("\n数据库迁移完成")
    except Exception as e:
        print(f"数据库迁移失败: {e}")


if __name__ == "__main__":
    add_soft_delete_fields()
