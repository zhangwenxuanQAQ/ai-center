"""
查看chatbot表结构
"""
import yaml
import os
import pymysql

config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
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
        cursor.execute("DESCRIBE chatbot;")
        columns = cursor.fetchall()
        
        print("chatbot表字段:")
        print(f"{'字段名':<20} {'类型':<20} {'允许空':<10} {'键':<10} {'默认值':<15}")
        print("-" * 80)
        for col in columns:
            field, type_, null, key, default, extra = col
            print(f"{field:<20} {type_:<20} {null:<10} {key:<10} {str(default):<15}")
        
        print("\nchatbot_category表字段:")
        cursor.execute("DESCRIBE chatbot_category;")
        columns = cursor.fetchall()
        print(f"{'字段名':<20} {'类型':<20} {'允许空':<10} {'键':<10} {'默认值':<15}")
        print("-" * 80)
        for col in columns:
            field, type_, null, key, default, extra = col
            print(f"{field:<20} {type_:<20} {null:<10} {key:<10} {str(default):<15}")
            
finally:
    connection.close()
