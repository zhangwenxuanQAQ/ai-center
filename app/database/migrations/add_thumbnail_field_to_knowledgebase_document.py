"""
数据库迁移脚本：在 knowledgebase_document 表中添加 thumbnail 字段
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
        
        print("\n1. 检查 thumbnail 字段是否已存在...")
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = %s 
            AND TABLE_NAME = 'knowledgebase_document' 
            AND COLUMN_NAME = 'thumbnail';
        """, (mysql_config['name'],))
        
        if cursor.fetchone():
            print("  - thumbnail 字段已存在，跳过")
        else:
            print("\n2. 添加 thumbnail 字段...")
            try:
                cursor.execute("""
                    ALTER TABLE knowledgebase_document 
                    ADD COLUMN thumbnail TEXT NULL COMMENT '文件缩略图' 
                    AFTER source_config;
                """)
                print("  - 成功添加 thumbnail 字段")
            except Exception as e:
                print(f"  - 添加字段失败: {e}")
                raise
        
        connection.commit()
        print("\n数据库迁移完成！")
        
except Exception as e:
    connection.rollback()
    print(f"\n数据库迁移失败: {e}")
    raise
finally:
    connection.close()