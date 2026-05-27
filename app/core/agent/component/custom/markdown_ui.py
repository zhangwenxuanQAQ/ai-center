# Author: zwx
# Date: 2025/9/29 16:55
# Description: Markdown UI 组件  https://markdown-ui-demo.blueprintlab.io/
import json
import time
from abc import ABC
from functools import partial

import pandas as pd

from .. import GenerateParam, Generate
from agent.prompt_template import markdown_ui_system_prompt_template
from app.core.knowledgebase.rag.prompts.generator import message_fit_in
from app.core.llm_model.utils.model_caller import ModelCaller


class MarkdownUIParam(GenerateParam):

    def __init__(self):
        super().__init__()
        self.temperature = 0.6
        self.top_p = 0.5
        self.prompt = markdown_ui_system_prompt_template
        self.type = "text-input"  # ui组件类型

    def check(self):
        pass


class MarkdownUI(Generate, ABC):
    component_name = "MarkdownUI"
    component_title = "Markdown UI "

    # def get_dependent_components(self):
    #     cpnts = set([para["component_id"] for para in self._param.begin_params \
    #                  if para.get("component_id") \
    #                  and para["component_id"].lower().find("answer") < 0 \
    #                  and para["component_id"].lower().find("begin") < 0])
    #     return list(cpnts)

    def reset(self, **kwargs):
        super().reset()

    def _run(self, history, **kwargs):

        query = self.get_input()  # 输入
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()
        # TODO 根据配置进一步处理用户输入
        user_prompt = self.get_user_prompt(query)

        chat_mdl = ModelCaller.get_chat_model(self._param.llm_id)  # 使用默认模型
        system_prompt = self._param.prompt

        # 历史问答
        msgs = self._canvas.get_history(self._param.message_history_window_size)
        if msgs and msgs[0]['role'] == 'assistant':
            msgs.pop(0)
        if len(msgs) < 1:
            msgs.append({'role': 'user', 'content': query})

        user_input = msgs[-1]["content"]
        msgs[-1]["content"] = user_input + "\n\n" + user_prompt

        messages = [*msgs]

        _, messages = message_fit_in([{"role": "system", "content": system_prompt}, *messages],
                                     int(chat_mdl.max_length * 0.97))

        downstreams = self._canvas.get_component(self._id)["downstream"]
        if self._param.stream and kwargs.get("stream") and len(downstreams) == 1 and \
                self._canvas.get_component(downstreams[0])[
                    "obj"].component_name.lower() == "answer":
            return partial(self.stream_markdown_ui, chat_mdl, messages)

        # 如果下游有结果输出节点
        component_answer_downstream = [x for x in downstreams if "ComponentAnswer" in x]
        if kwargs.get("stream") and len(component_answer_downstream) > 0:
            return partial(self.stream_markdown_ui, chat_mdl, messages)

        ans = chat_mdl.chat(messages[0]["content"], messages[1:], self._param.gen_conf())

        self._canvas.set_component_infor(self._id, {"prompt": messages[0]["content"], "messages": messages[1:],
                                                    "conf": self._param.gen_conf()})

        return MarkdownUI.be_output(ans)

    def get_user_prompt(self, query):
        prompt_contents = []
        prompt_contents.append(query)
        prompt_contents.append(f"\n\n请根据上信息生成{self._param.type}")
        return "\n".join(prompt_contents)

    def stream_markdown_ui(self, chat_mdl, messages):
        self.set_start_time(time.time())
        res = None
        for ans in chat_mdl.chat_streamly(messages[0]["content"], messages[1:], self._param.gen_conf()):
            res = {"content": ans, "reference": []}
            yield res

        self._canvas.set_component_infor(self._id, {"prompt": messages[0]["content"], "messages": messages[1:],
                                                    "conf": self._param.gen_conf()})
        self.set_end_time_and_append_log(time.time())  # 添加结束时间
        self.set_output(MarkdownUI.be_output(res))

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

    def stream_output(self, query, conversation_id, message_id, tenant_id, dsl):
        self.run_agent(query, conversation_id, message_id, tenant_id, dsl)

    def debug(self, **kwargs):
        return self._run([], **kwargs)
