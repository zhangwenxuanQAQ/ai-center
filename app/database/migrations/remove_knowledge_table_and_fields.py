"""
数据库迁移脚本：删除 knowledge 表和 chatbot 表中的 prompt_id、knowledge_id 字段
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import yaml
import pymysql

config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'configs', 'server_config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

mysql_config = config['mysql']

connection = pymysql.connect(
    host=mysql_config['host'],
    port=mysql_config['port'],
    user=mysql_config['user'],
    password=mysql_config['password'],
    database=mysql_config['name']
)

try:
    with connection.cursor() as cursor:
        print("开始执行数据库迁移...")
        
        print("\n1. 查询并删除 chatbot 表的外键约束...")
        cursor.execute("""
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = %s 
            AND TABLE_NAME = 'chatbot' 
            AND COLUMN_NAME IN ('prompt_id', 'knowledge_id')
            AND REFERENCED_TABLE_NAME IS NOT NULL;
        """, (mysql_config['name'],))
        
        foreign_keys = cursor.fetchall()
        for fk in foreign_keys:
            fk_name = fk[0]
            try:
                cursor.execute(f"ALTER TABLE chatbot DROP FOREIGN KEY {fk_name};")
                print(f"  - 成功删除外键约束: {fk_name}")
            except Exception as e:
                print(f"  - 删除外键约束 {fk_name} 失败: {e}")
        
        print("\n2. 删除 chatbot 表中的 prompt_id 和 knowledge_id 字段...")
        try:
            cursor.execute("ALTER TABLE chatbot DROP COLUMN prompt_id;")
            print("  - 成功删除 prompt_id 字段")
        except Exception as e:
            if "check that column/key exists" in str(e):
                print("  - prompt_id 字段不存在，跳过")
            else:
                raise
        
        try:
            cursor.execute("ALTER TABLE chatbot DROP COLUMN knowledge_id;")
            print("  - 成功删除 knowledge_id 字段")
        except Exception as e:
            if "check that column/key exists" in str(e):
                print("  - knowledge_id 字段不存在，跳过")
            else:
                raise
        
        print("\n3. 删除 knowledge 表...")
        try:
            cursor.execute("DROP TABLE IF EXISTS knowledge;")
            print("  - 成功删除 knowledge 表")
        except Exception as e:
            print(f"  - 删除 knowledge 表失败: {e}")
            raise
        
        connection.commit()
        print("\n数据库迁移完成！")
        
except Exception as e:
    connection.rollback()
    print(f"\n数据库迁移失败: {e}")
    raise
finally:
    connection.close()
