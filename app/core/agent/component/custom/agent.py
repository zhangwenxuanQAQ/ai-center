# Author: zwx
# Date: 2025/9/29 16:55
# Description: 智能体组件
import copy
import json
import time
from abc import ABC
from functools import partial

import pandas as pd
from pandas import DataFrame

from agent.agent import Agent
from ..base import ComponentParamBase, ComponentBase
from api.db.services.agent_service import AgentService
from api.service.agent_run_service import AgentRunService
from api.utils.agent_utils import parse_begin_param_file, parse_begin_param
from app.core.llm_model.utils.llm_util import get_output_tag_content


class AgentInstanceParam(ComponentParamBase):

    def __init__(self):
        super().__init__()
        self.agent_id = ""
        self.version_id = ""
        self.begin_params = [] #新的开始参数字段
        self.input_params = [] #老的开始参数字段
        self.dsl = {}  # dsl

    def check(self):
        if self.input_params:
            if isinstance(self.begin_params, dict) or not self.begin_params:
                self.begin_params = self.input_params
        self.check_empty(self.agent_id, "参数【智能体】为空")
        self.check_loop()

    def check_loop(self):
        parent_agent_ids = []
        self.recur_check_loop(self.agent_id, self.version_id, parent_agent_ids)

    def recur_check_loop(self, agent_id, version_id, parent_agent_ids):
        loop = False
        # TODO 循环依赖检查
        # dsl = {}
        #
        # if agent_id:
        #     agent = AgentService.get_detail_by_id(agent_id=agent_id, version_id=version_id)
        #
        # parent_agent_ids.append(agent_id)
        #
        # # 绑定的agent
        # for agent in agents:
        #     if loop:
        #         break
        #     dsl = agent["dsl"]
        #     for c in dsl["components"]:
        #         cpn = dsl["components"][c]["obj"]
        #         if "agent_ids" in cpn["params"] and cpn["params"]["agent_ids"]:
        #             intersection = [x for x in cpn["params"]["agent_ids"] if x in parent_agent_ids]
        #             if intersection:
        #                 loop = True
        #                 break
        #             parent_agent_ids.extend(cpn["params"]["agent_ids"])
        #             self.recur_check_loop(cpn["params"]["agent_ids"], parent_agent_ids)
        if loop:
            raise ValueError(f"智能体存在循环依赖")


