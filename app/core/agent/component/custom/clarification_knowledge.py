# Author: zwx
# Date: 2025/7/24 11:10
# Description: 澄清知识获取
import copy
import json
import logging
import time
from abc import ABC
from collections import OrderedDict
from typing import Dict, List

import requests
from pydantic import BaseModel

from ..base import ComponentParamBase, ComponentBase
from agent.util.es_util import generate_ablility_openness_request_headers
from api.db.services.topic_service import TopicWordApproveRelationService, TopicWordInfoService
from api.utils.neo4j_utils import Neo4jConnection, APPROVE_LABELS
from conf.es_search_settings import BASE_URL
from app.core.llm_model.utils.model_caller import ModelCaller


class ClarificationVO(BaseModel):
    original_words: list = []  # 原始词汇
    words: list = []  # 词汇名称
    word_infos: list = []  # 词汇信息
    approves: list = []  # 事项
    approve: Dict = {}  # 单个事项 {"id":"","name": result_approve.get("name"), "globalId": result_approve.get("基本编码"), "label": "业务项"}
    topics: list = []  # 主题
    msg: str = ""  # 反问澄清话术
    type: str = "1"  # 1 反问  2 词汇  3事项  4.其他情况
    kb_id: str = ""  # 知识库id
    doc_ids: list = []  # 文档id

    @staticmethod
    def tuple_to_model(tuple_data):
        return ClarificationVO(**dict(zip(ClarificationVO.__fields__.keys(), tuple_data)))


class ClarificationResultVO(BaseModel):
    words: list = []  # 词汇  [{"id":"",name:""}]
    approves: list = []  # 事项
    approve: Dict = {}  # 单个事项 {"id":"","name": result_approve.get("name"), "globalId": result_approve.get("基本编码"), "label": "业务项"}
    topics: list = []  # 主题 [{"id":"",name:""}]
    msg: str = ""  # 反问澄清话术
    type: str = "1"  # 1 反问  2 词汇  3事项  4.其他情况

    @staticmethod
    def tuple_to_model(tuple_data):
        return ClarificationVO(**dict(zip(ClarificationVO.__fields__.keys(), tuple_data)))


