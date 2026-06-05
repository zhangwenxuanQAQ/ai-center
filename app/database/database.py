from peewee import MySQLDatabase, InterfaceError as PeeweeInterfaceError, OperationalError as PeeweeOperationalError
from playhouse.pool import PooledMySQLDatabase
import yaml
import os
import logging
import pymysql

logger = logging.getLogger(__name__)

config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)


class RetryPooledMySQLDatabase(PooledMySQLDatabase):
    """
    支持自动重连的MySQL连接池数据库
    
    当连接失效时自动重连并重试SQL执行
    """
    
    def execute_sql(self, *args, **kwargs):
        """
        执行SQL语句，支持自动重连
        
        Args:
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            游标对象
        """
        retries = 3
        last_error = None
        
        for attempt in range(retries):
            try:
                return super().execute_sql(*args, **kwargs)
            except (PeeweeInterfaceError, PeeweeOperationalError, 
                    pymysql.err.InterfaceError, pymysql.err.OperationalError) as e:
                last_error = e
                logger.warning(f"数据库连接错误 (尝试 {attempt + 1}/{retries}): {e}")
                
                try:
                    self.close()
                    self.connect()
                except Exception as reconnect_error:
                    logger.error(f"数据库重连失败: {reconnect_error}")
                    
                if attempt == retries - 1:
                    sql = args[0] if args else 'unknown'
                    logger.error(f"数据库执行SQL失败，已重试{retries}次: {sql}")
                    raise last_error
                    
        raise last_error


db = RetryPooledMySQLDatabase(
    config['mysql']['name'],
    user=config['mysql']['user'],
    password=config['mysql']['password'],
    host=config['mysql']['host'],
    port=config['mysql']['port'],
    charset='utf8mb4',
    max_connections=config['mysql'].get('max_connections', 20),
    stale_timeout=1800,
)

def get_db_connection():
    """
    获取数据库连接，如果连接已断开则重新连接

    Returns:
        MySQLDatabase: 数据库连接对象
    """
    try:
        if not db.is_closed():
            try:
                db.execute_sql('SELECT 1')
            except Exception:
                db.close()
                db.connect(reuse_if_open=True)
        else:
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

def create_database_if_not_exists():
    """
    检查数据库是否存在，如果不存在则创建
    """
    try:
        db_name = config['mysql']['name']
        db_user = config['mysql']['user']
        db_password = config['mysql']['password']
        db_host = config['mysql']['host']
        db_port = config['mysql']['port']

        logger.info(f"[DB] 检查数据库 {db_name} 是否存在...")

        connection = pymysql.connect(
            host=db_host,
            port=int(db_port),
            user=db_user,
            password=db_password,
            charset='utf8mb4'
        )

        try:
            with connection.cursor() as cursor:
                cursor.execute(f"SHOW DATABASES LIKE '{db_name}'")
                result = cursor.fetchone()

                if result is None:
                    logger.info(f"[DB] 数据库 {db_name} 不存在，正在创建...")
                    cursor.execute(f"CREATE DATABASE `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                    logger.info(f"[DB] 数据库 {db_name} 创建成功")
                else:
                    logger.info(f"[DB] 数据库 {db_name} 已存在")
        finally:
            connection.close()

    except Exception as e:
        logger.error(f"[DB] 创建数据库失败: {e}")
        raise

try:
    db.connect()
    logger.info("数据库连接成功!")
except Exception as e:
    logger.error(f"数据库连接失败: {e}")
