# Author: zwx
# Date: 2025/4/15 16:05
# Description: input_optimize 输入优化模块（去除停用词，去除重复粗，去除特殊字符）
import logging
import re
import time
from abc import ABC
from typing import List

from ..base import ComponentBase, ComponentParamBase, ComponentBaseFrontEndField
from api.db.services.bot_service import BotConfigStatusService, BotConfigStopWordService, \
    BotConfigSpecialCharacterService, BotConfigSpecialCharacterExcludeService, BotConfigRepetitiveWordService


class InputOptimizeParamFrontEndField(ComponentBaseFrontEndField):
    """
    输入优化组件参数前端控件
    """
    pass


class InputOptimizeParam(ComponentParamBase):
    """
    参数
    """

    def __init__(self):
        super().__init__()
        self.bot_id = ""
        self.stop_word = True  # 停用词
        self.special_character = True  # 特殊字符
        self.repetitive_word = True  # 重复词

    def check(self):
        self.check_empty(self.bot_id, "未绑定聊天策略")


class InputOptimize(ComponentBase, ABC):
    component_name = "InputOptimize"
    component_title = "输入优化"

    def _run(self, history, **kwargs):
        start = time.time()
        query = self.get_input()  # 当前问题
        query = '\n'.join(query["content"]) if "content" in query else ""
        # query = str(query["content"][0]) if "content" in query else ""
        query = query.strip()
        bot_id = self._param.bot_id
        config_status: dict = BotConfigStatusService.get_by_bot_id(bot_id)
        if not config_status:
            logging.error(f"聊天策略不存在，bot_id{bot_id},跳过输入优化模块")
            self.append_log(f"聊天策略不存在，bot_id{bot_id},跳过输入优化模块")
            return InputOptimize.be_output(query)

        output_query = query

        if self._param.stop_word and 1 == config_status.get("stop_word"):
            logging.info("停用词处理")
            self.append_log("停用词处理")
            stop_words = BotConfigStopWordService.get_by_list(bot_id=bot_id, status=1)
            word_list = [x["word"] for x in stop_words]
            for stop_word in word_list:
                if stop_word in output_query:
                    output_query = output_query.replace(stop_word, '')
            logging.info("停用词处理结束")
            self.append_log("停用词处理结束")

        if self._param.special_character and 1 == config_status.get("special_character"):
            logging.info("特殊字符处理")
            self.append_log("特殊字符处理")
            special_words = BotConfigSpecialCharacterService.get_by_list(bot_id=bot_id, status=1)
            special_words_exclude = BotConfigSpecialCharacterExcludeService.get_by_list(bot_id=bot_id,
                                                                                        status=1)
            word_list = [x["word"] for x in special_words]
            word_exclude_list = [x["word"] for x in special_words_exclude]
            for special_word in word_list:
                if special_word in output_query and self.get_special_word_removeable(output_query, special_word,
                                                                                     word_exclude_list):
                    output_query = output_query.replace(special_word, '')
            logging.info("特殊字符处理结束")
            self.append_log("特殊字符处理结束")

        if self._param.repetitive_word and 1 == config_status.get("repetitive_word"):
            logging.info("重复词处理")
            self.append_log("重复词处理")
            repetitive_words = BotConfigRepetitiveWordService.get_by_list(bot_id=bot_id,
                                                                          status=1)
            word_list = [x["word"] for x in repetitive_words]
            for repetitive_word in word_list:
                if repetitive_word:
                    pattern = rf'({re.escape(repetitive_word)}\s*)+'
                    output_query = re.sub(pattern, repetitive_word, output_query)
            logging.info("重复词处理结束")
            self.append_log("重复词处理结束")

        return InputOptimize.be_output(output_query)

    # 是否去除特殊字符
    def get_special_word_removeable(self, query: str, special_word: str, special_words_exclude: List[str]):
        '''如果该特殊字符存在于特殊字符例外中，并且特殊字符的位置和特殊字符例外的位置相同'''
        result = True
        for special_word_exclude in special_words_exclude:
            if special_word_exclude in query and special_word in special_word_exclude:
                s_index = query.index(special_word)  # 特殊字符位置
                s_e_index = query.index(special_word_exclude)  # 特殊字符除外的位置
                if s_index >= s_e_index and s_index <= (s_e_index + len(special_word_exclude) - 1):
                    result = False
                    break
        return result

    def debug(self, **kwargs):
        return self._run([], **kwargs)
