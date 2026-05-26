# Author: zwx
# Date: 2025/4/8 15:35
# Description: knowledge_search 知识检索
import json
from abc import ABC

from ..base import ComponentBase, ComponentParamBase
from api import settings
from api.db import LLMType
# from api.db.db_models import KnowledgeInfo, ApproveInfo
from api.db.services.knowledgebase_service import KnowledgebaseService
from rag.app.tag import label_question
import requests
from conf.es_search_settings import BASE_URL
from agent.util.es_util import generate_ablility_openness_request_headers
from app.core.llm_model.utils.model_caller import ModelCaller


class KnowledgeSearchParam(ComponentParamBase):
    """
    知识检索
    """

    def __init__(self):
        super().__init__()
        self.similarity_threshold = 0.2
        self.keywords_similarity_weight = 0.5
        self.top_n = 8
        self.top_k = 1024
        self.kb_ids = []
        self.rerank_id = ""
        self.empty_response = ""
        self.tavily_api_key = ""
        self.use_kg = False

    def check(self):
        self.check_decimal_float(self.similarity_threshold, "[Retrieval] Similarity threshold")
        self.check_decimal_float(self.keywords_similarity_weight, "[Retrieval] Keyword similarity weight")
        self.check_positive_number(self.top_n, "[Retrieval] Top N")


