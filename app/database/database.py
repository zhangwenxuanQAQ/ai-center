"""
数据库连接管理模块
使用Peewee和Playhouse管理数据库连接
"""

from peewee import MySQLDatabase
from playhouse.pool import PooledMySQLDatabase
import yaml
import os

# 读取配置文件
config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

# 创建数据库连接池
db = PooledMySQLDatabase(
    config['mysql']['name'],
    user=config['mysql']['user'],
    password=config['mysql']['password'],
    host=config['mysql']['host'],
    port=config['mysql']['port'],
    charset='utf8mb4',
    use_unicode=True,
    max_connections=20,  # 最大连接数
    stale_timeout=300,   # 连接超时时间（秒）
)


def get_db():
    """
    获取数据库连接（用于兼容性）
    
    Yields:
        PooledMySQLDatabase: 数据库连接实例
    """
    try:
        # 确保数据库连接是打开的
        if db.is_closed():
            db.connect()
        yield db
    finally:
        # 不关闭连接，使用连接池管理
        pass


def close_db():
    """
    关闭数据库连接池
    """
    if not db.is_closed():
        db.close()
