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
import copy
import json
import re
import time
from abc import ABC
from functools import partial

import pandas as pd

from ..base import ComponentBase, ComponentParamBase
from api.model.agent_output import AgentOutput


class ComponentAnswerParam(ComponentParamBase):

    def __init__(self):
        super().__init__()
        self.stream = True  # 是否支持流式
        self.content = ""  # 指定输出内容（可关联其他组件以及固定文本）

    def check(self):
        self.check_empty(self.content, "未配置输出内容")


class ComponentAnswer(ComponentBase, ABC):
    """
    组件结果输出
    """
    component_name = "ComponentAnswer"
    component_title = "组件结果输出"

    def get_dependent_components(self):
        inputs = self.get_input_elements()
        cpnts = set(
            [i["key"] for i in inputs if
             i["key"].lower().find("answer") < 0 and i["key"].lower() !="begin" and i["key"].lower().find(
                 "sys.") < 0])
        return list(cpnts)

    def get_input_elements(self):
        key_set = set([])
        res = []
        for r in re.finditer(r"\{([a-z0-9]+[:@.][a-z0-9_-]+)\}", self._param.content, flags=re.IGNORECASE):
            cpn_id = r.group(1)
            if cpn_id in key_set:
                continue
            if cpn_id.lower().find("begin@") == 0:
                cpn_id, key = cpn_id.split("@")
                for p in self._canvas.get_component(cpn_id)["obj"]._param.query:
                    if p["key"] != key:
                        continue
                    res.append({"key": r.group(1), "name": p["name"]})
                    key_set.add(r.group(1))
                continue
            if cpn_id.startswith("sys."):
                res.append({"key": cpn_id, "name": cpn_id})
                key_set.add(cpn_id)
                continue
            cpn_nm = self._canvas.get_component_name(cpn_id)
            if not cpn_nm:
                continue
            res.append({"key": cpn_id, "name": cpn_nm})
            key_set.add(cpn_id)
        return res

    def get_input_content_list(self):
        content = self._param.content
        input_list = []
        left = 0
        fixed_text = ""
        # 从左向右遍历content，将依赖组件id和固定字符提取出来。 组件id格式是 {componentClass:ComponentName}
        for i in range(len(content)):
            fixed_text = content[left:i + 1]
            match = re.search(r"\{([a-z0-9]+[:@.][a-z0-9_-]+)\}", fixed_text, flags=re.IGNORECASE)
            if match:
                start_index = match.start()
                end_index = match.end()
                if start_index > 0:
                    input_list.append({"key": fixed_text[left:start_index], "type": "str"})
                component_id = fixed_text[start_index:].replace("{", "").replace("}", "")
                input_list.append({"key": component_id, "type": "component_id"})
                left = end_index
                fixed_text = ""
        if fixed_text:
            input_list.append({"key": fixed_text, "type": "str"})
        return input_list

    def _run(self, history, **kwargs):
        content = self._param.content
        input_content_list = self.get_input_content_list()
        if self._param.stream:
            return partial(self.stream_output, input_content_list, **kwargs)

        all_res = []
        for para in input_content_list:
            type = para["type"]
            key = para["key"]
            if type == "str":  # 固定字符串
                all_res.append(key)
            if type == "component_id":  # 组件依赖
                component_id = key
                if component_id.lower().find("begin@") == 0:
                    cpn_id, key = para["key"].split("@")
                    for p in self._canvas.get_component(cpn_id)["obj"]._param.query:
                        if p["key"] == key:
                            value = p.get("value", "")
                            self.make_kwargs(para, kwargs, value)
                            all_res.append(kwargs[para["key"]])
                            break
                    else:
                        assert False, f"Can't find parameter '{key}' for {cpn_id}"
                    continue
                if component_id.startswith("sys."):
                    global_value = self._canvas.get_global_value(component_id)
                    if global_value:
                        if "sys.files" == para["key"]:
                            file_content = "----\n".join(global_value)
                            self.make_kwargs(para, kwargs, file_content)
                        else:
                            self.make_kwargs(para, kwargs, global_value)
                        all_res.append(kwargs[para["key"]])
                    continue
                cpn = self._canvas.get_component(component_id)["obj"]
                if cpn.component_name.lower() == "answer":
                    hist = self._canvas.get_history(1)
                    if hist:
                        hist = hist[0]["content"]
                    else:
                        hist = ""
                    self.make_kwargs(para, kwargs, hist)
                    all_res.append(kwargs[para["key"]])
                    continue

                _, out = cpn.output(allow_partial=False)  # 依赖的组件输出
                if isinstance(out, pd.DataFrame):
                    tmp_content = ""
                    for ii, row in out.iterrows():
                        c = row.to_dict()["content"]
                        content = c if isinstance(c, str) else c["content"] if isinstance(c, dict) else str(c)
                        tmp_content += content
                    all_res.append(tmp_content)
                else:
                    stream = out
                    res = None
                    answer = ""
                    for st in stream():
                        res = st
                        if isinstance(st, AgentOutput):
                            res = {"content": res.data.answer, "stream": True, "upstream_id": component_id}
                        if isinstance(st, dict):
                            st["stream"] = True
                            st["upstream_id"] = component_id
                        if isinstance(st, pd.DataFrame):
                            tmp_content = ""
                            for ii, row in res.iterrows():
                                c = row.to_dict()["content"]
                                content = c if isinstance(c, str) else c["content"] if isinstance(c, dict) else str(c)
                                tmp_content += content
                            res = {"content": tmp_content, "stream": True, "upstream_id": component_id}
                        answer += res["content"]
                    all_res.append(answer)

        final_answer = "".join(all_res)
        return ComponentAnswer.be_output(final_answer)

    def stream_output(self, input_content_list, **kwargs):
        self.set_start_time(time.time())
        all_res = []
        answer = ""
        for para in input_content_list:
            type = para["type"]
            key = para["key"]
            if type == "str":  # 固定字符串
                answer += key
                all_res.append(key)
                yield {"content": answer, "stream": True}
            if type == "component_id":  # 组件依赖
                component_id = key
                if component_id.lower().find("begin@") == 0:
                    cpn_id, key = para["key"].split("@")
                    for p in self._canvas.get_component(cpn_id)["obj"]._param.query:
                        if p["key"] == key:
                            value = p.get("value", "")
                            self.make_kwargs(para, kwargs, value)
                            answer += value
                            yield {"content": answer, "stream": True, "upstream_id": component_id}
                            all_res.append(kwargs[para["key"]])
                            break
                    else:
                        assert False, f"Can't find parameter '{key}' for {cpn_id}"
                    continue
                if component_id.startswith("sys."):
                    global_value = self._canvas.get_global_value(component_id)
                    if global_value:
                        if "sys.files" == para["key"]:
                            file_content = "----\n".join(global_value)
                            self.make_kwargs(para, kwargs, file_content)
                        else:
                            self.make_kwargs(para, kwargs, global_value)
                        all_res.append(kwargs[para["key"]])
                    continue

                cpn = self._canvas.get_component(component_id)["obj"]
                if cpn.component_name.lower() == "answer":
                    hist = self._canvas.get_history(1)
                    if hist:
                        hist = hist[0]["content"]
                    else:
                        hist = ""
                    self.make_kwargs(para, kwargs, hist)
                    answer += value
                    yield {"content": answer, "stream": True, "upstream_id": component_id}
                    all_res.append(kwargs[para["key"]])
                    continue

                _, out = cpn.output(allow_partial=True)  # 依赖的组件输出
                if isinstance(out, pd.DataFrame):
                    tmp_content = ""
                    for ii, row in out.iterrows():
                        c = row.to_dict()["content"]
                        content = c if isinstance(c, str) else c["content"] if isinstance(c, dict) else str(c)
                        tmp_content += content
                    answer += tmp_content
                    yield {"content": answer, "stream": True, "upstream_id": component_id}
                    all_res.append(tmp_content)
                else:
                    stream = out
                    res = None
                    tmp_answer = answer
                    for st in stream():
                        res = st
                        if isinstance(st, AgentOutput):
                            #st.data.upstream_id = component_id
                            yield res
                            continue
                        if isinstance(st, dict):
                            st["stream"] = True
                            st["upstream_id"] = component_id
                        if isinstance(res, pd.DataFrame):
                            tmp_content = ""
                            for ii, row in res.iterrows():
                                c = row.to_dict()["content"]
                                content = c if isinstance(c, str) else c["content"] if isinstance(c, dict) else str(c)
                                tmp_content += content
                            res = {"content": tmp_content, "stream": True, "upstream_id": component_id}
                        tmp_answer = res["content"]
                        res["content"] = answer + tmp_answer
                        yield res
                    if isinstance(res, dict):
                        yield res
                        all_res.append(res["content"])
                    if isinstance(res, AgentOutput):
                        all_res.append(res.data.answer)

        final_answer = "".join(all_res)
        yield {"content": final_answer, "stream": True, "upstream_id": component_id, "is_last": True}
        self.set_end_time_and_append_log(time.time())  # 添加结束时间
        self.set_output(ComponentAnswer.be_output(final_answer))

    def make_kwargs(self, para, kwargs, value):
        tmp_value = value
        if isinstance(value, dict) or isinstance(value, list):
            tmp_value = copy.deepcopy(value)
            if para.get("type") == "file" and isinstance(value, dict):
                tmp_value.pop("base64_data", None)
                tmp_value.pop("thumbnail", None)
            if para.get("type") == "file" and isinstance(value, list):
                for v in tmp_value:
                    v.pop("base64_data", None)
                    v.pop("thumbnail", None)

        self._param.inputs.append({"component_id": para["key"], "content": tmp_value})
        try:
            tmp_value = json.loads(tmp_value)
        except Exception:
            pass
        kwargs[para["key"]] = tmp_value

    def set_exception(self, e):
        self.exception = e
