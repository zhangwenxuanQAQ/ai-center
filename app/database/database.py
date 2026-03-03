from peewee import MySQLDatabase
import yaml
import os

# 读取配置文件
config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

# 创建数据库连接
db = MySQLDatabase(
    config['mysql']['name'],
    user=config['mysql']['user'],
    password=config['mysql']['password'],
    host=config['mysql']['host'],
    port=config['mysql']['port'],
    charset='utf8mb4',
    use_unicode=True
)

# 依赖项，用于获取数据库连接
def get_db():
    try:
        # 确保数据库连接是打开的
        if not db.is_closed():
            db.connect()
        yield db
    finally:
        # 不关闭连接，使用连接池管理
        pass