# 图谱澄清服务
class ClarificationService:

    def __init__(self):
        approve_label_where_conds = []
        for label in ["事项知识"]:
            approve_label_where_conds.append("{alias}:" + label)
        self.approve_label_cond = "(" + ' or '.join(approve_label_where_conds) + ")"
        self.connection = Neo4jConnection()

    # 获取澄清结果
    def get_clarification_result(self, param: ClarificationVO) -> ClarificationVO:
        logging.info("澄清接口入参:" + str(param))
        connection = self.connection
        result = ClarificationVO()
        if param is None:
            raise Exception("请求体为空")

        max_topic = 10
        max_approve = 3
        original_words = copy.deepcopy(param.words) if len(param.original_words) == 0 else param.original_words
        param.original_words = original_words
        words = param.words
        approves = param.approves
        topics = param.topics
        kb_id = param.kb_id  # 知识库id
        doc_ids = param.doc_ids  # 知识库id
        result_approves = []
        result_words = []
        result_word_infos = []
        result_type = "4"  # 1 反问  2 词汇  3事项  4.其他情况
        result_topics = []
        try:
            res_topics = []  # 主题
            topic_names = []  # 主题名称
            case1 = False
            case2 = False
            case3 = False
            # 知识库id过滤条件
            kb_id_cond = "{kb_id:'" + kb_id + "'}" if kb_id else ""
            doc_ids_json = str(doc_ids)
            # 入参词汇
            if len(words) > 0:
                words_json = str(words)
                # 1：直接查询参数词汇唯一路径返回末尾词汇
                cql1 = "match (n:`主题词汇`{kb_id_cond})-[:`同义词`]->(s:`主题词汇`{kb_id_cond}) where n.name in {words} and n.doc_id in {doc_ids} with (collect(s.name) + {words}) as words match p=(n:`主题词汇`{kb_id_cond})-[r:`子词汇`|`同义词`*]->(m:`主题词汇`{kb_id_cond})  where ALL(x in nodes(p) where x.name in " \
                       "words) with max(length(p)) as l ,words match p=(n:`主题词汇`{kb_id_cond})-[r:`子词汇`|`同义词`*]->(m:`主题词汇`{" \
                       "kb_id_cond}) where m.doc_id in {doc_ids} and ALL(x in nodes(p) where x.name in words) and length(p)=l return distinct m "
                match_cql = cql1.format(doc_ids=doc_ids_json, words=words_json, kb_id_cond=kb_id_cond)
                result_list = connection.execute_cql(match_cql)

                if len(result_list) == 0 and len(words) == 1:
                    node_sql = "match (n:`主题词汇`{kb_id_cond})-[:`绑定`{kb_id_cond}]->(:`事项知识`{kb_id_cond}) where n.name = '{word_name}' and n.doc_id in {doc_ids} return n"
                    match_cql = node_sql.format(doc_ids=doc_ids_json, word_name=words[0], kb_id_cond=kb_id_cond)
                    result_list = connection.execute_cql(match_cql)

                if len(result_list) == 1:
                    row = result_list[0][0]
                    last_word = row
                    # 然后根据末尾词汇查找唯一路径返回事项
                    if self.is_only_one_path(last_word.id, approves):
                        result_approves = self.get_only_one_path_approve(last_word.id, approves)
                        result_topics = [{"id": last_word.get("word_id"), "name": last_word.get("word_name")}]
                        case1 = True
                        result_type = "3"

                    if not case1:
                        # 是否为末级节点
                        is_last_node = self.is_last_node(last_word.id)
                        node_has_no_approve = self.node_has_no_approve(last_word.id)
                        if is_last_node and node_has_no_approve:
                            result_topics = [{"id": last_word.get("word_id"), "name": last_word.get("word_name")}]
                            case1 = True
                            result_type = "4"
                        elif is_last_node and not node_has_no_approve:
                            result_approves = self.get_only_one_path_approve(last_word.id, approves)
                            result_topics = [{"id": last_word.get("word_id"), "name": last_word.get("word_name")}]
                            case1 = True
                            result_type = "3"
                        elif not is_last_node:
                            tmp_cql = "match (parent)-[:`子词汇`]->(next:`主题词汇`{kb_id_cond}) where " \
                                      "id(parent)={id} with next  " \
                                      " return distinct next order by next.sort_order "
                            tmp_cql = tmp_cql.format(id=last_word.id, kb_id_cond=kb_id_cond)
                            next_words = connection.execute_cql(tmp_cql)
                            next_words = self.filter_next_words(param, next_words, approves, topic_names, kb_id,
                                                                doc_ids)
                            tmp_next_words = self.dedup_next_words(next_words)
                            tmp_result = self.process_next_words(param, tmp_next_words, param.words, topic_names, kb_id,
                                                                 doc_ids)
                            result_type = tmp_result.type
                            result_words = tmp_result.words
                            if result_type == "2":
                                result_word_infos = self.get_dedup_next_words(next_words)
                            else:
                                result_word_infos = tmp_result.word_infos
                            result_approves = tmp_result.approves
                            result_topics = tmp_result.topics
                            if last_word.get("name") not in words:
                                words.append(last_word.get("name"))
                                words_json = str(words)
                            case1 = True

                # -*- 参数预处理 -*-
                if not case1:
                    if len(topics) > 0:
                        tmp_topics_json = str(topics)
                        topic_cql = "match (n:主题{kb_id_cond}) where n.name in {topics} and n.doc_id in {doc_ids} return collect(n.name) as names"
                        topic_res = connection.execute_cql_one(
                            topic_cql.format(doc_ids=doc_ids_json, topics=tmp_topics_json, kb_id_cond=kb_id_cond))
                        topic_names = topic_res.get("names", [])
                    else:
                        # 查询入参词汇关联主题
                        word_topic_names = self.get_topic_names(original_words, kb_id, doc_ids)
                        topic_names.extend(word_topic_names)
                        topic_names = list(set(topic_names))
                    # 同义词查询
                    syn_cql = "match (n:`主题词汇`{kb_id_cond})-[:同义词*]->(m:`主题词汇`{kb_id_cond})<-[:`子词汇`|`主题`*]-(t:`主题`{kb_id_cond}) where n.name in {words} and n.doc_id in {doc_ids} and t.name in {topics}  with collect(m.name)+ {words} as words return words"
                    new_words = connection.execute_cql_one(
                        syn_cql.format(doc_ids=doc_ids_json, words=words_json, topics=str(topic_names),
                                       kb_id_cond=kb_id_cond))
                    new_words = new_words.get("words", [])
                    words = new_words
                    # 过滤词汇
                    filter_cql = "match (n:主题词汇{kb_id_cond})-[:`子词汇`|`主题`|`同义词`*]-(t:`主题`{kb_id_cond}) where n.name in {words} and n.doc_id in {doc_ids} and t.name in {topics} return collect(n.name)+{topics} as words"
                    filter_cql = filter_cql.format(doc_ids=doc_ids_json, words=str(words), topics=str(topic_names),
                                                   kb_id_cond=kb_id_cond)
                    filtered_words = connection.execute_cql_one(filter_cql)
                    words = filtered_words.get("words", [])
                    words = self.debup_words(words)
                    words_json = str(words)

                    topic_cql = "match p=(n:`主题词汇`{kb_id_cond})<-[:`子词汇`|`主题`*]-(t:`主题`{kb_id_cond}) where n.name in {words} and n.doc_id in {doc_ids} with t {where} return distinct " \
                                "t union match (t)-[:主题]->(m:主题词汇{kb_id_cond}) where t.name in {words} and t.doc_id in {doc_ids} return distinct t "
                    where = ""
                    if len(topic_names) > 0:
                        where = " where t.name in " + str(topic_names)
                    res_topics = connection.execute_cql(
                        topic_cql.format(doc_ids=doc_ids_json, words=words_json, where=where, kb_id_cond=kb_id_cond))
                    res_topics_names = [item['t'].get('name') for item in res_topics]
                    topic_names = res_topics_names
                    result_topics = topic_names
                #  -*- 预处理结束-*-

                # 2: 查询事项
                if not case1 and len(words) > 0 and len(topic_names) < max_topic:
                    pass

                # 3: 根据主题数量处理
                if not case1 and not case2:
                    # 如果大于n个主题，返回主题
                    if len(res_topics) >= max_topic:
                        new_res_topics = res_topics[:10]
                        new_res_topics_words = [item['t'].get('name') for item in new_res_topics]
                        result_line = f'{"".join(original_words)}通常涉及到不同的主题，包括{",".join(new_res_topics_words)}等等。请您补充描述更多细节'
                        result.msg = result_line
                        # 返回主题词汇
                        result_words = [item['t'].get('name') for item in new_res_topics]
                        result_topics = result_words
                        case3 = True
                        result_type = "1"
                    # 如果大于1个主题，返回主题
                    elif len(res_topics) > 1:
                        for data in res_topics:
                            row = data.get("t")
                            result_words.append(row.get("name"))
                            result_topics = result_words
                        case3 = True
                        result_type = "2"
                    # 如果都在一个主题下，则查找共同父节点，然后返回向下1级
                    elif len(res_topics) == 1:
                        # 找到第一个共同父节点
                        tmp_cql1 = "match (common{kb_id_cond}) where (common:`主题` or common:主题词汇) and common.doc_id in {doc_ids} and  ALL(x in {words} where (:`主题词汇`{params})<-[" \
                                   ":`子词汇`|`主题`*0..]-(common) or (:`主题词汇`{params})-[:`同义词`*]->(:`主题词汇`)<-[:子词汇|`主题`*0..]-(" \
                                   "common) or common.name = x) with common match p=(common)<-[r:主题|子词汇*0..]-(t:`主题`) where  t.name in " + str(
                            topic_names) + " with common ," \
                                           "length(p) as l order by l desc with collect(common) as parent,l where size(parent)=1 return parent[0] as parent limit 1 "
                        parent_res = connection.execute_cql_one(
                            tmp_cql1.format(doc_ids=doc_ids_json, words=words_json, params="{name:x}",
                                            kb_id_cond=kb_id_cond))
                        if parent_res:
                            parent = parent_res.get("parent")
                            parent_id = parent.id
                            # 获取向下1级子节点(且过滤不需要的子节点)
                            tmp_cql2 = "match (parent)-[:`子词汇`|`同义词`|`主题`]->(next:`主题词汇`{kb_id_cond})-[:`子词汇`*0..]->(m:`主题词汇`{kb_id_cond}) where id(parent)={wordId} with next  " \
                                       "where ANY(x in {words} where (next)-[:`子词汇`|`主题`*0..]->(:`主题词汇`{params}) or (" \
                                       ":`主题`{params})-->(next)) or NONE(x in {words} where (next)-[" \
                                       ":`子词汇`|`主题`*0..]->(:`主题词汇`{params})) return " \
                                       "distinct next order by next.sort_order "
                            tmp_cql3 = tmp_cql2.format(wordId=parent_id, words=words_json,
                                                       params="{name:x}",
                                                       kb_id_cond=kb_id_cond)
                            next_words = connection.execute_cql(tmp_cql3)
                            next_words = self.filter_next_words(param, next_words, approves, topic_names, kb_id,
                                                                doc_ids)
                            if len(next_words) > 0:
                                tmp_next_words = self.dedup_next_words(next_words)
                                tmp_result = self.process_next_words(param, tmp_next_words, param.words, topic_names,
                                                                     kb_id, doc_ids)
                                result_type = tmp_result.type
                                result_words = tmp_result.words
                                result_word_infos = tmp_result.word_infos
                                result_approves = tmp_result.approves
                                result_topics = tmp_result.topics
                                case3 = True
                            else:
                                tmp_cql2 = "match (parent)-[:`子词汇`|`同义词`]->(next:`主题词汇`{kb_id_cond})-[:`子词汇`*0..]->(m:`主题词汇`{kb_id_cond}) where " \
                                           "parent.wordId='{wordId}' with next  " \
                                           " return distinct next order by next.sort_order "
                                tmp_cql3 = tmp_cql2.format(wordId=parent_id, kb_id_cond=kb_id_cond)
                                next_words = connection.execute_cql(tmp_cql3)
                                next_words = self.filter_next_words(param, next_words, approves, topic_names, kb_id,
                                                                    doc_ids)
                                if len(next_words) > 0:
                                    tmp_next_words = self.dedup_next_words(next_words)
                                    tmp_result = self.process_next_words(param, tmp_next_words, param.words,
                                                                         topic_names,
                                                                         kb_id, doc_ids)
                                    result_type = tmp_result.type
                                    result_words = tmp_result.words
                                    result_word_infos = tmp_result.word_infos
                                    result_approves = tmp_result.approves
                                    result_topics = tmp_result.topics
                                    if len(result_words) > 0:
                                        case3 = True
                                        result_type = "2"

            find = case1 or case2 or case3
            # 入参事项
            if len(approves) > 0 and not find:
                approves_json = str(approves)
                # 查询主题
                topic_cql = "match p=(n)<-[:`子词汇`|`主题`|`同义词`|`绑定`*]-(t:`主题`{kb_id_cond}) where " + self.approve_label_cond.format(
                    alias="n") + " and n.name in {approves} optional match (t)-[:主题]->(m:主题词汇{kb_id_cond}) with t {where} return distinct t"
                where = ""
                if len(topic_names) > 0:
                    where = " where t.name in " + str(topic_names)
                    where += " and t.doc_id in " + str(doc_ids)
                res_topics = connection.execute_cql(
                    topic_cql.format(approves=approves_json, where=where, kb_id_cond=kb_id_cond))
                # 如果大于n个主题，返回主题
                if len(res_topics) >= max_topic:
                    new_res_topics = res_topics[:10]
                    new_res_topics_words = [item['t'].get('name') for item in new_res_topics]
                    result_line = f'{"".join(original_words)}通常涉及到不同的主题，包括{",".join(new_res_topics_words)}等等。请您补充描述更多细节'
                    result.msg = result_line
                    # 返回主题词汇
                    result_words = [item['t'].get('name') for item in new_res_topics]
                    result_topics = result_words
                    result_type = "1"
                # 如果大于1个主题，返回主题
                elif len(res_topics) > 1:
                    for data in res_topics:
                        row = data.get("t")
                        result_words.append(row.get("name"))
                        result_topics = result_words
                    result_type = "2"
                else:
                    # 找到第一个共同父节点
                    tmp_cond = []
                    for label in APPROVE_LABELS:
                        tmp_cond.append("(:" + label + "{params})<-[:`子词汇`|`绑定`|`同义词`*0..]-(common)")
                    tmp_where = ' or '.join(tmp_cond)
                    tmp_cql1 = "match (common:`主题词汇`{kb_id_cond}) where common.doc_id in {doc_ids} and  ALL(x in {approves} where " + tmp_where + ") with common match p=(common)<-[r:主题|子词汇*]-(:`主题`)  with " \
                                                                                                                                                      "common,length(p) as l order by l desc with collect(common)[0] as parent "
                    # 获取向下1级子节点
                    tmp_cql2 = " match (parent)-[:`子词汇`|`同义词`]->(next:`主题词汇`{kb_id_cond})-[:`子词汇`|`绑定`*0..]->(m) where " \
                               " " + self.approve_label_cond.format(
                        alias="m") + " and m.name in {approves} return distinct next order by next.sort_order"
                    tmp_cql3 = (tmp_cql1 + tmp_cql2).format(doc_ids=doc_ids_json, approves=approves_json,
                                                            params="{name:x}",
                                                            kb_id_cond=kb_id_cond)
                    next_words = connection.execute_cql(tmp_cql3)
                    if len(next_words) > 0:
                        result_words = self.dedup_next_words(next_words)
                        result_type = "2"

        except Exception as e:
            logging.info(f"澄清异常:{e}")
            result_type = "4"
            result.msg = "澄清异常:" + str(e.args)
            # return InternalErrorException(message=e.args)

        if len(result_words) > 0:
            # 查询词汇节点信息
            if not result_word_infos:
                cql = "match p=(t:主题{kb_id_cond})-[:`子词汇`|`主题`*]->(i:主题词汇{kb_id_cond})-[:`子词汇`*0..1]-(n:主题词汇{kb_id_cond}) {where} return distinct n order by n.sort_order"
                where = " where 1=1"
                if len(topic_names) == 1:
                    where += " and t.name in " + str(topic_names)
                where += " and i.name in " + words_json
                where += " and n.name in" + str(result_words)
                where += " and n.doc_id in " + str(doc_ids)
                where += " and All(x in " + str(result_words) + " where EXISTS((i)-[:`子词汇`*0..1]-(:主题词汇{name:x})))"
                res = connection.execute_cql(cql.format(where=where, kb_id_cond=kb_id_cond))
                result_word_infos = [{"id": data.get("n").get("word_id"), "name": data.get("n").get("word_name")} for
                                     data in res]

            # 查询是否直接关联事项，如果全部直接关联事项且<=max_approve则返回列表
            # cql = "match p=(t:主题)-[:`子词汇`|`主题`*]->(i:主题词汇)-[:`子词汇`]->(n:主题词汇)-[:`绑定`]->(a) {where} return distinct a"
            # where = " where " + self.approve_label_cond.format(alias="a")
            # if len(topic_names) == 1:
            #     where += " and t.name in " + str(topic_names)
            # where += " and i.name in " + words_json
            # where += " and n.name in" + str(result_words)
            # res = connection.execute_cql(cql.format(where=where))
            # if 1 < len(res) <= max_approve:
            #     result_approves = [data.get("a") for data in res]
            #     result_type = "3"

            # 查询父节点
            cql = "match p=(t:主题{kb_id_cond})-[:`子词汇`|`主题`*]->(i:主题词汇{kb_id_cond})-[:`子词汇`]->(n:主题词汇{kb_id_cond}) {where} with i,collect(n.name) as names  with i, apoc.coll.removeAll({words}, names) as inters where size(inters)=0 return i"
            where = " where 1=1"
            where += " and t.doc_id in " + str(doc_ids)
            if len(topic_names) == 1:
                where += " and t.name in " + str(topic_names)
            res = connection.execute_cql(cql.format(where=where, words=str(result_words), kb_id_cond=kb_id_cond))
            result_topics = [{"id": data.get("i").get("word_id"), "name": data.get("i").get("word_name")} for data in
                             res if
                             (data.get("i").get("word_name") in words)]

        if len(result_approves) > 0:
            approve_names = []
            for result_approve in result_approves:
                if result_approves is not None and result_approve.get("name") is not None:
                    result_labels = result_approve["labels"] if result_approve[
                                                                    "labels"] is not None else result_approve.labels
                    result_labels = [x for x in APPROVE_LABELS if x in ','.join(result_labels)]
                    label = result_labels[0] if len(result_labels) > 0 else ""
                    approve = {"id": result_approve.get("id"), "name": result_approve.get("name"),
                               "label": label, "type": label, "labels": result_labels}
                    if len(result_approves) == 1:
                        result.approve = approve
                    result.approves.append(approve)
                    approve_names.append(result_approve.get("name"))
            if len(result_words) == 0:
                if result_type == "3" and len(result_topics) == 1:
                    pass
                else:
                    # 查询父节点
                    cql = "match p=(t:主题{kb_id_cond})-[:`子词汇`|`主题`*]->(i:主题词汇{kb_id_cond})-[:`绑定`]->(a) {where} with i,collect(a.name) as names  with i, apoc.coll.removeAll({words}, names) as inters where size(inters)=0 return i"
                    where = " where 1=1"
                    where += " and t.doc_id in " + str(doc_ids)
                    if len(topic_names) == 1:
                        where += " and t.name in " + str(topic_names)
                    res = connection.execute_cql(
                        cql.format(where=where, words=str(approve_names), kb_id_cond=kb_id_cond))
                    result_topics = [{"id": data.get("i").get("word_id"), "name": data.get("i").get("word_name")} for
                                     data in res if
                                     (data.get("i").get("word_name") in words)]

        result.words = result_words
        result.word_infos = result_word_infos
        result.topics = result_topics

        if len(result.words) == 0 and len(result.approves) == 0 and len(result.topics) == 0:
            result_type = "4"

        result.type = result_type
        logging.info("澄清结果:" + str(result))
        return result

    # 递归解析下级节点
    # tmp_next_words 当前获取的下级节点
    # words 接口入参
    # topics 接口入参
    def process_next_words(self, param: ClarificationVO, tmp_next_words: list, words: list, topic_names: list,
                           kb_id: str, doc_ids: list) -> ClarificationVO:
        connection = self.connection
        kb_id_cond = "{kb_id:'" + kb_id + "'}" if kb_id else ""

        result = ClarificationVO()

        intersection = [x for x in tmp_next_words if x in words]  # 如果下级节点存在于入参词汇中
        intersection_json = str(intersection)

        # # 如果下级节点于入参词汇全相等，直接返回（避免死循环）
        # if sorted(param.original_words) == sorted(tmp_next_words):
        #     return tmp_next_words

        # 如果下级节点只有1个，则直接添加到入参中
        if len(tmp_next_words) == 1:
            words.extend(tmp_next_words)

        if len(intersection) == 1 or len(tmp_next_words) == 1:

            intersection_json = str(intersection) if len(intersection) == 1 else str(tmp_next_words)

            next_cql = "match (t:主题{kb_id_cond})-[:主题|子词汇*]->(n:主题词汇{kb_id_cond})-[:`子词汇`]->(next:`主题词汇`{" \
                       "kb_id_cond})-[:`子词汇`|`同义词`|`绑定`*0..]->(m) {" \
                       "where} with next order by next.sort_order return collect(distinct next.name) as words "
            where = " where n.name in " + intersection_json + " "
            where += " and n.doc_id in " + str(doc_ids) + " "
            if len(topic_names) > 0:
                where += " and t.name in " + str(topic_names)
            next_cql = next_cql.format(where=where, kb_id_cond=kb_id_cond)
            next_words = connection.execute_cql_one(next_cql)
            next_words = next_words.get("words", [])
            tmp_intersection = [x for x in next_words if x in words]
            if len(next_words) == 1 and len(tmp_intersection) == 0:
                words.extend(next_words)
                param.words = words
                return self.get_clarification_result(param)
            elif len(next_words) == 0:
                param.words = words
                return self.get_clarification_result(param)
            else:
                return self.process_next_words(param, next_words, words, topic_names, kb_id, doc_ids)
        elif len(intersection) > 0:
            words_json = str(words)
            where_cql = " where n.name in " + intersection_json + " "
            where_cql += " and n.doc_id in " + str(doc_ids) + " "
            # 是否为末级节点
            is_last_node_cql = "match (n:主题词汇{kb_id_cond}) " + where_cql + " with n match (s:主题词汇{kb_id_cond})-[:`主题`|子词汇]->(n)-[:绑定]->(a) where " + self.approve_label_cond.format(
                alias="a") + " and s.name in " + words_json + \
                               "return distinct n union match (n:主题词汇{kb_id_cond}) " + where_cql + \
                               " with n match (s:主题词汇{kb_id_cond})-[:`主题`|子词汇]->(n) where not (n)-->() and s.name in " + words_json + " return distinct n "
            last_nodes = connection.execute_cql(is_last_node_cql.format(kb_id_cond=kb_id_cond))
            if len(last_nodes) > 0:
                result.words = intersection
                result.type = "2"
                return result

            # 不是末级节点则继续递归查询
            return_cql = " unwind reduce(acc = [], node in nodes(p) | acc + [node.name]) as nodeNames return collect(distinct nodeNames) as names "
            match_cql = "match p=(t:主题{kb_id_cond})-[:主题|子词汇*]->(n: 主题词汇{kb_id_cond})-[:子词汇*0..]->(:主题词汇{kb_id_cond})"
            if len(topic_names) > 0:
                where_cql += " and t.name in " + str(topic_names)

            cql = match_cql + where_cql + return_cql
            tail_node_res = connection.execute_cql_one(cql.format(kb_id_cond=kb_id_cond))
            if tail_node_res:
                tail_name_names = tail_node_res.get("names")
                tail_name_names = list(set(tail_name_names))
                for i in range(len(words) - 1, -1, -1):
                    if words[i] not in tail_name_names:  # 删除元素
                        del words[i]
                param.words = words
                if sorted(param.words) == sorted(words):
                    result.words = intersection
                    result.type = "2"
                    return result
                else:
                    return self.get_clarification_result(param)
        else:
            filter_cql = "match p=(t:主题{kb_id_cond})-[:主题|子词汇*]->(n:主题词汇{kb_id_cond})-[:子词汇*]->(m:主题词汇{kb_id_cond}) {where} with n order by n.sort_order return collect(distinct n.name) as words"
            where = " where n.name in " + str(tmp_next_words) + " and m.name in " + str(words)
            where += " and n.doc_id in " + str(doc_ids) + " "
            if len(topic_names) > 0:
                where += " and t.name in " + str(topic_names)
            filter_cql = filter_cql.format(where=where, kb_id_cond=kb_id_cond)
            children_word = connection.execute_cql_one(filter_cql)
            next_words = children_word.get("words", [])
            # 过滤后的词和参数传的词是否相等
            is_equal = set(next_words) == set(tmp_next_words)
            if len(next_words) == 1:
                words.extend(next_words)
                param.words = words
                return self.get_clarification_result(param)
            elif len(next_words) > 0 and not is_equal:
                return self.process_next_words(param, next_words, words, topic_names, kb_id)
            else:
                result.words = tmp_next_words
                result.type = "2"
                return result

    def filter_next_words(self, param: ClarificationVO, words, approves: List, topic_names, kb_id, doc_ids):
        connection = self.connection
        kb_id_cond = "{kb_id:'" + kb_id + "'}" if kb_id else ""
        word_names = [item['next'].get('name') for item in words]
        where = " where " + self.approve_label_cond.format(alias="a")
        where += " and n.name in " + str(word_names)
        where += " and n.doc_id in " + str(doc_ids)
        if len(topic_names) > 0:
            where += " and t.name in " + str(topic_names)
        if len(approves) > 0:
            where += " and a.name in " + str(approves)
        if len(words) == 1:
            param.words.append(words[0].get("next")["word_name"])

            next_cql = "match (t:主题{kb_id_cond})-[:主题|子词汇*]->(n:主题词汇{kb_id_cond})-[:`子词汇`|`同义词`]->(next:`主题词汇`{kb_id_cond})-[:`子词汇`|`同义词`|`绑定`*]->(a) {where} with next  " \
                       " return distinct next order by next.sort_order "
            next_cql = next_cql.format(where=where, kb_id_cond=kb_id_cond)
            next_words = connection.execute_cql(next_cql)
            if len(next_words) == 0:
                return words
            return self.filter_next_words(param, next_words, approves, topic_names, kb_id, doc_ids)
        else:
            if len(approves) == 0 or len(words) == 0:
                return words
            cql = "match (t:主题{kb_id_cond})-[:主题|子词汇*]->(n:主题词汇{kb_id_cond})-[:`子词汇`|`同义词`|`绑定`*]->(a) {where} with n as next return next order by next.sort_order "
            word_nodes = connection.execute_cql(cql.format(where=where, kb_id_cond=kb_id_cond))
            return word_nodes

    # 查询根据词汇查询主题名称
    def get_topic_names(self, words, kb_id, doc_ids):
        connection = self.connection
        kb_id_cond = "{kb_id:'" + kb_id + "'}" if kb_id else ""
        topic_names = []
        if len(words) > 0:
            words_json = str(words)
            doc_ids_json = str(doc_ids)
            cql1 = "match (m:主题{kb_id_cond}) where m.name in {words} and m.doc_id in {doc_ids} return m".format(
                doc_ids=doc_ids_json,
                words=words_json,
                kb_id_cond=kb_id_cond)
            topics = connection.execute_cql(cql1)
            if len(topics) == 0:
                cql2 = "match p=(m:主题{kb_id_cond})-[:`子词汇`|`同义词`|`绑定`|主题*]->(n:主题词汇{kb_id_cond})<-[:同义词*0..]-(s:主题词汇{kb_id_cond})  unwind reduce(acc = [" \
                       "], node in nodes(p) | acc + [node.name]) as nodeNames with collect(distinct nodeNames) as " \
                       "nodeNames, m  where ALL(x in  {words} where x in " \
                       "nodeNames) and m.doc_id in {doc_ids} return distinct m "
                cql2 = cql2.format(doc_ids=doc_ids_json, words=words_json, kb_id_cond=kb_id_cond)
                topics = connection.execute_cql(cql2)
            if len(topics) == 0:
                cql2_1 = "match (n:主题词汇{kb_id_cond})<-[:`子词汇`|`同义词`|`绑定`|主题*]-(m:主题{kb_id_cond}) where n.name in {words} and n.doc_id in {doc_ids} return m".format(
                    doc_ids=doc_ids_json, words=words_json, kb_id_cond=kb_id_cond)
                cql2_2 = "match (n:`主题词汇`{kb_id_cond})-[:同义词]->(:`主题词汇`{kb_id_cond})<-[:`子词汇`|`同义词`|`绑定`|主题*]-(m:主题{kb_id_cond}) where n.name in {words} and n.doc_id in {doc_ids} return m".format(
                    doc_ids=doc_ids_json, words=words_json, kb_id_cond=kb_id_cond)
                cql2 = cql2_1 + " union all " + cql2_2
                topics = connection.execute_cql(cql2)
            for data in topics:
                row = data.get("m")
                topic_names.append(row.get("name"))
        return topic_names

    # 是否为最后一个节点
    def is_last_node(self, id):
        if id:
            where = " where id(n) = " + str(id) + " and not (n)-[:子词汇|同义词]->(:`主题词汇`)"
            cql = "match p=(n:`主题词汇`) " + where + " return n "
            result_list = self.connection.execute_cql(cql)
            if len(result_list) != 0:
                return True
        return False

    # 判断末级节点且没有绑定事项
    def node_has_no_approve(self, id):
        if id:
            conds = []
            for label in APPROVE_LABELS:
                conds.append("not (n)-[:绑定]->(:" + label + ")")
            cond = ' and '.join(conds)
            where = " where id(n) = " + str(id) + " and " + cond
            cql = "match p=(n:`主题词汇`) " + where + " return n "
            if len(self.connection.execute_cql(cql)) == 0:
                return False
        return True

    # 判断是否有唯一路径找到目标事项
    def is_only_one_path(self, id, approves: List, max_approve: int = 3):
        count = 0
        if id:
            where = " where " + self.approve_label_cond.format(alias="a")
            where += " and id(n) = " + str(id) + ""
            if len(approves):
                where += " and a.name in " + str(approves)
            cql = "match p=(n:`主题词汇`)-[:`子词汇`|`同义词`|`绑定`*]->(a) " + where + " return count(p) as count "
            result_list = self.connection.execute_cql(cql)
            count = result_list[0].get("count", 0)
        if count == 1:
            return True
        else:
            return False

    def get_only_one_path_approve(self, id, approves: List):
        result = []
        if id:
            where = " where " + self.approve_label_cond.format(alias="a")
            where += " and id(n) = " + str(id) + ""
            if len(approves):
                where += " and a.name in " + str(approves)
            cql = "match p=(n:`主题词汇`)-[:`子词汇`|`同义词`|`绑定`*]->(a) " + where + " return a "
            result_list = self.connection.execute_cql(cql)
            for data in result_list:
                row = data.get("a")
                result.append(row)
        return result

    # 去重下级词汇
    def dedup_next_words(self, words):
        tmp_next_words = []
        for data in words:
            row = data.get("next")
            if row.get("name") in tmp_next_words:
                continue
            tmp_next_words.append(row.get("name"))
        return tmp_next_words

    # 去重词汇
    def debup_words(self, words):
        seen = set()
        return [x for x in words if not (x in seen or seen.add(x))]

    def get_dedup_next_words(self, words):
        tmp_next_words = []
        tmp_next_word_names = []
        for data in words:
            row = data.get("next")
            if row.get("name") in tmp_next_word_names:
                continue
            tmp_next_words.append({"id": row.get("word_id"), "name": row.get("name")})
            tmp_next_word_names.append(row.get("name"))
        return tmp_next_words