class AgentInstance(ComponentBase, ABC):
    component_name = "AgentInstance"
    component_title = "智能体"

    def get_dependent_components(self):
        if self._param.input_params:
            if isinstance(self._param.begin_params, dict) or not self._param.begin_params:
                self._param.begin_params = self._param.input_params
        cpnts = set([para["component_id"] for para in self._param.begin_params \
                     if para.get("component_id") \
                     and para["component_id"].lower().find("answer") < 0 \
                     and para["component_id"].lower().find("begin@") < 0 and para["component_id"].lower().find(
                "sys.") < 0])
        return list(cpnts)

    def reset(self, **kwargs):
        super().reset()
        self._param.dsl = {}

    def get_memory_value(self, memory_config: dict = {}):
        from .. import component_class
        from agent.agent import Agent
        value = ""
        if memory_config:
            name = memory_config.get("name", "")
            name_list = name.split("@")
            # task_id action_id action_data_id sub_agent_component_name param_name 子任务
            if len(name_list) > 1:
                agent_id = name_list[0]
                component_id = name_list[1]
                data_id = name_list[2] if len(name_list) > 2 else ""
                if agent_id is None:
                    return value
                # 获取子agent组件属性值
                if agent_id == self._param.agent_id:
                    sub_dsl = copy.deepcopy(self._param.dsl)
                    sub_agent_component_id = component_id
                    if sub_dsl:
                        sub_component = sub_dsl['components'][sub_agent_component_id]
                        sub_agent_component_name = sub_component["obj"]["component_name"]
                        param = component_class(sub_agent_component_name + "Param")()
                        param.update(sub_component["obj"]["params"])
                        cpn = component_class(sub_agent_component_name)(
                            Agent(json.dumps(sub_dsl, ensure_ascii=False)),
                            sub_agent_component_id, param)
                        memory_config_ = copy.deepcopy(memory_config)
                        memory_config_["name"] = data_id
                        cpn._canvas.history.append(self._canvas.history[-1])
                        value = cpn.get_memory_value(memory_config_)  # 子agent组件属性值
                else:
                    value = data_id
            else:
                value = super().get_memory_value(memory_config)
        return value

    def _run(self, history, **kwargs):

        query = self.get_input()  # 输入
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()

        conversation_id = self._canvas.get_global_value("conversation_id", "")
        message_id = self._canvas.get_global_value("message_id", "")
        dsl = {}
        if not self._param.dsl:
            cvs = AgentService.get_detail_by_id(agent_id=self._param.agent_id, version_id=self._param.version_id)
            if cvs:
                dsl = json.dumps(cvs["dsl"], ensure_ascii=False)
                agents = Agent(dsl, self._canvas.get_tenant_id())
                agents.reset()
                dsl = json.loads(str(agents))
                self._param.agent_name = cvs["title"]
            else:
                raise Exception(f"智能体不存在，agent_id:{self._param.agent_id}")
        else:
            dsl = self._param.dsl
            agents = Agent(json.dumps(dsl, ensure_ascii=False), self._canvas.get_tenant_id())

        begin_params = self.get_begin_params_values()
        self.append_log(f"设置开始参数：{begin_params}")
        # 设置begin参数
        if begin_params:
            begin_component = agents.components["begin"]
            params = begin_component["obj"]._param
            begin_query = params.query if hasattr(params, "query") else []
            for param in begin_query:
                if param["key"] in begin_params:
                    param["value"] = parse_begin_param_file(param, begin_params[param["key"]]) if param[
                                                                                                      "type"] == "file" else \
                        parse_begin_param(param, begin_params[param["key"]])

            # 系统变量
            system_params = params.system_params if hasattr(params, "system_params") else []
            for param in system_params:
                if param["key"] in begin_params:
                    system_params["value"] = begin_params[param["key"]]

        dsl = json.loads(str(agents))

        downstreams = self._canvas.get_component(self._id)["downstream"]
        if kwargs.get("stream") and len(downstreams) == 1 and self._canvas.get_component(downstreams[0])[
            "obj"].component_name.lower() == "answer":
            return partial(self.run_agent, query, conversation_id, message_id, self._canvas.get_tenant_id(), dsl, True)

        # 如果下游有结果输出节点
        component_answer_downstream = [x for x in downstreams if "ComponentAnswer" in x]
        if kwargs.get("stream") and len(component_answer_downstream) > 0:
            return partial(self.run_agent, query, conversation_id, message_id, self._canvas.get_tenant_id(), dsl, True)

        res = self.run_agent(query, conversation_id, message_id, self._canvas.get_tenant_id(), dsl, False)
        final_res = ""
        for res1 in res:
            final_res = res1
        return AgentInstance.be_output(final_res)

    # 解析输入参数，返回参数名：参数值map
    def get_begin_params_values(self):
        result = {}
        begin_params = self._param.begin_params
        if begin_params:
            for params in begin_params:
                if params["from"] == "input":
                    component_id = ""
                    value = params["value"]
                    result[params["name"]] = value
                else:
                    component_id = params["component_id"]
                    value = self.get_reference_input_value(component_id)
                    if isinstance(value, DataFrame):
                        value = "\n".join(value["content"]) if "content" in value else ""
                        result[params["name"]] = value
                    else:
                        continue

                self._param.inputs.append({
                    "component_id": component_id,
                    "content": value
                })
        return result

    # 获取依赖组件值
    def get_reference_input_value(self, component_id):
        reversed_cpnts = []
        if len(self._canvas.path) > 1:
            reversed_cpnts.extend(self._canvas.path[-2])
        reversed_cpnts.extend(self._canvas.path[-1])
        up_cpns = self.get_upstream()
        reversed_up_cpnts = [cpn for cpn in reversed_cpnts if cpn in up_cpns]

        outs = []
        if component_id:
            if component_id.startswith("sys."):
                global_value = self._canvas.get_global_value(component_id)
                if global_value:
                    if "sys.files" == component_id:
                        file_content = "----\n".join(global_value)
                        outs.append(pd.DataFrame([{"content": file_content}]))
                    else:
                        outs.append(pd.DataFrame([{"content": global_value}]))

            elif component_id.split("@")[0].lower() == "begin":
                cpn_id, key = component_id.split("@")
                for p in self._canvas.get_component(cpn_id)["obj"]._param.query:
                    if p["key"] == key:
                        if p["type"] == "file" and not p["parse"]:
                            value = p.get("value", {})
                            outs.append(pd.DataFrame([{"content": json.dumps(value)}]))
                        else:
                            outs.append(pd.DataFrame([{"content": p.get("value", "")}]))
                        break
                else:
                    assert False, f"Can't find parameter '{key}' for {cpn_id}"

            elif component_id.lower().find("answer") == 0:
                txt = []
                for r, c in self._canvas.history[::-1]:
                    # 过滤掉assistant
                    if "user" == r:
                        txt.append(f"{c}")
                        break
                    # txt.append(f"{r.upper()}:{c}")
                txt = "\n".join(txt)
                outs.append(pd.DataFrame([{"content": txt}]))
            else:
                outs.append(self._canvas.get_component(component_id)["obj"].output(allow_partial=False)[1])

        if outs:
            df = pd.concat(outs, ignore_index=True)
            if "content" in df:
                df = df.drop_duplicates(subset=['content']).reset_index(drop=True)
            return df

        upstream_outs = []

        for u in reversed_up_cpnts[::-1]:
            if self.get_component_name(u) in ["switch"]:
                continue
            if self.component_name.lower() == "generate" and self.get_component_name(u) == "retrieval":
                o = self._canvas.get_component(u)["obj"].output(allow_partial=False)[1]
                if o is not None:
                    o["component_id"] = u
                    upstream_outs.append(o)
                    continue
            # if self.component_name.lower()!="answer" and u not in self._canvas.get_component(self._id)["upstream"]: continue
            if self.component_name.lower().find("switch") < 0 \
                    and self.get_component_name(u) in ["relevant", "categorize"]:
                continue
            if u.lower().find("answer") >= 0:
                for r, c in self._canvas.history[::-1]:
                    if r == "user":
                        upstream_outs.append(pd.DataFrame([{"content": c, "component_id": u}]))
                        break
                break
            if self.component_name.lower().find("answer") >= 0 and self.get_component_name(u) in ["relevant"]:
                continue
            o = self._canvas.get_component(u)["obj"].output(allow_partial=False)[1]
            if o is not None:
                o["component_id"] = u
                upstream_outs.append(o)
            break

        assert upstream_outs, "无法找到依赖的输入组件"

        df = pd.concat(upstream_outs, ignore_index=True)
        if "content" in df:
            df = df.drop_duplicates(subset=['content']).reset_index(drop=True)

        return df

    def run_agent(self, query, conversation_id, message_id, tenant_id, dsl, stream_run: bool = True):
        from api.model.agent_output import AgentOutput
        self.set_start_time(time.time())
        show_progress = self._canvas.get_show_progress(self._id)
        show_text = self._canvas.get_show_text(self._id)
        files = self._canvas.get_global_value("files", [])
        finished_dsl = {}
        final_contents = []
        final_dict_output_contents = []
        stream_start = False
        stream_output = None
        stream_output_content = None  # 流式输出结果（后面覆盖前面的）
        self.append_log(f"开始运行智能体：{self._param.agent_name}")
        for output in AgentRunService().sse(message=query,
                                            agent_id=self._param.agent_id,
                                            agent_name=self._param.agent_name,
                                            conversation_id=conversation_id,
                                            message_id=message_id,
                                            tenant_id=tenant_id,
                                            dsl=dsl, files=files):
            if isinstance(output, str):
                index = output.find("data:")
                if index != -1:
                    sub_ans = json.loads(output[index + 5:].strip())
                    # 最后一条消息
                    if isinstance(sub_ans, dict) and sub_ans["data"] == True:
                        finished_dsl = sub_ans["dsl"]
                        break
                    try:
                        sub_ans = AgentOutput(**sub_ans)
                        action_result, action_reference, stream = self.get_action_result(sub_ans,
                                                                                         remove_think=False)
                        task_answer_upstream_id = sub_ans.data.upstream_id
                        sub_ans.data.parent_component_name = self.get_component_node_name(self._id)
                        # 最终Answer处理
                        # 只有AgentOutput最终Answer有可能stream
                        #         yield {"content": content_char, "reference": {},
                        #                "task_answer_upstream_id": task_answer_upstream_id,
                        #                "stream_status": "start" if not stream_start else ""}
                        show_output_content = None
                        if stream:
                            stream_output = sub_ans
                            stream_output_content = action_result
                            show_output_content = {"content": action_result, "reference": {},
                                                   "task_answer_upstream_id": task_answer_upstream_id,
                                                   "stream_status": "start" if not stream_start else ""}
                            stream_start = True
                        else:
                            if stream_output_content:
                                final_contents.append(stream_output_content)
                                final_dict_output_contents.append(show_output_content)
                            # 重置参数
                            stream_output = None
                            stream_output_content = ""
                            stream_start = False

                            if sub_ans.data.component_name == "Answer":
                                show_output_content = {"content": action_result, "reference": action_reference,
                                                       "task_answer_upstream_id": task_answer_upstream_id,
                                                       "stream_status": "start"}
                                final_contents.append(action_result)
                                final_dict_output_contents.append(show_output_content)

                        res = sub_ans
                        yield res
                        # if show_output_content and show_text:
                        #     yield show_output_content
                    except Exception as e:
                        continue

        if stream_output_content:
            final_contents.append(stream_output_content)
            final_dict_output_contents.append(show_output_content)

        self._param.dsl = finished_dsl  # 更新dsl
        self.set_end_time_and_append_log(time.time())  # 添加结束时间
        self.append_log(f"运行智能体结束：{self._param.agent_name}")

        res = "\n".join(final_contents)
        if stream_run:
            # self.set_output(AgentInstance.be_output(final_dict_output_contents))
            self.set_output(AgentInstance.be_output(res))
        else:
            yield res

    def get_action_result(self, action_answer, remove_think: bool = False):
        from api.model.agent_output import AgentOutput
        content = ""
        reference = {}
        stream = False
        if action_answer:
            if isinstance(action_answer, AgentOutput):
                content = action_answer.data.answer
                reference = action_answer.data.reference
                stream = action_answer.data.stream
            elif isinstance(action_answer, str):
                content = action_answer
                reference = {}
                stream = False
            else:
                content = action_answer["content"]
                reference = action_answer["reference"]
                stream = action_answer[
                    "stream"] if "stream" in action_answer else False
        res = content
        think_content = get_output_tag_content(content, "think")
        answer_content = get_output_tag_content(content, "answer")
        if remove_think:
            res = content.replace(f"<think>{think_content}</think>", "")
        res = res.replace(f"<answer>{answer_content}</answer>", answer_content)
        return res, reference, stream

    def debug(self, **kwargs):
        return self._run([], **kwargs)
