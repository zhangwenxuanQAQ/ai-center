from peewee import MySQLDatabase
import yaml
import os
import logging

logger = logging.getLogger(__name__)

config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

db = MySQLDatabase(
    config['mysql']['name'],
    user=config['mysql']['user'],
    password=config['mysql']['password'],
    host=config['mysql']['host'],
    port=config['mysql']['port'],
    charset='utf8mb4'
)

def get_db_connection():
    """
    获取数据库连接，如果连接已断开则重新连接
    
    Returns:
        MySQLDatabase: 数据库连接对象
    """
    try:
        if db.is_closed():
            db.connect(reuse_if_open=True)
    except Exception as e:
        logger.error(f"数据库连接失败: {e}")
        try:
            db.close()
            db.connect(reuse_if_open=True)
        except Exception as retry_error:
            logger.error(f"数据库重连失败: {retry_error}")
            raise
    return db

def close_db_connection():
    """
    关闭数据库连接
    """
    try:
        if not db.is_closed():
            db.close()
    except Exception as e:
        logger.error(f"关闭数据库连接失败: {e}")

try:
    db.connect()
    print("数据库连接成功!")
except Exception as e:
    print(f"数据库连接失败: {e}")