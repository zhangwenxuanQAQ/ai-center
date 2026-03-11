"""
获取数据库表结构脚本
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
        cursor.execute("SHOW TABLES;")
        tables = cursor.fetchall()
        
        print("=" * 80)
        print("数据库表结构信息")
        print("=" * 80)
        
        for table in tables:
            table_name = table[0]
            print(f"\n{'=' * 80}")
            print(f"表名: {table_name}")
            print(f"{'=' * 80}")
            
            cursor.execute(f"DESCRIBE {table_name};")
            columns = cursor.fetchall()
            
            print(f"{'字段名':<20} {'类型':<20} {'允许空':<10} {'键':<10} {'默认值':<15} {'额外':<15}")
            print("-" * 80)
            for col in columns:
                field, type_, null, key, default, extra = col
                print(f"{field:<20} {type_:<20} {null:<10} {key:<10} {str(default):<15} {extra:<15}")
            
            cursor.execute(f"SHOW INDEX FROM {table_name};")
            indexes = cursor.fetchall()
            if indexes:
                print(f"\n索引信息:")
                print(f"{'索引名':<30} {'列名':<20} {'唯一':<10}")
                print("-" * 60)
                seen_indexes = set()
                for idx in indexes:
                    idx_name = idx[2]
                    col_name = idx[4]
                    unique = '是' if idx[1] == 0 else '否'
                    if idx_name not in seen_indexes:
                        print(f"{idx_name:<30} {col_name:<20} {unique:<10}")
                        seen_indexes.add(idx_name)
            
            cursor.execute(f"SHOW CREATE TABLE {table_name};")
            create_table = cursor.fetchone()[1]
            print(f"\n建表语句:")
            print(create_table)
            
finally:
    connection.close()
