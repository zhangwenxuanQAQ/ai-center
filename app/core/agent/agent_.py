# Author: zwx
# Date: 2025/4/14 10:02
# Description: Agent （原Canvas）
import json
import logging
import time
from collections import OrderedDict
from copy import deepcopy
from functools import partial

import pandas as pd
from pandas import DataFrame, Series

from agent.component import component_class
from agent.component.base import ComponentBase
from api.model.agent_output import AgentOutput
from api.model.component_output import ComponentOutput, MessageType, ComponentStatus


class Agent:
    """
    dsl = {
        "components": {
            "begin": {
                "obj":{
                    "component_name": "Begin",
                    "params": {},
                },
                "downstream": ["answer_0"],
                "upstream": [],
            },
            "answer_0": {
                "obj": {
                    "component_name": "Answer",
                    "params": {}
                },
                "downstream": ["retrieval_0"],
                "upstream": ["begin", "generate_0"],
            },
            "retrieval_0": {
                "obj": {
                    "component_name": "Retrieval",
                    "params": {}
                },
                "downstream": ["generate_0"],
                "upstream": ["answer_0"],
            },
            "generate_0": {
                "obj": {
                    "component_name": "Generate",
                    "params": {}
                },
                "downstream": ["answer_0"],
                "upstream": ["retrieval_0"],
            }
        },
        "history": [],
        "messages": [],
        "reference": [],
        "path": [["begin"]],
        "answer": []
    }
    """

    def __init__(self, dsl: str, tenant_id=None):
        self.path = []
        self.history = []
        self.messages = []
        self.answer = []
        self.components = {}
        self.dsl = json.loads(dsl) if dsl else {
            "components": {
                "begin": {
                    "obj": {
                        "component_name": "Begin",
                        "params": {
                            "prologue": "Hi there!"
                        }
                    },
                    "downstream": [],
                    "upstream": [],
                    "parent_id": ""
                }
            },
            "history": [],
            "messages": [],
            "reference": [],
            "path": [],
            "answer": []
        }
        self._tenant_id = tenant_id
        self._embed_id = ""
        # 全局变量
        self.globals = {
            "sys.query": "",
            "sys.user_id": tenant_id,
            "sys.files": [],
            "sys.conversation_id": "",
            "sys.message_id": ""
        }
        self.load()

    def load(self):
        self.components = self.dsl["components"]
        cpn_nms = set([])
        for k, cpn in self.components.items():
            cpn_nms.add(cpn["obj"]["component_name"])

        assert "Begin" in cpn_nms, "Agent必须要有开始组件"
        assert "Answer" in cpn_nms, "Agent必须要有对话组件"

        for k, cpn in self.components.items():
            cpn_nms.add(cpn["obj"]["component_name"])
            param = component_class(cpn["obj"]["component_name"] + "Param")()
            param.update(cpn["obj"]["params"])
            param.check()
            cpn["obj"] = component_class(cpn["obj"]["component_name"])(self, k, param)
            if cpn["obj"].component_name == "Categorize":
                for _, desc in param.category_description.items():
                    if desc["to"] not in cpn["downstream"]:
                        cpn["downstream"].append(desc["to"])

            #输出 dict 转 DataFrame，便于后续执行时获取
            output_var_name = cpn["obj"]._param.output_var_name
            if hasattr(cpn["obj"]._param, output_var_name):
                output_data = getattr(cpn["obj"]._param, output_var_name)
                if output_data and isinstance(output_data, dict):
                    setattr(cpn["obj"]._param, output_var_name, pd.DataFrame(output_data))

        self.path = self.dsl["path"]
        self.history = self.dsl["history"]
        self.messages = self.dsl["messages"]
        self.answer = self.dsl["answer"]
        self.reference = self.dsl["reference"]
        self._embed_id = self.dsl.get("embed_id", "")
        if "globals" in self.dsl:
            self.globals = self.dsl["globals"]
        else:
            self.globals = {
                "sys.query": "",
                "sys.user_id": self._tenant_id,
                "sys.files": [],
                "sys.conversation_id": "",
                "sys.message_id": "",
            }

    def __str__(self):
        self.dsl["path"] = self.path
        self.dsl["history"] = self.history
        self.dsl["messages"] = self.messages
        self.dsl["answer"] = self.answer
        self.dsl["reference"] = self.reference
        self.dsl["embed_id"] = self._embed_id
        self.dsl["tenant_id"] = self._tenant_id
        dsl = {
            "components": {}
        }
        for k in self.dsl.keys():
            if k in ["components"]:
                continue
            dsl[k] = deepcopy(self.dsl[k])

        for k, cpn in self.components.items():
            if k not in dsl["components"]:
                dsl["components"][k] = {}
            for c in cpn.keys():
                if c == "obj":
                    dsl["components"][k][c] = json.loads(str(cpn["obj"]))
                    continue
                dsl["components"][k][c] = deepcopy(cpn[c])

        self.dsl["globals"] = self.globals
        return json.dumps(dsl, ensure_ascii=False)

    def reset(self, **kwargs):
        self.path = []
        mem = kwargs.get('memory', False)
        if not mem:
            self.history = []
            self.messages = []

        mem_sys = kwargs.get('memory_sys', False)
        if not mem_sys:
            # 重置globals
            for k in self.globals.keys():
                if isinstance(self.globals[k], str):
                    self.globals[k] = ""
                elif isinstance(self.globals[k], int):
                    self.globals[k] = 0
                elif isinstance(self.globals[k], float):
                    self.globals[k] = 0
                elif isinstance(self.globals[k], list):
                    self.globals[k] = []
                elif isinstance(self.globals[k], dict):
                    self.globals[k] = {}
                else:
                    self.globals[k] = None

        self.answer = []
        self.reference = []
        for k, cpn in self.components.items():
            self.components[k]["obj"].reset(**kwargs)
        self._embed_id = ""

    def get_component_name(self, cid):
        for n in self.dsl["graph"]["nodes"]:
            if cid == n["id"]:
                return n["data"]["name"]
        return ""

    def get_show_progress(self, cid):
        for n in self.dsl["graph"]["nodes"]:
            if cid == n["id"]:
                return n["data"]["show_progress"] if "show_progress" in n["data"] else True
        return True

    def get_show_text(self, cid):
        for n in self.dsl["graph"]["nodes"]:
            if cid == n["id"]:
                return n["data"]["show_text"] if "show_text" in n["data"] else True
        return True

    def run(self, **kwargs):
        # 设置globals全局变量
        from api.utils.agent_utils import get_files
        from agent.util.agent_util import sort_downstream
        for k in kwargs.keys():
            if k in ["user_id", "files", "conversation_id", "message_id", "query"] and kwargs[k]:
                if k == "files":
                    self.globals[f"sys.{k}"] = get_files(kwargs[k])
                else:
                    self.globals[f"sys.{k}"] = kwargs[k]

        for r, c in self.history[::-1]:
            if r == "user":
                self.globals["sys.query"] = c
                break

        if not self.path:
            self.components["begin"]["obj"].run(self.history, **kwargs)
            self.path.append(["begin"])

        self.path.append([])
        self.answer = []  # 重置answer
        self.component_answer = []  # 结果输出组件
        ran = -1
        waiting = []
        without_dependent_checking = []
        parallel_paths = [] # 并行循环内部路径
        def prepare2run(cpns):
            nonlocal ran, ans
            cpns = sort_downstream(cpns)  # 重排序（将ComponentAnswer指定）
            for c in cpns:
                path_append = False
                if self.path[-1] and c == self.path[-1][-1]:
                    continue
                component_name = self.get_component_name(c)
                show_progress = self.get_show_progress(c)
                show_text = self.get_show_text(c)
                cpn_info = self.components[c]
                cpn = self.components[c]["obj"]
                if cpn.component_name == "Answer" and not cpn_info.get("parent_id"):  # 没有父组件
                    self.answer.append(c)
                else:
                    logging.debug(f"Agent.prepare2run: {c}")
                    if c not in without_dependent_checking:
                        cpids = cpn.get_dependent_components()
                        if any([cc not in self.path[-1] for cc in cpids]):
                            if c not in waiting:
                                waiting.append(c)
                            continue
                        if c in waiting:
                            continue
                    # "*'{}'* is running...🕞".format(self.get_component_name(c))
                    running_text = "{}".format(component_name)
                    output = ComponentOutput(content=running_text,
                                             component_class=cpn.component_name,
                                             component_name=component_name, message_type=MessageType.PROGRESS.value,
                                             show_progress=show_progress, show_text=show_text, logs=cpn._param.logs,
                                             start_time=cpn._param.start_time, end_time=cpn._param.end_time,
                                             duration=cpn._param.duration)
                    yield output

                    if cpn.component_name.lower() == "iteration":
                        st_cpn = cpn.get_start()
                        assert st_cpn, "Start component not found for Iteration."
                        if not st_cpn["obj"].end():
                            if st_cpn["obj"].is_first():  # 如果是首轮，则清空循环历史数据
                                cpn.set_start_time(time.time())
                                cpn.set_output(None)
                            cpn = st_cpn["obj"]

                    downstreams = self.components[cpn._id]["downstream"]
                    component_answer_downstream = [x for x in downstreams if "ComponentAnswer" in x]

                    try:
                        ans = cpn.run(self.history, **kwargs)

                        # 任务分发节点，执行子任务
                        if cpn.component_name == "IntentionRecognition":
                            # 执行子任务
                            for sub_ans in cpn.run_tasks(chosen=ans["content"][0]):
                                if isinstance(sub_ans, AgentOutput):
                                    sub_ans.data.parent_component_name = component_name
                                    yield sub_ans
                                else:
                                    yield self.get_component_output(sub_ans, component_name, kwargs.get("stream"),
                                                                    show_progress=show_progress, show_text=show_text,
                                                                    component=cpn)

                        elif cpn.component_name == "Answer" and cpn_info.get("parent_id"):  # 循环组件内部Answer节点
                            child_output = None
                            for ans_output in self.run_answer(ans, **kwargs):
                                child_output = ans_output
                                yield ans_output
                            # if child_output:
                            #     yield child_output
                        elif (
                                cpn.component_name == "IntentDetectionV2" or cpn.component_name == "ComponentAnswer") and isinstance(
                                ans, partial):
                            # 意图分类组件或结果输出组件--流式输出
                            if cpn.component_name == "IntentDetectionV2" and len(component_answer_downstream) > 0:
                                new_cpn = self.components[component_answer_downstream[0]]["obj"]
                                ans = new_cpn.run(self.history, **kwargs)
                                component_name = self.get_component_name(new_cpn._id)
                                self.path[-1].append(c)
                                path_append = True
                                self.path[-1].append(new_cpn._id)
                                cpn = new_cpn

                            output = None
                            for an in ans():
                                if isinstance(an, AgentOutput):
                                    output = ComponentOutput(content=json.dumps(an.to_dict(),ensure_ascii=False),
                                                             component_name=component_name,
                                                             component_class=cpn.component_name,
                                                             show_progress=show_progress, show_text=show_text,
                                                             message_type=MessageType.AGENT.value,
                                                             status=ComponentStatus.RUNNING.value)
                                    yield output
                                else:
                                    output = ComponentOutput(content=an,
                                                             component_name=component_name,
                                                             component_class=cpn.component_name,
                                                             show_progress=show_progress, show_text=show_text,
                                                             message_type=MessageType.TEXT.value,
                                                             status=ComponentStatus.RUNNING.value)
                                    yield output

                            if output and isinstance(output, ComponentOutput):
                                output.status = ComponentStatus.FINISHED.value
                                yield output
                        else:
                            yield self.get_component_output(ans, component_name, kwargs.get("stream"),
                                                            show_progress=show_progress, show_text=show_text,
                                                            component=cpn)

                        # 并行执行循环组件子流程
                        if cpn.component_name == "IterationItem":
                            if cpn.parallel:
                                from agent.util.agent_util import run_iteration_parallel
                                # c = cpn._id
                                iteration_agent = None
                                for iter_res, iteration_agent in run_iteration_parallel(self, cpn, **kwargs):
                                    yield iter_res
                                if iteration_agent:  # 将内部路径添加到path
                                    self.path[-1].extend(iteration_agent.path[-1])
                                    self.path[-1].append(cpn_info["obj"]._id)
                                    # parallel_paths[cpn._id] = []
                                    # parallel_paths[cpn._id].extend(iteration_agent.path[-1])
                                    parallel_paths.extend(iteration_agent.path[-1])
                                    #ran += len(iteration_agent.path[-1]) - 1
                                continue
                            else:
                                c = cpn._id
                    except Exception as e:
                        logging.exception(f"Agent运行异常: {e}")
                        #self.path[-1].clear()
                        if not path_append:
                            self.path[-1].append(c)
                        ran += 1
                        raise e
                    if not path_append:
                        self.path[-1].append(c)

            ran += 1

        downstream = self.components[self.path[-2][-1]]["downstream"]
        if not downstream and self.components[self.path[-2][-1]].get("parent_id"):
            cid = self.path[-2][-1]
            pid = self.components[cid]["parent_id"]
            o, _ = self.components[cid]["obj"].output(allow_partial=False)
            oo, _ = self.components[pid]["obj"].output(allow_partial=False)
            self.components[pid]["obj"].set_output(pd.concat([oo, o], ignore_index=True).dropna())
            downstream = [pid]

        for m in prepare2run(downstream):
            # yield {"content": m, "running_status": True}
            yield m

        while 0 <= ran < len(self.path[-1]):
            logging.debug(f"Agent运行: {ran} {self.path}")
            cpn_id = self.path[-1][ran]
            cpn = self.get_component(cpn_id)
            if not any([cpn["downstream"], cpn.get("parent_id"), waiting]):
                # break
                ran += 1
                continue

            if cpn_id in parallel_paths:
                ran += 1
                #if cpn["downstream"]:
                continue

            loop = self._find_loop()
            if loop:
                raise OverflowError(f"Too much loops: {loop}")

            downstream = []
            if cpn["obj"].component_name.lower() in ["switch", "categorize", "relevant"]:
                switch_out_str = cpn["obj"].output()[1].iloc[0, 0]
                # 兼容绑定的意图识别操作
                out_parts = switch_out_str.split("@")
                switch_out = out_parts[0]
                assert switch_out in self.components, \
                    "{}'s output: {} not valid.".format(cpn_id, switch_out)
                downstream = [switch_out]
                if len(out_parts) > 2 and "IntentDetection" in switch_out:
                    action_id = out_parts[2]
                    self.components[switch_out]["obj"]._param.do_action_ids = [action_id]  # 设置手动意图操作id
            elif cpn["obj"].component_name == "IntentDetectionV2":
                # 意图分类组件
                out_str = cpn["obj"].output()[1].iloc[0, 0]
                try:
                    to_component_ids = json.loads(out_str)  # 下游组件
                except Exception as e:
                    to_component_ids = []
                downstream = to_component_ids
            elif cpn["obj"].component_name.lower() == "answer" and not cpn.get("parent_id"):
                ran += 1
                continue
            else:
                downstream = cpn["downstream"]

            # 有parent_id (即在循环组件里)
            if not downstream and cpn.get("parent_id"):
                pid = cpn["parent_id"]
                if cpn["obj"].component_name.lower() == "answer":
                    _, o = cpn["obj"].output(allow_partial=True)
                else:
                    _, o = cpn["obj"].output(allow_partial=False)
                _, oo = self.components[pid]["obj"].output(allow_partial=False)
                self.components[pid]["obj"].set_output(
                    pd.concat([oo.dropna(axis=1), o.dropna(axis=1)], ignore_index=True).dropna())
                downstream = [pid]

            for m in prepare2run(downstream):
                # yield {"content": m, "running_status": True}
                yield m

            if ran >= len(self.path[-1]) and waiting:
                without_dependent_checking = waiting
                waiting = []
                for m in prepare2run(without_dependent_checking):
                    # yield {"content": m, "running_status": True}
                    yield m
                without_dependent_checking = []
                ran -= 1

        # 思考结束标签
        output = ComponentOutput(content="",
                                 component_class="ThinkingStop",
                                 component_name="ThinkingStop", status=ComponentStatus.FINISHED.value,
                                 message_type=MessageType.PROGRESS.value)
        yield output

        if self.answer:
            #去重
            self.answer = list(OrderedDict.fromkeys(self.answer))
            while len(self.answer) > 0:
                cpn_id = self.answer[0]
                # component_name = self.get_component_name(cpn_id)
                #
                # running_text = "**{}**...🕞".format(component_name)
                # output = ComponentOutput(content=running_text,
                #                          component_name=component_name, message_type=MessageType.PROGRESS.value)
                # yield output

                self.answer.pop(0)
                ans = self.components[cpn_id]["obj"].run(self.history, **kwargs)
                self.path[-1].append(cpn_id)
                for ans_output in self.run_answer(ans, **kwargs):
                    yield ans_output

                # self.path[-1].append(cpn_id)
                # if kwargs.get("stream"):
                #     assert isinstance(ans, partial)
                #     for an in ans():
                #         if isinstance(an, AgentOutput):
                #             yield an
                #         else:
                #             output = ComponentOutput(content=an,
                #                                      component_class="Answer",
                #                                      component_name="Answer", message_type=MessageType.TEXT.value,
                #                                      status=ComponentStatus.FINISHED.value)
                #
                #             yield output
                #
                #     if output:  # 将上游节点设为finished并且打印answer最后一条finished消息
                #         upstream_id = output.content["upstream_id"] if isinstance(output.content, dict) else ""
                #         upstream_stream = output.content["stream"] if isinstance(output.content, dict) else ""
                #         if upstream_id:
                #             component_name = self.get_component_name(upstream_id)
                #             show_progress = self.get_show_progress(upstream_id)
                #             show_text = self.get_show_text(upstream_id)
                #             cpn = self.components[upstream_id]["obj"]
                #             upstream_output = self.get_component_output(cpn.get_output_value(), component_name,
                #                                                         kwargs.get("stream"),
                #                                                         show_progress=show_progress,
                #                                                         show_text=show_text,
                #                                                         component=cpn)
                #             if upstream_stream:
                #                 upstream_output.status = ComponentStatus.FINISHED.value
                #                 # yield upstream_output
                #                 # yield output
                #
                # else:
                #     output = ComponentOutput(content=ans,
                #                              component_class="Answer",
                #                              component_name="Answer", message_type=MessageType.TEXT.value,
                #                              status=ComponentStatus.FINISHED.value)
                #     yield output

        else:
            raise Exception(
                "该流程缺少对话节点，请设置对话节点.")

    def run_answer(self, ans, **kwargs):
        if kwargs.get("stream"):
            assert isinstance(ans, partial)
            output = None
            for an in ans():
                if isinstance(an, AgentOutput):
                    yield an
                else:
                    output = ComponentOutput(content=an,
                                             component_class="Answer",
                                             component_name="Answer", message_type=MessageType.TEXT.value,
                                             status=ComponentStatus.FINISHED.value)

                    yield output

            if output:  # 将上游节点设为finished并且打印answer最后一条finished消息
                upstream_id = output.content["upstream_id"] if isinstance(output.content, dict) else ""
                upstream_stream = output.content["stream"] if isinstance(output.content, dict) else ""
                if upstream_id:
                    component_name = self.get_component_name(upstream_id)
                    show_progress = self.get_show_progress(upstream_id)
                    show_text = self.get_show_text(upstream_id)
                    cpn = self.components[upstream_id]["obj"]
                    upstream_output = self.get_component_output(cpn.get_output_value(), component_name,
                                                                kwargs.get("stream"),
                                                                show_progress=show_progress,
                                                                show_text=show_text,
                                                                component=cpn)
                    if upstream_stream:
                        upstream_output.status = ComponentStatus.FINISHED.value

        else:
            output = ComponentOutput(content=ans,
                                     component_class="Answer",
                                     component_name="Answer", message_type=MessageType.TEXT.value,
                                     status=ComponentStatus.FINISHED.value)
            yield output

    def get_component_output(self, ans, component_name, stream, show_progress: bool = True, show_text: bool = True,
                             component=None):
        cpn = component
        if isinstance(ans, partial):
            if stream:
                assert isinstance(ans, partial)
                downstream = []
                for component_id in cpn._canvas.components:
                    if component_id == cpn._id:
                        downstream = cpn._canvas.components[component_id]["downstream"]
                        break

                status = ComponentStatus.FINISHED.value
                for downstream_id in downstream:
                    if "Answer" in downstream_id:
                        # status = ComponentStatus.RUNNING.value
                        break;
                return ComponentOutput(content=str(ans),
                                       component_name=component_name,
                                       component_class=cpn.component_name,
                                       message_type=MessageType.TEXT.value,
                                       status=status, show_progress=show_progress, show_text=show_text,
                                       logs=cpn._param.logs,
                                       start_time=cpn._param.start_time, end_time=cpn._param.end_time,
                                       duration=cpn._param.duration)
                # for an in ans():
                #     return ComponentOutput(content=str(an),
                #                            component_name=component_name,
                #                            component_class=cpn.component_name,
                #                            message_type=MessageType.TEXT.value,
                #                            status=ComponentStatus.FINISHED.value, show_progress=show_progress,
                #                            logs=cpn._param.logs,
                #                            start_time=cpn._param.start_time, end_time=cpn._param.end_time,
                #                            duration=cpn._param.duration)
            else:
                content = ans
                return ComponentOutput(content=content,
                                       component_name=component_name,
                                       component_class=cpn.component_name,
                                       message_type=MessageType.TEXT.value,
                                       status=ComponentStatus.FINISHED.value, show_progress=show_progress,
                                       show_text=show_text,
                                       logs=cpn._param.logs,
                                       start_time=cpn._param.start_time, end_time=cpn._param.end_time,
                                       duration=cpn._param.duration)
        elif isinstance(ans, DataFrame):
            content = "\n".join(ans["content"]) if "content" in ans else ""
            reference = ans["reference"] if "reference" in ans else {}
            if isinstance(reference, Series):
                reference = reference.to_dict()[0] if reference.to_dict() else {}
            return ComponentOutput(content=content,
                                   reference=reference,
                                   component_name=component_name,
                                   component_class=cpn.component_name,
                                   message_type=MessageType.TEXT.value,
                                   status=ComponentStatus.STOPPED.value if "stopped" in ans and ans[
                                       "stopped"].bool() else ComponentStatus.FINISHED.value,
                                   show_progress=show_progress, show_text=show_text,
                                   logs=cpn._param.logs,
                                   start_time=cpn._param.start_time, end_time=cpn._param.end_time,
                                   duration=cpn._param.duration)

        elif isinstance(ans, AgentOutput):
            return ans
        else:
            content = ans
            return ComponentOutput(content=content,
                                   component_name=component_name,
                                   component_class=cpn.component_name,
                                   message_type=MessageType.TEXT.value,
                                   status=ComponentStatus.FINISHED.value, show_progress=show_progress,
                                   show_text=show_text,
                                   logs=cpn._param.logs,
                                   start_time=cpn._param.start_time, end_time=cpn._param.end_time,
                                   duration=cpn._param.duration)

    def get_component(self, cpn_id):
        return self.components[cpn_id]

    def get_tenant_id(self):
        return self._tenant_id

    def get_history(self, window_size):
        convs = []
        if window_size <= 0:
            return convs
        for role, obj in self.history[window_size * -1:]:
            if isinstance(obj, list) and obj and all([isinstance(o, dict) for o in obj]):
                convs.append({"role": role, "content": '\n'.join([str(s.get("content", "")) for s in obj])})
            else:
                convs.append({"role": role, "content": str(obj)})

        return convs

    def add_user_input(self, question):
        self.history.append(("user", question))

    def set_embedding_model(self, embed_id):
        self._embed_id = embed_id

    def get_embedding_model(self):
        return self._embed_id

    def _find_loop(self, max_loops=6):
        path = self.path[-1][::-1]
        if len(path) < 2:
            return False

        for i in range(len(path)):
            if path[i].lower().find("answer") == 0 or path[i].lower().find("iterationitem") == 0:
                path = path[:i]
                break

        if len(path) < 2:
            return False

        for loc in range(2, len(path) // 2):
            pat = ",".join(path[0:loc])
            path_str = ",".join(path)
            if len(pat) >= len(path_str):
                return False
            loop = max_loops
            while path_str.find(pat) == 0 and loop >= 0:
                loop -= 1
                if len(pat) + 1 >= len(path_str):
                    return False
                path_str = path_str[len(pat) + 1:]
            if loop < 0:
                pat = " => ".join([p.split(":")[0] for p in path[0:loc]])
                return pat + " => " + pat

        return False

    def get_prologue(self):
        return self.components["begin"]["obj"]._param.prologue

    def set_global_param(self, **kwargs):
        for k, v in kwargs.items():
            for q in self.components["begin"]["obj"]._param.query:
                if k != q["key"]:
                    continue
                q["value"] = v

    def get_preset_param(self):
        return self.components["begin"]["obj"]._param.query

    def get_component_input_elements(self, cpnnm):
        return self.components[cpnnm]["obj"].get_input_elements()

    def set_component_infor(self, cpn_id, infor):
        self.components[cpn_id]["obj"].set_infor(infor)

    def get_component_obj(self, cpn_id) -> ComponentBase:
        return self.components.get(cpn_id)["obj"]

    def get_component_type(self, cpn_id) -> str:
        return self.components.get(cpn_id)["obj"].component_name

    def is_reff(self, exp: str) -> bool:
        exp = exp.strip("{").strip("}")
        if exp.find("@") < 0:
            return exp in self.globals  # 依赖全局变量
        arr = exp.split("@")
        if len(arr) != 2:
            return False
        if self.get_component(arr[0]) is None:
            return False
        return True

    # 获取全局变量
    def get_global_value(self, exp, default=None):
        exp = exp.strip("{").strip("}").strip(" ").strip("{").strip("}")
        if exp in self.globals:
            return self.globals[exp]
        return default
