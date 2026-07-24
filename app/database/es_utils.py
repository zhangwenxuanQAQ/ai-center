"""
Elasticsearch工具类
用于文档切片后的向量存储和检索

功能特性:
- 自动版本检查（要求ES 8.x或9.x）
- 全局重试机制（ATTEMPT_TIME=2）
- 完善的错误处理和日志记录
- 兼容ES 9.x Python客户端（不支持位置参数和body参数）
- 混合检索（向量+关键词）和Rerank重排序
"""

import logging
import math
import time
from collections import OrderedDict
from dataclasses import dataclass
from functools import wraps
from typing import Optional, Dict, Any, List, Callable, Tuple
import json
import numpy as np

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

ATTEMPT_TIME = 2


@dataclass
class SearchResult:
    """ES检索结果数据类"""
    total: int
    ids: List[str]
    query_vector: List[float]
    field: Dict[str, Dict[str, Any]]
    keywords: List[str]

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
        self._ensure_initialized()
        if not self._es_client:
            logger.error("ES客户端未初始化")
            return self._get_default_return_value(func.__name__)

        last_exception = None
        total_attempts = 1 + ATTEMPT_TIME

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
                    time.sleep(0.5 * attempt)

        logger.error(f"{func.__name__} 经过{total_attempts}次尝试后仍然失败: {last_exception}")
        return self._get_default_return_value(func.__name__)

    return wrapper


