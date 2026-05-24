# Author: zwx
# Date: 2025/10/22 16:55
# Description: 意图识别组件V2版本。 该版本只做意图分类
import json
import time
from functools import partial

from agent.component import GenerateParam, Generate
from agent.prompt_template import intent_detection_v2_system_prompt_template
from api.db import LLMType
from api.db.services.llm_service import LLMBundle
from api.utils.llm_util import format_prompt_template, get_llm_content, parse_llm_tags
from rag.prompts import message_fit_in


class IntentDetectionV2Param(GenerateParam):

    def __init__(self):
        super().__init__()
        self.temperature = 0.5
        self.prompt = intent_detection_v2_system_prompt_template
        self.deep_thinking = True
        self.configs = self.get_config()  # 配置 {"name":"意图名称" , "description":"意图描述" , "actions" : ["下游节点数组"]}

    def check(self):
        super().check()
        self.check_empty(self.configs, "意图配置为空")

    def get_config(self):
        configs = []
        # configs.append(
        #     {"index": 1, "name": "通用知识查询", "description": "一般日常生活中的问题",
        #      "actions": [
        #          {"id": "1", "type": "knowledgebase", "data": {"kb_ids": ["16bf91200f9a11f0825b0242ac1d0006"]}}]})
        # configs.append(
        #     {"index": 1, "name": "政务服务咨询与定位",
        #      "description": "帮助用户定位需要办理的服务，并解答用户输入的与政务服务事项相关的属性咨询。用户咨询以下内容时，给出相应回答。 - 行政审批：证照办理/资质申请流程，如“我要开XX店”、“我要申请XX证明” - 民生服务：社保/医保/公积金政策 - 企业服务：工商注册/税务申报指南 - 政策回答：事项相关政策问题解答 - 政务服务相关办事指南或者属性咨询问题 - 便民服务相关办事指南或者属性咨询问题",
        #      "actions": ["Generate:EveryHoopsNotice"]})
        # configs.append(
        #     {"index": 2, "name": "非政务服务咨询",
        #      "description": "非政务服务咨询助手。（1）用户咨询的是湖南省辖区外的政务服务事务，即咨询非湖南省内的政务服务问题时，进入该分类，如咨询上海市、四川省等地的相关政务服务。具体示例如下：广州医保政策、上海租房提取公积金所需材料、湖南人，身份证在广州丢了、在杭州办理身份证换领需要带什么材料等。（2）●非政务服务的商业/私人问题（示例：\"哪家餐厅好吃\"）●非政务服务范畴的其他问题，如医疗、教育、游戏、金融、电商、娱乐、传媒等领域问题（示例：\"企业如何申请科创板上市？\"）●非政务服务范围的特殊情形（法律诉讼、举报投诉、纠纷调解、案件举报、信访诉求等）●紧急事件类（人身安全、群体冲突、突发公共事件），如“在高铁站身份证丢了，应该怎么上车”。",
        #      "actions": ["Generate:MajorRulesGive"]})
        return configs


class IntentDetectionV2(Generate):
    component_name = "IntentDetectionV2"

    def reset(self, **kwargs):
        super().reset()

    def _run(self, history, **kwargs):
        query = self.get_input()  # 当前问题
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()

        chat_mdl = LLMBundle(self._canvas.get_tenant_id(), LLMType.CHAT, self._param.llm_id)  # 使用默认模型

        system_prompt = self.process_prompt(**kwargs)
        system_prompt = format_prompt_template(system_prompt, {
            "configs": json.dumps(self._param.configs, indent=4, ensure_ascii=False)})

        messages = self.get_messages(self._param.message_history_window_size)  # LLM 消息记录
        if messages and messages[0]['role'] == 'assistant':
            messages.pop(0)
        _, messages = message_fit_in([{"role": "system", "content": system_prompt}, *messages],
                                     int(chat_mdl.max_length * 0.97))
        messages.append({"role": "user", "content": query})
        if self._param.only_use_user_message:  # 只使用user输入
            messages = [x for x in messages if x["role"] == "user" or x["role"] == "system"]

        downstreams = self._canvas.get_component(self._id)["downstream"]
        if kwargs.get("stream") and len(downstreams) == 1 and self._canvas.get_component(downstreams[0])[
            "obj"].component_name.lower() == "answer":
            return partial(self.stream_output, chat_mdl, messages)

        # 如果下游有结果输出节点
        component_answer_downstream = [x for x in downstreams if "ComponentAnswer" in x]
        if kwargs.get("stream") and len(component_answer_downstream) > 0:
            return partial(self.stream_output, chat_mdl, messages)

        ans = chat_mdl.chat(messages[0]["content"], messages[1:], self._param.gen_conf())
        self.append_log(f"意图识别返回：{ans}")

        to_component_ids = []
        content = get_llm_content(ans)
        try:
            content_dict = json.loads(content) if content else {}
            to_component_ids = content_dict.get("actions", [])
        except Exception as e:
            raise Exception("意图识别异常:" + str(content))

        to_component_ids = [x for x in to_component_ids if "ComponentAnswer" not in x]
        self.append_log(f"下游节点:{to_component_ids}")
        self._canvas.set_component_infor(self._id, {"prompt": messages[0]["content"], "messages": messages[1:],
                                                    "conf": self._param.gen_conf()})
        messages.append({"role": "assistant", "content": ans})
        self._param.messages = messages
        return IntentDetectionV2.be_output(json.dumps(to_component_ids, ensure_ascii=False))

    def stream_output(self, chat_mdl, messages):
        self.set_start_time(time.time())
        answer = ""
        think_content = ""
        for ans in chat_mdl.chat_streamly(messages[0]["content"], messages[1:], self._param.gen_conf()):
            # 这里打印think
            thought_content = parse_llm_tags(ans, "think") or parse_llm_tags(ans, "thought")
            if thought_content:
                res = {"content": f"<think>{thought_content}</think>", "reference": {}}
                think_content = f"<think>{thought_content}</think>"
                yield res

            answer = ans

        to_component_ids = []
        content = get_llm_content(answer)
        try:
            content_dict = json.loads(content) if content else {}
            to_component_ids = content_dict.get("actions", [])
        except Exception as e:
            raise Exception("意图识别异常:" + str(content))

        # 过滤掉ComponentAnswer
        to_component_ids = [x for x in to_component_ids if "ComponentAnswer" not in x]
        self.append_log(f"下游节点:{to_component_ids}")
        self._canvas.set_component_infor(self._id, {"prompt": messages[0]["content"], "messages": messages[1:],
                                                    "conf": self._param.gen_conf()})
        self.set_end_time_and_append_log(time.time())  # 添加结束时间
        messages.append({"role": "assistant", "content": answer})
        self._param.messages = messages
        self.set_output(IntentDetectionV2.be_output(json.dumps(to_component_ids, ensure_ascii=False)))
