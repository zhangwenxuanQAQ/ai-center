"""
知识库内置工具

封装知识库检索的转换和调用逻辑，继承自CustomTool。
每个知识库数据库记录对应一个KnowledgebaseSearch实例，
通过callback机制注入实际的知识库检索逻辑。
"""

import json
from typing import Any, Dict, List, Optional

from app.core.tools.custom_tool import CustomTool


def _build_kb_description(kb) -> str:
    """
    构建知识库工具的描述文本

    包含知识库名称、描述和包含的文档列表（标题和标签），
    帮助大模型理解知识库内容并决定是否调用。

    Args:
        kb: Knowledgebase数据库对象

    Returns:
        str: 完整的知识库描述文本
    """
    from app.database.models import KnowledgebaseDocument

    kb_id = str(kb.id)
    kb_name = kb.name
    kb_description = kb.description or ''

    description_parts = [
        f'【知识库】：{kb_name}',
        f'【知识库描述】：{kb_description if kb_description else "无"}'
    ]

    documents = KnowledgebaseDocument.select().where(
        (KnowledgebaseDocument.kb_id == kb_id) &
        (KnowledgebaseDocument.deleted == False) &
        (KnowledgebaseDocument.status == True)
    ).order_by(KnowledgebaseDocument.created_at.desc())

    if documents.count() > 0:
        description_parts.append('【包含文档】：')
        description_parts.append('| 标题 | 标签 |')
        description_parts.append('| ------- | ------- |')

        for doc in documents:
            title = doc.title or doc.file_name or '未命名文档'
            tags_str = ''
            if doc.tags:
                try:
                    tags_list = json.loads(doc.tags) if isinstance(doc.tags, str) else doc.tags
                    if isinstance(tags_list, list):
                        tags_str = ', '.join(tags_list)
                except (json.JSONDecodeError, TypeError):
                    tags_str = str(doc.tags) if doc.tags else ''
            description_parts.append(f'| {title} | {tags_str if tags_str else "无"} |')
    else:
        description_parts.append('【包含文档】：无')

    description_parts.append('需要查询以上相关知识可以使用本工具')
    return ' \n'.join(description_parts)


class KnowledgebaseSearch(CustomTool):
    """
    知识库检索工具类，继承自CustomTool

    封装知识库检索的OpenAI格式转换和实际调用逻辑。
    每个知识库数据库记录对应一个KnowledgebaseSearch实例，
    通过callback机制将知识库检索逻辑注入到run方法中。

    使用示例:
        # 从数据库对象创建
        tool = KnowledgebaseSearch.from_kb(kb)

        # 转换为OpenAI tool格式
        openai_tool = tool.to_openai_tool()

        # 执行知识库检索
        result = tool.run(action='knowledgebase_search', task_name='查询',
                         kb_id='xxx', query='查询内容')
    """

    tool_type: str = "knowledgebase"

    def __init__(
        self,
        kb_id: str = "",
        name: str = "",
        title: str = "",
        description: str = "",
        params: Optional[list] = None,
        **extra
    ):
        """
        初始化知识库工具

        Args:
            kb_id: 知识库ID（数据库主键）
            name: 工具名称（通常为知识库名称）
            title: 工具标题
            description: 工具描述（包含知识库信息和文档列表）
            params: BaseToolParam参数列表
            **extra: 额外属性
        """
        self.kb_id = kb_id
        # 通过callback注入知识库检索逻辑
        super().__init__(
            name=name,
            title=title,
            description=description,
            params=params,
            callback=self._execute_kb_search,
            **extra
        )

    def _execute_kb_search(self, **kwargs) -> Any:
        """
        知识库检索的实际执行逻辑（作为callback注入到run方法中）

        调用RetrievalService执行知识库检索，
        并将检索结果格式化为包含content、doc_name、similarity的列表。

        Args:
            **kwargs: 工具参数，必须包含kb_id和query

        Returns:
            Any: 检索结果列表的JSON字符串，或"未检索到相关内容"

        Raises:
            ValueError: 缺少kb_id或query参数
            Exception: 知识库检索失败
        """
        from app.core.knowledgebase.retrieval_service import RetrievalService

        kb_id = kwargs.get('kb_id', '') or self.kb_id
        query = kwargs.get('query', '')

        if not kb_id or not query:
            raise ValueError('知识库检索缺少kb_id或query参数')

        kb_config = RetrievalService._get_kb_config(kb_id)
        retrieval_config = kb_config.get("retrieval_config", {})

        top_k = retrieval_config.get("top_k", 10)
        page_size = top_k

        result = RetrievalService.retrieval(
            kb_ids=[kb_id],
            question=query,
            top_k=top_k,
            page_size=page_size,
            vector_similarity_threshold=retrieval_config.get("vector_similarity"),
            keyword_similarity_threshold=retrieval_config.get("keyword_similarity"),
            vector_similarity_weight=retrieval_config.get("vector_similarity_weight"),
            sort_by=retrieval_config.get("sort_by"),
            embedding_model_id=kb_config.get("embedding_model_id"),
            rerank_model_id=kb_config.get("rerank_model_id"),
        )

        chunks = result.get('chunks', [])
        if chunks:
            search_results = []
            for chunk in chunks:
                search_results.append({
                    'content': chunk.get('content_with_weight', ''),
                    'doc_name': chunk.get('docnm_kwd', ''),
                    'similarity': chunk.get('similarity', 0),
                })
            return json.dumps(search_results, ensure_ascii=False)
        return '未检索到相关内容'

    def to_openai_tool(self) -> Dict[str, Any]:
        """
        生成OpenAI tool格式

        基于知识库信息生成OpenAI tool格式，
        包含action、task_name、kb_id、query、reasoning_content等参数。

        Returns:
            Dict[str, Any]: OpenAI tool格式的工具定义
        """
        kb_id = self.kb_id
        tool = {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.description,
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'action': {
                            'type': 'string',
                            'enum': ['knowledgebase_search'],
                            'description': '操作类型，必须为 knowledgebase_search , 表示知识库检索'
                        },
                        'task_name': {
                            'type': 'string',
                            'description': '给本次操作起一个简短的任务名称，例如"查询xxx今天的天气"'
                        },
                        'kb_id': {
                            'type': 'string',
                            'enum': [kb_id],
                            'description': '知识库id'
                        },
                        'query': {
                            'type': 'string',
                            'description': '根据用户问题改写为知识库的查询条件'
                        },
                        'reasoning_content': {
                            'type': 'string',
                            'description': '为何选择并使用本工具，返回思考过程'
                        }
                    },
                    'required': ['task_name', 'kb_id', 'query', 'action']
                }
            }
        }

        return json.loads(json.dumps(tool, ensure_ascii=False))

    @classmethod
    def from_kb(cls, kb) -> 'KnowledgebaseSearch':
        """
        从数据库Knowledgebase对象创建KnowledgebaseSearch实例

        构建包含知识库信息和文档列表的描述文本，
        并创建对应的KnowledgebaseSearch实例。

        Args:
            kb: Knowledgebase数据库对象

        Returns:
            KnowledgebaseSearch: 知识库检索工具实例
        """
        description = _build_kb_description(kb)
        return cls(
            kb_id=str(kb.id),
            name=kb.name,
            description=description
        )
