"""
知识库检索服务

提供向量检索、混合检索和Rerank重排序功能
参考ragflow的retrieval和search方法实现
"""

import json
import logging
from typing import Dict, Any, Optional, List

from app.database.models import Knowledgebase, LLMModel
from app.database.es_utils import es_utils
from app.core.llm_model.factory import LLMFactory
from app.core.exceptions import ResourceNotFoundError, BaseServiceError

logger = logging.getLogger(__name__)


class RetrievalService:
    """
    知识库检索服务类

    提供基于向量+关键词的混合检索，支持Rerank模型重排序
    """

    @staticmethod
    def _get_model_instance(model_id: str, model_type: str):
        """
        根据模型ID获取模型实例

        Args:
            model_id: 模型ID
            model_type: 模型类型（embedding/rerank）

        Returns:
            模型实例，不存在返回None
        """
        try:
            llm_model = LLMModel.get(LLMModel.id == model_id)
            if not llm_model or llm_model.deleted:
                logger.error(f"{model_type}模型不存在或已删除: {model_id}")
                return None

            model_config = {
                "api_key": llm_model.api_key,
                "endpoint": llm_model.endpoint,
                "name": llm_model.name,
                "provider": llm_model.provider,
            }

            if llm_model.config:
                try:
                    extra_config = json.loads(llm_model.config) if isinstance(llm_model.config, str) else llm_model.config
                    model_config.update(extra_config)
                except (json.JSONDecodeError, TypeError):
                    pass

            return LLMFactory.create_model(model_type, model_config)
        except LLMModel.DoesNotExist:
            logger.error(f"{model_type}模型不存在: {model_id}")
            return None
        except Exception as e:
            logger.error(f"获取{model_type}模型失败: {e}")
            return None

    @staticmethod
    def _get_kb_config(kb_id: str) -> Dict[str, Any]:
        """
        获取知识库的检索配置

        Args:
            kb_id: 知识库ID

        Returns:
            Dict: 知识库配置信息，包含embedding_model_id、rerank_model_id、retrieval_config等

        Raises:
            ResourceNotFoundError: 知识库不存在
        """
        try:
            kb = Knowledgebase.get_by_id(kb_id)
            if kb.deleted:
                raise ResourceNotFoundError(message=f"知识库 {kb_id} 不存在")
        except Knowledgebase.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库 {kb_id} 不存在")

        retrieval_config = {}
        if kb.retrieval_config:
            try:
                retrieval_config = json.loads(kb.retrieval_config) if isinstance(kb.retrieval_config, str) else kb.retrieval_config
            except (json.JSONDecodeError, TypeError):
                retrieval_config = {}

        return {
            "kb_id": str(kb.id),
            "kb_name": kb.name,
            "embedding_model_id": kb.embedding_model_id,
            "rerank_model_id": kb.rerank_model_id,
            "retrieval_config": retrieval_config,
        }

    @staticmethod
    def retrieval(
        kb_ids: List[str] = None,
        question: str = None,
        doc_ids: List[str] = None,
        page: int = 1,
        page_size: int = 10,
        top_k: int = 1024,
        vector_similarity_threshold: float = None,
        keyword_similarity_threshold: float = None,
        vector_similarity_weight: float = None,
        sort_by: str = None,
        embedding_model_id: str = None,
        rerank_model_id: str = None,
        metadatas: dict = None,
    ) -> Dict[str, Any]:
        """
        知识库检索入口方法

        参考ragflow的retrieval方法，整合向量编码、混合检索和重排序流程

        Args:
            kb_ids: 知识库ID列表（为空则查询所有可用知识库）
            question: 查询文本
            doc_ids: 文档ID列表（可选，用于限定检索范围）
            page: 页码（从1开始）
            page_size: 每页数量
            top_k: 召回数量
            vector_similarity_threshold: 文本相似度阈值（为空则使用知识库配置或默认0.2）
            keyword_similarity_threshold: 关键词相似度阈值（为空则使用知识库配置或默认0.0）
            vector_similarity_weight: 向量相似度权重（为空则使用知识库配置或默认0.7）
            sort_by: 排序方式（sim/vsim/tsim，为空则使用知识库配置或默认sim）
            embedding_model_id: Embedding模型ID（为空则使用第一个知识库配置）
            rerank_model_id: Rerank模型ID（为空则使用第一个知识库配置）

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
                    }
                ]
            }
        """
        if not question:
            return {"total": 0, "chunks": []}

        if not es_utils.is_available:
            logger.error("ES不可用，无法进行检索")
            return {"total": 0, "chunks": []}

        from app.database.models import Knowledgebase, KnowledgebaseDocument

        # 1. 过滤知识库：如果传了kb_ids则过滤禁用的，没传则查询所有可用的
        available_kb_ids = []
        if kb_ids:
            # 过滤掉禁用和已删除的知识库
            for kb_id in kb_ids:
                try:
                    kb = Knowledgebase.get_by_id(kb_id)
                    if not kb.deleted and kb.status:
                        available_kb_ids.append(kb_id)
                    else:
                        logger.warning(f"知识库 {kb_id} 已禁用或已删除，已过滤")
                except Knowledgebase.DoesNotExist:
                    logger.warning(f"知识库 {kb_id} 不存在，已过滤")
        else:
            # 查询所有可用的知识库
            available_kbs = Knowledgebase.select().where(
                (Knowledgebase.deleted == False) & (Knowledgebase.status == True)
            )
            available_kb_ids = [str(kb.id) for kb in available_kbs]

        if not available_kb_ids:
            logger.error("没有可用的知识库")
            return {"total": 0, "chunks": []}

        # 2. 过滤文档：如果传了doc_ids则过滤禁用的，没传则查询可用知识库中的可用文档
        available_doc_ids = None
        if doc_ids:
            # 过滤掉禁用和已删除的文档
            available_doc_ids = []
            for doc_id in doc_ids:
                try:
                    doc = KnowledgebaseDocument.get_by_id(doc_id)
                    # 文档必须属于可用知识库且自身可用
                    if (not doc.deleted and doc.status and
                        str(doc.kb_id) in available_kb_ids):
                        available_doc_ids.append(doc_id)
                    else:
                        logger.warning(f"文档 {doc_id} 已禁用或已删除或不属于可用知识库，已过滤")
                except KnowledgebaseDocument.DoesNotExist:
                    logger.warning(f"文档 {doc_id} 不存在，已过滤")
        else:
            # 查询可用知识库中的可用文档
            available_docs = KnowledgebaseDocument.select().where(
                (KnowledgebaseDocument.kb_id.in_(available_kb_ids)) &
                (KnowledgebaseDocument.deleted == False) &
                (KnowledgebaseDocument.status == True)
            )
            available_doc_ids = [str(doc.id) for doc in available_docs]
            # 如果没有可用文档，设置为None让ES查询不做文档过滤
            if not available_doc_ids:
                available_doc_ids = None

        kb_config = RetrievalService._get_kb_config(available_kb_ids[0])
        kb_retrieval_config = kb_config.get("retrieval_config", {})

        emb_model_id = embedding_model_id or kb_config.get("embedding_model_id")
        rnk_model_id = rerank_model_id or kb_config.get("rerank_model_id")

        sim_threshold = vector_similarity_threshold if vector_similarity_threshold is not None else kb_retrieval_config.get("vector_similarity", 0.0)
        kw_threshold = keyword_similarity_threshold if keyword_similarity_threshold is not None else kb_retrieval_config.get("keyword_similarity", 0.0)
        vsim_weight = vector_similarity_weight if vector_similarity_weight is not None else kb_retrieval_config.get("vector_similarity_weight", 0.7)
        sort = sort_by or kb_retrieval_config.get("sort_by", "sim")

        if not emb_model_id:
            logger.error(f"知识库 {available_kb_ids[0]} 未配置Embedding模型")
            return {"total": 0, "chunks": []}

        embedding_model = RetrievalService._get_model_instance(emb_model_id, "embedding")
        if not embedding_model:
            logger.error(f"无法创建Embedding模型实例: {emb_model_id}")
            return {"total": 0, "chunks": []}

        try:
            query_vector, _ = embedding_model.encode_queries(question)
            query_vector = query_vector.tolist() if hasattr(query_vector, 'tolist') else list(query_vector)
        except Exception as e:
            logger.error(f"查询文本向量化失败: {e}")
            raise BaseServiceError(f"查询文本向量化失败: {e}")

        rerank_model = None
        if rnk_model_id:
            rerank_model = RetrievalService._get_model_instance(rnk_model_id, "rerank")
            if rerank_model:
                logger.info(f"使用Rerank模型进行重排序: {rnk_model_id}")
            else:
                logger.warning(f"无法创建Rerank模型实例: {rnk_model_id}，将使用本地排序")

        try:
            result = es_utils.hybrid_search(
                index_name=None,
                query_vector=query_vector,
                question=question,
                kb_ids=available_kb_ids,
                doc_ids=available_doc_ids,
                top_k=top_k,
                page=page,
                page_size=page_size,
                vector_similarity_threshold=sim_threshold,
                keyword_similarity_threshold=kw_threshold,
                vector_similarity_weight=vsim_weight,
                rerank_mdl=rerank_model,
                sort_by=sort,
                available_only=True,
                metadatas=metadatas,
            )
            return result
        except Exception as e:
            logger.error(f"知识库检索失败: {e}")
            raise BaseServiceError(f"知识库检索失败: {e}")
