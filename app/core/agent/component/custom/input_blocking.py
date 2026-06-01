# Author: zwx
# Date: 2025/4/14 16:55
# Description: input_blocking 输入阻断模块
import logging
import random
import time
from abc import ABC
from typing import List

import pandas as pd

from ..base import ComponentBase, ComponentParamBase, ComponentBaseFrontEndField
from api.db.services.bot_service import BotConfigInputLimitService, BotConfigStatusService, \
    BotConfigSensitiveWordService, BotConfigSensitiveWordReplyService, BotConfigRepeatQuestionReplyService


class InputBlockingParamFrontEndField(ComponentBaseFrontEndField):
    """
    输入阻断组件参数前端控件
    """
    pass


class InputBlockingParam(ComponentParamBase):
    """
    输入阻断模块
    """

    def __init__(self):
        super().__init__()
        self.bot_id = ""
        self.input_limit = True  # 输入限制
        self.sensitive_word = True  # 敏感词
        self.repeat_question_reply = True  # 重复回答

    def check(self):
        self.check_empty(self.bot_id, "未绑定聊天策略")


class InputBlocking(ComponentBase, ABC):
    component_name = "InputBlocking"
    component_title = "输入阻断"

    def _run(self, history, **kwargs):
        start = time.time()
        query = self.get_input()  # 当前问题
        query = '\n'.join(query["content"]) if "content" in query else ""
        # query = str(query["content"][0]) if "content" in query else ""
        query = query.strip()
        bot_id = self._param.bot_id
        config_status: dict = BotConfigStatusService.get_by_bot_id(bot_id)
        if not config_status:
            logging.error(f"聊天策略不存在，bot_id{bot_id},跳过输入阻断模块")
            self.append_log(f"聊天策略不存在，bot_id{bot_id},跳过输入阻断模块")
            return InputBlocking.be_output(query)

        if self._param.input_limit and 1 == config_status.get("input_limit"):
            logging.info("输入限制判断处理")
            self.append_log("输入限制判断处理")
            one: dict = BotConfigInputLimitService.get_by_bot_id(bot_id)
            input_least_number = one.get("input_least_number", 3)
            input_least_prompt = one.get("input_least_prompt",
                                         f"您输入的字数过少，至少输入{input_least_number}个字符")
            input_most_number = one.get("input_most_number", 200)
            input_most_prompt = one.get("input_most_prompt", f"最多输入{input_most_number}个字符")
            if len(query) < input_least_number:
                return pd.DataFrame([{"content": input_least_prompt, "stopped": True}])
            if len(query) > input_most_number:
                return pd.DataFrame([{"content": input_most_prompt, "stopped": True}])
            logging.info("输入限制判断结束")
            self.append_log("输入限制判断结束")

        if self._param.sensitive_word and 1 == config_status.get("sensitive_word"):
            logging.info("敏感词判断")
            self.append_log("敏感词判断")
            sensitive_words = BotConfigSensitiveWordService.get_by_list(bot_id=bot_id, status=1)
            sensitive_word_replys = BotConfigSensitiveWordReplyService.get_by_list(bot_id=bot_id,
                                                                                   status=1)
            sensitive_word_replys_category_map = {x["category"]: x["content"] for x in sensitive_word_replys}
            if sensitive_words:
                for sensitive_word in sensitive_words:
                    if sensitive_word["word"] in query:
                        word = sensitive_word["word"]
                        category = sensitive_word["category"] if "category" in sensitive_word else ""
                        content = sensitive_word_replys_category_map[
                            category] if category in sensitive_word_replys_category_map else f"谢谢您的提问，但这个问题涉及敏感词汇:{word}"
                        #raise Exception("异常.")
                        return pd.DataFrame([{"content": content, "stopped": True}])
            logging.info("敏感词判断结束")
            self.append_log("敏感词判断结束")

        if self._param.repeat_question_reply and 1 == config_status.get("repeat_question_reply"):
            logging.info("重复问题处理")
            self.append_log("重复问题处理")
            hist: List = self._canvas.get_history(self._param.message_history_window_size)  # 历史问题
            hist_messages = [h["content"] for h in hist if h["role"] == "user"]
            repeat_question_replys = BotConfigRepeatQuestionReplyService.get_by_list(bot_id=bot_id,
                                                                                     status=1)
            count = hist_messages.count(query)
            default_limit = 3  # 取默认3次
            if repeat_question_replys:
                contents = [x["content"] for x in repeat_question_replys if
                            "repetitive_question_times" in x and x["repetitive_question_times"] <= count]
                if len(contents)>0:
                    content = random.choice(contents)
                    return pd.DataFrame([{"content": content, "stopped": True}])
            elif default_limit <= count:
                return pd.DataFrame([{"content": "抱歉，您重复提问，请换一种提问方式", "stopped": True}])
            logging.info("重复问题处理结束")
            self.append_log("重复问题处理结束")

        return InputBlocking.be_output(query)

    def debug(self, **kwargs):
        return self._run([], **kwargs)
