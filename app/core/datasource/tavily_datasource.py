"""
Tavily 数据源实现

提供对 Tavily 搜索 API 的访问，支持搜索和检索切片功能
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.core.datasource.base import DatasourceBase


class TavilyDatasource(DatasourceBase):
    """
    Tavily 数据源实现类
    
    提供对 Tavily 搜索服务的访问，实现搜索和检索切片功能
    """

    def __init__(self, config: Dict[str, Any]):
        """
        初始化 Tavily 数据源
        
        Args:
            config: 数据源配置字典，必须包含 api_key
        """
        super().__init__(config)
        self.api_key = config.get("api_key", "")
        self.tavily_client = None

    def _get_client(self):
        """
        延迟初始化 Tavily 客户端
        
        Returns:
            TavilyClient: Tavily 客户端实例
        """
        if self.tavily_client is None:
            from tavily import TavilyClient
            self.tavily_client = TavilyClient(api_key=self.api_key)
        return self.tavily_client

    def test_connection(self) -> Dict[str, Any]:
        """
        测试 Tavily 连接
        
        Returns:
            Dict[str, Any]: 包含连接测试结果的字典
        """
        if not self.api_key:
            return {
                "success": False,
                "message": "API Key 不能为空"
            }
        
        try:
            client = self._get_client()
            response = client.search(query="test", search_depth="basic", max_results=1)
            if response and "results" in response:
                return {
                    "success": True,
                    "message": "连接成功"
                }
            else:
                return {
                    "success": False,
                    "message": "连接失败，无法获取搜索结果"
                }
        except Exception as e:
            logging.error(f"Tavily 连接测试失败: {str(e)}")
            return {
                "success": False,
                "message": f"连接失败: {str(e)}"
            }

    def execute_query(self, query: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        执行搜索查询
        
        Args:
            query: 查询语句
            params: 查询参数（可选）
            
        Returns:
            Dict[str, Any]: 包含查询结果的字典
        """
        try:
            results = self.search(query)
            return {
                "success": True,
                "message": "查询成功",
                "data": results
            }
        except Exception as e:
            logging.error(f"Tavily 查询失败: {str(e)}")
            return {
                "success": False,
                "message": f"查询失败: {str(e)}",
                "data": None
            }

    def get_schema_info(self) -> Dict[str, Any]:
        """
        获取数据源的Schema信息
        
        Returns:
            Dict[str, Any]: 包含Schema信息的字典
        """
        return {
            "success": True,
            "message": "Tavily 数据源无需Schema信息",
            "data": {
                "type": "tavily",
                "description": "Tavily 搜索数据源",
                "capabilities": ["search", "search_chunks"]
            }
        }

    def search(self, query: str, max_results: int = 6) -> List[Dict[str, Any]]:
        """
        执行搜索
        
        Args:
            query: 搜索查询词
            max_results: 最大返回结果数，默认6
            
        Returns:
            List[Dict[str, Any]]: 搜索结果列表
        """
        try:
            client = self._get_client()
            response = client.search(
                query=query,
                search_depth="advanced",
                max_results=max_results
            )
            if response and "results" in response:
                return [{
                    "url": res.get("url", ""),
                    "title": res.get("title", ""),
                    "content": res.get("content", ""),
                    "score": res.get("score", 0)
                } for res in response["results"]]
            return []
        except Exception as e:
            logging.error(f"Tavily 搜索失败: {str(e)}")
            return []

    def search_chunks(self, query: str, max_results: int = 6) -> Dict[str, Any]:
        """
        检索切片列表
        
        参考 ragflow 的 Tavily.retrieve_chunks 方法实现
        
        Args:
            query: 搜索查询词
            max_results: 最大返回结果数，默认6
            
        Returns:
            Dict[str, Any]: 包含切片和文档聚合信息的字典
                - chunks: 切片列表
                - doc_aggs: 文档聚合信息
        """
        chunks = []
        doc_aggs = []
        
        logging.info(f"[Tavily]Q: {query}")
        
        for result in self.search(query, max_results=max_results):
            chunk_id = str(uuid4())
            
            chunks.append({
                "chunk_id": chunk_id,
                "content_ltks": [],
                "content_with_weight": result["content"],
                "doc_id": chunk_id,
                "docnm_kwd": result["title"],
                "kb_id": [],
                "important_kwd": [],
                "image_id": "",
                "similarity": result["score"],
                "vector_similarity": 1.0,
                "term_similarity": 0,
                "vector": [],
                "positions": [],
                "url": result["url"]
            })
            
            doc_aggs.append({
                "doc_name": result["title"],
                "doc_id": chunk_id,
                "count": 1,
                "url": result["url"]
            })
            
            logging.info(f"[Tavily]R: {result['content'][:128]}...")
        
        return {"chunks": chunks, "doc_aggs": doc_aggs}