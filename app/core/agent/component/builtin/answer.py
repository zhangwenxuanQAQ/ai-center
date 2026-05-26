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
import random
from abc import ABC
from functools import partial
from typing import Tuple, Union
import time

import pandas as pd

from ..base import ComponentBase, ComponentParamBase

try:
    from api.model.agent_output import AgentOutput
except ImportError:
    class AgentOutput:
        pass


class AnswerParam(ComponentParamBase):
    """
    Define the Answer component parameters.
    """

    def __init__(self):
        super().__init__()
        self.post_answers = []
        self.upstream_order = []  # 上游节点顺序

    def check(self):
        return True


class Answer(ComponentBase, ABC):
    component_name = "Answer"
    component_title = "回答"

    def _run(self, history, **kwargs):
        if kwargs.get("stream"):
            return partial(self.stream_output)

        ans = self.get_input()
        if self._param.post_answers:
            ans = pd.concat([ans, pd.DataFrame([{"content": random.choice(self._param.post_answers)}])],
                            ignore_index=False)
        return ans

    def stream_output(self):
        if self._id == "AgentInstance:DullYaksServe":
            print("DullYaksServe")
        self.set_start_time(time.time())
        res = None
        if hasattr(self, "exception") and self.exception:
            res = {"content": str(self.exception)}
            self.exception = None
            yield res
            self.set_output(res)
            return
        # TODO answer多个上游一起输出
        all_res = []
        streams_map = self.get_upstream_output_map()
        # 根据upstream_order重新排序输出
        upstream_order = self._param.upstream_order if self._param.upstream_order else []  # 上游节点顺序
        ordered_streams_map = {}
        for cpn_name in upstream_order:
            if cpn_name in streams_map:
                ordered_streams_map[cpn_name] = streams_map[cpn_name]
                del streams_map[cpn_name]
        ordered_streams_map.update(streams_map)

        for key, stream in ordered_streams_map.items():
            answer_content = None
            res = None
            if isinstance(stream, pd.DataFrame):
                res = stream
                answer = ""
                for ii, row in stream.iterrows():
                    c = row.to_dict()["content"]
                    content = c if isinstance(c, str) else c["content"] if isinstance(c, dict) else str(c)
                    answer += content
                yield {"content": answer, "stream": False, "upstream_id": key}
                answer_content = {"content": answer, "stream": False, "upstream_id": key}
            else:
                stream_start = False
                for st in stream():
                    res = st
                    if isinstance(st, AgentOutput):
                        #st.data.upstream_id = key
                        pass
                    if isinstance(st, dict):
                        st["stream"] = True
                        st["upstream_id"] = key
                        if not stream_start:  # 标记流式数据第一条
                            st["stream_status"] = "start" if "stream_status" not in res else res["stream_status"]
                            stream_start = True
                        else:
                            st["stream_status"] = "" if "stream_status" not in res else res["stream_status"]
                    yield st
                if isinstance(res, dict):
                    answer_content = res
                if isinstance(res, pd.DataFrame):
                    answer = ""
                    for ii, row in res.iterrows():
                        c = row.to_dict()["content"]
                        content = c if isinstance(c, str) else c["content"] if isinstance(c, dict) else str(c)
                        answer += content
                    answer_content = {"content": answer, "stream": True, "upstream_id": key}

            if self._param.post_answers:
                res["content"] += random.choice(self._param.post_answers)
                res["upstream_id"] = key
                yield res
            all_res.append(answer_content)

        self.set_end_time_and_append_log(time.time())  # 添加结束时间
        self.set_output(all_res)
        # 多个返回结束

        # 单个返回暂时停用
        # stream = self.get_stream_input()
        # if isinstance(stream, pd.DataFrame):
        #     res = stream
        #     answer = ""
        #     for ii, row in stream.iterrows():
        #         answer += row.to_dict()["content"]
        #         yield {"content": answer}
        # else:
        #     for st in stream():
        #         res = st
        #         yield st
        # if self._param.post_answers:
        #     res["content"] += random.choice(self._param.post_answers)
        #     yield res
        #
        # self.set_output(res)

    def set_exception(self, e):
        self.exception = e

    def output(self, allow_partial=True) -> Tuple[str, Union[pd.DataFrame, partial]]:
        if allow_partial:
            return super.output()

        for r, c in self._canvas.history[::-1]:
            if r == "user":
                return self._param.output_var_name, pd.DataFrame([{"content": c}])

        self._param.output_var_name, pd.DataFrame([])
