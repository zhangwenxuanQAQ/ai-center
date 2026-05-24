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
import re
from abc import ABC
from copy import deepcopy

import pandas as pd

from agent.component.base import ComponentBase, ComponentParamBase
from api import settings
from api.db import LLMType, StatusEnum
from api.db.services.document_service import DocumentService
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.services.llm_service import LLMBundle
from rag.app.tag import label_question
from rag.prompts import kb_prompt
from rag.utils.tavily_conn import Tavily


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
        self.return_as_chunks = False # 以chunks数组返回
        self.doc_ids = [] # 指定文档id

    def check(self):
        self.check_decimal_float(self.similarity_threshold, "[Retrieval] Similarity threshold")
        self.check_decimal_float(self.keywords_similarity_weight, "[Retrieval] Keyword similarity weight")
        self.check_positive_number(self.top_n, "[Retrieval] Top N")


class Retrieval(ComponentBase, ABC):
    component_name = "Retrieval"

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

        kbs = KnowledgebaseService.get_by_ids(filtered_kb_ids)
        if not kbs:
            return Retrieval.be_output("")

        filtered_kb_ids = [kb.id for kb in kbs]

        tenant_id = self._param.user_id if self._param.user_id else kbs[0].tenant_id
        tenant_ids = [kb.tenant_id for kb in kbs]
        if self._param.user_id:
            tenant_ids.append(self._param.user_id)

        embd_nms = list(set([kb.embd_id for kb in kbs]))
        assert len(embd_nms) == 1, "Knowledge bases use different embedding models."

        embd_mdl = None
        if embd_nms:
            embd_mdl = LLMBundle(self._canvas.get_tenant_id(), LLMType.EMBEDDING, embd_nms[0])
            self._canvas.set_embedding_model(embd_nms[0])

        rerank_mdl = None
        if self._param.rerank_id:
            query = re.sub(r"^user[:：\s]*", "", query, flags=re.IGNORECASE)
            rerank_mdl = LLMBundle(tenant_id, LLMType.RERANK, self._param.rerank_id)

        if kbs:
            var_doc_ids = []
            if kb_ids:
                doc_query = DocumentService.model.select().where(DocumentService.model.id.in_(kb_ids),
                                                     DocumentService.model.status == StatusEnum.VALID.value)
                docs = list(doc_query.dicts())
                if docs:
                    tmp_doc_ids = [x["id"] for x in docs]
                    var_doc_ids.extend(tmp_doc_ids)

            doc_ids = None
            if self._param.doc_ids:
                doc_ids = self._param.doc_ids
            elif not var_doc_ids:
                doc_query = DocumentService.model.select().where(DocumentService.model.kb_id.in_(kb_ids),
                                                                 DocumentService.model.status == StatusEnum.VALID.value)
                docs = list(doc_query.dicts())
                if docs:
                    doc_ids = [x["id"] for x in docs]
                else:
                    doc_ids = None

            if var_doc_ids:
                doc_ids = [] if doc_ids is None else doc_ids
                doc_ids.extend(var_doc_ids)


            kbinfos = settings.retrievaler.retrieval(query, embd_mdl, tenant_ids, filtered_kb_ids,
                                                     1, self._param.top_n,
                                                     self._param.similarity_threshold,
                                                     1 - self._param.keywords_similarity_weight,
                                                     aggs=False, rerank_mdl=rerank_mdl,
                                                     rank_feature=label_question(query, kbs), doc_ids=doc_ids,sort_by=self._param.sort_by)
        else:
            kbinfos = {"chunks": [], "doc_aggs": []}

        if self._param.use_kg and kbs:
            ck = settings.kg_retrievaler.retrieval(query,
                                                   tenant_ids,
                                                   filtered_kb_ids,
                                                   embd_mdl,
                                                   LLMBundle(tenant_id, LLMType.CHAT))
            if ck["content_with_weight"]:
                kbinfos["chunks"].insert(0, ck)

        if self._param.tavily_api_key:
            tav = Tavily(self._param.tavily_api_key)
            tav_res = tav.retrieve_chunks(query)
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

            df = pd.DataFrame({"content": [json.dumps(output_chunks,ensure_ascii=False)]})
        else:
            df = pd.DataFrame({"content": kb_prompt(kbinfos, 200000), "chunks": json.dumps(kbinfos["chunks"])})
        logging.debug("{} {}".format(query, df))
        return df.dropna()
