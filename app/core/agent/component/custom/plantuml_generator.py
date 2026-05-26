# Author: zwx
# Date: 2025/4/3 16:55
# Description: 模型生成PlantUML各种图表 https://plantuml.com/zh/
import copy
import logging
import re
import time
from abc import ABC
import json

import requests
from plantuml import PlantUML

from .. import GenerateParam, Generate
from api import settings
from rag.prompts import message_fit_in
from app.core.llm_model.utils.llm_util import get_output_json_content
from app.core.llm_model.utils.model_caller import ModelCaller


class PlantUMLGeneratorParam(GenerateParam):
    """
    PlantUML
    """

    def __init__(self):
        super().__init__()
        self.server_url = settings.PLANTUML_CONFIG.get("server_url", "http://172.21.84.6:8080/")
        self.temperature = 0.5
        self.plantuml_code = ""  # plantuml代码
        self.doc_ids = []  # 上传的文件id列表
        self.theme = "plain"  # 主题
        self.theme_list = ["amiga"
            , "aws-orange"
            , "black-knight"
            , "bluegray"
            , "blueprint"
            , "cerulean-outline"
            , "cerulean"
            , "crt-amber"
            , "crt-green"
            , "cyborg-outline"
            , "cyborg"
            , "hacker"
            , "lightgray"
            , "mars"
            , "materia-outline"
            , "materia"
            , "metal"
            , "mimeograph"
            , "minty"
            , "plain"
            , "reddress-darkblue"
            , "reddress-darkgreen"
            , "reddress-darkorange"
            , "reddress-darkred"
            , "reddress-lightblue"
            , "reddress-lightgreen"
            , "reddress-lightorange"
            , "reddress-lightred"
            , "sandstone"
            , "silver"
            , "sketchy-outline"
            , "sketchy"
            , "spacelab"
            , "spacelab-white"
            , "superhero-outline"
            , "superhero"
            , "toy"
            , "united"
            , "vibrant"]  # 主题列表
        self.image_type = "png"  # 图表类型
        self.image_type_list = ["png", "svg", "txt", "pdf"]
        self.prompt = self.prompt_template()
        self.files = []  # 文件信息列表

    def check(self):
        super().check()

    # 提示词模版
    @classmethod
    def prompt_template(cls):
        role = "角色：你是一个PlantUML图表代码生成专家，善于从用户需求生成PlantUML代码"
        require_list = ["需求："]
        require_list.append("- 请根据文件内容以及用户要求生成PlantUML代码")
        require_list.append(
            f"- 如果文件内容为空则只用根据用户要求生成")
        require_list.append("- 代码内容必须满足PlantUML规范，不能有语法错误")
        require_list.append("- PlantUML的默认主题为{theme},如果用户输入有指定主题则主题为用户指定的主题")

        input_list = ["输入："]
        input_list.append("以下是文件内容：\n   {file_content}\n以上是文件内容\n")
        # input_list.append("以下是用户要求：\n   {query} \n以上是用户要求")

        output_list = ["输出："]
        output_list.append("- 在<think> </think> 标签中展示你的思考过程，并在 <answer> </answer> 标签中返回PlantUML代码")
        output_list.append("- 代码内容必须以@startuml开头以@enduml结尾")
        output_list.append("- 不能以```plantuml开头和```结尾")
        output_list.append("- 如果不能生成PlantUML则代码内容为空")
        output_list.append("- 如果无法根据文件内容生成符合用户要求的代码，则只使用用户要求生成代码")
        output_list.append("- 同样的用户要求，尽量消除幻觉，在一个会话里面保持生成的PlantUML代码的一致性")

        prompt_rows = []
        prompt_rows.append(role)
        prompt_rows.append('\n'.join(require_list))
        prompt_rows.append('\n'.join(input_list))
        prompt_rows.append('\n'.join(output_list))
        prompt = '\n\n'.join(prompt_rows)
        return prompt


