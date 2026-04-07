"""
Elasticsearch工具类
用于文档切片后的向量存储和检索

功能特性:
- 自动版本检查（要求ES 8.x）
- 全局重试机制（ATTEMPT_TIME=2）
- 完善的错误处理和日志记录
"""

import logging
import time
from functools import wraps
from typing import Optional, Dict, Any, List, Callable

try:
    from elasticsearch import Elasticsearch
    from elasticsearch.helpers import bulk
    ELASTICSEARCH_AVAILABLE = True
except ImportError:
    Elasticsearch = None
    bulk = None
    ELASTICSEARCH_AVAILABLE = False

from app.configs.config import config as app_config

logger = logging.getLogger(__name__)

# 全局重试次数配置
ATTEMPT_TIME = 2


def retry_on_failure(func: Callable) -> Callable:
    """
    重试装饰器
    
    为ES操作提供自动重试机制，当操作失败时会自动重试ATTEMPT_TIME次
    
    执行流程:
    - 第1次: 初始执行
    - 第2~ATTEMPT_TIME+1次: 重试执行（每次间隔递增）
    
    Args:
        func: 需要添加重试机制的函数
        
    Returns:
        Callable: 包装后的函数
    """
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        if not self._es_client:
            logger.error("ES客户端未初始化")
            return self._get_default_return_value(func.__name__)
        
        last_exception = None
        total_attempts = 1 + ATTEMPT_TIME  # 初始执行 + 重试次数
        
        for attempt in range(1, total_attempts + 1):
            try:
                result = func(self, *args, **kwargs)
                if attempt > 1:
                    logger.info(f"{func.__name__} 第{attempt}次尝试成功")
                return result
            except Exception as e:
                last_exception = e
                logger.warning(
                    f"{func.__name__} 第{attempt}/{total_attempts}次尝试失败: {e}"
                )
                if attempt < total_attempts:
                    time.sleep(0.5 * attempt)  # 递增延迟
        
        logger.error(f"{func.__name__} 经过{total_attempts}次尝试后仍然失败: {last_exception}")
        return self._get_default_return_value(func.__name__)
    
    return wrapper


