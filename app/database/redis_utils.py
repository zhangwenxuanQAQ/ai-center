"""
Redis工具类
提供Redis连接、队列操作、任务调度等功能
参考RAGFLOW的redis_conn.py实现
"""

import logging
import json
from typing import Optional, Dict, Any, List, Callable

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False

from app.configs.config import config as app_config

logger = logging.getLogger(__name__)


class RedisMsg:
    """Redis消息封装类"""

    def __init__(self, consumer, queue_name, group_name, msg_id, message):
        self.__consumer = consumer
        self.__queue_name = queue_name
        self.__group_name = group_name
        self.__msg_id = msg_id
        self.__message = json.loads(message["message"])

    def ack(self) -> bool:
        """确认消息处理完成"""
        try:
            self.__consumer.xack(self.__queue_name, self.__group_name, self.__msg_id)
            return True
        except Exception as e:
            logger.warning(f"[EXCEPTION]ack {self.__queue_name}||{str(e)}")
        return False

    def get_message(self) -> Dict[str, Any]:
        """获取消息内容"""
        return self.__message

    def get_msg_id(self) -> str:
        """获取消息ID"""
        return self.__msg_id


class RedisUtils:
    """Redis工具类（单例模式）"""

    _instance: Optional['RedisUtils'] = None
    _redis_client: Optional[Any] = None
    _is_connected: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """
        初始化Redis连接
        """
        if not REDIS_AVAILABLE:
            logger.warning("redis-py库未安装，Redis功能不可用。请运行: pip install redis")
            self._redis_client = None
            return

        try:
            redis_config = app_config.config.get('redis', {})

            host = redis_config.get('host', '127.0.0.1')
            port = redis_config.get('port', 6379)
            db = redis_config.get('db', 1)
            username = redis_config.get('username', '')
            password = redis_config.get('password', '')

            conn_params = {
                'host': host,
                'port': port,
                'db': db,
                'decode_responses': True,
            }

            if username:
                conn_params['username'] = username
            if password:
                conn_params['password'] = password

            self._redis_client = redis.StrictRedis(**conn_params)

            # 测试连接
            self._redis_client.ping()
            self._is_connected = True

            logger.info(f"成功连接到Redis: {host}:{port}, DB: {db}")

        except Exception as e:
            logger.error(f"初始化Redis连接失败: {e}")
            self._redis_client = None
            self._is_connected = False

    @property
    def is_available(self) -> bool:
        """检查Redis功能是否可用"""
        return REDIS_AVAILABLE and self._redis_client is not None and self._is_connected

    @property
    def client(self) -> Optional[Any]:
        """获取Redis客户端实例"""
        return self._redis_client

    def _reconnect(self) -> bool:
        """重新连接Redis"""
        logger.info("尝试重新连接Redis...")
        self._initialize()
        return self._is_connected

    # ==================== 基本操作 ====================

    def health(self) -> bool:
        """健康检查"""
        if not self._redis_client:
            return False

        try:
            self._redis_client.ping()
            test_key, test_val = "redis_health_check", "ok"
            self._redis_client.set(test_key, test_val, ex=3)

            if self._redis_client.get(test_key) == test_val:
                return True
            return False
        except Exception as e:
            logger.warning(f"Redis健康检查失败: {e}")
            self._reconnect()
            return False

    def info(self) -> Optional[Dict[str, Any]]:
        """获取Redis信息"""
        if not self._redis_client:
            return None

        try:
            info = self._redis_client.info()
            return {
                'redis_version': info.get('redis_version', ''),
                'redis_mode': info.get('redis_mode', ''),
                'used_memory': info.get('used_memory_human', ''),
                'connected_clients': info.get('connected_clients', 0),
                'instantaneous_ops_per_sec': info.get('instantaneous_ops_per_sec', 0),
            }
        except Exception as e:
            logger.warning(f"获取Redis信息失败: {e}")
            return None

    def get(self, key: str) -> Optional[str]:
        """获取值"""
        if not self._redis_client:
            return None

        try:
            return self._redis_client.get(key)
        except Exception as e:
            logger.warning(f"Redis.get {key} got exception: {e}")
            self._reconnect()
            return None

    def set(self, key: str, value: str, exp: int = 3600) -> bool:
        """设置值"""
        if not self._redis_client:
            return False

        try:
            self._redis_client.set(key, value, ex=exp)
            return True
        except Exception as e:
            logger.warning(f"Redis.set {key} got exception: {e}")
            self._reconnect()
            return False

    def set_obj(self, key: str, obj: Any, exp: int = 3600) -> bool:
        """设置对象（自动JSON序列化）"""
        if not self._redis_client:
            return False

        try:
            self._redis_client.set(key, json.dumps(obj, ensure_ascii=False), ex=exp)
            return True
        except Exception as e:
            logger.warning(f"Redis.set_obj {key} got exception: {e}")
            self._reconnect()
            return False

    def get_obj(self, key: str) -> Optional[Any]:
        """获取对象（自动JSON反序列化）"""
        if not self._redis_client:
            return None

        try:
            value = self._redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning(f"Redis.get_obj {key} got exception: {e}")
            self._reconnect()
            return None

    def exists(self, key: str) -> bool:
        """检查Key是否存在"""
        if not self._redis_client:
            return False

        try:
            return self._redis_client.exists(key) > 0
        except Exception as e:
            logger.warning(f"Redis.exists {key} got exception: {e}")
            self._reconnect()
            return False

    def delete(self, key: str) -> bool:
        """删除Key"""
        if not self._redis_client:
            return False

        try:
            self._redis_client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis.delete {key} got exception: {e}")
            self._reconnect()
            return False

    def incrby(self, key: str, increment: int = 1) -> Optional[int]:
        """递增"""
        if not self._redis_client:
            return None

        try:
            return self._redis_client.incrby(key, increment)
        except Exception as e:
            logger.warning(f"Redis.incrby {key} got exception: {e}")
            self._reconnect()
            return None

    # ==================== 队列操作 ====================

    def queue_product(self, queue: str, message: Dict[str, Any]) -> bool:
        """
        发送消息到队列
        
        Args:
            queue: 队列名称
            message: 消息内容
            
        Returns:
            bool: 是否成功
        """
        if not self._redis_client:
            return False

        for retry in range(3):
            try:
                payload = {"message": json.dumps(message)}
                self._redis_client.xadd(queue, payload)
                logger.debug(f"成功发送消息到队列: {queue}")
                return True
            except Exception as e:
                logger.exception(f"Redis.queue_product {queue} got exception (retry {retry+1}/3): {e}")
                if retry < 2:
                    self._reconnect()
        return False

    def queue_consumer(
        self,
        queue_name: str,
        group_name: str,
        consumer_name: str,
        msg_id: str = ">"
    ) -> Optional[RedisMsg]:
        """
        从队列消费消息（使用消费者组）
        
        Args:
            queue_name: 队列名称
            group_name: 消费者组名称
            consumer_name: 消费者名称
            msg_id: 消息ID，">"表示新消息
            
        Returns:
            RedisMsg or None: 消息对象
        """
        if not self._redis_client:
            return None

        for retry in range(3):
            try:
                # 尝试创建消费者组
                try:
                    group_info = self._redis_client.xinfo_groups(queue_name)
                    if not any(gi["name"] == group_name for gi in group_info):
                        self._redis_client.xgroup_create(queue_name, group_name, id="0", mkstream=True)
                except redis.exceptions.ResponseError as e:
                    if "no such key" in str(e).lower():
                        self._redis_client.xgroup_create(queue_name, group_name, id="0", mkstream=True)
                    elif "busygroup" in str(e).lower():
                        logger.warning("Group already exists, continue.")
                    else:
                        raise

                # 读取消息
                args = {
                    "groupname": group_name,
                    "consumername": consumer_name,
                    "count": 1,
                    "block": 5000,  # 5秒超时
                    "streams": {queue_name: msg_id},
                }
                
                messages = self._redis_client.xreadgroup(**args)
                if not messages:
                    return None
                
                stream, element_list = messages[0]
                if not element_list:
                    return None
                
                msg_id, payload = element_list[0]
                res = RedisMsg(self._redis_client, queue_name, group_name, msg_id, payload)
                return res
                
            except Exception as e:
                if str(e) == 'no such key':
                    pass
                else:
                    logger.exception(f"Redis.queue_consumer {queue_name} got exception (retry {retry+1}/3): {e}")
                    if retry < 2:
                        self._reconnect()
        return None

    def queue_info(self, queue: str, group_name: str) -> Optional[Dict[str, Any]]:
        """
        获取队列信息
        
        Args:
            queue: 队列名称
            group_name: 消费者组名称
            
        Returns:
            dict: 队列信息
        """
        if not self._redis_client:
            return None

        for retry in range(3):
            try:
                groups = self._redis_client.xinfo_groups(queue)
                for group in groups:
                    if group["name"] == group_name:
                        return group
            except Exception as e:
                logger.warning(f"Redis.queue_info {queue} got exception (retry {retry+1}/3): {e}")
                if retry < 2:
                    self._reconnect()
        return None

    def get_pending_msg(self, queue: str, group_name: str) -> List[Dict[str, Any]]:
        """
        获取待确认消息
        
        Args:
            queue: 队列名称
            group_name: 消费者组名称
            
        Returns:
            list: 待确认消息列表
        """
        if not self._redis_client:
            return []

        try:
            messages = self._redis_client.xpending_range(queue, group_name, '-', '+', 10)
            return messages
        except Exception as e:
            if 'No such key' not in (str(e) or ''):
                logger.warning(f"Redis.get_pending_msg {queue} got exception: {e}")
        return []


# 全局单例实例
redis_utils = RedisUtils()
