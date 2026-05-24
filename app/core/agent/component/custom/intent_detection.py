# Author: zwx
# Date: 2025/4/3 16:55
# Description: 意图识别组件（用户输入 -> 解析用户意图 -> 选择动作 -> 用户确认 ->执行动作 -> 最终结果）
import copy

from agent.component import GenerateParam, Generate
from agent.model.component_arg import ComponentResetArg
from agent.prompt_template import intent_detection_system_prompt_template
import json


class IntentDetectionParam(GenerateParam):

    def __init__(self):
        super().__init__()
        self.temperature = 0.5
        self.prompt = intent_detection_system_prompt_template
        self.deep_thinking = True
        self.configs = self.get_config()  # 配置 {"name":"意图名称" , "description":"意图描述" , "actions" : [{"type":"agent/mcp/knowledgebase/chat","data":{}}]}
        self.messages = []  # 意图识别消息记录（用于记录最终返回前多轮对话）
        self.conversation_id = ""
        self.dialog_id = ""
        self.message_id = ""
        self.file_path = ""
        self.doc_ids = []
        self.action_dsl_map = {}  # 操作智能体dsl
        self.do_action_ids = []  # 手动执行操作

    def check(self):
        super().check()
        self.check_empty(self.configs, "意图配置为空")

    def get_config(self):
        configs = []
        configs.append(
            {"id": "1", "index": 0, "name": "通用聊天", "description": "通用聊天助手",
             "actions": [{"id": "1", "type": "chat", "data": {}}]})
        # configs.append(
        #     {"index": 1, "name": "通用知识查询", "description": "一般日常生活中的问题",
        #      "actions": [
        #          {"id": "1", "type": "knowledgebase", "data": {"kb_ids": ["16bf91200f9a11f0825b0242ac1d0006"]}}]})
        # configs.append(
        #     {"index": 2, "name": "政务知识咨询", "description": "政务领域的知识",
        #      "actions": [{"id": "1", "type": "agent", "data": {"id": "bc55bc2a4be211f0a8ad66318a4df0b1"}}]})
        # configs.append({"index": 3, "name": "工具调用", "description": "调用MCP工具",
        #                 "actions": [
        #                     {"id": "1", "type": "mcp", "data": {"id": "256b4c483d2e11f090c44a948448a3d0", "tools": [
        #                         {"name": "getListByPage_27", "title": "分页查询信息项",
        #                          "server_id": "256b4c483d2e11f090c44a948448a3d0", "description": "分页查询信息项",
        #                          "inputSchema": {
        #                              "properties": {
        #                                  "auditState": {
        #                                      "description": "审核状态  1-待审核 2-审核通过 3-审核不通过",
        #                                      "in": "query",
        #                                      "type": "string"
        #                                  },
        #                                  "cascade": {
        #                                      "default": True,
        #                                      "description": "是否级联",
        #                                      "in": "query",
        #                                      "type": "boolean"
        #                                  },
        #                                  "content": {
        #                                      "description": "名称或编码",
        #                                      "in": "query",
        #                                      "type": "string"
        #                                  },
        #                                  "formId": {
        #                                      "description": "表单id",
        #                                      "in": "query",
        #                                      "type": "string"
        #                                  },
        #                                  "infogroupCode": {
        #                                      "description": "信息集编码",
        #                                      "in": "query",
        #                                      "type": "string"
        #                                  },
        #                                  "page": {
        #                                      "description": "页号",
        #                                      "in": "query",
        #                                      "type": "integer"
        #                                  },
        #                                  "rows": {
        #                                      "description": "页大小",
        #                                      "in": "query",
        #                                      "type": "integer"
        #                                  },
        #                                  "state": {
        #                                      "description": "状态  1-可用 2-不可用",
        #                                      "in": "query",
        #                                      "type": "string"
        #                                  }
        #                              },
        #                              "required": [],
        #                              "type": "object"
        #                          }}]}}]})
        return configs


class IntentDetection(Generate):
    component_name = "IntentDetection"

    def reset(self, **kwargs):
        super().reset()
        mem = False if ComponentResetArg.MEMORY.value not in kwargs else kwargs[ComponentResetArg.MEMORY.value]
        if not mem:
            self._param.messages = []
            self._param.action_dsl_map = {}

    def get_memory_value(self, memory_config: dict = {}):
        from agent.component import component_class
        from agent.agent import Agent
        value = ""
        if memory_config:
            name = memory_config.get("name", "")
            name_list = name.split("@")
            # task_id action_id action_data_id sub_agent_component_name param_name 子任务
            if len(name_list) > 1:
                config_id = name_list[0]
                action_id = name_list[1]
                data_id = name_list[2] if len(name_list) > 2 else ""
                sub_agent_component_id = name_list[3] if len(name_list) > 3 else ""
                sub_agent_component_param_name = name_list[4] if len(name_list) > 4 else ""

                action = self.get_config_action(config_id, action_id)
                if action is None:
                    return value

                type = action["type"]
                # 获取子agent组件属性值
                if type == "agent" and sub_agent_component_id and sub_agent_component_param_name:
                    agent_id = data_id  # 绑定的智能体id
                    sub_dsl = self._param.action_dsl_map[agent_id] if agent_id in self._param.action_dsl_map else {}
                    sub_dsl = copy.deepcopy(sub_dsl)
                    sub_agent_component_name = sub_agent_component_id.split(":")[0]
                    if sub_dsl:
                        sub_component = sub_dsl['components'][sub_agent_component_id]
                        param = component_class(sub_agent_component_name + "Param")()
                        param.update(sub_component["obj"]["params"])
                        cpn = component_class(sub_agent_component_name)(
                            Agent(json.dumps(sub_dsl, ensure_ascii=False)),
                            sub_agent_component_id, param)
                        memory_config_ = copy.deepcopy(memory_config)
                        memory_config_["name"] = sub_agent_component_param_name
                        cpn._canvas.history.append(self._canvas.history[-1])
                        value = cpn.get_memory_value(memory_config_)  # 子agent组件属性值
                else:
                    value = data_id
            else:
                value = super().get_memory_value(memory_config)
        return value

    def get_config_action(self, config_id, action_id):
        for config in self._param.configs:
            if config["id"] == config_id:
                actions = config["actions"] if "actions" in config else []
                for action in actions:
                    if action["id"] == action_id:
                        return action
        return None

    def _run(self, history, **kwargs):
        query = self.get_input()  # 当前问题
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()
        from api.service.intent_detection_run_service import IntentDetectionRunService
        from api.service.intent_detection_run_service_v2 import IntentDetectionRunServiceV2 #简化了提示词

        return IntentDetectionRunServiceV2().run_with_agent_component(component=self, **kwargs)