class KnowledgeSearch(ComponentBase, ABC):
    component_name = "KnowledgeSearch"
    component_title = "助理知识检索"


    def get_ori_input(self):
        for item in self.get_input_elements():
            if item['key'] == 'input':
                return {'valid_question': {}, 'rewrite_question': {str(item['value']): ''}}
        raise "请引入user_input!!"

    def _run(self, history, **kwargs):
        top_n = 10
        retrievaler_type = ''
        query_mysql = False
        query_ = history[-1][1]
        query = ''
        stop_words = ['办理', '需要', '材料', '条件', '流程']
        # TODO 现场需要传入对应header
        header = generate_ablility_openness_request_headers()
        for item in self.get_input_elements():
            if item['key'] == '事项选择':
                query = []
                query_keywords = []
                # TODO 支持一句多问
                retrievaler_type = '事项选择'
                parser_res = json.loads(self.get_stream_input().values.tolist()[0][0])
                if type(parser_res) == type([]):
                    parser_res = parser_res[0]
                # if not parser_res:
                #     parser_res = {'valid_question': {}, 'rewrite_question': {query_: ''}}
                # TODO 后续适配多问题
                if parser_res.__contains__('rewrite_question'):
                    if parser_res['rewrite_question']:
                        for rewrite_question in parser_res['rewrite_question'].keys():
                            tmp = []
                            query.append(rewrite_question)
                            tmp = [keyword for keyword in parser_res['rewrite_question'][rewrite_question].split(',')
                                                   if keyword not in stop_words]
                            query_keywords.append(tmp)
                            # query = list(parser_res['rewrite_question'].keys())[0]
                    # else:
                    #     query = [query_]

            if item['key'] == '问答':
                retrievaler_type = '问答'
                query = []
                parsed_model_output = json.loads(self.get_stream_input().values.tolist()[0][0])
                if parsed_model_output:
                    if parsed_model_output.__contains__('approve_name'):
                        query = [approve_name for approve_name in parsed_model_output['approve_name']]
                        query_mysql = True if query else False
                    elif parsed_model_output['index'] == -1:
                        # TODO 待加入澄清树逻辑
                        # return KnowledgeSearch.be_output(parsed_model_output)
                        pass
        # if not query:
        #     query = [query_]
        kbs = KnowledgebaseService.get_by_ids(self._param.kb_ids)
        if not kbs:
            return KnowledgeSearch.be_output("")

        embd_nms = list(set([kb.embd_id for kb in kbs]))
        assert len(embd_nms) == 1, "Knowledge bases use different embedding models."

        embd_mdl = None
        if embd_nms:
            embd_mdl = LLMBundle(self._canvas.get_tenant_id(), LLMType.EMBEDDING, embd_nms[0])
            self._canvas.set_embedding_model(embd_nms[0])

        rerank_mdl = None
        if self._param.rerank_id:
            rerank_mdl = LLMBundle(kbs[0].tenant_id, LLMType.RERANK, self._param.rerank_id)
        res = []

        if not kbs:
            kbs = True
        if kbs:
            self._param.top_n = top_n
            if retrievaler_type == '事项选择':
                used_approve_name = []
                valid_question = []
                index = 0
                for query_keyword, query_content in zip(query_keywords, query):
                    url = f"{BASE_URL}/v1/service/search/main/knowledge"
                    body = {
                             "search_mode":"vector_search",
                             "_knowledge_center_category":"",
                             "_knowledge_center_name_en":"",
                             "_knowledge_center_tags":"",
                             "_enabled":"",
                             "_index_category":"index_table",
                             "input_text":query_content,
                             "result_type":"map",
                             "page":1,
                             "rows":10,
                             "sort":"",
                             "condition":"",
                             "rerank_enabled":True,
                             "rerank_top_n":5,
                             "rerank_min_score":0.6,
                             "ext":"",
                             "vector_top_k":10,
                             "vector_min_score":0.3,
                             "mix_search_recall_number":5,
                             "mix_search_top_k":5,
                             "attributes":[
                                  "-1"
                             ]
                    }
                    header = generate_ablility_openness_request_headers()
                    response = requests.post(url, json=body, headers=header).json()
                    for item in response:
                        if item['_title'] not in used_approve_name:
                            used_approve_name.append(item['_title'])
                        else:
                            continue
                        if item:
                            if item.__contains__('unify_id'):
                                unify_id = item['unify_id']
                            else:
                                unify_id = ''
                            if item['Type'] != '高效办成一件事':
                                res.append({'事项名称': item['_title'],
                                            '办理条件': item['answer_map']['受理条件'], 'index': index,
                                            'unify_id': unify_id})
                            else:
                                res.append({'事项名称': item['_title'],
                                            '一件事介绍': item['Description'], 'index': index,
                                            'unify_id': unify_id})
                        index += 1
                    # kbinfos = settings.knowledge_retrievaler.retrieval(query_content, embd_mdl, kbs[0].tenant_id,
                    #                                                    self._param.kb_ids,
                    #                                                    1, self._param.top_n,
                    #                                                    self._param.similarity_threshold,
                    #                                                    1 - self._param.keywords_similarity_weight,
                    #                                                    aggs=False, rerank_mdl=rerank_mdl,
                    #                                                    rank_feature=label_question(query, kbs),
                    #                                                    keywords=query_keyword)
                    # for chunk in kbinfos['chunks']:
                    #     approve_name = chunk['content_with_weight']
                    #     if approve_name in used_approve_name:
                    #         continue
                    #     else:
                    #         used_approve_name.append(approve_name)
                    #     # doc_id = chunk['doc_id']
                    #     approve_info = ApproveInfo.select().where(ApproveInfo.approve_name == approve_name)[0]
                    #     res.append({'事项名称': approve_name, '名称同义词': approve_info.approve_split.split('\n'),
                    #                 '办事条件': approve_info.description, 'index': index, 'unify_id': ''})
                    #     index += 1
                    #     # chunk['content_with_weight'] = json.dumps(res, ensure_ascii=False)
                    if parser_res['valid_question']:
                        valid_question.append(list(parser_res['valid_question'].keys()))
                res = (f"前置合法性验证问题：{valid_question} \n"
                       f"事项列表: {json.dumps(res, ensure_ascii=False)}\n"
                       f"用户问题: {query}")

            elif retrievaler_type == '问答':
                if query_mysql:
                    for query_content in query:
                        url = f"{BASE_URL}/v1/service/search/main/knowledge/byname?_title={query_content}&_index=table_index_vector"
                        header = generate_ablility_openness_request_headers()
                        response = requests.get(url, headers=header).json()
                        if response.__contains__('unify_id'):
                            unify_id = response['unify_id']
                        elif response.__contains__('unifyId'):
                            unify_id = response['unifyId']
                        else:
                            unify_id = ''
                        header = generate_ablility_openness_request_headers()
                        url = f"{BASE_URL}/v1/service/kg_search/qa/answers"
                        body = {'entity':{'unify_id': unify_id}}
                        response = requests.post(url, json=body, headers=header).json()
                        if response and "answer" in response:
                            res.append({'事项名称': query_content, '事项详细信息': response['answer']})
                    # kbinfos = {}
                    # tmp = []
                    # for query_content in query:
                    #     tmp.append({'content_with_weight': query_content})
                    # kbinfos['chunks'] = tmp
                else:
                    url = f"{BASE_URL}/v1/service/search/main/knowledge"
                    body = {
                        "search_mode": "vector_search",
                        "_knowledge_center_category": "",
                        "_knowledge_center_name_en": "",
                        "_knowledge_center_tags": "",
                        "_enabled": "",
                        "_index_category": "index_table",
                        "input_text": query_,
                        "result_type": "map",
                        "page": 1,
                        "rows": 10,
                        "sort": "",
                        "condition": "",
                        "rerank_enabled": True,
                        "rerank_top_n": 5,
                        "rerank_min_score": 0.6,
                        "ext": "",
                        "vector_top_k": 10,
                        "vector_min_score": 0.3,
                        "mix_search_recall_number": 5,
                        "mix_search_top_k": 5,
                        "attributes": [
                            "-1"
                        ]
                    }
                    header = generate_ablility_openness_request_headers()
                    response = requests.post(url, json=body, headers=header).json()
                    for item in response:
                        if item:
                            res.append({'事项名称': item['_title'], '事项详细信息': item['answer_map']})
                    # kbinfos = settings.knowledge_retrievaler.retrieval(query_, embd_mdl, kbs[0].tenant_id,
                    #                                                    self._param.kb_ids,
                    #                                                    1, self._param.top_n,
                    #                                                    self._param.similarity_threshold,
                    #                                                    1 - self._param.keywords_similarity_weight,
                    #                                                    aggs=False, rerank_mdl=rerank_mdl,
                    #                                                    rank_feature=label_question(query, kbs))
                # kbinfos = {}
                # for chunk in kbinfos['chunks']:
                #     content_with_weight = chunk['content_with_weight']
                #     # doc_id = chunk['doc_id']
                #     details = KnowledgeInfo.select().where(
                #         KnowledgeInfo.knowledge_name == content_with_weight
                #     )[0].detail
                #     detail = json.loads(details)
                #     materials = []
                #     free_sub_materials = []
                #     for material in detail['materialList']:
                #         if material['freeSubmission'] == '无':
                #             materials.append({'材料名称': material['materialTitle'], '填报须知': material['materialExplain']})
                #         else:
                #             free_sub_materials.append(
                #                 {'材料名称': material['materialTitle'], '填报须知': material['materialExplain']})
                #     res.append({'事项名称': content_with_weight, '受理条件': detail['acceptanceCondition'],
                #                 '服务对象': detail['serveObject'], '所需材料': materials,
                #                 '免提交材料': free_sub_materials, '收费项目': detail['chargeList'] if detail.__contains__('chargeList') else [],
                #                 '办理部门': detail['deptName'], '办理时限': detail['approveLimit'],
                #                 '承诺办结时限': detail['commitmentLimitExplain']})
                #     # chunk['content_with_weight'] = json.dumps(res, ensure_ascii=False)
                return KnowledgeSearch.be_output(json.dumps(res, ensure_ascii=False))
            else:
                kbinfos = settings.knowledge_retrievaler.retrieval(query, embd_mdl, kbs[0].tenant_id,
                                                                   self._param.kb_ids,
                                                                   1, self._param.top_n,
                                                                   self._param.similarity_threshold,
                                                                   1 - self._param.keywords_similarity_weight,
                                                                   aggs=False, rerank_mdl=rerank_mdl,
                                                                   rank_feature=label_question(query, kbs))
        else:
            kbinfos = {"chunks": [], "doc_aggs": []}

        if self._param.use_kg and kbs:
            ck = settings.kg_retrievaler.retrieval(query,
                                                   [kbs[0].tenant_id],
                                                   self._param.kb_ids,
                                                   embd_mdl,
                                                   LLMBundle(kbs[0].tenant_id, LLMType.CHAT))
            if ck["content_with_weight"]:
                kbinfos["chunks"].insert(0, ck)

        if type(res) == type(' '):
            return KnowledgeSearch.be_output(res)
        else:
            return KnowledgeSearch.be_output(json.dumps(res, ensure_ascii=False))
