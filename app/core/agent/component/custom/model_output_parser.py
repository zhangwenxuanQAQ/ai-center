# Author: zwx
# Date: 2025/4/3 16:55
# Description: model_output_parser 模型输出解析
import logging
import re
import time
from abc import ABC

from .. import GenerateParam
from ..base import ComponentBase
import json
from api.db.db_models import ApproveInfo
from conf.es_search_settings import BASE_URL
import requests
from agent.util.es_util import generate_ablility_openness_request_headers


class ModelOutputParserParam(GenerateParam):

    def __init__(self):
        super().__init__()

    def check(self):
        pass


class ModelOutputParser(ComponentBase, ABC):
    component_name = "ModelOutputParser"
    component_title = "模型输出解析"

    @staticmethod
    def extract_and_parse_json(text, task):
        # 第一步：提取 <answer></answer> 之前的内容
        if task == '问答':
            return text
        answer_match = re.search(r'<answer>(.*?)</answer>', text, re.DOTALL)
        if answer_match:
            answer_content = answer_match.group(1)  # 获取匹配的内容
        else:
            answer_content = text

        # 第二步：提取 '''json{xxx}''' 格式的 JSON 内容
        json_matches = re.findall(r"```json(.*?)```", answer_content.replace('\n', ''), re.DOTALL)

        # 解析 JSON 数据
        json_objects = []
        if json_matches:
            for match in json_matches:
                try:
                    json_objects.append(json.loads(match.replace('\\', '')))  # 解析 JSON
                except json.JSONDecodeError as e:
                    print(e.args)
        else:
            try:
                answer = json.loads(answer_content)
                json_objects = [answer]
            except Exception as e:
                json_objects = []

        return json_objects[0] if json_objects else [{'index': -1, 'reason': '对事项选择进行召回时出错'}]


    def _run(self, history, **kwargs):
        start = time.time()
        approve_names = []
        header = {}

        #TODO
        parser_type = ''
        for item in self.get_input_elements():
            if item['key'] in ['事项选择', '问题改写', '问答']:
                if parser_type:
                    raise "包含多个任务类型,请检查参数列表"
                else:
                    parser_type = item['key']
            if item['key'] == '事项选择':
                try:
                    parent = self.get_upstream()
                    if len(parent) > 1:
                        raise "模型输出结果解析仅能存在一个上游节点！"
                    approve_list = self._canvas.get_component(self.get_upstream()[0])['obj'].get_stream_input().values.tolist()[0][0]
                    index1 = approve_list.index('\n事项列表: ')
                    index2 = approve_list.index('用户问题: ')
                    approve_list = approve_list[index1+6:index2]
                    approve_list = json.loads(approve_list)
                except Exception as e:
                    print(e.args)
                    raise Exception(str(e))
            if item['key'] == '问答':
                try:
                    parent = self.get_upstream()
                    if len(parent) > 1:
                        raise "模型输出结果解析仅能存在一个上游节点！"
                    approve_select_res = (self._canvas.get_component(self._canvas.get_component(self.get_upstream()[0])
                                                                    ['obj'].get_upstream()[0])['obj'].
                                          get_stream_input().values.tolist())[0][0]
                    approve_select_res = json.loads(approve_select_res)['model_out']
                    approve_list = self._canvas.get_component(self.get_upstream()[0])['obj'].get_stream_input().values.tolist()[0]
                    approve_ids = []
                    if len(approve_select_res) == 1:
                        if approve_select_res[0]['index'] == -1:
                            pass
                        else:
                            for approves in approve_list:
                                for approve in json.loads(approves):
                                    approve_names.append(approve['事项名称'])
                                    url = f"{BASE_URL}/v1/service/search/main/knowledge/byname?_title={approve['事项名称']}&_index=table_index_vector"
                                    header = generate_ablility_openness_request_headers()
                                    response = requests.get(url, headers=header).json()
                                    if response.__contains__('unify_id'):
                                        unify_id = response['unify_id']
                                    elif response.__contains__('unifyId'):
                                        unify_id = response['unifyId']
                                    else:
                                        unify_id = ''
                                    approve_ids.append(unify_id)
                    else:
                        for approves in approve_list:
                            for approve in json.loads(approves):
                                approve_names.append(approve['事项名称'])
                                url = f"{BASE_URL}/v1/service/search/main/knowledge/byname?_title={approve['事项名称']}&_index=table_index_vector"
                                header = generate_ablility_openness_request_headers()
                                response = requests.get(url, headers=header).json()
                                if response.__contains__('unify_id'):
                                    unify_id = response['unify_id']
                                elif response.__contains__('unifyId'):
                                    unify_id = response['unifyId']
                                else:
                                    unify_id = ''
                                approve_ids.append(unify_id)
                except Exception as e:
                    print(e.args)
                    raise e.args
        if parser_type == '问答':
            model_output = self.get_stream_input().values.tolist()[0][0]  # 模型输出结果
        else:
            model_output = self.get_stream_input().values.tolist()[0][0].replace('\n', '').replace(' ', '')  # 模型输出结果
        res = self.extract_and_parse_json(model_output, parser_type)
        if parser_type == '问答':
            res = {'model_output': res, 'approve_names': approve_names, 'approve_ids': approve_ids}
        if parser_type == '事项选择':
            approve_names = []
            approve_ids = []
            result = {'model_out': res}
            for item in res:
                try:
                    approve_index = item['index']
                except Exception as e:
                    logging.error(f"事项选择解析出现错误：{e.args}")
                    approve_index = -1
                if approve_index != -1:
                    approve_name = approve_list[approve_index]['事项名称']
                    if approve_name not in approve_names:
                        approve_names.append(approve_name)
                        url = f"{BASE_URL}/v1/service/search/main/knowledge/byname?_title={approve_name}&_index=table_index_vector"
                        header = generate_ablility_openness_request_headers()
                        response = requests.get(url, headers=header).json()
                        if response.__contains__('unify_id'):
                            unify_id = response['unify_id']
                        elif response.__contains__('unifyId'):
                            unify_id = response['unifyId']
                        else:
                            unify_id = ''
                        approve_ids.append(unify_id)
            result['approve_name'] = approve_names
            result['approve_ids'] = approve_ids

            return ModelOutputParser.be_output(json.dumps(result, ensure_ascii=False))

        # if self._id == "ModelOutputParser:NewBottlesGrow":
        #     res = {
        #         "valid question": {
        #             "幼儿园升小学是否符合入学条件": "幼儿园升小学,入学条件"
        #         },
        #         "rewrite question": {
        #             "幼儿园升小学需要办理哪些手续": "幼儿园升小学,入学手续",
        #             "幼儿园升小学手续能否合并办理": "幼儿园升小学,合并办理",
        #             "家长工作忙无法办理小学入学手续怎么办": "小学入学手续,家长工作忙"
        #         }
        #     }

        return ModelOutputParser.be_output(json.dumps(res, ensure_ascii=False))