class ESUtils:
    """ES连接和操作工具类"""

    _instance: Optional['ESUtils'] = None
    _es_client: Optional[Elasticsearch] = None
    _es_version: str = ""
    _is_version_valid: bool = False
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _ensure_initialized(self):
        """懒加载初始化，首次使用时才建立连接"""
        if not self._initialized:
            self._initialized = True
            self._initialize()

    def _initialize(self):
        """
        初始化ES连接并进行版本检查

        功能:
        1. 建立ES连接
        2. 获取并验证ES版本号
        3. 如果版本不是8.x或9.x，记录错误日志并抛出异常
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
            scheme = es_config.get('scheme', 'http')

            es_url = f"{scheme}://{host}:{port}"

            common_params = {
                "max_retries": 3,
                "retry_on_timeout": True,
                "verify_certs": False,
                "request_timeout": 30,
            }

            if username and password:
                self._es_client = Elasticsearch(
                    hosts=[es_url],
                    basic_auth=(username, password),
                    **common_params
                )
            else:
                self._es_client = Elasticsearch(
                    hosts=[es_url],
                    **common_params
                )

            if not self._es_client.ping():
                logger.error(f"无法连接到Elasticsearch: {host}:{port}")
                raise ConnectionError(f"无法连接到Elasticsearch服务: {host}:{port}")

            info = self._es_client.info()
            version_info = info.get('version', {})
            version_number = version_info.get('number', 'unknown')

            self._es_version = str(version_number).split('-')[0]
            self._is_version_valid = self._check_es_version()

            if not self._is_version_valid:
                error_msg = (
                    f"Elasticsearch版本不支持! "
                    f"当前版本: {self._es_version}, 要求版本: 8.x或9.x"
                )
                logger.error(error_msg)
                raise ValueError(error_msg)

            logger.info(
                f"成功连接到Elasticsearch: {host}:{port}, "
                f"版本: {self._es_version}"
            )

        except (ConnectionError, ValueError):
            raise
        except Exception as e:
            logger.error(f"初始化Elasticsearch连接失败: {e}")
            self._es_client = None

    def _check_es_version(self) -> bool:
        """
        检查ES版本是否为8.x或9.x

        Returns:
            bool: 如果版本号为8或9开头返回True，否则False
        """
        if not self._es_version:
            return False

        major_version = self._es_version.split('.')[0]

        try:
            version_int = int(major_version)
            return version_int == 8 or version_int == 9
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
            'hybrid_search': SearchResult(total=0, ids=[], query_vector=[], field={}, keywords=[]),
            'delete_document': False,
            'delete_by_query': 0,
            'count_documents': 0,
            'check_connection': False,
            'get_indices_info': [],
            'get_cluster_health': {},
            'get_cluster_stats': {},
        }
        return default_returns.get(method_name, None)

    @property
    def is_available(self) -> bool:
        """检查ES功能是否可用"""
        self._ensure_initialized()
        return ELASTICSEARCH_AVAILABLE and self._es_client is not None and self._is_version_valid

    @property
    def client(self) -> Optional[Elasticsearch]:
        """获取ES客户端实例"""
        self._ensure_initialized()
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
    def get_cluster_health(self) -> Dict[str, Any]:
        """
        获取集群健康状态

        Returns:
            Dict: 集群健康信息
        """
        health = self._es_client.cluster.health()
        return {
            "status": health.get("status", "unknown"),
            "number_of_nodes": health.get("number_of_nodes", 0),
            "number_of_data_nodes": health.get("number_of_data_nodes", 0),
            "active_primary_shards": health.get("active_primary_shards", 0),
            "active_shards": health.get("active_shards", 0),
            "relocating_shards": health.get("relocating_shards", 0),
            "initializing_shards": health.get("initializing_shards", 0),
            "unassigned_shards": health.get("unassigned_shards", 0),
            "delayed_unassigned_shards": health.get("delayed_unassigned_shards", 0),
            "number_of_pending_tasks": health.get("number_of_pending_tasks", 0),
            "number_of_in_flight_fetch": health.get("number_of_in_flight_fetch", 0),
            "task_max_waiting_in_queue_millis": health.get("task_max_waiting_in_queue_millis", 0),
            "active_shards_percent_as_number": health.get("active_shards_percent_as_number", 0),
        }

    @retry_on_failure
    def get_cluster_stats(self) -> Dict[str, Any]:
        """
        获取集群统计信息

        Returns:
            Dict: 集群统计信息
        """
        stats = self._es_client.cluster.stats()
        nodes = stats.get("nodes", {})
        indices = stats.get("indices", {})
        return {
            "nodes_count": nodes.get("count", {}).get("total", 0),
            "data_nodes_count": nodes.get("count", {}).get("data", 0),
            "coordinating_only_nodes": nodes.get("count", {}).get("coordinating_only", 0),
            "heap_max_in_bytes": nodes.get("jvm", {}).get("heap_max_in_bytes", 0),
            "heap_used_in_bytes": nodes.get("jvm", {}).get("heap_used_in_bytes", 0),
            "indices_count": indices.get("count", 0),
            "docs_count": indices.get("docs", {}).get("count", 0),
            "store_size_in_bytes": indices.get("store", {}).get("size_in_bytes", 0),
            "shards_total": indices.get("shards", {}).get("total", 0),
            "shards_primaries": indices.get("shards", {}).get("primaries", 0),
        }

    @retry_on_failure
    def get_indices_info(self) -> List[Dict[str, Any]]:
        """
        获取所有索引信息

        Returns:
            List[Dict]: 索引信息列表
        """
        indices = self._es_client.indices.get_alias(name="*")
        result = []
        for index_name, info in indices.items():
            if not index_name.startswith("."):
                stats = self._es_client.indices.stats(index=index_name)
                index_stats = stats.get("indices", {}).get(index_name, {})
                result.append({
                    "name": index_name,
                    "health": info.get("health", "unknown"),
                    "status": info.get("status", "unknown"),
                    "docs_count": index_stats.get("total", {}).get("docs", {}).get("count", 0),
                    "store_size": index_stats.get("total", {}).get("store", {}).get("size_in_bytes", 0),
                    "primaries": info.get("settings", {}).get("index", {}).get("number_of_shards", 1),
                    "replicas": info.get("settings", {}).get("index", {}).get("number_of_replicas", 0),
                })
        return result

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
            settings = {
                "number_of_shards": 1,
                "number_of_replicas": 0,
            }
            index_mappings = mappings or {
                "properties": {
                    "content": {"type": "text", "analyzer": "ik_max_word"},
                    "content_with_weight": {"type": "text", "analyzer": "ik_max_word"},
                    "content_ltks": {"type": "text", "analyzer": "ik_max_word"},
                    "content_sm_ltks": {"type": "text", "analyzer": "ik_max_word"},
                    "important_kwd": {"type": "keyword"},
                    "important_tks": {"type": "text", "analyzer": "ik_max_word"},
                    "content_vector": {
                        "type": "dense_vector",
                        "dims": 1024,
                        "index": True,
                        "similarity": "cosine",
                    },
                    "doc_name": {"type": "keyword"},
                    "doc_type": {"type": "keyword"},
                    "kb_id": {"type": "keyword"},
                    "doc_id": {"type": "keyword"},
                    "available_int": {"type": "integer"},
                    "page_num_int": {"type": "integer"},
                    "top_int": {"type": "integer"},
                    "create_timestamp_flt": {"type": "float"},
                    "created_at": {"type": "date"},
                }
            }
            self._es_client.indices.create(
                index=index_name,
                settings=settings,
                mappings=index_mappings,
            )
            logger.info(f"成功创建索引: {index_name}")
            return True
        else:
            logger.info(f"索引已存在: {index_name}")
            return True

    @retry_on_failure
    def insert_document(self, index_name: str, doc: Dict[str, Any], doc_id: str = None) -> bool:
        """
        插入单个文档（带重试机制）

        Args:
            index_name: 索引名称
            doc: 文档数据
            doc_id: 文档ID（可选，不指定则由ES自动生成）

        Returns:
            bool: 是否插入成功
        """
        if doc_id:
            res = self._es_client.index(index=index_name, id=doc_id, document=doc, refresh=True)
        else:
            res = self._es_client.index(index=index_name, document=doc, refresh=True)
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
        success, failed = bulk(self._es_client, actions, refresh=True)
        logger.info(f"批量插入完成, 成功: {success}, 失败: {len(failed)}")
        return success

    @retry_on_failure
    def search_documents(
        self,
        index_name: str,
        query: Dict[str, Any],
        size: int = 10,
        from_: int = 0,
        include_id: bool = False,
        sort: List[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        搜索文档（带重试机制）

        Args:
            index_name: 索引名称
            query: 查询条件
            size: 返回数量
            from_: 起始位置
            include_id: 是否在结果中包含文档ID
            sort: 排序条件

        Returns:
            List[Dict]: 文档列表
        """
        es_query = query.get("query", query) if isinstance(query, dict) else query
        search_params = {
            "index": index_name,
            "query": es_query,
            "size": size,
            "from_": from_,
        }
        if sort:
            search_params["sort"] = sort
        res = self._es_client.search(**search_params)
        hits = res.get('hits', {}).get('hits', [])
        if include_id:
            results = []
            for hit in hits:
                doc = hit.get('_source', {})
                doc['_id'] = hit.get('_id')
                doc['_score'] = hit.get('_score')
                results.append(doc)
            return results
        return [hit.get('_source', {}) for hit in hits]

    @retry_on_failure
    def vector_search(
        self,
        index_name: str = None,
        vector: List[float] = None,
        kb_ids: List[str] = None,
        top_k: int = 10,
        min_score: float = 0.0,
        vector_field: str = "content_vector",
        question: str = None,
        vector_similarity_weight: float = 0.7,
        metadatas: Dict[str, Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        向量相似度搜索（使用ES knn retriever，带重试机制）

        Args:
            index_name: 索引名称，为None时查询所有索引
            vector: 查询向量
            kb_ids: 知识库ID列表（可选）
            top_k: 返回Top K结果
            min_score: 最小相似度阈值（用于knn的similarity参数）
            vector_field: 向量字段名
            question: 查询文本（可选，用于构建文本匹配条件）

        Returns:
            List[Dict]: 相似文档列表
        """
        filter_conditions = []
        if kb_ids:
            if len(kb_ids) == 1:
                filter_conditions.append({"term": {"kb_id": kb_ids[0]}})
            else:
                filter_conditions.append({"terms": {"kb_id": kb_ids}})
        
        if metadatas:
            metadata_filters = self._build_metadata_filter(metadatas)
            filter_conditions.extend(metadata_filters)

        match_expr = None
        if question:
            try:
                from app.core.knowledgebase.rag.nlp.query import FulltextQueryer, MatchTextExpr
                qryr = FulltextQueryer()
                match_expr, _ = qryr.question(question, min_match=min_score if min_score > 0 else 0.3)
            except Exception as e:
                logger.warning(f"FulltextQueryer初始化失败: {e}")
                match_expr = None

        knn_query = {
            "field": vector_field,
            "query_vector": vector,
            "k": top_k,
            "num_candidates": top_k * 10,
        }

        if min_score > 0:
            knn_query["similarity"] = min_score
        
        knn_filter = {"bool": {}}
        if match_expr:
            query_string_query = {
                "query_string": {
                    "fields": match_expr.fields,
                    "type": "best_fields",
                    "query": match_expr.matching_text,
                    "boost": 1 - vector_similarity_weight,
                }
            }
            if match_expr.extra_options:
                if "minimum_should_match" in match_expr.extra_options:
                    query_string_query["query_string"]["minimum_should_match"] = str(int(match_expr.extra_options["minimum_should_match"] * 100)) + "%"
            knn_filter["bool"]["must"] = [query_string_query]
        
        if filter_conditions:
            knn_filter["bool"]["filter"] = filter_conditions
        
        if knn_filter["bool"]:
            knn_query["filter"] = knn_filter

        from app.constants.knowledgebase_chunk_constant import CHUNK_FIELDS
        source_fields = list(CHUNK_FIELDS)
        source_fields.append(vector_field)

        search_params = {
            "index": index_name if index_name else "_all",
            "knn": knn_query,
            "size": top_k,
            "_source": source_fields,
        }

        if match_expr:
            query_string_query = {
                "query_string": {
                    "fields": match_expr.fields,
                    "type": "best_fields",
                    "query": match_expr.matching_text,
                    "boost": 1 - vector_similarity_weight,
                }
            }
            if match_expr.extra_options:
                if "minimum_should_match" in match_expr.extra_options:
                    query_string_query["query_string"]["minimum_should_match"] = str(int(match_expr.extra_options["minimum_should_match"] * 100)) + "%"
            
            text_query = {
                "bool": {
                    "must": [query_string_query]
                }
            }
            if filter_conditions:
                text_query["bool"]["filter"] = filter_conditions
            #search_params["query"] = text_query
        elif filter_conditions:
            #search_params["query"] = {"bool": {"filter": filter_conditions}}
            pass

        res = self._es_client.search(**search_params)
        hits = res.get('hits', {}).get('hits', [])
        results = []
        for hit in hits:
            source = hit.get('_source', {})
            source['_score'] = hit.get('_score', 0)
            source['_id'] = hit.get('_id')
            results.append(source)

        return results

    @retry_on_failure
    def hybrid_search(
        self,
        index_name: str = None,
        query_vector: List[float] = None,
        question: str = None,
        kb_ids: List[str] = None,
        doc_ids: List[str] = None,
        top_k: int = 1024,
        page: int = 1,
        page_size: int = 10,
        vector_similarity_threshold: float = 0.0,
        keyword_similarity_threshold: float = 0.0,
        vector_similarity_weight: float = 0.7,
        vector_field: str = None,
        rerank_mdl=None,
        sort_by: str = "sim",
        available_only: bool = True,
        metadatas: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        混合检索（向量+关键词），使用ES knn retriever，支持Rerank重排序

        参考ragflow的retrieval和search方法实现，使用ES 8.x+的knn retriever API
        进行向量检索，结合query_string进行关键词检索，计算混合相似度，并支持Rerank模型重排序

        检索流程:
        1. 使用ES knn retriever进行向量检索（knn参数）
        2. 使用query_string进行关键词检索（query参数）
        3. ES自动合并两者结果
        4. 对结果进行Rerank重排序（如有Rerank模型）
        5. 计算混合相似度并过滤

        Args:
            index_name: ES索引名称，为None时查询所有索引
            query_vector: 查询文本的向量
            question: 查询文本
            kb_ids: 知识库ID列表（可选，用于过滤）
            doc_ids: 文档ID列表（可选，用于过滤）
            top_k: 召回数量（从ES中检索的候选数量）
            page: 页码（从1开始）
            page_size: 每页数量
            vector_similarity_threshold: 文本相似度阈值（混合相似度低于此值的结果被过滤）
            keyword_similarity_threshold: 关键词相似度阈值（关键词相似度低于此值的结果被过滤）
            vector_similarity_weight: 向量相似度权重（0~1，关键词相似度权重=1-此值）
            vector_field: 向量字段名（如q_1024_vec，为空则自动推断）
            rerank_mdl: Rerank模型实例（可选，传入则使用模型重排序）
            sort_by: 排序方式（sim=混合相似度, vsim=向量相似度, tsim=关键词相似度）
            available_only: 是否只检索可用的切片（available_int=1）

        Returns:
            Dict: {
                "total": 符合条件的总数,
                "chunks": [
                    {
                        "chunk_id": 切片ID,
                        "content_with_weight": 切片内容,
                        "doc_id": 文档ID,
                        "docnm_kwd": 文档名称,
                        "kb_id": 知识库ID,
                        "similarity": 混合相似度,
                        "vector_similarity": 向量相似度,
                        "term_similarity": 关键词相似度,
                        ...其他字段
                    }
                ]
            }
        """
        ranks = {"total": 0, "chunks": []}
        if not question and not query_vector:
            return ranks

        if not vector_field and query_vector:
            vector_field = f"q_{len(query_vector)}_vec"

        rerank_limit = math.ceil(64 / page_size) * page_size if page_size > 1 else 1
        search_size = min(top_k, rerank_limit)

        filter_conditions = []
        if kb_ids:
            if len(kb_ids) == 1:
                filter_conditions.append({"term": {"kb_id": kb_ids[0]}})
            else:
                filter_conditions.append({"terms": {"kb_id": kb_ids}})
        if doc_ids:
            filter_conditions.append({"terms": {"doc_id": doc_ids}})
        if available_only:
            filter_conditions.append({"term": {"available_int": 1}})
        
        if metadatas:
            metadata_filters = self._build_metadata_filter(metadatas)
            filter_conditions.extend(metadata_filters)

        knn_query = None
        match_expr = None
        if question:
            try:
                from app.core.knowledgebase.rag.nlp.query import FulltextQueryer, MatchTextExpr
                qryr = FulltextQueryer()
                match_expr, _ = qryr.question(question, min_match=vector_similarity_threshold if vector_similarity_threshold > 0 else 0.3)
            except Exception as e:
                logger.warning(f"FulltextQueryer初始化失败: {e}")
                match_expr = None

        if query_vector and vector_field:
            knn_query = {
                "field": vector_field,
                "query_vector": query_vector,
                "k": search_size,
                "num_candidates": search_size * 10,
            }
            if vector_similarity_threshold > 0:
                knn_query["similarity"] = vector_similarity_threshold
            
            knn_filter = {"bool": {}}
            if match_expr:
                query_string_query = {
                    "query_string": {
                        "fields": match_expr.fields,
                        "type": "best_fields",
                        "query": match_expr.matching_text,
                        "boost": 1 - vector_similarity_weight,
                    }
                }
                if match_expr.extra_options:
                    if "minimum_should_match" in match_expr.extra_options:
                        query_string_query["query_string"]["minimum_should_match"] = str(int(match_expr.extra_options["minimum_should_match"] * 100)) + "%"
                knn_filter["bool"]["must"] = [query_string_query]
            
            if filter_conditions:
                knn_filter["bool"]["filter"] = filter_conditions
            
            if knn_filter["bool"]:
                knn_query["filter"] = knn_filter

        text_query = None
        if match_expr:
            query_string_query = {
                "query_string": {
                    "fields": match_expr.fields,
                    "type": "best_fields",
                    "query": match_expr.matching_text,
                    "boost": 1 - vector_similarity_weight,
                }
            }
            if match_expr.extra_options:
                if "minimum_should_match" in match_expr.extra_options:
                    query_string_query["query_string"]["minimum_should_match"] = str(int(match_expr.extra_options["minimum_should_match"] * 100)) + "%"
            
            text_query = {
                "bool": {
                    "must": [query_string_query]
                }
            }
            if filter_conditions:
                text_query["bool"]["filter"] = filter_conditions
        elif filter_conditions:
            text_query = {"bool": {"filter": filter_conditions}}

        if not knn_query and not text_query:
            return ranks

        from app.constants.knowledgebase_chunk_constant import CHUNK_FIELDS
        source_fields = list(CHUNK_FIELDS)
        if vector_field:
            source_fields.append(vector_field)

        search_params = {
            "index": index_name if index_name else "_all",
            "size": top_k,
            "from_": 0,
            "_source": source_fields,
        }

        if knn_query:
            search_params["knn"] = knn_query
        # if text_query:
        #     search_params["query"] = text_query

        logging.info(f"ES 查询参数: {json.dumps(search_params, ensure_ascii=False)}")
        res = self._es_client.search(**search_params)
        hits = res.get('hits', {}).get('hits', [])
        total = res.get('hits', {}).get('total', {}).get('value', 0)

        if total == 0:
            if question:
                fallback_text_query = {
                    "bool": {
                        "must": [
                            {
                                "query_string": {
                                    "fields": ["content_ltks", "title_tks"],
                                    "type": "best_fields",
                                    "query": question,
                                    "minimum_should_match": "10%",
                                    "boost": 1 - vector_similarity_weight,
                                }
                            }
                        ],
                    }
                }
                if filter_conditions:
                    fallback_text_query["bool"]["filter"] = filter_conditions

                fallback_params = {
                    "index": index_name if index_name else "_all",
                    "size": top_k,
                    "from_": 0,
                }
                if knn_query:
                    fallback_knn = knn_query.copy()
                    fallback_knn["num_candidates"] = search_size * 20
                    fallback_params["knn"] = fallback_knn
                fallback_params["query"] = fallback_text_query

                res = self._es_client.search(**fallback_params)
                hits = res.get('hits', {}).get('hits', [])
                total = res.get('hits', {}).get('total', {}).get('value', 0)

        if not hits:
            return ranks

        sres_ids = []
        sres_fields = {}
        for hit in hits:
            chunk_id = hit.get('_id')
            sres_ids.append(chunk_id)
            source = hit.get('_source', {})
            source['_score'] = hit.get('_score', 0)
            sres_fields[chunk_id] = source

        sres = SearchResult(
            total=total,
            ids=sres_ids,
            query_vector=query_vector or [],
            field=sres_fields,
            keywords=question.split() if question else [],
        )

        tkweight = 1 - vector_similarity_weight
        vtweight = vector_similarity_weight

        if rerank_mdl and sres.total > 0:
            sim, tsim, vsim = self._rerank_by_model(
                rerank_mdl, sres, question, tkweight, vtweight
            )
        else:
            sim, tsim, vsim = self._rerank(
                sres, question, tkweight, vtweight, vector_field
            )

        sim_np = np.array(sim, dtype=np.float64)
        idx = np.argsort(sim_np * -1)

        dim = len(query_vector) if query_vector else 0
        zero_vector = [0.0] * dim

        # 先收集所有符合相似度条件的数据
        filtered_chunks = []
        for i in idx:
            if float(vsim[i]) < vector_similarity_threshold:
                continue
            if float(tsim[i]) < keyword_similarity_threshold:
                continue

            chunk_id = sres.ids[int(i)] if int(i) < len(sres.ids) else None
            if chunk_id is None or chunk_id not in sres.field:
                continue
            chunk = sres.field[chunk_id]

            d = {
                "chunk_id": chunk_id,
                "content_with_weight": chunk.get("content_with_weight", ""),
                "content_ltks": chunk.get("content_ltks", ""),
                "doc_id": chunk.get("doc_id", ""),
                "docnm_kwd": chunk.get("docnm_kwd", ""),
                "kb_id": chunk.get("kb_id", ""),
                "important_kwd": chunk.get("important_kwd", []),
                "image_id": chunk.get("img_id", ""),
                "image_base64": chunk.get("image_base64", ""),
                "similarity": float(sim[i]),
                "vector_similarity": float(vsim[i]),
                "term_similarity": float(tsim[i]),
                "metadatas": chunk.get("metadatas", {}),
            }
            if vector_field and vector_field in chunk:
                d["vector"] = chunk[vector_field]
            else:
                d["vector"] = zero_vector
            filtered_chunks.append(d)

        # 根据sort_by排序
        if sort_by == "vsim":
            filtered_chunks.sort(key=lambda x: x["vector_similarity"], reverse=True)
        elif sort_by == "tsim":
            filtered_chunks.sort(key=lambda x: x["term_similarity"], reverse=True)
        else:
            filtered_chunks.sort(key=lambda x: x["similarity"], reverse=True)

        # 设置总数
        ranks["total"] = len(filtered_chunks)

        # 根据page和page_size进行手动分页
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        ranks["chunks"] = filtered_chunks[start_idx:end_idx]

        return ranks

    def _rerank(
        self,
        sres: SearchResult,
        query: str,
        tkweight: float = 0.3,
        vtweight: float = 0.7,
        vector_field: str = None,
    ) -> Tuple[List[float], List[float], List[float]]:
        """
        本地重排序：基于向量相似度和关键词相似度的加权混合排序

        参考ragflow的rerank方法实现

        Args:
            sres: ES检索结果
            query: 查询文本
            tkweight: 关键词相似度权重
            vtweight: 向量相似度权重
            vector_field: 向量字段名

        Returns:
            Tuple[List[float], List[float], List[float]]: (混合相似度, 关键词相似度, 向量相似度)
        """
        if not sres.ids:
            return [], [], []

        try:
            from app.core.knowledgebase.rag.nlp.query import FulltextQueryer
            qryr = FulltextQueryer()
            _, keywords = qryr.question(query)
        except Exception as e:
            logger.warning(f"FulltextQueryer初始化失败: {e}，使用简化版关键词提取")
            keywords = query.split() if query else []

        ins_tw = []
        ins_embd = []
        zero_vector = [0.0] * len(sres.query_vector) if sres.query_vector else []

        for chunk_id in sres.ids:
            chunk = sres.field.get(chunk_id, {})
            content_ltks = list(OrderedDict.fromkeys(chunk.get("content_ltks", "").split()))
            title_tks = [t for t in chunk.get("title_tks", "").split() if t]
            question_tks = [t for t in chunk.get("question_tks", "").split() if t]
            important_kwd = chunk.get("important_kwd", [])
            if isinstance(important_kwd, str):
                important_kwd = [important_kwd]
            tks = content_ltks + title_tks * 2 + important_kwd * 5 + question_tks * 6
            ins_tw.append(tks)

            if vector_field and vector_field in chunk:
                vector = chunk[vector_field]
                if isinstance(vector, str):
                    try:
                        vector = [float(v) for v in vector.split("\t")]
                    except (ValueError, TypeError):
                        vector = zero_vector
                ins_embd.append(vector)
            else:
                ins_embd.append(zero_vector)

        sim, tksim, vtsim = qryr.hybrid_similarity(
            sres.query_vector, ins_embd, keywords, ins_tw, tkweight, vtweight
        )
        return sim, tksim, vtsim

    def _rerank_by_model(
        self,
        rerank_mdl,
        sres: SearchResult,
        query: str,
        tkweight: float = 0.3,
        vtweight: float = 0.7,
    ) -> Tuple[List[float], List[float], List[float]]:
        """
        使用Rerank模型进行重排序

        参考ragflow的rerank_by_model方法实现，先计算关键词相似度，
        再通过Rerank模型的similarity方法计算语义相似度，最后加权融合

        Args:
            rerank_mdl: Rerank模型实例
            sres: ES检索结果
            query: 查询文本
            tkweight: 关键词相似度权重
            vtweight: 向量相似度权重

        Returns:
            Tuple[List[float], List[float], List[float]]: (混合相似度, 关键词相似度, 向量相似度)
        """
        if not sres.ids:
            return [], [], []

        try:
            from app.core.knowledgebase.rag.nlp.query import FulltextQueryer
            qryr = FulltextQueryer()
            _, keywords = qryr.question(query)
        except Exception as e:
            logger.warning(f"FulltextQueryer初始化失败: {e}，使用简化版关键词提取")
            keywords = query.split() if query else []

        ins_tw = []
        doc_contents = []

        for chunk_id in sres.ids:
            chunk = sres.field.get(chunk_id, {})
            content_ltks = chunk.get("content_ltks", "").split()
            title_tks = [t for t in chunk.get("title_tks", "").split() if t]
            important_kwd = chunk.get("important_kwd", [])
            if isinstance(important_kwd, str):
                important_kwd = [important_kwd]
            tks = content_ltks + title_tks + important_kwd
            ins_tw.append(tks)
            doc_contents.append(" ".join(tks))

        tksim = []
        try:
            from app.core.knowledgebase.rag.nlp.query import FulltextQueryer
            qryr = FulltextQueryer()
            tksim = qryr.token_similarity(keywords, ins_tw)
        except Exception as e:
            logger.warning(f"token_similarity计算失败: {e}，使用简化版计算")
            query_token_set = set(keywords)
            query_token_freq = {}
            for t in keywords:
                query_token_freq[t] = query_token_freq.get(t, 0) + 1
            query_norm = math.sqrt(sum(v * v for v in query_token_freq.values()))
            if query_norm == 0:
                tksim = [0.0] * len(ins_tw)
            else:
                for doc_tokens in ins_tw:
                    doc_token_freq = {}
                    for t in doc_tokens:
                        doc_token_freq[t] = doc_token_freq.get(t, 0) + 1
                    dot_product = 0.0
                    for t in query_token_set:
                        if t in doc_token_freq:
                            dot_product += query_token_freq[t] * doc_token_freq[t]
                    doc_norm = math.sqrt(sum(v * v for v in doc_token_freq.values()))
                    if doc_norm == 0:
                        tksim.append(0.0)
                    else:
                        tksim.append(dot_product / (query_norm * doc_norm))

        try:
            from app.utils.string_utils import remove_redundant_spaces
            doc_contents_clean = [remove_redundant_spaces(doc) for doc in doc_contents]
            vtsim_arr, _ = rerank_mdl.similarity(query, doc_contents_clean)
            vtsim = vtsim_arr.tolist() if hasattr(vtsim_arr, 'tolist') else list(vtsim_arr)
        except Exception as e:
            logger.warning(f"Rerank模型similarity调用异常: {e}，回退到本地排序")
            return self._rerank(sres, query, tkweight, vtweight)

        sim = [tkweight * t + vtweight * v for t, v in zip(tksim, vtsim)]
        return sim, tksim, vtsim

    def _build_metadata_filter(self, metadatas: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        构建元数据过滤条件

        Args:
            metadatas: 元数据过滤条件，格式为{字段名: {value: 值, fuzzy: 是否模糊查询, relation: 范围关系}}

        Returns:
            List[Dict]: ES过滤条件列表
        """
        if not metadatas:
            return []

        filter_conditions = []
        for field_name, field_config in metadatas.items():
            if not field_config or not isinstance(field_config, dict):
                continue

            value = field_config.get('value')
            if value is None or value == '':
                continue

            fuzzy = field_config.get('fuzzy', False)
            relation = field_config.get('relation', 'INTERSECTS')

            # 基础字段名和精准查询字段名
            base_field_name = f"metadatas.{field_name}"
            keyword_field_name = f"metadatas.{field_name}.keyword"

            if field_name.endswith('_range'):
                # 范围查询使用基础字段名
                range_filter = self._build_range_filter(base_field_name, value, relation)
                if range_filter:
                    filter_conditions.append(range_filter)
            elif fuzzy and isinstance(value, str):
                # 模糊查询使用基础字段名(不带.keyword)
                filter_conditions.append({
                    "match": {base_field_name: value}
                })
            elif isinstance(value, list):
                # 精准查询使用.keyword后缀
                if len(value) == 1:
                    filter_conditions.append({"term": {keyword_field_name: value[0]}})
                else:
                    filter_conditions.append({"terms": {keyword_field_name: value}})
            else:
                # 精准查询使用.keyword后缀
                filter_conditions.append({"term": {keyword_field_name: value}})

        return filter_conditions
    
    def _build_range_filter(self, field_name: str, value: Any, relation: str) -> Optional[Dict[str, Any]]:
        """
        构建范围类型字段的过滤条件
        
        Args:
            field_name: 字段名
            value: 字段值（可以是单个值或范围对象）
            relation: 范围关系（INTERSECTS、CONTAINS、WITHIN）
        
        Returns:
            Optional[Dict]: ES范围过滤条件
        """
        if not value:
            return None
        
        if isinstance(value, dict):
            gte = value.get('gte') or value.get('from')
            lte = value.get('lte') or value.get('to')
            if gte is not None and lte is not None:
                range_value = {"gte": gte, "lte": lte}
            elif gte is not None:
                range_value = {"gte": gte}
            elif lte is not None:
                range_value = {"lte": lte}
            else:
                return None
        elif isinstance(value, (list, tuple)) and len(value) == 2:
            range_value = {"gte": value[0], "lte": value[1]}
        else:
            return None
        
        if relation == 'INTERSECTS':
            return {
                "range": {
                    field_name: {
                        "gte": range_value.get('gte'),
                        "lte": range_value.get('lte'),
                        "relation": "intersects"
                    }
                }
            }
        elif relation == 'CONTAINS':
            return {
                "range": {
                    field_name: {
                        "gte": range_value.get('gte'),
                        "lte": range_value.get('lte'),
                        "relation": "contains"
                    }
                }
            }
        elif relation == 'WITHIN':
            return {
                "range": {
                    field_name: {
                        "gte": range_value.get('gte'),
                        "lte": range_value.get('lte'),
                        "relation": "within"
                    }
                }
            }
        else:
            return {
                "range": {
                    field_name: range_value
                }
            }
    
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
        self._es_client.delete(index=index_name, id=doc_id, refresh=True)
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
        es_query = query.get("query", query) if isinstance(query, dict) else query
        res = self._es_client.delete_by_query(
            index=index_name,
            query=es_query,
            wait_for_completion=True,
            refresh=True
        )
        deleted_count = res.get('deleted', 0)
        logger.info(f"根据条件删除文档, 数量: {deleted_count}")
        return deleted_count

    @retry_on_failure
    def update_document(
        self,
        index_name: str,
        doc_id: str,
        doc: Dict[str, Any],
        upsert: bool = False
    ) -> bool:
        """
        更新文档（带重试机制）

        Args:
            index_name: 索引名称
            doc_id: 文档ID
            doc: 要更新的字段
            upsert: 如果文档不存在是否创建

        Returns:
            bool: 是否更新成功
        """
        self._es_client.update(
            index=index_name,
            id=doc_id,
            doc=doc,
            doc_as_upsert=upsert,
            refresh=True
        )
        logger.info(f"更新文档成功: {doc_id}")
        return True

    @retry_on_failure
    def get_document(self, index_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        获取单个文档（带重试机制）

        Args:
            index_name: 索引名称
            doc_id: 文档ID

        Returns:
            Optional[Dict]: 文档内容，不存在返回None
        """
        try:
            res = self._es_client.get(index=index_name, id=doc_id)
            return res.get('_source', {})
        except Exception as e:
            if "not_found" in str(e).lower():
                logger.warning(f"文档不存在: {doc_id}")
                return None
            raise

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
        if query:
            es_query = query.get("query", query) if isinstance(query, dict) else query
            res = self._es_client.count(index=index_name, query=es_query)
        else:
            res = self._es_client.count(index=index_name)
        count = res.get('count', 0)
        return count


es_utils = ESUtils()
