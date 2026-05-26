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
import logging
import re
from abc import ABC
from .. import GenerateParam, Generate
from app.core.llm_model.utils.model_caller import ModelCaller


class KeywordExtractParam(GenerateParam):
    """
    Define the KeywordExtract component parameters.
    """

    def __init__(self):
        super().__init__()
        self.top_n = 1
        self.prompt = ("你是一个专业的语义分析专家。你的任务是从用户问题中准确提取关键字。\n\n提取规则：\n\n1. 识别问题中的核心名词、动词和关键概念\n\n2. "
                       "去除停用词（如\"的\"、\"了\"、\"着\"等）\n\n3. 去除语气词和标点符号\n\n4. 去除非核心修饰词\n\n5. "
                       "提取的关键字必须对理解问题有实质性帮助\n\n输出要求：\n\n1. 仅返回关键字数组，格式为 [\"关键字1\", \"关键字2\", ...]\n\n2. "
                       "如果未提取到有效关键字，返回 []\n\n3. 不允许包含任何解释或额外信息\n\n4. 关键字必须来自原问题，不能自行添加或修改\n\n关键字判定标准：\n\n1. "
                       "能够表达问题核心意图的词语\n\n2. 对问题主题起到限定作用的词语\n\n3. 具有特定领域含义的专业词语\n\n4. 能够区分问题类型的动作词语")

    def check(self):
        super().check()
        self.check_positive_integer(self.top_n, "Top N")

#     def get_prompt(self):
#         self.prompt = """
# - Role: You're a question analyzer.
# - Requirements:
#   - Summarize user's question, and give top %s important keyword/phrase.
#   - Use comma as a delimiter to separate keywords/phrases.
# - Answer format: (in language of user's question)
#   - keyword:
# """ % self.top_n
#         return self.prompt


class KeywordExtract(Generate, ABC):
    component_name = "KeywordExtract"
    component_title = "关键词"



    def _run(self, history, **kwargs):
        query = self.get_input()
        if hasattr(query, "to_dict") and "content" in query:
            query = ", ".join(map(str, query["content"].dropna()))
        else:
            query = str(query)

        chat_mdl = ModelCaller.get_chat_model(self._param.llm_id)

        prompt = self._param.prompt
        prompt = self.process_prompt(**kwargs)

        self._canvas.set_component_infor(self._id, {"prompt":prompt,"messages":  [{"role": "user", "content": query}],"conf": self._param.gen_conf()})
        ans = chat_mdl.chat(prompt, [{"role": "user", "content": query}],
                            self._param.gen_conf())

        ans = re.sub(r"^.*</think>", "", ans, flags=re.DOTALL)
        ans = re.sub(r".*keyword:", "", ans).strip()
        logging.debug(f"ans: {ans}")
        return KeywordExtract.be_output(ans)

    def debug(self, **kwargs):
        return self._run([], **kwargs)
