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
from functools import partial
import pandas as pd
from ..base import ComponentBase, ComponentParamBase, ComponentBaseFrontEndField


class BeginParamFrontEndField(ComponentBaseFrontEndField):
    """
    开始节点参数前端控件
    """
    prologue = {
        "key": "prologue",
        "label": "欢迎语",
        "type": "textarea",
        "description": "用户进入对话时显示的欢迎消息",
        "defaultValue": "你好！ 我是你的助理，有什么可以帮到你的吗？",
    }
    query ={
        "key": "query",
        "label": "用户变量",
        "type": "custom",
        "description": "用户变量（可上传文件，设置固定值等）",
        "defaultValue": [],
    }



class BeginParam(ComponentParamBase):
    """
    Define the Begin component parameters.
    """

    def __init__(self):
        super().__init__()
        self.prologue = "你好！ 我是你的助理，有什么可以帮到你的吗？"
        self.query = []
        # 默认系统变量
        # "sys.user_id": self._tenant_id,
        # "sys.query": “”,
        # "sys.files": [],
        # "sys.conversation_id": "",
        # "sys.message_id": "",
        self.system_params = [{"key": "sys.query", "name": "用户问题", "type": "string"},
                              {"key": "sys.files", "name": "文件信息列表（通过文件上传接口返回）", "type": "array[object]"},
                              {"key": "sys.user_id", "name": "用户id", "type": "string"},
                              {"key": "sys.conversation_id", "name": "聊天id", "type": "string"},
                              {"key": "sys.message_id", "name": "消息id", "type": "string"}]

    def check(self):
        return True


class Begin(ComponentBase):
    component_name = "Begin"
    component_title = "开始"

    def _run(self, history, **kwargs):
        if kwargs.get("stream"):
            return partial(self.stream_output)
        return pd.DataFrame([{"content": self._param.prologue}])

    def stream_output(self):
        res = {"content": self._param.prologue}
        yield res
        self.set_output(self.be_output(res))