class ClarificationKnowledgeParam(ComponentParamBase):
    """
    组件参数
    """

    def __init__(self):
        super().__init__()
        self.history_qa_list = []  # 历史澄清问答
        self.history_words = []
        self.kb_id = []  # 知识库id
        self.approve_kb_id = ""  # 事项知识库
        self.similarity_threshold = 0.5
        self.top_n = 8

    def check(self):
        if not self.kb_id:
            raise ValueError("未选择知识库")
        self.check_decimal_float(self.similarity_threshold, "参数【similarity_threshold 相似度】")


class ClarificationKnowledge(ComponentBase, ABC):
    """
    澄清组件
    """
    component_name = "ClarificationKnowledge"
    component_title = "澄清知识查询"

    def reset(self, **kwargs):
        super().reset()
        mem = kwargs.get('memory', False)
        if not mem:
            self._param.history_qa_list = []
            self._param.history_words = []

    def get_memory_value(self, memory_config: dict = {}):
        value = ""
        if memory_config:
            name = memory_config.get("name", "")
            if "history_words" == name:
                query = ""
                for r, c in self._canvas.history[::-1]:
                    # 过滤掉assistant
                    if "user" == r:
                        query = f"{c}"
                        break
                query = query.strip()
                qa_list = self._param.history_qa_list
                words, approves = self.get_history_words(query, qa_list)
                value = words
            else:
                value = super().get_memory_value(memory_config)
        return value

    def _run(self, history, **kwargs):
        start = time.time()
        logging.info("开始查询澄清知识")
        query = self.get_input()  # 当前输入
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()

        kb_id = self._param.kb_id  # 历史问答澄清记录

        result = self.get_clarification_data(input_text=query)

        logging.info(f"查询澄清知识完成，耗时{round(time.time() - start, 2)}s")
        return ClarificationKnowledge.be_output(json.dumps(result, ensure_ascii=False))

    # 获取图谱链路澄清结果 words为澄清词数组
    def get_clarification_data(self, input_text: str = ""):
        from api.db.services.document_service import DocumentService
        from api.db import LLMType, StatusEnum

        result = {"type": "4", "data": {}, "msg": "未匹配到事项和澄清信息"}

        qa_list = self._param.history_qa_list  # 历史问答澄清记录

        user_input = ""
        query = self.get_input()  # 当前问题
        query = '\n'.join(query["content"]) if "content" in query else ""
        user_input = query.strip()

        self.append_log(f"澄清输入问题：{user_input}")
        words, approves = self.get_history_words(user_input, qa_list)  # 查询是否在澄清链路中
        if len(words) == 0 and len(approves) == 0:

            if not input_text:
                return result
            words, approves = self.get_history_words(input_text, qa_list)
        else:
            input_text = user_input
        # 如果直接在历史记录里找到事项
        if len(words) == 0 and len(approves) == 1:
            hit_vector = {"metadata": {"original_content": input_text}}
            result = self.get_approve_clarification_result(input_text=input_text,
                                                           hit_vector=hit_vector)
            return result

        if words and len(words) > 0:
            words.append(input_text)

        exist_words = TopicWordInfoService.get_by_kb_id(self._param.kb_id, input_text)
        exist_word_names = [x["word_name"] for x in exist_words]
        # 匹配到数据库词汇
        if exist_word_names and input_text in exist_word_names:
            words.append(input_text)
        words = list(OrderedDict.fromkeys(words))

        route = "link"
        service = ClarificationService()
        if len(words) > 0:
            route = "kg"

        doc_query = DocumentService.model.select().where(DocumentService.model.kb_id == self._param.kb_id,
                                                         DocumentService.model.parser_id == "c2_clarification",
                                                         DocumentService.model.status == StatusEnum.VALID.value)
        docs = list(doc_query.dicts())
        doc_ids = [x["id"] for x in docs]

        if route == "kg":
            param = ClarificationVO(words=words, approves=[], kb_id=self._param.kb_id, doc_ids=doc_ids)
            # 由图谱输出
            clarification_result = service.get_clarification_result(param)
            result = self.parse_result(clarification_result=clarification_result, result=result)
            seen = set()
            words = [x for x in param.words if not (x in seen or seen.add(x))]
            self.append_clarification_qa_record(input_text=input_text, words=words, result=result)
        else:
            # 查询向量库
            chunks, keywords = self.get_chunks(query=input_text)
            if chunks:
                count = 0
                best_chunk = chunks[0]
                best_chunk_words = best_chunk.split('->')
                best_chunk_keywords = [x for x in best_chunk_words if x in keywords]
                length = len(best_chunk_words)
                words.extend(best_chunk_words)
                for ck in chunks:
                    cks = ck.split('->')
                    has_kwd = False
                    if best_chunk_keywords:
                        has_kwd = all(x in cks for x in best_chunk_keywords)
                    if length >= len(cks) and has_kwd:
                        words.extend(cks)
                    elif length >= len(cks):
                        has_same = False
                        for i in range(len(cks)):
                            if cks[i] == best_chunk_words[i]:
                                has_same = True
                                continue
                            elif has_same:
                                words.append(cks[i])
                                break
                # words.extend(chunks[0].split('->'))
            param = ClarificationVO(words=words, approves=[], kb_id=self._param.kb_id, doc_ids=doc_ids)
            clarification_result = service.get_clarification_result(param)
            result = self.parse_result(clarification_result=clarification_result, result=result)
            seen = set()
            words = [x for x in param.words if not (x in seen or seen.add(x))]
            self.append_clarification_qa_record(input_text=input_text, words=words, result=result)

        return result

    # 获取事项结果
    def get_approve_clarification_result(self, input_text: str = "", hit_vector: dict = None):
        result = {"type": "4", "data": {}, "msg": "未匹配到事项和澄清信息"}
        if hit_vector:
            qa_list = self._param.history_qa_list  # 历史问答澄清记录
            metadata = hit_vector["metadata"]
            result = self.parse_result(hit_approve_vector=[metadata], result=result, qa_list=qa_list)
            self.append_clarification_qa_record(input_text=input_text, result=result)
        return result

    # 添加问答记录缓存
    # input_text 问题； words 澄清词数组 ； result 为澄清结果
    def append_clarification_qa_record(self, input_text: str = "", words: list = [], result: dict = {}):
        qa_list = self._param.history_qa_list
        output_words = result["data"]["words"] if "data" in result and "words" in result["data"] else []  # 澄清词数组
        output_topics = result["data"]["topics"] if "data" in result and "topics" in result[
            "data"] else []  # 当前节点数组

        # 如果有链路
        topics = result["data"]["topics"] if "topics" in result["data"] else []
        if topics:
            link_words = []
            for word in topics:
                link = word["link"] if "link" in word else ""
                link_words.extend(link.split("-"))
            link_words = [x for x in words if x in link_words]
            words = link_words

        record = {"question": input_text, "answer": {"input_words": words, "output_words": output_words,
                                                     "output_approves": self.get_output_approves(result),
                                                     "output_topics": output_topics}}
        self._param.history_qa_list.append(record)
        words, approves = self.get_history_words(input_text, qa_list)

    # 获取输出的知识
    def get_output_approves(self, clarification_result: dict = {}):
        output = []
        if "data" not in clarification_result:
            return output

        data = clarification_result["data"]
        if "approves" in data:
            output.extend(data["approves"])

        if "topics" in data:
            topics = clarification_result["data"]["topics"]
            if topics:
                word_ids = [data["id"] for data in topics if "id" in data]
                trs = TopicWordApproveRelationService.get_by_word_ids(word_ids=word_ids)
                approves = [{"id": x["approve_code"], "name": x["approve_name"], "type": "事项知识"} for x in trs]
                output.extend(approves)

        # 去重
        seen = set()
        return [x for x in output if not (x["id"] in seen or seen.add(x["id"]))]

    # 解析澄清结果
    def parse_result(self, clarification_result: ClarificationVO = None, hit_approve_vector: list = None,
                     qa_list: list = [],
                     result: dict = {}):
        max_approve = 3
        if clarification_result is not None:
            result_type = clarification_result.type
            result_words = clarification_result.words
            approves = clarification_result.approves
            topics = clarification_result.topics
            if result_type == "3":
                if len(approves) > 1:
                    result["msg"] = "事项列表"
                    result["type"] = "3"
                    result["data"] = {"approves": approves, "topics": topics}
                elif len(approves) == 1:
                    result["msg"] = "匹配到单一事项"
                    result["type"] = "1"
                    result["data"] = {"approves": approves, "topics": topics}
                else:
                    result["msg"] = "图谱澄清结果"
                    result["type"] = "2"
                    result["data"] = {"approves": approves, "topics": topics}

            elif result_type == "4":
                result["type"] = "4"
                result["data"] = {}
                result["msg"] = "未匹配到事项和澄清信息"

            else:
                vo = ClarificationResultVO()
                vo.words = clarification_result.word_infos
                vo.approves = clarification_result.approves
                vo.approve = clarification_result.approve
                vo.topics = clarification_result.topics
                vo.msg = clarification_result.msg
                vo.type = clarification_result.type
                result["type"] = "2"
                result["data"] = vo.model_dump()
                result["msg"] = "图谱澄清结果"

        if hit_approve_vector is not None:
            # 去重
            seen = set()
            hit_approve_vector = [x for x in hit_approve_vector if
                                  not (x['original_content'] in seen or seen.add(x['original_content']))]
            approves = []
            approve_codes = []
            # {"type": "事项知识", "id": str(data.id), "name": str(data.name), "name_ext": name_ext_list}
            if 1 < len(hit_approve_vector) <= max_approve:
                for hit_vector in hit_approve_vector:
                    approve_name = hit_vector['original_content']
                    logging.info(f"--从向量库选择匹配的事项名称：{approve_name}")
                    approve = TopicWordApproveRelationService.model.get_or_none(
                        TopicWordApproveRelationService.model.approve_name == approve_name)
                    if approve:
                        approves.append({"type": "事项知识", "id": approve.approve_code, "name": approve.approve_name})
                        approve_codes.append(approve.approve_code)
                result["type"] = "3"
                result["data"] = {"approves": approves}
                result["msg"] = "事项列表"
            else:
                hit_vector = hit_approve_vector[0]
                approve_name = hit_vector['original_content']
                approve = TopicWordApproveRelationService.model.get_or_none(
                    TopicWordApproveRelationService.model.approve_name == approve_name)
                approves.append({"type": "事项知识", "id": approve.approve_code, "name": approve.approve_name})
                approve_codes.append(approve.approve_code)
                result["type"] = "1"
                result["data"] = {"approves": approves}
                result["msg"] = "匹配到单一事项"
                logging.info(f"--从向量库选择匹配的事项名称：{approve_name}")

        if result["type"] == "1" and len(result["data"]["approves"]) > 0:
            approves = result["data"]["approves"]
            approve_codes = []
            for row in approves:
                approve_codes.append(row["id"])
            self.get_buttons_by_search_api(approves)  # 查询buttons
            parents = TopicWordInfoService.get_word_by_approve_codes(approve_codes=approve_codes,
                                                                     kb_id=self._param.kb_id)
            result_topics = [{"id": data["word_id"], "name": data["word_name"]} for data in parents]
            result_topics = self.parse_topics(topics=result_topics, qa_list=qa_list)
            result["data"]["topics"] = result_topics

        if "topics" in result["data"]:
            words = result["data"]["topics"]
            for word in words:
                link = TopicWordInfoService.get_word_link(word_id=word["id"])
                if link:
                    word["link"] = "-".join(link)
                else:
                    word["link"] = ""
        return result

    # 调用检索接口查询办事指南和立即办理按钮
    def get_buttons_by_search_api(self, approves: list = []):
        from api import settings
        from api.db.services.document_service import DocumentService
        from api.db.services.knowledgebase_service import KnowledgebaseService
        from api.db import LLMType, StatusEnum
        # http://172.24.1.106:31202/smart/search/v1/service/kg_search/qa/buttons
        button_url = f"{BASE_URL}/v1/service/kg_search/qa/buttons"
        header = generate_ablility_openness_request_headers()
        # for approve in approves:
        #     url = f"{BASE_URL}/v1/service/search/main/knowledge/byname?_title={approve['name']}&_index=table_index_vector"
        #     header = generate_ablility_openness_request_headers()
        #     response = requests.get(url, headers=header).json()
        #     unify_id = ""
        #     if response.__contains__('unify_id'):
        #         unify_id = response['unify_id']
        #     elif response.__contains__('unifyId'):
        #         unify_id = response['unifyId']
        #     else:
        #         unify_id = ''
        #     tmp_url = f"{button_url}?unify_id={unify_id}"
        #     response = requests.get(tmp_url, headers=header).json()
        #     try:
        #         approve["template_result"] = self.get_template_results(response)
        #     except Exception as e:
        #         approve["template_result"] = {}
        # return approves
        # 使用本地知识库
        unify_prompt = "帮我返回一下内容的中的unifyId内容，只用返回unifyId字符串"
        if not self._param.approve_kb_id:
            return approves
        else:
            chunks = []
            kb_id = self._param.approve_kb_id
            kbs = KnowledgebaseService.get_by_ids([kb_id])
            embedding_list = list(set([kb.embd_id for kb in kbs]))
            if len(embedding_list) != 1:
                return chunks
            embedding_model_name = embedding_list[0]
            embd_mdl = LLMBundle(self._canvas.get_tenant_id(), LLMType.EMBEDDING, embedding_model_name)
            tenant_id = kbs[0].tenant_id

            chat_mdl = LLMBundle(self._canvas.get_tenant_id(), LLMType.CHAT)
            for approve in approves:
                query = approve['name']
                # req = {"question": query, "sort": True,
                #        "topk": self._param.top_n if self._param.top_n > 0 else 5,
                #        "similarity": self._param.similarity_threshold}
                kbinfos = settings.retrievaler.retrieval(query, embd_mdl, [tenant_id], [kb_id],
                                                         1, 1,
                                                         self._param.similarity_threshold,
                                                         1 - 0.7,
                                                         aggs=False, rerank_mdl=None)
                # sres = settings.retrievaler.search(req, search.index_name(tenant_id),
                #                                    [kb_id], embd_mdl,
                #                                    highlight=False)
                chunk_content = ""
                kb_chunks = kbinfos["chunks"]
                for ck in kb_chunks:
                    chunk_content = ck.get("content_with_weight", "")
                    break

                if chunk_content:
                    ans = chat_mdl.chat(unify_prompt, [{"role": "user", "content": chunk_content}],
                                        {})
                    try:
                        approve["template_result"] = self.get_template_results(
                            [{"name": query, "type": "1", "url": f"?unify_id={ans}&matter_name={query}"}])
                    except Exception as e:
                        approve["template_result"] = {}
            return approves

    def get_template_results(self, content: list):
        from urllib.parse import parse_qs
        import json
        buttons = []
        matter_name = ""
        for row in content:
            button = {}
            button["name"] = row["name"]
            button["url_type"] = row["type"]
            button["url"] = "#"
            button["call_type"] = "get"
            url = row["url"]
            parts = url.split('?')
            params = {}
            if len(parts) > 1:
                query_params = parse_qs(parts[1])
                unify_id = query_params.get("unify_id", [""])[0]
                matter_name = query_params.get("matter_name", [""])[0]
                params["unify_id"] = unify_id
                params["matter_name"] = matter_name
            button["params"] = params
            buttons.append(button)
        res = {"data": {"buttons": buttons, "content": matter_name, "title": "为您推荐事项",
                        "note": "如需了解事项的具体办理地点及所需材料等相关信息，请点击导办生成办事指南。"},
               "template_name": "tp_event"}
        return res

    def parse_topics(self, topics: list = [], qa_list: list = []):
        is_hit = False
        topic_map = {x["name"]: x for x in topics}
        result_topics = topics
        for i in qa_list[::-1]:
            # 处理数据
            input_words = i["answer"]["input_words"]
            # 遍历点击的数据
            for word in input_words:
                if word in topic_map:
                    result_topics = [topic_map[word]]
                    # 命中
                    is_hit = True
                    break

            # 命中跳出循环
            if is_hit:
                break
        return result_topics

    def get_chunks(self, query):
        from api import settings
        from api.db.services.document_service import DocumentService
        from api.db.services.knowledgebase_service import KnowledgebaseService
        from api.db import LLMType, StatusEnum
        chunks = []
        kb_id = self._param.kb_id
        doc_query = DocumentService.model.select().where(DocumentService.model.kb_id == kb_id,
                                                         DocumentService.model.parser_id == "c2_clarification",
                                                         DocumentService.model.status == StatusEnum.VALID.value)
        docs = list(doc_query.dicts())
        if not docs:
            return chunks

        doc_ids = [x["id"] for x in docs]
        kbs = KnowledgebaseService.get_by_ids([kb_id])
        embedding_list = list(set([kb.embd_id for kb in kbs]))
        if len(embedding_list) != 1:
            return chunks
        embedding_model_name = embedding_list[0]
        embd_mdl = LLMBundle(self._canvas.get_tenant_id(), LLMType.EMBEDDING, embedding_model_name)
        tenant_id = kbs[0].tenant_id
        req = {"question": query, "doc_ids": doc_ids, "sort": True,
               "topk": 1,
               "similarity": self._param.similarity_threshold}
        kbinfos = settings.retrievaler.retrieval(query, embd_mdl, [tenant_id], [kb_id],
                                                 1, self._param.top_n,
                                                 self._param.similarity_threshold,
                                                 1 - 0.7,
                                                 aggs=False, rerank_mdl=None,
                                                 doc_ids=doc_ids)
        kb_chunks = kbinfos["chunks"]
        keywords = kbinfos["keywords"]
        for ck in kb_chunks:
            chunk_content = ck.get("content_with_weight", "")
            chunks.append(chunk_content)

        return chunks, keywords

    # 获取历史澄清词
    def get_history_words(self, input_text: str = "", qa_list: list = []):
        words = []
        approves = []
        is_hit = False
        for i in qa_list[::-1]:
            # 判断是否在进行澄清 - 结果类型为tag，且为举例澄清 list[dict]
            # 处理数据
            input_words = i["answer"]["input_words"]
            output_words = i["answer"]["output_words"]
            output_approves = i["answer"]["output_approves"]
            # 遍历点击的数据
            for word in output_words:
                output_word_name = word["name"] if "name" in word else word
                if input_text == output_word_name:
                    # 命中
                    is_hit = True
                    # 澄清词，需要从之前轮次获得。 把之前澄清以及当前词汇作为未来一轮澄清词进行存储。
                    words = copy.deepcopy(input_words)
                    approves = copy.deepcopy(output_approves)

                    # 如果澄清词，也在之前词汇中，则只取当前词汇进行澄清，否则把之前澄清词加上
                    if input_text in input_words:
                        words = [input_text]
                    else:
                        words.append(input_text)
                    break

            for word in output_approves:
                word_name = word["name"] if "name" in word else word
                if input_text == word_name:
                    # 命中
                    is_hit = True
                    # 澄清词，需要从之前轮次获得。 把之前澄清以及当前词汇作为未来一轮澄清词进行存储。
                    approves = [word]
                    break

            # 命中跳出循环
            if is_hit:
                break
        return words, approves

    def debug(self, **kwargs):
        return self._run([], **kwargs)
