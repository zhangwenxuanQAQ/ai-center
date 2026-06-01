# Author: zwx
# Date: 2025/4/3 16:55
# Description: 任务分发组件（选择agent,mcp server或者默认聊天执行）
import asyncio
import copy
import json
import logging
import queue
import re
import threading
import time
from abc import ABC

from agent.agent import Agent
from .. import GenerateParam, Generate, GenerateParamFrontEndField
from api.utils.llm_util import format_prompt_template
from api.db.services.agent_service import AgentService

from api.db.services.dialog_service import DialogService, chat
from api.db.services.mcp_service import MCPService
from api.db.services.user_service import UserTenantService
from api.model.agent_output import AgentOutput, AgentDataOutput
from api.model.component_output import MessageType, ComponentStatus
from api.model.mcp_output import MCPOutput, MCPStatus
from api.utils.mcp_utils import mcp_server_list_tools
from app.core.llm_model.utils.model_caller import ModelCaller


class IntentionRecognitionParamFrontEndField(GenerateParamFrontEndField):
    """
    任务分发组件参数前端控件
    """
    pass


class IntentionRecognitionParam(GenerateParam):

    def __init__(self):
        super().__init__()
        self.temperature = 0.1
        self.prompt = self.init_template()
        self.agent_ids = []  # 智能体id列表
        self.mcp_server_ids = []  # mcp服务id列表
        self.conversation_id = ""
        self.dialog_id = ""
        self.message_id = ""
        self.doc_ids = []
        self.file_path = ""
        self.agent_dsl_map = {}

    def check(self):
        super().check()
        self.check_loop()

    def check_loop(self):
        parent_agent_ids = []
        self.recur_check_loop(self.agent_ids, parent_agent_ids)

    def recur_check_loop(self, agent_ids, parent_agent_ids):
        loop = False
        if not agent_ids:
            # 查询有权限的agent
            users = UserTenantService.get_users_by_tenant_ids(self.user_id)
            user_ids = [x["id"] for x in users]
            agents = AgentService.get_by_list(user_ids=user_ids, current_user_id=self.user_id)
        else:
            agents = AgentService.get_by_ids(ids=agent_ids)

        parent_agent_ids.extend([x["id"] for x in agents])

        # 绑定的agent
        for agent in agents:
            if loop:
                break
            dsl = agent["dsl"]
            for c in dsl["components"]:
                cpn = dsl["components"][c]["obj"]
                if "agent_ids" in cpn["params"] and cpn["params"]["agent_ids"]:
                    intersection = [x for x in cpn["params"]["agent_ids"] if x in parent_agent_ids]
                    if intersection:
                        loop = True
                        break
                    parent_agent_ids.extend(cpn["params"]["agent_ids"])
                    self.recur_check_loop(cpn["params"]["agent_ids"], parent_agent_ids)
        if loop:
            raise ValueError(f"智能体存在循环依赖")

    def extract_and_parse_json(self, text, task=''):
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
        for match in json_matches:
            try:
                json_objects.append(json.loads(match.replace('\\', '').replace("'", '"')))  # 解析 JSON
            except json.JSONDecodeError as e:
                print(e.args)

        return json_objects[0] if json_objects else []

    def init_template(self):
        """ agent、tool选择prompt模板 """
        example = [[
            {
                "type": "agent",
                "agent_name": "agent名称",
                "agent_id": "agent ID",
                "arguments": {"content": "用户问题"}
            },
            {
                "type": "tool",
                "tool_name": "tool唯一名称",
                "tool_title": "tool标题",
                "server_id": "xxxx",
                "arguments": {"param1": "", "param2": "", "param3": "", "param4": "", "param5": ""}
            }],
            [
                {
                    "type": "agent",
                    "agent_name": "agent名称",
                    "agent_id": "agent ID",
                    "arguments": {"content": "分析后的用户问题"}
                }
            ]
        ]
        prompt = ('- 你是系统中的任务分发者\n'
                  '你需要分析用户问题,从智能体(agent)以及工具(tool)列表中，选择合适的智能体与工具用来后续执行，并将用户问题中可能存在的参数值提取出来\n')
        prompt += '- 不能随变选择,一定要与用户问题有大概率关系才选择\n'
        prompt += '- 如果提取不出参数则使用参数默认值\n\n'
        prompt += "用户问题:{{query}}\n"
        prompt += f"【agent列表】：\n"
        prompt += "{{agents}}\n\n"

        prompt += "【tool列表】:\n"
        prompt += "{{tools}}\n\n"

        prompt += (f"- 输出格式示例:\n"
                   f"```json{example}```\n")
        prompt += (f"- 输出为数组，数组的每一项也是数组。 可以并行执行的agent或tool放到同一个子数组内\n")
        prompt += (f"- 选择的agent放到type为agent的输出结果中。选择的tool放到type为tool的输出结果中\n")
        prompt += (f"- 选择尽可能少而准确的agent或tool,如果不符合用户问题，请不要选择\n\n")
        prompt += "\n- 在<think> </think> 标签中展示你的思考过程，并在 <answer> </answer> 标签中参照示例返回最终答案\n"
        return prompt

    def complete_prompt(self, query="", agent_list=[], tool_list=[]):
        agents_input = ""
        for agent in agent_list:
            agents_input += (f"agent名称: {agent['title']}\n"
                             f"agent介绍: {agent['description']}\n"
                             f"agent ID: {agent['id']}\n")
            agents_input += ('参数列表:[{"param_name": "content", "param_type": "string", '
                             '"description": "该字段为用户输入，若选择该agent，则将整段用户输入填入content参数"}]\n')
        tools_input = ""
        for tool in tool_list:
            tools_input += (f"tool唯一名称: {tool['name']}\n"
                            f"tool标题: {tool['annotations']['title']}\n"
                            f"tool介绍: {tool['description']}\n"
                            f"server_id: {tool['annotations']['server_id']}\n"
                            f"参数列表: {tool['inputSchema']['properties']}\n")

        query_input = {"query": query, "agents": agents_input, "tools": tools_input}
        prompt = format_prompt_template(self.prompt, query_input)
        return prompt


