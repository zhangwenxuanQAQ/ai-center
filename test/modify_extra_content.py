import pymysql
import yaml
import os

config_path = os.path.join(os.path.dirname(__file__), 'configs', 'server_config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

connection = pymysql.connect(
    host=config['mysql']['host'],
    port=config['mysql']['port'],
    user=config['mysql']['user'],
    password=config['mysql']['password'],
    database=config['mysql']['name'],
    charset='utf8mb4'
)

try:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM information_schema.columns
            WHERE table_name = 'chat_message'
            AND column_name = 'extra_content'
        """)
        result = cursor.fetchone()
        print(f"Current column info: {result}")

        cursor.execute("ALTER TABLE chat_message MODIFY COLUMN extra_content LONGTEXT")
        print("Column extra_content modified to LONGTEXT successfully")

        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM information_schema.columns
            WHERE table_name = 'chat_message'
            AND column_name = 'extra_content'
        """)
        result = cursor.fetchone()
        print(f"New column info: {result}")

    connection.commit()
finally:
    connection.close()