"""
获取数据库所有表的完整结构并生成对比报告
"""
import yaml
import os
import pymysql
from collections import defaultdict

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

db_schema = {}

try:
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES;")
        tables = cursor.fetchall()
        
        for table in tables:
            table_name = table[0]
            
            cursor.execute(f"DESCRIBE {table_name};")
            columns = cursor.fetchall()
            
            db_schema[table_name] = {}
            
            for col in columns:
                field, type_, null, key, default, extra = col
                db_schema[table_name][field] = {
                    'type': type_,
                    'null': null,
                    'key': key,
                    'default': default,
                    'extra': extra
                }
            
finally:
    connection.close()

print("=" * 100)
print("数据库表结构完整报告")
print("=" * 100)

for table_name, fields in sorted(db_schema.items()):
    print(f"\n{'=' * 100}")
    print(f"表名: {table_name}")
    print(f"{'=' * 100}")
    print(f"{'字段名':<30} {'类型':<30} {'允许空':<10} {'键':<10} {'默认值':<20}")
    print("-" * 100)
    for field_name, field_info in fields.items():
        print(f"{field_name:<30} {field_info['type']:<30} {field_info['null']:<10} {field_info['key']:<10} {str(field_info['default']):<20}")

print("\n" + "=" * 100)
print("表结构汇总")
print("=" * 100)

for table_name, fields in sorted(db_schema.items()):
    print(f"\n{table_name}:")
    print(f"  字段列表: {', '.join(sorted(fields.keys()))}")