class IntentionRecognition(Generate, ABC):
    component_name = "IntentionRecognition"
    component_title = "任务分发 (最开始版本，已弃用)"

    def reset(self,**kwargs):
        super().reset()

    def _run(self, history, **kwargs):
        query = self.get_input()  # 当前问题
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()

        #### prompt处理 ####
        # 判断提示词中是否有依赖其他组件变量
        prompt = self.process_prompt(**kwargs)
        #### prompt处理结束 ####

        # 查询agent ， mcp服务，mcp服务工具{id:[工具列表]}
        agents, agent_map, mcp_severs, mcp_server_tools = self.get_agents_and_mcps()

        system_prompt = "你是一个问题分析专家"  # system
        tool_list = []
        for key in mcp_server_tools:
            for tool in mcp_server_tools[key]:
                tool_list.append(tool)
        chat_input = self._param.complete_prompt(query, agents, tool_list)

        chat_mdl = ModelCaller.get_chat_model(self._param.llm_id)
        ans = chat_mdl.chat(system_prompt, [{"role": "user", "content": chat_input}],
                            self._param.gen_conf())
        res = self._param.extract_and_parse_json(ans)
        logging.info(f"模型返回结果：{ans}")
        self.append_log(f"模型返回结果：{ans}")
        chosen = json.dumps(res, indent=4, ensure_ascii=False)

        self.append_log(f"智能体或mcp工具：{chosen}")
        return IntentionRecognition.be_output(chosen)

    def run_tasks(self, chosen):
        """
        执行子任务
        每个子任务结果通过队列yield
        :param chosen:
        :return:
        """
        from api.service.agent_run_service import AgentRunService
        from api.service.mcp_run_service import MCPRunService

        final_output_map = {}

        def output_convert_to_agent_output(self, output) -> AgentOutput | None:
            """
            结果统一转化为AgentOutput
            :param output:
            :return:
            """
            final_output = None
            # MCP工具输出
            if isinstance(output, MCPOutput):
                agent_output = AgentOutput(code=output.code, message=output.message,
                                           conversation_id=output.conversation_id,
                                           agent_id=output.server_id,
                                           agent_name=f"MCP工具调用-{output.tool_title}" if output.tool_title else "",
                                           data=AgentDataOutput(component_output=output.data,
                                                                id=self._param.message_id))
                final_output = agent_output

            # Agent流程输出
            if isinstance(output, str):
                index = output.find("data:")
                if index != -1:
                    sub_ans = json.loads(output[index + 5:].strip())
                    try:
                        sub_ans = AgentOutput(**sub_ans)
                        final_output = sub_ans
                    except Exception as e:
                        # 保存子任务agent dsl
                        if isinstance(sub_ans, dict) and "dsl" in sub_ans and "agent_id" in sub_ans:
                            self._param.agent_dsl_map[sub_ans["agent_id"]] = sub_ans["dsl"]
                        return None

            # 普通聊天输出
            if isinstance(output, dict):
                try:
                    agent_output = AgentOutput(code=0, message="", conversation_id=self._param.conversation_id,
                                               agent_id=self._param.conversation_id, agent_name="知识检索",
                                               data=AgentDataOutput(answer=output.get("answer", ""), component_name="知识检索",
                                                                    reference=output.get("reference", {}),
                                                                    message_type=MessageType.TEXT.value,
                                                                    stream=True,
                                                                    status=ComponentStatus.FINISHED.value,
                                                                    id=self._param.message_id))
                    final_output = agent_output
                except Exception as e:
                    return None
            return final_output

        # 任务生成器执行
        def generator_runner(self, gen_func, func_params, output_queue, type):
            # 如果是普通聊天回答则添加一个agent消息
            if type == "chat":
                agent_out_put = AgentOutput(code=0, message="", conversation_id=self._param.conversation_id,
                                            agent_id=self._param.conversation_id, agent_name="知识检索",
                                            data=AgentDataOutput(answer="知识检索", component_name="知识检索",
                                                                 reference={"chunks": [], "doc_aggs": []},
                                                                 message_type=MessageType.PROGRESS.value,
                                                                 start_time=time.time(),id=self._param.message_id))
                output_queue.put(agent_out_put)

            for value in gen_func(**func_params):
                output = output_convert_to_agent_output(self, value)
                if not output or not output.data.component_name:  # 如果没有组件名称则跳过 （mcp调用逻辑会出现step_name为空的情况）
                    continue

                final_output_map[output.agent_name] = {}  # {"上游节点id":"答案"}
                if output.data.status == MCPStatus.SUCCESS.value:
                    final_output_map[output.agent_name]["answer"] = output.data.answer

                if output.data.component_name == "Answer":
                    final_output_map[output.agent_name][output.data.upstream_id] = output.data.answer

                if output.data.component_name == "知识检索":
                    final_output_map[output.agent_name]["answer"] = output.data.answer

                output_queue.put(output)
            output_queue.put(None)  # 结束信号

        query = self.get_input()  # 当前问题
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()
        tenant_id = self._canvas.get_tenant_id()
        content = chosen if chosen else "[]"
        task_list = json.loads(content)
        # 如果没找到则用普通聊天
        if len(task_list) == 0 and self._param.dialog_id:
            task_list.append([{"type": "chat", "arguments": {}}])

        final_output_list = []  # 最终回答列表

        msg = self._canvas.get_history(self._param.message_history_window_size)
        if msg and msg[0]['role'] == 'assistant':
            msg.pop(0)
        if len(msg) < 1:
            msg.append({'role': 'user', 'content': query})

        for tasks in task_list:
            outputs = queue.Queue()  # 输出结果队列
            parallel_tasks = tasks
            async_tasks = []
            for task in parallel_tasks:
                type = task["type"]
                arguments = task["arguments"]
                if type == "agent" and "agent_id" in task:
                    query_content = arguments["content"] if "content" in arguments else query
                    if not query_content:
                        continue
                    agent_id = task["agent_id"]
                    e, agent = AgentService.get_by_id(agent_id)
                    agent_obj = Agent(json.dumps(agent.dsl, ensure_ascii=False), tenant_id)
                    agent_obj.reset()
                    agent_obj.history = self._canvas.history
                    dsl = json.loads(str(agent_obj))
                    t = threading.Thread(target=generator_runner,
                                         args=(self, AgentRunService().sse,
                                               {"agent_id": agent_id, "agent_name": task["agent_name"],
                                                "message": query_content,
                                                "conversation_id": self._param.conversation_id,
                                                "message_id": self._param.message_id,
                                                "tenant_id": tenant_id, "file_path": self._param.file_path,
                                                "dsl": dsl}, outputs, type))
                    async_tasks.append(t)

                if type == "tool" and "tool_name" in task:
                    server_id = task["server_id"]
                    tool_name = task["tool_name"]
                    t = threading.Thread(target=generator_runner,
                                         args=(self, MCPRunService(llm_id=self._param.llm_id).sse,
                                               {"mcp_server_ids": [server_id], "tool_names": [tool_name],
                                                "argument_list": [arguments],
                                                "conversation_id": self._param.conversation_id,
                                                "messages": msg,
                                                "message_id": self._param.message_id,
                                                "file_path": self._param.file_path,
                                                "tenant_id": tenant_id, "return_as_component": True}, outputs, type))
                    async_tasks.append(t)

                if type == "chat":
                    if not query:
                        continue
                    msg.append({"content": query, "id": self._param.message_id, "doc_ids": self._param.doc_ids,
                                "role": "user"})
                    # chat(dia, msg, True, **req):
                    e, dia = DialogService.get_by_id(self._param.dialog_id)
                    t = threading.Thread(target=generator_runner,
                                         args=(self, chat,
                                               {"dialog": dia, "messages": msg,
                                                "stream": True}, outputs, type))
                    async_tasks.append(t)

            # 启动线程执行
            task_start_time_map = {}  # 任务日志map
            for t in async_tasks:
                t.start()
            running_tasks = len(async_tasks)
            # 循环获取任务输出
            start = time.time()
            if running_tasks > 0:
                self.append_log(f"开始运行子任务")
            while running_tasks:
                value = outputs.get()
                if value is None:
                    running_tasks -= 1  # 一个生成器结束
                else:
                    yield value

                if value and value.agent_name not in task_start_time_map:
                    task_start_time_map[value.agent_name] = time.time()
                    self.append_log(f"开始运行{value.agent_name}")

            end = time.time()
            for agent_name in final_output_map:
                for k, v in final_output_map[agent_name].items():
                    final_output_list.append(v)
                self.append_log(f"运行{agent_name}结束")

            self.append_log(f"运行子任务结束，耗时{round(end - start, 2)}s")

        final_output = IntentionRecognition.be_output('\n'.join(final_output_list) if final_output_list else "")
        self.set_output(final_output)
        yield final_output

    def get_agents_and_mcps(self):
        """
        查询agent，mcp
        :return:
        """
        tenant_id = self._canvas.get_tenant_id()
        agent_ids = self._param.agent_ids
        mcp_server_ids = self._param.mcp_server_ids

        tenants = UserTenantService.get_tenants_by_user_id(tenant_id)
        tenant_ids = [x["tenant_id"] for x in tenants]

        agents = []
        agent_map = {}
        mcp_severs = []
        mcp_server_tools = {}
        # 查询agent
        try:
            self.append_log("查询智能体列表")
            if not agent_ids:
                # 查询有权限的agent
                users = UserTenantService.get_users_by_tenant_ids(tenant_ids)
                user_ids = [x["id"] for x in users]
                agents = AgentService.get_by_list(user_ids=user_ids, current_user_id=tenant_id)
            else:
                agents = AgentService.get_by_ids(ids=agent_ids)

            for agent in agents:
                agent_obj = Agent(json.dumps(agent["dsl"], ensure_ascii=False), tenant_id)
                agent_obj.reset()
                agent["dsl"] = json.loads(str(agent_obj))
                agent_map[agent["id"]] = agent
        except Exception as e:
            self.append_log(f"查询智能体异常{str(e)}")

        # 查询mcp server和tool
        try:
            self.append_log("查询MCP服务和工具")
            mcp_severs = MCPService.get_server_by_ids_and_tenant_ids(mcp_server_ids, tenant_ids)
            for row in mcp_severs:
                server_name = row["name"]
                server_id = row["id"]
                mcp_server_tools[server_id] = []
                try:
                    tools = asyncio.run(mcp_server_list_tools(server_id=server_id))
                    tools = [x.model_dump() for x in tools]
                    available_tools = []
                    # 只取可用的
                    for tool in tools:
                        annotations = tool["annotations"] if "annotations" in tool else {}
                        annotations["server_id"] = server_id
                        mcp_tool_info = annotations["mcp_tool_info"] if "mcp_tool_info" in annotations else {}
                        status = mcp_tool_info["status"] if "status" in mcp_tool_info else 1
                        if status != 1:
                            continue

                        tool["annotations"] = annotations
                        available_tools.append(tool)
                    mcp_server_tools[server_id] = available_tools
                except Exception as e:
                    self.append_log(f"查询MCP工具异常，服务{server_name}异常{str(e)}")
            self.append_log("获取MCP服务和工具完成")
        except Exception as e:
            self.append_log(f"查询MCP服务和工具异常{str(e)}")
        return agents, agent_map, mcp_severs, mcp_server_tools

    def process_prompt(self, **kwargs):
        input_ref = self.get_prompt_input_elements()
        for para in input_ref:
            if para["key"].lower().find("begin@") == 0:
                cpn_id, key = para["key"].split("@")
                for p in self._canvas.get_component(cpn_id)["obj"]._param.query:
                    if p["key"] == key:
                        kwargs[para["key"]] = p.get("value", "")
                        if isinstance(p.get("value", ""), dict) or isinstance(p.get("value", ""), list):
                            json_value = copy.deepcopy(p.get("value"))
                            if p.get("type") == "file" and isinstance(json_value, dict):
                                json_value.pop("base64_data",None)
                                json_value.pop("thumbnail",None)
                            if p.get("type") == "file" and isinstance(json_value, list):
                                for v in json_value:
                                    v.pop("base64_data", None)
                                    v.pop("thumbnail", None)
                            kwargs[para["key"]] = json.dumps(json_value, ensure_ascii=False)
                        self._param.inputs.append(
                            {"component_id": para["key"], "content": kwargs[para["key"]]})
                        break
                else:
                    assert False, f"找不到变量 '{key}' for {cpn_id}"
                continue

            if para["key"].startswith("sys."):
                kwargs[para["key"]] = para["value"]
                self._param.inputs.append(
                    {"component_id": para["key"], "content": kwargs[para["key"]]})
                continue
            component_id = para["key"]
            cpn = self._canvas.get_component(component_id)["obj"]
            if cpn.component_name.lower() == "answer":  # 如果
                hist = self._canvas.get_history(1)
                if hist:
                    hist = hist[0]["content"]
                else:
                    hist = ""
                kwargs[para["key"]] = hist
                continue
            _, out = cpn.output(allow_partial=False)
            flow_path = self._canvas.path[-1] #本次节点流程路径
            if "content" not in out.columns or component_id not in flow_path:
                kwargs[para["key"]] = ""
            else:
                if cpn.component_name.lower() == "retrieval":
                    pass
                kwargs[para["key"]] = "  - " + "\n - ".join(
                    [o if isinstance(o, str) else str(o) for o in out["content"]])
            self._param.inputs.append({"component_id": para["key"], "content": kwargs[para["key"]]})
        prompt = self._param.prompt  # 提示词模版
        for n, v in kwargs.items():  # 替换变量
            prompt = re.sub(r"\{%s\}" % re.escape(n), str(v).replace("\\", " "), prompt)

        return prompt

    def debug(self, **kwargs):
        return self._run([], **kwargs)

    def test(**kwargs):
        yield kwargs
