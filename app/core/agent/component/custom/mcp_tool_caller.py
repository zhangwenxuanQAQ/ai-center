# Author: zwx
# Date: 2025/4/3 16:55
# Description: mcp_tool mcp工具调用
import asyncio
import copy
import json
import logging
import re
import time
from abc import ABC

from pandas import DataFrame

from agent.component import GenerateParam, Generate
from api.db import LLMType, StatusEnum
from api.db.services.llm_service import LLMBundle
from api.utils.llm_util import get_llm_content, format_prompt_template
from api.utils.mcp_utils import mcp_server_test_connection, mcp_server_list_tools, mcp_server_call_tool
from rag.prompts import message_fit_in


class MCPToolCallerParam(GenerateParam):
    """
    MCP工具调用组件参数
    """

    def __init__(self):
        super().__init__()
        self.temperature = 0.1
        # self.prompt = "需求：\n\n\t\n\t- 请分析用户问题后从工具列表中选择最合适的工具，并将问题中可能存在的参数值填充到参数字段中。\n\n\t - 返回工具名称必须存在输入的工具列表中。。\n\n     - 分析用户问题后，需要根据工具名称，工具描述，工具参数名称以及工具参数描述等来选择可能的工具。\n\n     - 不要随机选择工具,当语义要求大概率满足工具功能是才选择\n\t\n\t - 以下```之间是工具列表中单个工具的标准定义json结构示例 ：\t\t\t\n\n```\n{\n\n\t\"annotations\": {\n\n\t\t\"extra_param\": {\n\n\t\t\t\"base_path\": \"/\",\n\n\t\t\t\"headers\": {\n\n\t\t\t\t\"Authorization\": \"\"\n\n\t\t\t},\n\n\t\t\t\"host\": \"172.21.84.6:9380\",\n\n\t\t\t\"method\": \"post\",\n\n\t\t\t\"path\": \"/v1/bot/config/sensitive_word/create\",\n\n\t\t\t\"scheme\": \"http\"\n\n\t\t},\n\n\t\t\"title\": \"新增敏感词\",\n\n\t\t\"type\": \"restful\",\n\n\t\t\"server_id\": \"1efb6b1e3a9e11f0a0dc005056b5d499\"\n\n\t},\n\n\t\"description\": \"新增敏感词\",\n\n\t\"inputSchema\": {\n\n\t\t\"properties\": {\n\n\t\t\t\"body\": {\n\n\t\t\t\t\"description\": \"请求体\",\n\n\t\t\t\t\"in\": \"body\",\n\n\t\t\t\t\"properties\": {\n\n\t\t\t\t\t\"bot_id\": {\n\n\t\t\t\t\t\t\"description\": \"机器人id\",\n\n\t\t\t\t\t\t\"required\": true,\n\n\t\t\t\t\t\t\"type\": \"string\"\n\n\t\t\t\t\t},\n\n\t\t\t\t\t\"category\": {\n\n\t\t\t\t\t\t\"description\": \"敏感类型\",\n\n\t\t\t\t\t\t\"type\": \"string\"\n\n\t\t\t\t\t},\n\n\t\t\t\t\t\"status\": {\n\n\t\t\t\t\t\t\"default\": \"1\",\n\n\t\t\t\t\t\t\"description\": \"状态\",\n\n\t\t\t\t\t\t\"type\": \"string\"\n\n\t\t\t\t\t},\n\n\t\t\t\t\t\"word\": {\n\n\t\t\t\t\t\t\"description\": \"词汇\",\n\n\t\t\t\t\t\t\"required\": true,\n\n\t\t\t\t\t\t\"type\": \"string\"\n\n\t\t\t\t\t}\n\n\t\t\t\t},\n\n\t\t\t\t\"type\": \"object\"\n\n\t\t\t}\n\n\t\t},\n\n\t\t\"required\": [\n\n\t\t\t\"body\"\n\n\t\t],\n\n\t\t\"type\": \"object\"\n\n\t},\n\n\t\"name\": \"post_v1_bot_config_sensitive_word_create\"\n\n}\n\n```\n\n          单个工具结构说明： name是工具唯一名称  , description是工具描述,annotations.title 是工具标题,annotations.server_id 是服务id。inputSchema是工具参数配置json。inputSchema.properties是参数字段json对象，其中key是参数名，description是参数描述，default是参数默认值， type是参数类型。\n如果参数类型是object则properties为参数对应的字段配置\n\n\t  \n\t    - 需要根据用户问题选择工具列表中最可能需要使用的单个工具\n\n        - 当获取到单个工具数据需要根据问题对参数值填充，如果解析不出参数值则使用工具参数默认值\n\n\n\n输出：\n            - 在<think> </think> 标签中展示你的思考过程，并在 <answer> </answer> 标签中返回最终答案\n\n\t\t\t- 最终答案结构必须该json结构 ： {\"name\":工具唯一名称 , \"title\":工具标题,\"server_id\":服务id, \"arguments\":{参数名:参数值}}\n\n\t\t\t- 如果没找到工具则答案返回空对象\n\n\n\n输入：\n\n\n - 以下是用户问题：\n\n   {{question}}\n\n - 以下是工具列表：\n \n   {{tools}}\n\n 以上是工具列表：\n\n"
        self.prompt = self.prompt_template()
        # self.answer_prompt = self.answer_prompt_template()
        self.answer_prompt = ""
        self.server_id = ""  # MCP服务id
        self.tool_names = []  # 工具名称列表
        self.tool_name = ""  # 指定工具名称
        self.arguments = ""  # 指定工具参数
        self.result_type = "text"  # 返回格式  text/json
        self.error_handle = "pass"  # 错误处理 pass不处理,输入原值返回 , throw_exception 抛异常中断流程
        self.file_path = ""  # 文件路径
        self.empty_response = ""

    def check(self):
        super().check()

    # 提示词模版
    @classmethod
    def prompt_template(cls):
        output_example = {"name": "工具唯一名称", "title": "工具标题", "server_id": "服务id",
                          "arguments": {"参数名": "参数值"}}

        role = "角色：你是一个问题分析专家。"
        tool_definition_example = {"name": "xxx", "title": "xxx", "server_id": "xxx", "description": "xxx",
                                   "inputSchema": {
                                       "properties": {
                                           "参数名": {"参数描述": "xxx", "参数类型": "xxx", "参数默认值": "xxx",
                                                      "properties": {}}}}}
        require_list = ["需求："]
        require_list.append("- 请分析用户问题后从工具列表中选择最合适的工具，并将问题中可能存在的参数值填充到参数字段中")
        require_list.append(
            f"- 以下```之间是工具列表中单个工具的标准定义json结构示例 ：\n ``` {json.dumps(tool_definition_example, indent=4, ensure_ascii=False)}\n ``` \n "
            f"单个工具结构说明： name是工具唯一名称, description是工具描述,title 是工具标题,server_id 是服务id。"
            f"inputSchema是工具参数配置json。required是必填参数。 inputSchema.properties是参数字段json对象， 如果参数类型是object则properties为参数对应的字段配置"
            f"opntions是参数枚举值")
        require_list.append("- 分析用户问题后，需要根据工具名称，工具描述，工具参数名称以及工具参数描述等来选择可能的工具")
        require_list.append("- 如果参数存在枚举值则需要根据用户输入从枚举值中提取参数值")
        require_list.append("- 返回工具名称必须存在输入的工具列表中")
        require_list.append("- 不要随机选择工具,当语义要求大概率满足工具功能是才选择")
        require_list.append("- 需要根据用户问题选择工具列表中最可能需要使用的单个工具")
        require_list.append("- 获取到单个工具后需要根据问题对参数值填充，如果解析不出参数值则使用工具参数默认值")
        require_list.append("- 如果必填参数值未填充则不返回工具，必填参数不能随意生成")

        input_list = ["输入："]
        # input_list.append("以下是用户问题：\n   {{question}}")
        input_list.append("以下是工具列表：\n   {{tools}} \n    以上是工具列表")

        output_list = ["输出："]
        output_list.append("- 在<think> </think> 标签中展示你的思考过程，并在 <answer> </answer> 标签中返回最终答案")
        output_list.append(f"- 最终答案结构必须该json结构：```json{json.dumps(output_example, ensure_ascii=False)}```")
        output_list.append("- 如果没找到工具则答案返回空对象")

        prompt_rows = []
        prompt_rows.append(role)
        prompt_rows.append('\n'.join(require_list))
        prompt_rows.append('\n'.join(input_list))
        prompt_rows.append('\n'.join(output_list))
        prompt = '\n\n'.join(prompt_rows)

        prompt = """
        角色：你是一个问题分析专家。
        
        ***需求***
        请分析用户问题从工具列表中选择最合适的工具，并将问题中可能存在的参数值填充到参数字段中
        
        单个工具结构说明： name是工具唯一名称, description是工具描述,title 是工具标题,server_id 是服务id。inputSchema是工具参数配置json。required是必填参数。 inputSchema.properties是参数字段json对象， 如果参数类型是object则properties为参数对应的字段配置opntions是参数枚举值
        
        ***请遵循以下规则***
        - 分析用户问题后，需要根据工具名称，工具描述，工具参数名称以及工具参数描述等来选择可能的工具
        - 如果参数存在枚举值则需要根据用户输入从枚举值中提取参数值
        - 返回工具名称必须存在输入的工具列表中
        - 需要根据用户问题选择工具列表中最可能需要使用的单个工具
        - 获取到单个工具后需要根据本次问题以及上下文对参数值填充，如果解析不出参数值则使用工具参数默认值。 工具参数的来源可以是用户问题，上下文以及之前选择的工具参数
        - 如果必填参数值未填充则不返回工具，必填参数不能随意生成
        - 如果没找到工具则答案返回空对象
        
        ***例子***
        问题1：张三的人员轨迹
        答案：<think>
        1. 用户问题中提到“张三的人员轨迹”，需要查询某个人的轨迹信息。
        2. 查看工具列表，发现`personTrailUsingGET`工具的描述是“人员轨迹”，符合用户需求。
        3. 该工具的参数包括`date`（日期）和`name`（姓名），其中`name`是必填参数，用户提供了姓名“江星”。
        4. `date`参数是必填的，但用户没有提供具体日期。当前时间为2026-02-11，可以推测用户可能希望查询当天的轨迹，因此可以使用当前日期作为默认值。
        5. 因此，`date`参数可以填充为“2026-02-11”，`name`参数为“张三”。
        6. 所有必填参数均已填充，可以返回该工具。
        </think>
        {"name": "personTrailUsingGET", "title": "人员轨迹", "server_id": "256b4c483d2e11f090c44a948448a3d0", "arguments": {"date": "2026-02-11", "name": "江星"}}
        
        问题2：他的人物关系图
        答案：<think>
        1. 用户问题中提到“他的人员关系图”，需要查询某个人的关系图信息。
        2. 查看工具列表，发现`personRelateUsingGET`工具的描述是“人员关系图”，符合用户需求。
        3. 该工具的参数包括`name`（姓名）和`sfzh`（身份证号），其中`name`是必填参数
        4. 由于用户使用了“他”来指代，根据历史问题可以知道“他”指“张三”。
        5. 因此选择人员关系图工具
        </think>
        {"name": "personRelateUsingGET", "title": "人员关系图", "server_id": "256b4c483d2e11f090c44a948448a3d0", "arguments": {"name": "张三"}
        
        
        ***可选择工具列表***
           {{tools}} 
        
        ***输出***
        - 在think标签中展示你的思考过程，
        - 在answer标签中返回最终答案 ，最终答案结构：{"name": "工具唯一名称", "title": "工具标题", "server_id": "服务id", "arguments": {"参数名": "参数值"}}
                """
        return prompt

    @classmethod
    def answer_prompt_template(cls):
        # prompt = "需求：\n\n\t\t\t- 整理并总结下方MCP工具返回数据。\n            - 根据用户输入理解用户对返回数据的需求然后返回结果\n\t\t\t- 需要满足返回数据的完整性，不能丢失数据。\n            - 请使用用户友好的语句进行回答 \n\n以下是MCP工具返回数据：\n   {tool_result}\n\n以上是MCP工具返回数据\n\n用户输入：\n{query}\n\n返回：\n            - 在<think> </think> 标签中展示你的思考过程      \t\n             - 接口可能会返回纯文本，JSON对象，JSON数组等各种不同的结构。\n            - 如果是纯文本则保留原文本。如果是JSON对象则提取出实际数据返回。如果是数组则提取出数组中的每一项数据展示。           \n\t\t\t- 如果无法整理出结果则按照原工具结果返回\n"
        prompt = "需求：    理解【用户要求】对数据来源【MCP工具数据】进行回答，具体需求如下：\n            - 分析【用户要求】理解用户对返回的需求\n            - 需要以用户友好的形式返回\n\n\n【数据来源】：\n以下是MCP工具数据：\n   {tool_result}\n以上是MCP工具数据\n\n【用户要求】：\n{query}\n\n返回：\n            - 在<think> </think> 标签中展示你的思考过程      \t\n\n\t\t\t- 需要满足数据来源的完整性，不能丢失数据\n            - 数据来源可能会返回纯文本，JSON对象，JSON数组等各种不同的结构。\n            - 如果是纯文本则保留原文本。如果是JSON对象则提取出实际数据返回。如果是数组则提取出数组中的每一项数据展示。          \n\n            - 优先按照【用户要求】的格式返回 \n\t\t\t- 如果无法整理出结果则按照原工具结果返回\n"
        return prompt


