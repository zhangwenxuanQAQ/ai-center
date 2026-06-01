#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

import json
import logging
from abc import ABC
from copy import deepcopy

import pandas as pd

from .base import ComponentBase, ComponentParamBase, ComponentBaseFrontEndField
from app.services.knowledgebase.service import KnowledgebaseService
from app.core.datasource.tavily_datasource import TavilyDatasource
from app.core.knowledgebase.retrieval_service import RetrievalService


class RetrievalParamFrontEndField(ComponentBaseFrontEndField):
    """
    知识检索组件参数前端控件
    """

    kb_ids = {
        "key": "kb_ids",
        "label": "知识库",
        "type": "select-multiple",
        "description": "选择要检索的知识库",
        "defaultValue": [],
    }

    kb_vars = {
        "key": "kb_vars",
        "label": "动态知识库变量",
        "type": "custom",
        "description": "从上游节点获取知识库ID的变量配置",
    }

    similarity_threshold = {
        "key": "similarity_threshold",
        "label": "相似度阈值",
        "type": "number",
        "description": "向量检索相似度阈值，范围0-1",
        "defaultValue": 0.2,
    }

    keywords_similarity_weight = {
        "key": "keywords_similarity_weight",
        "label": "关键词权重",
        "type": "number",
        "description": "关键词检索权重，与向量检索互补",
        "defaultValue": 0.5,
    }

    top_n = {
        "key": "top_n",
        "label": "返回数量",
        "type": "number",
        "description": "返回检索结果的最大数量",
        "defaultValue": 8,
    }

    top_k = {
        "key": "top_k",
        "label": "Top K",
        "type": "number",
        "description": "向量检索候选集大小",
        "defaultValue": 1024,
    }

    rerank_id = {
        "key": "rerank_id",
        "label": "重排序模型",
        "type": "select",
        "description": "用于结果重排序的Rerank模型",
    }

    empty_response = {
        "key": "empty_response",
        "label": "空结果响应",
        "type": "text",
        "description": "无检索结果时的默认回复内容",
    }

    tavily_api_key = {
        "key": "tavily_api_key",
        "label": "Tavily API Key",
        "type": "password",
        "description": "Tavily搜索引擎API密钥",
    }

    use_kg = {
        "key": "use_kg",
        "label": "使用知识图谱",
        "type": "boolean",
        "description": "是否启用知识图谱增强检索",
        "defaultValue": False,
    }

    sort_by = {
        "key": "sort_by",
        "label": "排序方式",
        "type": "select",
        "description": "结果排序方式：sim（相似度）或weight（权重）",
        "defaultValue": "sim",
    }

    return_as_chunks = {
        "key": "return_as_chunks",
        "label": "返回分块格式",
        "type": "boolean",
        "description": "是否以分块格式返回结果",
        "defaultValue": False,
    }


class RetrievalParam(ComponentParamBase):
    """
    Define the Retrieval component parameters.
    """

    def __init__(self):
        super().__init__()
        self.similarity_threshold = 0.2
        self.keywords_similarity_weight = 0.5
        self.top_n = 8
        self.top_k = 1024
        self.kb_ids = []
        self.kb_vars = []
        self.rerank_id = ""
        self.empty_response = ""
        self.tavily_api_key = ""
        self.use_kg = False
        self.sort_by = "sim"
        self.return_as_chunks = False
        self.doc_ids = []

    def check(self):
        self.check_decimal_float(self.similarity_threshold, "[Retrieval] Similarity threshold")
        self.check_decimal_float(self.keywords_similarity_weight, "[Retrieval] Keyword similarity weight")
        self.check_positive_number(self.top_n, "[Retrieval] Top N")


class Retrieval(ComponentBase, ABC):
    component_name = "Retrieval"
    component_title = "知识检索"

    def _run(self, history, **kwargs):
        query = self.get_input()
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()

        kb_ids: list[str] = self._param.kb_ids or []

        kb_vars = self._fetch_outputs_from(self._param.kb_vars)

        if len(kb_vars) > 0:
            for kb_var in kb_vars:
                if len(kb_var) == 1:
                    kb_var_value = str(kb_var["content"][0])

                    for v in kb_var_value.split(","):
                        kb_ids.append(v)
                else:
                    for v in kb_var.to_dict("records"):
                        kb_ids.append(v["content"])

        filtered_kb_ids: list[str] = [kb_id for kb_id in kb_ids if kb_id]

        kbs = []
        for kb_id in filtered_kb_ids:
            kb = KnowledgebaseService.get_knowledgebase(kb_id)
            if kb:
                kbs.append(kb)
        if not kbs:
            return Retrieval.be_output("")

        filtered_kb_ids = [str(kb.id) for kb in kbs]

        var_doc_ids = []
        if kb_ids:
            for kb_id in kb_ids:
                docs = KnowledgebaseService.get_documents(kb_id=kb_id, status=True, limit=10000)
                if docs:
                    tmp_doc_ids = [str(doc["id"]) for doc in docs]
                    var_doc_ids.extend(tmp_doc_ids)

        doc_ids = None
        if self._param.doc_ids:
            doc_ids = self._param.doc_ids
        elif not var_doc_ids:
            all_doc_ids = []
            for kb_id in filtered_kb_ids:
                docs = KnowledgebaseService.get_documents(kb_id=kb_id, status=True, limit=10000)
                if docs:
                    all_doc_ids.extend([str(doc["id"]) for doc in docs])
            doc_ids = all_doc_ids if all_doc_ids else None

        if var_doc_ids:
            doc_ids = [] if doc_ids is None else doc_ids
            doc_ids.extend(var_doc_ids)

        kbinfos = RetrievalService.retrieval(
            kb_ids=filtered_kb_ids,
            question=query,
            doc_ids=doc_ids,
            page=1,
            page_size=self._param.top_n,
            top_k=self._param.top_k,
            vector_similarity_threshold=self._param.similarity_threshold,
            vector_similarity_weight=1 - self._param.keywords_similarity_weight,
            sort_by=self._param.sort_by,
            rerank_model_id=self._param.rerank_id if self._param.rerank_id else None,
        )

        if self._param.tavily_api_key:
            tavily_datasource = TavilyDatasource({"api_key": self._param.tavily_api_key})
            tav_res = tavily_datasource.search_chunks(query)
            kbinfos["chunks"].extend(tav_res["chunks"])
            kbinfos["doc_aggs"].extend(tav_res["doc_aggs"])

        if not kbinfos["chunks"]:
            df = Retrieval.be_output("")
            if self._param.empty_response and self._param.empty_response.strip():
                df["empty_response"] = self._param.empty_response
            return df

        if self._param.return_as_chunks:
            output_chunks = []
            contents = kb_prompt(kbinfos, 200000)
            for i in range(len(kbinfos["chunks"])):
                kbinfos["chunks"][i]["content"] = kbinfos["chunks"][i]["content_with_weight"]
                output_chunk = deepcopy(kbinfos["chunks"][i])
                del output_chunk["vector"]
                del output_chunk["image_id"]
                output_chunks.append(output_chunk)

            df = pd.DataFrame({"content": [json.dumps(output_chunks, ensure_ascii=False)]})
        else:
            df = pd.DataFrame({"content": kb_prompt(kbinfos, 200000), "chunks": json.dumps(kbinfos["chunks"])})
        logging.debug("{} {}".format(query, df))
        return df.dropna()