class ESUtils:
    """ES连接和操作工具类"""

    _instance: Optional['ESUtils'] = None
    _es_client: Optional[Elasticsearch] = None
    _es_version: str = ""
    _is_version_valid: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """
        初始化ES连接并进行版本检查
        
        功能:
        1. 建立ES连接
        2. 获取并验证ES版本号
        3. 如果版本不是8.x，记录错误日志并抛出异常
        """
        if not ELASTICSEARCH_AVAILABLE:
            logger.warning("Elasticsearch库未安装，ES功能不可用。请运行: pip install elasticsearch")
            self._es_client = None
            return
            
        try:
            es_config = app_config.config.get('es', {})

            host = es_config.get('host', '127.0.0.1')
            port = es_config.get('port', 9200)
            username = es_config.get('username', 'elastic')
            password = es_config.get('password', '')

            if username and password:
                self._es_client = Elasticsearch(
                    hosts=[f"http://{host}:{port}"],
                    basic_auth=(username, password),
                    timeout=30,
                    max_retries=3,
                    retry_on_timeout=True,
                )
            else:
                self._es_client = Elasticsearch(
                    hosts=[f"http://{host}:{port}"],
                    timeout=30,
                    max_retries=3,
                    retry_on_timeout=True,
                )

            # 测试连接
            if not self._es_client.ping():
                logger.error(f"无法连接到Elasticsearch: {host}:{port}")
                raise ConnectionError(f"无法连接到Elasticsearch服务: {host}:{port}")
            
            # 获取ES版本信息
            info = self._es_client.info()
            version_info = info.get('version', {})
            version_number = version_info.get('number', 'unknown')
            
            self._es_version = str(version_number).split('-')[0]  # 去掉可能的SNAPSHOT后缀
            self._is_version_valid = self._check_es_version()
            
            if not self._is_version_valid:
                error_msg = (
                    f"Elasticsearch版本不支持! "
                    f"当前版本: {self._es_version}, 要求版本: 8.x及以上"
                )
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            logger.info(
                f"成功连接到Elasticsearch: {host}:{port}, "
                f"版本: {self._es_version}"
            )
            
        except (ConnectionError, ValueError):
            raise  # 版本检查或连接错误直接抛出
        except Exception as e:
            logger.error(f"初始化Elasticsearch连接失败: {e}")
            self._es_client = None

    def _check_es_version(self) -> bool:
        """
        检查ES版本是否为8.x
        
        Returns:
            bool: 如果版本号以8开头返回True，否则False
        """
        if not self._es_version:
            return False
            
        major_version = self._es_version.split('.')[0]
        
        try:
            return int(major_version) == 8
        except ValueError:
            logger.warning(f"无法解析ES版本号: {self._es_version}")
            return False

    def _get_default_return_value(self, method_name: str):
        """
        根据方法名返回默认值
        
        Args:
            method_name: 方法名
            
        Returns:
            方法的默认返回值
        """
        default_returns = {
            'create_index': False,
            'insert_document': False,
            'batch_insert_documents': 0,
            'search_documents': [],
            'vector_search': [],
            'delete_document': False,
            'delete_by_query': 0,
            'count_documents': 0,
            'check_connection': False,
        }
        return default_returns.get(method_name, None)

    @property
    def is_available(self) -> bool:
        """检查ES功能是否可用"""
        return ELASTICSEARCH_AVAILABLE and self._es_client is not None and self._is_version_valid

    @property
    def client(self) -> Optional[Elasticsearch]:
        """获取ES客户端实例"""
        return self._es_client

    @property
    def version(self) -> str:
        """获取ES版本号"""
        return self._es_version

    @retry_on_failure
    def check_connection(self) -> bool:
        """检查ES连接状态"""
        return self._es_client.ping()

    @retry_on_failure
    def create_index(self, index_name: str, mappings: Dict[str, Any] = None) -> bool:
        """
        创建索引（带重试机制）

        Args:
            index_name: 索引名称
            mappings: 索引映射配置

        Returns:
            bool: 是否创建成功
        """
        if not self._es_client.indices.exists(index=index_name):
            body = {
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                },
                "mappings": mappings or {
                    "properties": {
                        "content": {"type": "text", "analyzer": "ik_max_word"},
                        "content_vector": {
                            "type": "dense_vector",
                            "dims": 1024,
                            "index": True,
                            "similarity": "cosine",
                        },
                        "doc_name": {"type": "keyword"},
                        "doc_type": {"type": "keyword"},
                        "kb_id": {"type": "keyword"},
                        "created_at": {"type": "date"},
                    }
                },
            }
            self._es_client.indices.create(index=index_name, body=body)
            logger.info(f"成功创建索引: {index_name}")
            return True
        else:
            logger.info(f"索引已存在: {index_name}")
            return True

    @retry_on_failure
    def insert_document(self, index_name: str, doc: Dict[str, Any]) -> bool:
        """
        插入单个文档（带重试机制）

        Args:
            index_name: 索引名称
            doc: 文档数据

        Returns:
            bool: 是否插入成功
        """
        res = self._es_client.index(index=index_name, body=doc)
        logger.debug(f"插入文档成功, _id: {res.get('_id')}")
        return True

    @retry_on_failure
    def batch_insert_documents(self, index_name: str, docs: List[Dict[str, Any]]) -> int:
        """
        批量插入文档（带重试机制）

        Args:
            index_name: 索引名称
            docs: 文档列表

        Returns:
            int: 成功插入的文档数量
        """
        actions = [
            {
                "_index": index_name,
                "_source": doc,
            }
            for doc in docs
        ]
        success, failed = bulk(self._es_client, actions)
        logger.info(f"批量插入完成, 成功: {success}, 失败: {len(failed)}")
        return success

    @retry_on_failure
    def search_documents(
        self,
        index_name: str,
        query: Dict[str, Any],
        size: int = 10,
        from_: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        搜索文档（带重试机制）

        Args:
            index_name: 索引名称
            query: 查询条件
            size: 返回数量
            from_: 起始位置

        Returns:
            List[Dict]: 文档列表
        """
        res = self._es_client.search(
            index=index_name,
            body=query,
            size=size,
            from_=from_,
        )
        hits = res.get('hits', {}).get('hits', [])
        return [hit.get('_source', {}) for hit in hits]

    @retry_on_failure
    def vector_search(
        self,
        index_name: str,
        vector: List[float],
        kb_id: str = None,
        top_k: int = 10,
        min_score: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        向量相似度搜索（带重试机制）

        Args:
            index_name: 索引名称
            vector: 查询向量
            kb_id: 知识库ID（可选）
            top_k: 返回Top K结果
            min_score: 最小相似度分数

        Returns:
            List[Dict]: 相似文档列表
        """
        query_body = {
            "size": top_k,
            "min_score": min_score,
            "query": {
                "script_score": {
                    "query": {"match_all": {}},
                    "script": {
                        "source": "cosineSimilarity(params.query_vector, 'content_vector') + 1.0",
                        "params": {"query_vector": vector},
                    },
                }
            },
        }

        if kb_id:
            query_body["query"]["script_score"]["query"] = {
                "bool": {
                    "filter": [{"term": {"kb_id": kb_id}}]
                }
            }

        res = self._es_client.search(index=index_name, body=query_body)
        hits = res.get('hits', {}).get('hits', [])
        results = []
        for hit in hits:
            source = hit.get('_source', {})
            source['_score'] = hit.get('_score', 0)
            source['_id'] = hit.get('_id')
            results.append(source)

        return results

    @retry_on_failure
    def delete_document(self, index_name: str, doc_id: str) -> bool:
        """
        删除文档（带重试机制）

        Args:
            index_name: 索引名称
            doc_id: 文档ID

        Returns:
            bool: 是否删除成功
        """
        self._es_client.delete(index=index_name, id=doc_id)
        logger.info(f"删除文档成功: {doc_id}")
        return True

    @retry_on_failure
    def delete_by_query(self, index_name: str, query: Dict[str, Any]) -> int:
        """
        根据查询条件删除文档（带重试机制）

        Args:
            index_name: 索引名称
            query: 删除条件

        Returns:
            int: 删除的文档数量
        """
        res = self._es_client.delete_by_query(
            index=index_name,
            body=query,
            wait_for_completion=True,
        )
        deleted_count = res.get('deleted', 0)
        logger.info(f"根据条件删除文档, 数量: {deleted_count}")
        return deleted_count

    @retry_on_failure
    def count_documents(self, index_name: str, query: Dict[str, Any] = None) -> int:
        """
        统计文档数量（带重试机制）

        Args:
            index_name: 索引名称
            query: 查询条件（可选）

        Returns:
            int: 文档数量
        """
        body = query if query else {"query": {"match_all": {}}}
        res = self._es_client.count(index=index_name, body=body)
        count = res.get('count', 0)
        return count


# 全局单例实例
es_utils = ESUtils()
