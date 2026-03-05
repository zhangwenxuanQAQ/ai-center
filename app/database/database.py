from peewee import MySQLDatabase
import yaml
import os

# 读取配置文件
config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

# 创建Peewee数据库连接
db = MySQLDatabase(
    config['mysql']['name'],
    user=config['mysql']['user'],
    password=config['mysql']['password'],
    host=config['mysql']['host'],
    port=config['mysql']['port']
)

# 尝试连接数据库
try:
    db.connect()
    print("数据库连接成功!")
except Exception as e:
    print(f"数据库连接失败: {e}")