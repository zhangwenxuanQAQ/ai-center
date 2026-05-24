# Author: zwx
# Date: 2025/4/3 16:55
# Description: code_executor 代码执行器
import copy
import importlib
import json
import logging
import time
from abc import ABC

import pandas as pd
from pandas import DataFrame
import jsonpath

from agent.component.base import ComponentBase, ComponentParamBase


class CodeExecutorParam(ComponentParamBase):

    def __init__(self):
        super().__init__()
        self.language = "python"  # 语言，暂时支持python和javascript
        self.code = "def main():\n\treturn ''"  # 代码
        self.input_params = []  # 入参 {name:参数名 , from: input或reference ,component_id:依赖组件id ,value:参数值,datatype:数据类型}
        self.output_params = []  # 输出参数{name:参数名,datatype:数据类型} , 为空的话则直接返回代码执行结果字符串
        # datatype:数据类型 number/string/object/array/boolean
        self.error_handle = "throw_exception"  # 错误处理 pass不处理输入的原值返回 , throw_exception 抛异常中断流程

    def check(self):
        self.check_empty(self.language, "未选择语言")
        self.check_empty(self.code, "代码为空")


class CodeExecutor(ComponentBase, ABC):
    component_name = "CodeExecutor"

    def get_dependent_components(self):
        cpnts = set([para["component_id"] for para in self._param.input_params \
                     if para.get("component_id") \
                     and para["component_id"].lower().find("answer") < 0 \
                     and para["component_id"].lower().find("begin@") < 0 and para["component_id"].lower().find("sys.") < 0])
        return list(cpnts)

    def _run(self, history, **kwargs):
        start = time.time()
        component_name = self.get_component_node_name()
        # query_input = self.get_input()  # 当前问题
        if self._param.code:
            code = self._param.code
            language = self._param.language
            self._param.inputs = []
            input_params_values = self.get_input_params_values()
            output_params = self._param.output_params
            logging.info(f"执行代码{code},语言：{language}")
            logging.info(f"入参：{input_params_values}")
            self.append_log(f"入参：{input_params_values}")
            try:
                value = ""
                if self._param.language == "python":
                    res = self.exec_python(code, input_params_values)
                    value = self.get_exec_output_value(res, output_params)
                elif self._param.language == "javascript":
                    # res = self.exec_python(code, input_params_values)
                    # value = self.get_exec_output_value(res, output_params)
                    pass
                else:
                    raise Exception(f"不支持语言：{language}")

                # 转换为字符串
                try:
                    if isinstance(value, dict) or isinstance(value, list):
                        value = json.dumps(value, ensure_ascii=False)
                    else:
                        value = str(value) if not isinstance(value, str) else value
                except:
                    value = str(value) if not isinstance(value, str) else value
                return CodeExecutor.be_output(value)
            except Exception as e:
                logging.error(f"{component_name}代码执行异常：{str(e)}")
                self.append_log(f"{component_name}代码执行异常：{str(e)}")
                if self._param.error_handle == "throw_exception":  # 如果错误处理throw_exception则中断流程
                    raise Exception(f"{component_name}代码执行异常：{str(e)}")
                    #return pd.DataFrame([{"content": f"{component_name}代码执行异常：{str(e)}", "stopped": True}])
                else:
                    return pd.DataFrame([{"content": f"{str(e)}"}])

        return pd.DataFrame([{"content": ""}])

    # 解析输出
    def get_exec_output_value(self, value, output_params=[]):
        if not value:
            return value
        if output_params:
            if isinstance(output_params, list) or isinstance(output_params, dict):
                out = []
                for params in output_params:
                    key = params["name"]
                    found_values = jsonpath.jsonpath(value, f"$.{key}")
                    output_value = found_values[0] if len(found_values) > 0 else ""
                    output_value = self.parse_value_from_datatype(output_value, params["datatype"])
                    out.append(output_value)
                return '\n'.join(out)
            else:
                return value
        return value

    # 执行python代码
    def exec_python(self, code: str, input_params_values: dict = {}):

        # 限制import
        def safe_import(name, *args, **kwargs):
            # 禁止导入危险模块
            blocked_modules = {"os", "sys", "subprocess", "shutil"}
            if name in blocked_modules:
                raise ImportError(f"模块 {name} 被禁止使用")
            return importlib.import_module(name)

        # 将安全的import添加到local变量
        import builtins
        builtins_copy = {}
        for k in builtins.__dict__:
            if k not in {"compile", "open"}:
                builtins_copy[k] = builtins.__dict__[k]
        exec_locals = {'__builtins__': builtins_copy, "__import__": safe_import}

        # 执行
        exec(code, {}, exec_locals)
        # 提取动态函数并传入外部参数
        func = exec_locals["main"]
        result = func(**input_params_values)
        logging.info(f"代码执行结果：{result}")
        return result

    # 解析输入参数，返回参数名：参数值map
    def get_input_params_values(self):
        result = {}
        input_params = self._param.input_params
        if input_params:
            for params in input_params:
                if params["from"] == "input":
                    component_id = ""
                    value = params["value"]
                    result[params["name"]] = self.parse_value_from_datatype(value, params["datatype"])
                else:
                    component_id = params["component_id"]
                    value = self.get_reference_input_value(component_id)
                    if isinstance(value, DataFrame):
                        value = "\n".join(value["content"]) if "content" in value else ""
                        result[params["name"]] = self.parse_value_from_datatype(value, params["datatype"])
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

    # 根据数据类型解析值
    def parse_value_from_datatype(self, value, datatype: str = "string"):
        if value is None:
            return value
        try:
            datatype = "string" if not datatype else datatype
            if datatype == "string":
                value = str(value) if not isinstance(value, str) else value
            if datatype == "int":
                value = int(value) if not isinstance(value, int) else value
            if datatype == "float":
                value = float(value) if not isinstance(value, float) else value
            if datatype == "object" or datatype == "array":
                value = json.loads(value)
            if datatype == "boolean":
                value = bool(value) if not isinstance(value, bool) else value
        except Exception as e:
            logging.debug(f"参数值类型转换异常,value:{value},datatype:{datatype}")

        return value

    def debug(self, **kwargs):
        return self._run([], **kwargs)
