# Author: zwx
# Date: 2025/4/3 16:55
# Description: multi_turn_query_rewriter 多轮对话问题改写
import copy
import json
import logging
import re
import time
from abc import ABC
from typing import List

from .. import GenerateParam, Generate
from app.core.llm_model.utils.llm_util import get_output_json_content
from app.core.llm_model.utils.model_caller import ModelCaller


class MultiTurnQueryRewriteParam(GenerateParam):
    """
    多轮对话问题改写组件参数
    """

    def __init__(self):
        super().__init__()
        self.temperature = 0.1
        self.prompt = ("你是一个问题分析专家。我需要你帮我分析用户问题,按以下步骤执行:\n\n1. 问题拆分\n\n- 分析用户问题是否包含多个独立问题点，需要根据语境拆分为独立子问题\n\n- "
                       "若问题格式为\"A做B需要什么\",增加\"A能否做B\"的前置性合法性验证子问题。\n\n- 若仅问\"A能否做B\"或者\"做B需要什么\",无需增加前置性验证子问题\n\n- "
                       "若问题无需拆分,保持原样\n\n- 注意:避免过度拆分,只拆分确实必要的部分\n\n2. 问题改写\n\n- "
                       "检查历史问题记录，基于历史对话记录进行语义补全，上下文关联规则如下：\n\n● "
                       "当问题含\"这个/那个\"时：继承最近3轮对话的核心实体\n\n示例：\n\n历史问题：\"企业如何申请科技创新补贴\"\n\n当前问题：\"这个政策截止到什么时候\" → "
                       "改写为\"科技创新补贴政策截止时间\"\n\n● 检测到连续追问时：自动继承前序问题主体\n\n示例：\n\n历史问题：\"长沙社保转移流程\"\n\n当前问题：\"需要哪些材料\" → "
                       "改写为\"长沙社保转移所需材料\"\n\n● 缺失主体时优先补全：\n\n\"怎么办理\" → 结合历史补充为\"企业注册怎么办理\"\n\n- 改写要求：\n\n● "
                       "改写需参考上下文的历史问题\n\n● 若无以上情况，则无需改写则保持原样\n\n● 若无历史问题记录则跳过改写步骤\n\n● "
                       "如果问题中含有辱骂、抱怨、反动等词汇，则自动去掉这些词汇，若去掉后文本语义变更＞30%，则用[**]替换\n\n● "
                       "注意:改写需保持原问题的核心语义不变，不得丢失问题包含背景、前提的描述内容\n\n3. 关键字提取\n\n- 从每个改写后的问题中提取:\n\n  * 核心实体 ：政务服务标准事项名称（ "
                       "如营业执照）\n\n  * 关键动词 ：办理/申报/查询等政务动词（如补办、延期、变更 ）\n\n  * 业务主体对象 "
                       "：自然人/法人身份等（如退役军人、小微企业、民办非企业单位、外商投资企业）\n\n  * 政策依据 ：带文号的法规文件（如湘政发〔2023〕12号）\n\n  * 限定条件 "
                       "：户籍/资质/时效要求（如长沙户籍、3年纳税记录）\n\n  * 重要概念 ：政务相关概念（如告知承诺制）\n\n- "
                       "确保提取的关键字对理解问题有实质帮助\n\n输出格式:```json{\"valid_question\": {\"前置性验证子问题\": \"关键字\"}, "
                       "\"rewrite_question\": {\"改写问题1\": \"关键字\", \"改写问题2\": \"关键字\"}}```\n\n注意事项:\n\n1. 严格遵循问题拆分标准,"
                       "避免过度拆分\n\n2. 改写时必须基于历史问题，改写后的文本语义必须需保持原问题核心意图不变，不得丢失问题包含背景、前提的描述内容\n\n3. 关键字必须具有实质性价值\n\n4. "
                       "保持输出格式的一致性\n\n5. 请严格按照输出格式输出，严禁输出其他任何内容\n\n6. 请用中文回答\n\n\n\n输入：\n\n历史问题：\"\"\"{{"
                       "history}}\"\"\"\n\n用户问题：\"\"\"{{question}}\"\"\"\n\n\n\n- "
                       "示例1：\n\n用户问题：\"装修提取公积金需要带什么材料？\"\n\n输出:\n\n```json{\"valid_question\": {\"装修能否提取公积金?\": \"装修,"
                       "提取,公积金\"}, \"rewrite_question\": {\"装修提取公积金需要带什么材料？\": \"装修,提取,公积金,材料\"}}```\n\n- "
                       "示例2：\n\n用户问题：\"我50岁，想要提取退休公积金？\"\n\n输出:\n\n```json{\"valid_question\": {\"50岁是否符合退休年龄?\": "
                       "\"退休,年龄\"}, \"rewrite_question\": {\"50岁，能否提取退休公积金？\": \"公积金,提取,"
                       "退休\"}}```\n\n！！注意检查输出的json格式是否正确,例如json的key value是用双引号包裹，而非单引号\n\n在<think> </think> "
                       "标签中展示你的思考过程，并在 <answer> </answer> 标签中返回最终答案,例如:\n\n<answer>\n\n```json{\"valid_question\": {"
                       "\"前置性验证子问题\": \"关键字\"}, \"rewrite_question\": {\"改写问题1\": \"关键字\", \"改写问题2\": "
                       "\"关键字\"}}```\n\n</answer>")
        self.max_tokens = 0
        self.history_input = []  # 历史输入
        self.message_history_window_size = 10

    def check(self):
        super().check()


