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
import re

from jinja2 import StrictUndefined
from jinja2.sandbox import SandboxedEnvironment

from .base import ComponentBase, ComponentParamBase, ComponentBaseFrontEndField


class TemplateParamFrontEndField(ComponentBaseFrontEndField):
    """
    模板转换组件参数前端控件
    """

    content = {
        "key": "content",
        "label": "模板内容",
        "type": "textarea",
        "description": "Jinja2模板内容，支持变量引用如{component_id}",
    }

    parameters = {
        "key": "parameters",
        "label": "参数列表",
        "type": "custom",
        "description": "模板中使用的参数定义",
    }


class TemplateParam(ComponentParamBase):
    """
    Define the Generate component parameters.
    """

    def __init__(self):
        super().__init__()
        self.content = ""
        self.parameters = []

    def check(self):
        self.check_empty(self.content, "[Template] Content")
        return True


class Template(ComponentBase):
    component_name = "Template"
    component_title = "模板转换"
    
    @property
    def get_dependent_components(self):
        inputs = self.get_input_elements()
        cpnts = set([i["key"] for i in inputs if i["key"].lower().find("answer") < 0 and i["key"].lower().find("begin") < 0])
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

    def _run(self, history, **kwargs):
        content = self._param.content

        self._param.inputs = []
        for para in self.get_input_elements():
            if para["key"].lower().find("begin@") == 0:
                cpn_id, key = para["key"].split("@")
                for p in self._canvas.get_component(cpn_id)["obj"]._param.query:
                    if p["key"] == key:
                        value = p.get("value", "")
                        self.make_kwargs(para, kwargs, value)
                        break
                else:
                    assert False, f"Can't find parameter '{key}' for {cpn_id}"
                continue

            if para["key"].startswith("sys."):
                global_value = self._canvas.get_global_value(para["key"])
                if global_value:
                    if "sys.files" == para["key"]:
                        file_content = "----\n".join(global_value)
                        self.make_kwargs(para, kwargs, file_content)
                    else:
                        self.make_kwargs(para, kwargs, global_value)
                continue

            component_id = para["key"]
            cpn = self._canvas.get_component(component_id)["obj"]
            if cpn.component_name.lower() == "answer":
                hist = self._canvas.get_history(1)
                if hist:
                    hist = hist[0]["content"]
                else:
                    hist = ""
                self.make_kwargs(para, kwargs, hist)
                continue

            _, out = cpn.output(allow_partial=False)

            result = ""
            if "content" in out.columns:
                result = "\n".join([o if isinstance(o, str) else str(o) for o in out["content"]])

            self.make_kwargs(para, kwargs, result)

        #template = Jinja2Template(content)
        env = SandboxedEnvironment(
            autoescape=True,
            undefined=StrictUndefined,
        )
        template = env.from_string(content)

        try:
            content = template.render(kwargs)
        except Exception:
            pass

        for n, v in kwargs.items():
            if not isinstance(v, str):
                try:
                    v = json.dumps(v, ensure_ascii=False)
                except Exception:
                    pass
            # content = re.sub(
            #     r"\{%s\}" % re.escape(n), v, content
            # )
            # content = re.sub(
            #     r"(#+)", r" \1 ", content
            # )
            # Process backslashes in strings, Use Lambda function to avoid escape issues
            if isinstance(v, str):
                v = v.replace("\\", "\\\\")
            content = re.sub(r"\{%s\}" % re.escape(n), lambda match: v, content)
            #content = re.sub(r"(#+)", r" \1 ", content)

        return Template.be_output(content)

    def make_kwargs(self, para, kwargs, value):
        # self._param.inputs.append(
        #     {"component_id": para["key"], "content": value}
        # )
        self._param.inputs.append({"component_id": para["key"], "content": value})
        try:
            value = json.loads(value)
        except Exception:
            pass
        kwargs[para["key"]] = value
