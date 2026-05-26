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
import json
from abc import ABC
import pandas as pd
from .base import ComponentBase, ComponentParamBase
import logging


class IterationItemParam(ComponentParamBase):
    """
    Define the IterationItem component parameters.
    """

    def check(self):
        return True


class IterationItem(ComponentBase, ABC):
    component_name = "IterationItem"

    def __init__(self, canvas, id, param: ComponentParamBase):
        super().__init__(canvas, id, param)
        self._idx = 0
        self.parallel = False  # 并行执行
        self.thread_max = 5  # 最大线程数

    def _run(self, history, **kwargs):
        parent = self.get_parent()
        ans = parent.get_input()
        self.parallel = parent._param.parallel
        self.thread_max = parent._param.thread_max
        if parent._param.delimiter == "fileList":
            file_list = []  # 文件列表处理
            for content in ans["content"]:
                if isinstance(content, str):
                    file_list.extend(json.loads(content))
                if isinstance(content, list):
                    file_list.extend(content)
                if isinstance(content, dict):
                    file_list.append(json.loads(content))
            if self.parallel:
                ans = json.dumps(file_list)
            else:
                ans = [json.dumps(x, ensure_ascii=False) if not isinstance(x, str) else x for x in file_list]
        else:
            ans = parent._param.delimiter.join(ans["content"]) if "content" in ans else ""
            ans = [a.strip() for a in ans.split(parent._param.delimiter)]
        if not ans:
            self._idx = -1
            return pd.DataFrame()

        if self.parallel:  # 并行执行
            df = pd.DataFrame([{"content": ans}])
            self._idx = -1
        else:
            df = pd.DataFrame([{"content": ans[self._idx]}])
            self._idx += 1
            if self._idx >= len(ans):
                self._idx = -1
        return df

    def end(self):
        return self._idx == -1

    def is_first(self):
        return self._idx == 0
