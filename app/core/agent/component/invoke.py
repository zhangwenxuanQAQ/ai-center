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
from abc import ABC
import requests
from app.core.knowledgebase.deepdoc.parser import HtmlParser
from .base import ComponentBase, ComponentParamBase, ComponentBaseFrontEndField


class InvokeParamFrontEndField(ComponentBaseFrontEndField):
    """
    接口调用组件参数前端控件
    """

    url = {
        "key": "url",
        "label": "接口地址",
        "type": "text",
        "description": "API接口URL地址",
    }

    method = {
        "key": "method",
        "label": "请求方法",
        "type": "select",
        "description": "HTTP请求方法：get、post、put",
        "defaultValue": "get",
    }

    headers = {
        "key": "headers",
        "label": "请求头",
        "type": "textarea",
        "description": "HTTP请求头JSON格式",
    }

    variables = {
        "key": "variables",
        "label": "请求参数",
        "type": "custom",
        "description": "接口请求参数配置",
    }

    timeout = {
        "key": "timeout",
        "label": "超时时间(秒)",
        "type": "number",
        "description": "请求超时时间",
        "defaultValue": 60,
    }

    clean_html = {
        "key": "clean_html",
        "label": "清理HTML",
        "type": "boolean",
        "description": "是否清理HTML标签只保留正文",
        "defaultValue": False,
    }

    datatype = {
        "key": "datatype",
        "label": "数据类型",
        "type": "select",
        "description": "POST/PUT请求数据格式：json或formdata",
        "defaultValue": "json",
    }

    proxy = {
        "key": "proxy",
        "label": "代理地址",
        "type": "text",
        "description": "HTTP代理服务器地址",
    }


class InvokeParam(ComponentParamBase):
    """
    Define the Crawler component parameters.
    """

    def __init__(self):
        super().__init__()
        self.proxy = None
        self.headers = ""
        self.method = "get"
        self.variables = []
        self.url = ""
        self.timeout = 60
        self.clean_html = False
        self.datatype = "json"  # New parameter to determine data posting type

    def check(self):
        self.check_valid_value(self.method.lower(), "Type of content from the crawler", ['get', 'post', 'put'])
        self.check_empty(self.url, "End point URL")
        self.check_positive_integer(self.timeout, "Timeout time in second")
        self.check_boolean(self.clean_html, "Clean HTML")
        self.check_valid_value(self.datatype.lower(), "Data post type", ['json', 'formdata'])  # Check for valid datapost value


class Invoke(ComponentBase, ABC):
    component_name = "Invoke"
    component_title = "接口调用"


    def _run(self, history, **kwargs):
        args = {}
        for para in self._param.variables:
            if para.get("component_id"):
                if '@' in para["component_id"]:
                    component = para["component_id"].split('@')[0]
                    field = para["component_id"].split('@')[1]
                    cpn = self._canvas.get_component(component)["obj"]
                    for param in cpn._param.query:
                        if param["key"] == field:
                            if "value" in param:
                                args[para["key"]] = param["value"]
                else:
                    cpn = self._canvas.get_component(para["component_id"])["obj"]
                    if cpn.component_name.lower() == "answer":
                        args[para["key"]] = self._canvas.get_history(1)[0]["content"]
                        continue
                    _, out = cpn.output(allow_partial=False)
                    if not out.empty:
                        args[para["key"]] = "\n".join(out["content"])
            else:
                args[para["key"]] = para["value"]

        url = self._param.url.strip()

        #path param替换
        for key in args:
            path_arg = "{"+key+"}"
            if url.find(path_arg) !=0:
                url = url.replace(path_arg, args[key])


        if url.find("http") != 0:
            url = "http://" + url

        method = self._param.method.lower()
        headers = {}
        if self._param.headers:
            headers = json.loads(self._param.headers)
        proxies = None
        if re.sub(r"https?:?/?/?", "", self._param.proxy):
            proxies = {"http": self._param.proxy, "https": self._param.proxy}

        if method == 'get':
            response = requests.get(url=url,
                                    params=args,
                                    headers=headers,
                                    proxies=proxies,
                                    timeout=self._param.timeout)
            if self._param.clean_html:
                sections = HtmlParser()(None, response.content)
                return Invoke.be_output("\n".join(sections))

            return Invoke.be_output(response.text)

        if method == 'put':
            if self._param.datatype.lower() == 'json':
                response = requests.put(url=url,
                                        json=args,
                                        headers=headers,
                                        proxies=proxies,
                                        timeout=self._param.timeout)
            else:
                response = requests.put(url=url,
                                        data=args,
                                        headers=headers,
                                        proxies=proxies,
                                        timeout=self._param.timeout)
            if self._param.clean_html:
                sections = HtmlParser()(None, response.content)
                return Invoke.be_output("\n".join(sections))
            return Invoke.be_output(response.text)

        if method == 'post':
            if self._param.datatype.lower() == 'json':
                response = requests.post(url=url,
                                         json=args,
                                         headers=headers,
                                         proxies=proxies,
                                         timeout=self._param.timeout)
            else:
                response = requests.post(url=url,
                                         data=args,
                                         headers=headers,
                                         proxies=proxies,
                                         timeout=self._param.timeout)
            if self._param.clean_html:
                sections = HtmlParser()(None, response.content)
                return Invoke.be_output("\n".join(sections))
            return Invoke.be_output(response.text)