class MCPToolCaller(Generate, ABC):
    component_name = "MCPToolCaller"

    def reset(self, **kwargs):
        super().reset(**kwargs)

    def _run(self, history, **kwargs):
        start = time.time()
        logging.info("开始MCP工具调用")
        query = self.get_input()  # 当前问题
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()

        #### prompt处理 ####
        # 判断提示词中是否有依赖其他组件变量
        prompt = self.process_prompt(**kwargs)
        #### prompt处理结束 ####

        server_id = self._param.server_id
        tool_names = self._param.tool_names

        if not server_id:
            raise Exception("未绑定mcp服务")

        self.append_log("测试连接MCP服务器")
        try:
            asyncio.run(
                mcp_server_test_connection(server_id=server_id))
        except Exception as e:
            raise Exception(str(e.args))
        self.append_log("连接MCP服务器成功")

        self.append_log("获取MCP工具")
        tools = asyncio.run(mcp_server_list_tools(server_id=server_id))
        tools = [x.model_dump() for x in tools]
        available_tools = []
        # 只取可用的
        for tool in tools:
            simple_tool = self.simplify_tool(server_id, tool)
            if not simple_tool:
                continue
            if len(tool_names) == 0 or simple_tool["name"] in tool_names:
                available_tools.append(simple_tool)

        self.append_log("获取MCP工具成功")

        # 如果未指定工具，则使用LLM选择
        name = None
        arguments = {}
        if not self._param.tool_name:
            chat_mdl = LLMBundle(self._canvas.get_tenant_id(), LLMType.CHAT, self._param.llm_id)
            chat_conf = copy.deepcopy(self._param.gen_conf())
            chat_conf["deep_thinking"] = self._param.deep_thinking
            query_input = {"question": query, "tools": json.dumps(available_tools, indent=4, ensure_ascii=False)}
            chat_input = format_prompt_template(prompt, query_input)  # 替换prompt占位参数

            # system_prompt = "你是一个问题分析专家"  # system
            system_prompt = chat_input

            logging.info(f"模型选择工具-输入：{query_input}")
            self.append_log(f"模型选择工具-输入：{query_input}")

            chat_inputs = []
            user_massages = []
            msg = self.get_messages(self._param.message_history_window_size)  # LLM 消息记录
            # msgs = self._canvas.get_history(self._param.message_history_window_size)
            if msg and msg[0]['role'] == 'assistant':
                msg.pop(0)

            _, msg = message_fit_in([{"role": "system", "content": system_prompt}, *msg],
                                    int(chat_mdl.max_length * 0.97))
            msg.append({"role": "user", "content": query})
            # 流式
            ans = ""
            for ans_ in chat_mdl.chat_streamly(system_prompt, msg[1:], chat_conf):
                ans = ans_

            msg.append({"role": "assistant", "content": ans})
            self._param.messages = msg

            logging.info(f"模型返回结果：{ans}")
            self.append_log(f"模型返回结果：{ans}")
            content = get_llm_content(ans)
            # 去掉<answer>
            pattern = r"<answer>(.*?)</answer>"
            # re.DOTALL标志允许.匹配包括换行符在内的所有字符
            match = re.search(pattern, content, re.DOTALL)
            # 检查是否匹配成功
            if match:
                # 提取匹配的内容
                answer = match.group(1)
                content = answer

            result = ""
            content_dict = {}
            try:
                content_dict = json.loads(content) if content else {}
            except Exception as e:
                if self._param.error_handle == "pass":  # 错误处理
                    result = content
                else:
                    raise Exception("模型选择工具异常:" + str(content))

            name = content_dict.get("name", "")
            arguments = content_dict.get("arguments", {})
        else:
            # 指定工具
            name = self._param.tool_name
            arguments = self.get_input_params_values(available_tools)
            content_dict = {"name": name, "arguments": arguments}

        if self._param.file_path:
            body = arguments.get("body", {})
            body["file_path"] = self._param.file_path

        logging.info(f"工具名称和参数：{content_dict}")
        self.append_log(f"工具名称和参数：{json.dumps(content_dict, indent=4, ensure_ascii=False)}")
        # 获取工具完成
        # 调用工具
        if name:
            try:
                self.append_log(f"开始工具调用：{content_dict}")
                result = asyncio.run(mcp_server_call_tool(server_id=server_id, name=name, params=arguments))
                try:
                    if self._param.result_type == "json":
                        result = json.loads(result)
                except Exception as e:
                    pass

                logging.info(f"工具调用结果：{result}")
                self.append_log(f"工具调用结果：{result}")
            except Exception as e:
                logging.info(f"工具调用异常：{str(e)}")
                self.append_log(f"工具调用异常：{str(e)}")
                if self._param.error_handle == "pass":  # 错误处理
                    result = str(e)
                    pass
                else:
                    raise Exception(str(e.args))

            # 如果有answer_prompt
            if self._param.answer_prompt:
                logging.info(f"最终答案组装")
                self.append_log(f"最终答案组装")
                chat_conf = copy.deepcopy(self._param.gen_conf())
                chat_conf["deep_thinking"] = self._param.deep_thinking
                answer_input = {"tool_result": result, "query": query}
                answer_input = format_prompt_template(self._param.answer_prompt, answer_input)  # 替换prompt占位参数
                system_prompt = "你是一个数据总结整理专家"  # system
                ans = chat_mdl.chat(system_prompt, [{"role": "user", "content": answer_input}],
                                    chat_conf)
                result = ans
                logging.info(f"最终答案组装完成")
                self.append_log(f"最终答案组装完成")
        else:
            if self._param.empty_response:
                result = self._param.empty_response
            else:
                result = content
            # result = "未找到合适的mcp工具" if not result else result
            # result = self._param.empty_response if not result else result
            self.append_log(result)
        logging.info(f"mcp工具调用完成，耗时{round(time.time() - start, 2)}s")
        return MCPToolCaller.be_output(result)

    # 简化工具json
    def simplify_tool(self, server_id, tool: dict):
        simple_tool = {}
        annotations = tool["annotations"] if "annotations" in tool else {}
        mcp_tool_info = annotations["mcp_tool_info"] if "mcp_tool_info" in annotations else {}
        status = mcp_tool_info["status"] if "status" in mcp_tool_info else annotations[
            "status"] if "status" in annotations else StatusEnum.VALID.value
        tool["title"] = annotations["title"] if "title" in annotations else ""
        tool["server_id"] = server_id
        if status != StatusEnum.VALID.value:
            return None
        simple_tool["name"] = tool["name"]
        simple_tool["server_id"] = tool["server_id"]
        simple_tool["title"] = tool["title"]
        simple_tool["description"] = tool["description"] if "description" in tool else ""
        simple_tool["inputSchema"] = tool["inputSchema"]
        return simple_tool

    # 解析输入参数，返回参数名：参数值map
    def get_input_params_values(self, available_tools):
        result = {}
        input_params = self._param.arguments
        tool_argument_datatypes = {}
        for tool in available_tools:
            if tool["name"] == self._param.tool_name:
                properties = tool["inputSchema"]["properties"]
                for prop in properties:
                    tool_argument_datatypes[prop] = properties[prop]["type"]
        if input_params:
            for params in input_params:
                param_name = params["name"]
                params["datatype"] = tool_argument_datatypes[param_name] if "datatype" not in params else params[
                    "datatype"]
                if params["from"] == "input":
                    component_id = ""
                    value = params["value"] if "value" in params else ""
                    result[params["name"]] = self.parse_value_from_datatype(value, params["datatype"],
                                                                            tool_argument_datatypes[param_name])
                else:
                    component_id = params["component_id"] if "component_id" in params else ""
                    value = self.get_reference_input_value(component_id)
                    if isinstance(value, DataFrame):
                        value = "\n".join(value["content"]) if "content" in value else ""
                        result[params["name"]] = self.parse_value_from_datatype(value, params["datatype"],
                                                                                tool_argument_datatypes[param_name])
                    else:
                        continue

                self._param.inputs.append({
                    "component_id": component_id,
                    "content": value
                })
        return result

    # 根据数据类型解析值
    def parse_value_from_datatype(self, value, datatype: str = "string", argument_datatype: str = "string"):
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

        # 特殊处理
        try:
            if isinstance(value, str):
                if argument_datatype == "int":
                    value = int(value)
                if argument_datatype == "float":
                    value = float(value)
                if datatype == "boolean":
                    value = bool(value)
                if argument_datatype == "array":
                    value = [value]
        except Exception as e:
            logging.debug(f"参数值解析异常-{str(e)},value:{value},datatype:{datatype}")

        return value

    def debug(self, **kwargs):
        return self._run([], **kwargs)
