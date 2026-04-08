"""
RAG分词器
提供文本分词、细粒度分词等功能
"""

import re
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class RagTokenizer:
    """RAG文本分词器"""

    def __init__(self):
        self._stopwords = set()
        self._load_stopwords()

    def _load_stopwords(self):
        """加载停用词"""
        common_stops = [
            "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都",
            "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会",
            "着", "没有", "看", "好", "自己", "这", "他", "她", "它", "们",
            "那", "什么", "这个", "那个", "这些", "那些", "之", "与", "及",
            "等", "或", "而", "但", "以", "可", "其", "所", "为", "于",
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "must", "shall",
            "can", "need", "dare", "ought", "used", "to", "of", "in",
            "for", "on", "with", "at", "by", "from", "as", "into",
            "through", "during", "before", "after", "above", "below",
            "between", "out", "off", "over", "under", "again", "further",
            "then", "once", "here", "there", "when", "where", "why",
            "how", "all", "each", "few", "more", "most", "other",
            "some", "such", "no", "nor", "not", "only", "own", "same",
            "so", "than", "too", "very", "s", "t", "just", "don",
            "now", "i", "me", "my", "myself", "we", "our", "ours",
            "ourselves", "you", "your", "yours", "yourself", "yourselves",
            "him", "his", "himself", "her", "hers", "herself", "its",
            "itself", "them", "their", "theirs", "themselves",
        ]
        self._stopwords = set(common_stops)

    def tokenize(self, text: str) -> str:
        """
        对文本进行分词

        Args:
            text: 输入文本

        Returns:
            str: 分词后的字符串，用空格分隔
        """
        if not text:
            return ""

        text = self._preprocess(text)
        tokens = self._split_tokens(text)
        return " ".join(tokens)

    def fine_grained_tokenize(self, tokens: str) -> str:
        """
        细粒度分词，提取关键词

        Args:
            tokens: 已分词的字符串

        Returns:
            str: 关键词字符串
        """
        if not tokens:
            return ""

        token_list = tokens.split()
        keywords = [t for t in token_list if t.lower() not in self._stopwords and len(t) > 1]
        return " ".join(keywords)

    def _preprocess(self, text: str) -> str:
        """文本预处理"""
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _split_tokens(self, text: str) -> List[str]:
        """
        分词实现（中英文混合）
        
        Args:
            text: 预处理后的文本
            
        Returns:
            List[str]: 分词结果列表
        """
        tokens = []
        current_token = ""
        
        for char in text:
            if self._is_cjk_char(char):
                if current_token and not self._is_cjk_char(current_token[-1]):
                    if current_token.strip():
                        tokens.append(current_token.strip())
                    current_token = ""
                current_token += char
                if len(current_token) >= 2:
                    tokens.append(current_token)
                    current_token = ""
            elif char.isalpha() or char.isdigit():
                if current_token and self._is_cjk_char(current_token[-1]):
                    tokens.append(current_token)
                    current_token = ""
                current_token += char
            else:
                if current_token.strip():
                    tokens.append(current_token.strip())
                current_token = ""
                
        if current_token.strip():
            tokens.append(current_token.strip())
            
        return tokens

    @staticmethod
    def _is_cjk_char(char: str) -> bool:
        """判断是否为CJK字符"""
        if not char:
            return False
        cp = ord(char)
        return (0x4E00 <= cp <= 0x9FFF or 
                0x3400 <= cp <= 0x4DBF or
                0x20000 <= cp <= 0x2A6DF or
                0x2A700 <= cp <= 0x2B73F or
                0x2B740 <= cp <= 0x2B81F or
                0x2B820 <= cp <= 0x2CEAF or
                0xF900 <= cp <= 0xFAFF or
                0x2F800 <= cp <= 0x2FA1F)

    def is_chinese(self, text: str) -> bool:
        """判断文本是否为中文"""
        if not text:
            return False
        chinese_count = sum(1 for ch in text if self._is_cjk_char(ch))
        return (chinese_count / len(text)) > 0.3 if text else False


# 全局单例实例
tokenizer = RagTokenizer()
tokenize = tokenizer.tokenize
fine_grained_tokenize = tokenizer.fine_grained_tokenize
