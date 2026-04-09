"""
数据库迁移脚本：在 knowledgebase 表中添加 text_model_id 字段
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
        
        print("\n1. 检查 text_model_id 字段是否已存在...")
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = %s 
            AND TABLE_NAME = 'knowledgebase' 
            AND COLUMN_NAME = 'text_model_id';
        """, (mysql_config['name'],))
        
        if cursor.fetchone():
            print("  - text_model_id 字段已存在，跳过")
        else:
            print("\n2. 添加 text_model_id 字段...")
            try:
                cursor.execute("""
                    ALTER TABLE knowledgebase 
                    ADD COLUMN text_model_id VARCHAR(40) NULL COMMENT 'Text模型ID' 
                    AFTER rerank_model_id;
                """)
                print("  - 成功添加 text_model_id 字段")
                
                print("\n3. 添加索引...")
                cursor.execute("""
                    CREATE INDEX idx_text_model_id ON knowledgebase(text_model_id);
                """)
                print("  - 成功添加索引")
                
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
