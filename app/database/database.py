from peewee import MySQLDatabase, InterfaceError as PeeweeInterfaceError, OperationalError as PeeweeOperationalError
from playhouse.pool import PooledMySQLDatabase
from contextlib import contextmanager
import yaml
import os
import logging
import pymysql
import threading
import time

logger = logging.getLogger(__name__)

config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

# 线程本地存储，用于跟踪每个线程是否获取了连接
# 这样可以确保每个线程独立管理自己的连接生命周期
_thread_local = threading.local()


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


# 创建连接池数据库实例
db = RetryPooledMySQLDatabase(
    config['mysql']['name'],
    user=config['mysql']['user'],
    password=config['mysql']['password'],
    host=config['mysql']['host'],
    port=config['mysql']['port'],
    charset='utf8mb4',
    max_connections=config['mysql'].get('max_connections', 32),
    stale_timeout=config['mysql'].get('stale_timeout', 300),
    connect_timeout=config['mysql'].get('connect_timeout', 10),
)

def get_db_connection():
    """
    获取数据库连接，如果连接已断开则重新连接
    
    注意：调用此函数后，必须在操作完成后调用 close_db_connection() 释放连接
    对于HTTP请求，中间件会自动处理；对于后台线程，需要手动管理或使用 db_connection_scope()
    
    Returns:
        MySQLDatabase: 数据库连接对象
    """
    try:
        if db.is_closed():
            db.connect(reuse_if_open=True)
            # 标记当前线程已获取连接
            _thread_local.connection_acquired = True
            logger.debug(f"线程 {threading.current_thread().name} 获取数据库连接")
        # 健康检查：ping底层pymysql连接，失效则自动重连TCP连接
        # 解决连接池中连接长时间空闲被MySQL服务端断开的问题
        try:
            conn = db.connection()
            if conn is not None and hasattr(conn, 'ping'):
                conn.ping(reconnect=True)
        except Exception as ping_error:
            logger.warning(f"数据库连接ping失败，尝试重连: {ping_error}")
            db.close()
            db.connect(reuse_if_open=True)
            # 重连后再次ping确认
            conn = db.connection()
            if conn is not None and hasattr(conn, 'ping'):
                conn.ping(reconnect=True)
            _thread_local.connection_acquired = True
    except Exception as e:
        logger.error(f"数据库连接失败: {e}")
        try:
            db.close()
            db.connect(reuse_if_open=True)
            _thread_local.connection_acquired = True
        except Exception as retry_error:
            logger.error(f"数据库重连失败: {retry_error}")
            raise
    return db


def close_db_connection():
    """
    关闭数据库连接，将连接归还到连接池
    
    对于HTTP请求，中间件会自动调用此函数；
    对于后台线程，需要手动调用或使用 db_connection_scope()
    """
    try:
        if not db.is_closed():
            db.close()
            # 清除当前线程的连接标记
            if hasattr(_thread_local, 'connection_acquired'):
                delattr(_thread_local, 'connection_acquired')
            logger.debug(f"线程 {threading.current_thread().name} 释放数据库连接")
    except Exception as e:
        logger.error(f"关闭数据库连接失败: {e}")


def close_stale_thread_connections(max_age=300):
    """
    关闭长时间未释放的连接（用于清理后台线程中可能泄漏的连接）
    
    Args:
        max_age: 连接最大存活时间（秒），超过此时间的连接将被强制关闭
    """
    try:
        # 调用Peewee连接池的close_stale方法
        if hasattr(db, 'close_stale'):
            closed_count = db.close_stale(age=max_age)
            if closed_count > 0:
                logger.warning(f"强制关闭了 {closed_count} 个长时间未释放的数据库连接")
    except Exception as e:
        logger.error(f"清理过期连接失败: {e}")


@contextmanager
def db_connection_scope():
    """
    数据库连接上下文管理器
    
    在进入上下文时获取数据库连接，在退出上下文时（无论成功或异常）
    将连接归还到连接池，避免连接泄露。
    
    使用示例:
        with db_connection_scope():
            # 执行数据库操作
            users = User.select()
            # 退出上下文时自动释放连接
    """
    try:
        get_db_connection()
        yield
    finally:
        close_db_connection()

def get_pool_status():
    """
    获取连接池状态信息
    
    Returns:
        dict: 包含连接池状态信息的字典
    """
    try:
        # 获取连接池的状态信息
        in_use_count = len(db._in_use) if hasattr(db, '_in_use') else 0
        free_count = len(db._connections) if hasattr(db, '_connections') else 0
        max_conn = db._max_connections if hasattr(db, '_max_connections') else 0
        
        return {
            'in_use': in_use_count,  # 正在使用的连接数
            'free': free_count,      # 空闲的连接数
            'max': max_conn,         # 最大连接数
            'total': in_use_count + free_count,  # 总连接数
            'is_closed': db.is_closed()  # 数据库是否关闭
        }
    except Exception as e:
        logger.error(f"获取连接池状态失败: {e}")
        return {
            'in_use': 0,
            'free': 0,
            'max': 0,
            'total': 0,
            'is_closed': True,
            'error': str(e)
        }

def log_pool_status_periodically():
    """
    定期记录连接池状态到日志，并主动回收泄漏的连接
    
    线程池(thread_pool_exec/asyncio.to_thread)中的线程执行DB操作后
    不会主动归还连接，需要通过close_stale定期强制回收。
    """
    while True:
        try:
            # 主动回收超过stale_timeout的in_use连接（线程池泄漏的连接）
            if hasattr(db, 'close_stale'):
                closed_count = db.close_stale()
                if closed_count > 0:
                    logger.warning(f"[连接池清理] 回收了 {closed_count} 个过期未释放的数据库连接")
            
            pool_status = get_pool_status()
            logger.info(
                f"数据库连接池状态 - 正在使用: {pool_status['in_use']}, "
                f"空闲: {pool_status['free']}, "
                f"总数: {pool_status['total']}, "
                f"最大: {pool_status['max']}, "
                f"是否关闭: {pool_status['is_closed']}"
            )
            
            # 如果连接数超过80%,发出警告并紧急清理
            if pool_status['max'] > 0 and pool_status['in_use'] > pool_status['max'] * 0.8:
                logger.warning(
                    f"数据库连接池使用率超过80%! "
                    f"当前使用: {pool_status['in_use']}/{pool_status['max']}, "
                    f"正在执行紧急清理..."
                )
                # 紧急清理：用更短的age强制回收更多连接
                if hasattr(db, 'close_stale'):
                    emergency_closed = db.close_stale(age=30)
                    if emergency_closed > 0:
                        logger.warning(f"[紧急清理] 强制回收了 {emergency_closed} 个连接")
        except Exception as e:
            logger.error(f"监控连接池状态失败: {e}")
        
        # 每60秒检查并清理一次（缩短间隔以更快地回收泄漏连接）
        time.sleep(60)

# 启动连接池监控线程
_pool_monitor_thread = threading.Thread(
    target=log_pool_status_periodically,
    daemon=True,
    name="DatabasePoolMonitor"
)
_pool_monitor_thread.start()

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