class MultiTurnQueryRewrite(Generate, ABC):
    component_name = "MultiTurnQueryRewrite"
    component_title = "多轮问题改写"
    
    def reset(self, **kwargs):
        super().reset()
        mem = kwargs.get('memory', False)
        if not mem:
            self._param.history_input = []

    def _run(self, history, **kwargs):
        start = time.time()
        logging.info("开始多轮问题改写")
        query = self.get_input()  # 当前问题
        query = str(query["content"][0]) if "content" in query else ""

        hist: List = self._canvas.get_history(self._param.message_history_window_size)  # 历史问题
        hist_messages = [h["content"] for h in hist if h["role"] == "user"]
        # hist_messages: List = self._param.history_input
        window_hist_messages = hist_messages[:-1]
        history = "\n".join(window_hist_messages) if window_hist_messages else ''

        #### prompt处理 ####
        # 判断提示词中是否有依赖其他组件变量
        input_ref = self.get_input_elements()[1:]
        for para in input_ref:
            if para["key"].lower().find("begin@") == 0:
                cpn_id, key = para["key"].split("@")
                for p in self._canvas.get_component(cpn_id)["obj"]._param.query:
                    if p["key"] == key:
                        kwargs[para["key"]] = p.get("value", "")
                        if isinstance(p.get("value", ""), dict) or isinstance(p.get("value", ""), list):
                            json_value = copy.deepcopy(p.get("value"))
                            if p.get("type") == "file" and isinstance(json_value, dict):
                                json_value.pop("base64_data",None)
                                json_value.pop("thumbnail",None)
                            if p.get("type") == "file" and isinstance(json_value, list):
                                for v in json_value:
                                    v.pop("base64_data", None)
                                    v.pop("thumbnail", None)
                            kwargs[para["key"]] = json.dumps(json_value, ensure_ascii=False)
                        self._param.inputs.append(
                            {"component_id": para["key"], "content": kwargs[para["key"]]})
                        break
                else:
                    assert False, f"找不到变量 '{key}' for {cpn_id}"
                continue
            if para["key"].startswith("sys."):
                kwargs[para["key"]] = para["value"]
                self._param.inputs.append(
                    {"component_id": para["key"], "content": kwargs[para["key"]]})
                continue

            component_id = para["key"]
            cpn = self._canvas.get_component(component_id)["obj"]
            if cpn.component_name.lower() == "answer":  # 如果
                hist = self._canvas.get_history(1)
                if hist:
                    hist = hist[0]["content"]
                else:
                    hist = ""
                kwargs[para["key"]] = hist
                continue
            _, out = cpn.output(allow_partial=False)
            if "content" not in out.columns:
                kwargs[para["key"]] = ""
            else:
                if cpn.component_name.lower() == "retrieval":
                    pass
                kwargs[para["key"]] = "  - " + "\n - ".join(
                    [o if isinstance(o, str) else str(o) for o in out["content"]])
            self._param.inputs.append({"component_id": para["key"], "content": kwargs[para["key"]]})
        prompt = self._param.prompt  # 提示词模版
        for n, v in kwargs.items():  # 替换变量
            prompt = re.sub(r"\{%s\}" % re.escape(n), str(v).replace("\\", " "), prompt)
        #### prompt处理结束 ####

        query_input = {"history": history, "question": query}
        chat_input = format_prompt_template(prompt, query_input)  # 将history和query替换到提示词中

        system_prompt = "你是一个专业的问题分析改写专家"  # system

        logging.info(f"多轮问题改写-输入：{query_input}")
        self.append_log(f"多轮问题改写-输入：{query_input}")
        chat_mdl = ModelCaller.get_chat_model(self._param.llm_id)
        ans = chat_mdl.chat(system_prompt, [{"role": "user", "content": chat_input}],
                            self._param.gen_conf())
        logging.info(f"模型返回结果：{ans}")
        self.append_log(f"模型返回结果：{ans}")
        content = get_output_json_content(ans)
        # 去掉<answer>
        pattern = r"<answer>(.*?)</answer>"
        # re.DOTALL标志允许.匹配包括换行符在内的所有字符
        match = re.search(pattern, content, re.DOTALL)
        # 检查是否匹配成功
        if match:
            # 提取匹配的内容
            answer = match.group(1)
            content = answer
        query_dic = json.loads(content)
        valid_question = query_dic.get("valid_question", {})
        rewrite_questions = query_dic.get("rewrite_question", {})
        if not rewrite_questions:
            if not valid_question:
                logging.error(f"rewrite_question和valid_question都为空,使用原问题")
                rewrite_questions = {query: ''}
            else:
                logging.error(f"改写问题为空，启用valid_question:{valid_question}")
                rewrite_questions = valid_question

        result = list(rewrite_questions.keys())
        logging.info(f"多轮问题改写-结果：{result}")
        self.append_log(f"多轮问题改写-结果：{result}")
        self._param.history_input.append(query)  # 添加到历史
        return MultiTurnQueryRewrite.be_output("\n".join(result))

    def debug(self, **kwargs):
        return self._run([], **kwargs)

    @staticmethod
    def gen_lang(language):
        # convert code lang to language word for the prompt
        language_dict = {'af': 'Afrikaans', 'ak': 'Akan', 'sq': 'Albanian', 'ws': 'Samoan', 'am': 'Amharic',
                         'ar': 'Arabic', 'hy': 'Armenian', 'az': 'Azerbaijani', 'eu': 'Basque', 'be': 'Belarusian',
                         'bem': 'Bemba', 'bn': 'Bengali', 'bh': 'Bihari',
                         'xx-bork': 'Bork', 'bs': 'Bosnian', 'br': 'Breton', 'bg': 'Bulgarian', 'bt': 'Bhutani',
                         'km': 'Cambodian', 'ca': 'Catalan', 'chr': 'Cherokee', 'ny': 'Chichewa', 'zh-cn': 'Chinese',
                         'zh-tw': 'Chinese', 'co': 'Corsican',
                         'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish', 'nl': 'Dutch', 'xx-elmer': 'Elmer',
                         'en': 'English', 'eo': 'Esperanto', 'et': 'Estonian', 'ee': 'Ewe', 'fo': 'Faroese',
                         'tl': 'Filipino', 'fi': 'Finnish', 'fr': 'French',
                         'fy': 'Frisian', 'gaa': 'Ga', 'gl': 'Galician', 'ka': 'Georgian', 'de': 'German',
                         'el': 'Greek', 'kl': 'Greenlandic', 'gn': 'Guarani', 'gu': 'Gujarati', 'xx-hacker': 'Hacker',
                         'ht': 'Haitian Creole', 'ha': 'Hausa', 'haw': 'Hawaiian',
                         'iw': 'Hebrew', 'hi': 'Hindi', 'hu': 'Hungarian', 'is': 'Icelandic', 'ig': 'Igbo',
                         'id': 'Indonesian', 'ia': 'Interlingua', 'ga': 'Irish', 'it': 'Italian', 'ja': 'Japanese',
                         'jw': 'Javanese', 'kn': 'Kannada', 'kk': 'Kazakh', 'rw': 'Kinyarwanda',
                         'rn': 'Kirundi', 'xx-klingon': 'Klingon', 'kg': 'Kongo', 'ko': 'Korean', 'kri': 'Krio',
                         'ku': 'Kurdish', 'ckb': 'Kurdish (Sorani)', 'ky': 'Kyrgyz', 'lo': 'Laothian', 'la': 'Latin',
                         'lv': 'Latvian', 'ln': 'Lingala', 'lt': 'Lithuanian',
                         'loz': 'Lozi', 'lg': 'Luganda', 'ach': 'Luo', 'mk': 'Macedonian', 'mg': 'Malagasy',
                         'ms': 'Malay', 'ml': 'Malayalam', 'mt': 'Maltese', 'mv': 'Maldivian', 'mi': 'Maori',
                         'mr': 'Marathi', 'mfe': 'Mauritian Creole', 'mo': 'Moldavian', 'mn': 'Mongolian',
                         'sr-me': 'Montenegrin', 'my': 'Burmese', 'ne': 'Nepali', 'pcm': 'Nigerian Pidgin',
                         'nso': 'Northern Sotho', 'no': 'Norwegian', 'nn': 'Norwegian Nynorsk', 'oc': 'Occitan',
                         'or': 'Oriya', 'om': 'Oromo', 'ps': 'Pashto', 'fa': 'Persian',
                         'xx-pirate': 'Pirate', 'pl': 'Polish', 'pt': 'Portuguese', 'pt-br': 'Portuguese (Brazilian)',
                         'pt-pt': 'Portuguese (Portugal)', 'pa': 'Punjabi', 'qu': 'Quechua', 'ro': 'Romanian',
                         'rm': 'Romansh', 'nyn': 'Runyankole', 'ru': 'Russian', 'gd': 'Scots Gaelic',
                         'sr': 'Serbian', 'sh': 'Serbo-Croatian', 'st': 'Sesotho', 'tn': 'Setswana',
                         'crs': 'Seychellois Creole', 'sn': 'Shona', 'sd': 'Sindhi', 'si': 'Sinhalese', 'sk': 'Slovak',
                         'sl': 'Slovenian', 'so': 'Somali', 'es': 'Spanish', 'es-419': 'Spanish (Latin America)',
                         'su': 'Sundanese',
                         'sw': 'Swahili', 'sv': 'Swedish', 'tg': 'Tajik', 'ta': 'Tamil', 'tt': 'Tatar', 'te': 'Telugu',
                         'th': 'Thai', 'ti': 'Tigrinya', 'to': 'Tongan', 'lua': 'Tshiluba', 'tum': 'Tumbuka',
                         'tr': 'Turkish', 'tk': 'Turkmen', 'tw': 'Twi',
                         'ug': 'Uyghur', 'uk': 'Ukrainian', 'ur': 'Urdu', 'uz': 'Uzbek', 'vu': 'Vanuatu',
                         'vi': 'Vietnamese', 'cy': 'Welsh', 'wo': 'Wolof', 'xh': 'Xhosa', 'yi': 'Yiddish',
                         'yo': 'Yoruba', 'zu': 'Zulu'}
        if language in language_dict:
            return language_dict[language]
        else:
            return ""