class PlantUMLGenerator(Generate, ABC):
    component_name = "PlantUMLGenerator"
    component_title = "UML图表生成工具"
    
    def reset(self, **kwargs):
        super().reset()

    def _run(self, history, **kwargs):
        start = time.time()
        logging.info("开始生成PlantUML图表")
        query = self.get_input()  # 当前输入
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()

        #### prompt处理 ####
        # 判断提示词中是否有依赖其他组件变量
        prompt = self.process_prompt(**kwargs)
        #### prompt处理结束 ####
        result = ""
        if self._param.plantuml_code:
            result = self._param.plantuml_code
            self.append_log("用户已经指定了PlantUML代码，直接返回")
        else:
            self.append_log("开始生成PlantUML代码")
            logging.info(f"模型生成PlantUML代码")
            self.append_log(f"模型生成PlantUML代码")
            chat_mdl = ModelCaller.get_chat_model(self._param.llm_id)
            chat_conf = copy.deepcopy(self._param.gen_conf())
            chat_conf["deep_thinking"] = self._param.deep_thinking

            if self._param.doc_ids:
                chunks = self.get_chunks()
                file_content = "\n".join(chunks)
            elif self._param.files:
                file_content = self._canvas.get_global_value("files", [])
            else:
                file_content = ""
            query_input = {"query": query, "file_content": file_content, "theme": self._param.theme}
            chat_input = format_prompt_template(prompt, query_input)  # 替换prompt占位参数

            # system_prompt = "你是一个图表生成专家"  # system
            # system_prompt = "你是一个图表生成专家"  # system
            system_prompt = chat_input

            msg = self._canvas.get_history(self._param.message_history_window_size)
            if msg and msg[0]['role'] == 'assistant':
                msg.pop(0)
            if len(msg) < 1:
                msg.append({'role': 'user', 'content': query})
            _, msg = message_fit_in(msg, int(chat_mdl.max_length * 0.97))

            # 流式
            for ans_ in chat_mdl.chat_streamly(system_prompt, msg, chat_conf):
                ans = ans_

            logging.info(f"模型返回结果：{ans}")
            self.append_log(f"模型返回结果：{ans}")
            content = get_output_json_content(ans)
            result = content
            # 去掉<answer>
            pattern = r"<answer>(.*?)</answer>"
            match = re.search(pattern, content, re.DOTALL)
            # 检查是否匹配成功
            if match:
                # 提取匹配的内容
                answer = match.group(1)
                result = answer

            self.append_log("生成PlantUML代码完成")

            self.append_log(f"PlantUML代码：{result}")
            logging.info(f"PlantUML代码：{result}")

        if result and self._param.server_url:
            try:
                self.append_log(f"连接PlantUML服务器生成图片url，服务器路径：{self._param.server_url}")
                url = self._param.server_url + self._param.image_type + "/"
                server = PlantUML(url=url, basic_auth={}, form_auth={}, http_opts={},
                                  request_opts={})
                image_url = server.get_url(result)

                # image_id = image_url.split("/")[-1]
                # retry = 2
                # valid = self.validate(image_id)
                # if not valid:
                #     msg = [{'role': 'user', 'content': chat_input}]
                #     msg.append({'role': 'assistant', 'content': result})
                #     msg.append({'role': 'user',
                #                 'content': '生成的代码存在语法错误，请更正后帮我重新生成一次代码。原代码图形样式和数量必须需要保持一致'})
                #     ans = chat_mdl.chat(system_prompt, msg, chat_conf)
                #     content = get_llm_content(ans)
                #     result = content
                #     # 去掉<answer>
                #     pattern = r"<answer>(.*?)</answer>"
                #     match = re.search(pattern, content, re.DOTALL)
                #     # 检查是否匹配成功
                #     if match:
                #         # 提取匹配的内容
                #         answer = match.group(1)
                #         result = answer

                result = image_url
                self.append_log(f"PlantUML服务器生成图片url完成{image_url}")
            except Exception as e:
                self.append_log(f"PlantUML服务器生成图片url失败{str(e)}, 直接返回PlantUML代码")

        logging.info(f"生成PlantUML图表完成，耗时{round(time.time() - start, 2)}s")
        return PlantUMLGenerator.be_output(result)

    def validate(self, image_id):
        url = self._param.server_url + "map/" + image_id
        try:
            response = requests.get(url)
        except Exception as e:
            return False

    def get_chunks(self):
        from rag.nlp import search
        from api import settings
        from api.db.services.document_service import DocumentService
        from api.db.services.knowledgebase_service import KnowledgebaseService
        chunks = []
        doc_ids = self._param.doc_ids
        for doc_id in doc_ids:
            e, doc = DocumentService.get_by_id(doc_id)
            if not e:
                continue
            kb_id = doc.kb_id
            kbs = KnowledgebaseService.get_by_ids([kb_id])
            embedding_list = list(set([kb.embd_id for kb in kbs]))
            if len(embedding_list) != 1:
                continue
            embedding_model_name = embedding_list[0]
            embd_mdl = LLMBundle(self._canvas.get_tenant_id(), LLMType.EMBEDDING, embedding_model_name)
            tenant_id = kbs[0].tenant_id
            req = {"doc_ids": [doc_id]}
            sres = settings.retrievaler.search(req, search.index_name(tenant_id),
                                               [kb_id], embd_mdl,
                                               highlight=False)
            for id in sres.ids:
                chunk_content = sres.field[id].get("content_with_weight", "")
                chunks.append(chunk_content)
        return chunks

    def debug(self, **kwargs):
        return self._run([], **kwargs)
