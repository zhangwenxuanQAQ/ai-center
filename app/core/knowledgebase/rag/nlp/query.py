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
import json
import re
from collections import defaultdict

from app.core.knowledgebase.rag.nlp import rag_tokenizer
from app.core.knowledgebase.rag.nlp import term_weight

logger = logging.getLogger(__name__)


class MatchTextExpr:
    """文本匹配表达式"""
    
    def __init__(
        self,
        fields: list,
        matching_text: str,
        topn: int,
        extra_options: dict = None,
    ):
        self.fields = fields
        self.matching_text = matching_text
        self.topn = topn
        self.extra_options = extra_options or {}


class FulltextQueryer:
    def __init__(self):
        self.tw = term_weight.Dealer()
        self.query_fields = [
            "title_tks^10",
            "title_sm_tks^5",
            "important_kwd^30",
            "important_tks^20",
            "question_tks^20",
            "content_ltks^2",
            "content_sm_ltks",
        ]

    def is_chinese(self, text: str) -> bool:
        """判断文本是否为中文"""
        if not text:
            return False
        chinese = 0
        for ch in text:
            if '\u4e00' <= ch <= '\u9fff':
                chinese += 1
        if chinese / len(text) > 0.2:
            return True
        return False

    def add_space_between_eng_zh(self, txt):
        """在英文和中文之间添加空格"""
        return re.sub(r'([a-zA-Z])([^\x00-\xff])', r'\1 \2', re.sub(r'([^\x00-\xff])([a-zA-Z])', r'\1 \2', txt))

    def rmWWW(self, txt):
        """移除www前缀"""
        txt = re.sub(r"https?://www\.", "https://", txt)
        txt = re.sub(r"https?://", "", txt)
        return txt

    def sub_special_char(self, txt):
        """替换特殊字符"""
        return re.sub(r"[ :|\r\n\t,，。？?/`!！&^%%()\[\]{}<>*~'\"\\]+", " ", txt).strip()

    def question(self, txt, min_match: float = 0.3):
        """
        解析查询问题，提取关键词并构建文本匹配表达式
        
        Args:
            txt: 查询文本
            min_match: 最小匹配度（默认0.3，最大不超过0.3）
            
        Returns:
            tuple: (MatchTextExpr, keywords)
        """
        if min_match > 0.3:
            min_match = 0.3
        
        original_query = txt
        txt = self.add_space_between_eng_zh(txt)
        txt = re.sub(
            r"[ :|\r\n\t,，。？?/`!！&^%%()\[\]{}<>*~'\"\\]+",
            " ",
            rag_tokenizer.tradi2simp(rag_tokenizer.strQ2B(txt.lower())),
        ).strip()
        otxt = txt
        txt = self.rmWWW(txt)
        
        keywords = []
        
        if not self.is_chinese(txt):
            txt = self.rmWWW(txt)
            tks = rag_tokenizer.tokenize(txt).split()
            keywords = [t for t in tks if t]
            tks_w = self.tw.weights(tks, preprocess=False)
            tks_w = [(re.sub(r"[ \\\"'^]", "", tk), w) for tk, w in tks_w]
            tks_w = [(re.sub(r"^[\+-]", "", tk), w) for tk, w in tks_w if tk]
            tks_w = [(tk.strip(), w) for tk, w in tks_w if tk.strip()]
            
            q = ["({}^{:.4f})".format(tk, w) for tk, w in tks_w if tk]
            for i in range(1, len(tks_w)):
                left, right = tks_w[i - 1][0].strip(), tks_w[i][0].strip()
                if not left or not right:
                    continue
                q.append(
                    '"%s %s"^%.4f'
                    % (
                        tks_w[i - 1][0],
                        tks_w[i][0],
                        max(tks_w[i - 1][1], tks_w[i][1]) * 2,
                    )
                )
            if not q:
                q.append(txt)
            query = " ".join(q)
            
            match_expr = MatchTextExpr(
                self.query_fields, query, 100, {"original_query": original_query}
            )
            
            for tk, w in tks_w[:256]:
                keywords.append(tk)
        else:
            def need_fine_grained_tokenize(tk):
                if len(tk) < 3:
                    return False
                if re.match(r"[0-9a-z\.\+#_\*-]+$", tk):
                    return False
                return True
            
            txt = self.rmWWW(txt)
            qs = []
            for tt in self.tw.split(txt)[:256]:
                if not tt:
                    continue
                keywords.append(tt)
                twts = self.tw.weights([tt])
                
                tms = []
                for tk, w in sorted(twts, key=lambda x: x[1] * -1):
                    sm = (
                        rag_tokenizer.fine_grained_tokenize(tk).split()
                        if need_fine_grained_tokenize(tk)
                        else []
                    )
                    sm = [
                        re.sub(
                            r"[ ,\./;'\[\]\\`~!@#$%\^&\*\(\)=\+_<>\?:\"\{\}\|，。；'【】、！￥……（）——《》？：\"-]+",
                            "",
                            m,
                        )
                        for m in sm
                    ]
                    sm = [self.sub_special_char(m) for m in sm if len(m) > 1]
                    sm = [m for m in sm if len(m) > 1]
                    if len(keywords) < 32:
                        keywords.append(re.sub(r"[ \\\"']+", "", tk))
                        keywords.extend(sm)
                    tk = self.sub_special_char(tk)
                    if tk.find(" ") > 0:
                        tk = '"%s"' % tk
                    if sm:
                        tk = f'{tk} OR "%s" OR ("%s"~2)^0.5' % (" ".join(sm), " ".join(sm))
                    if tk.strip():
                        tms.append((tk, w))
                tms = " ".join([f"({t})^{w}" for t, w in tms])
                if len(twts) > 1:
                    tms += ' ("%s"~2)^1.5' % rag_tokenizer.tokenize(tt)
                if tms:
                    qs.append(tms)
            
            if qs:
                query = " OR ".join([f"({t})" for t in qs if t])
                if not query:
                    query = otxt
                match_expr = MatchTextExpr(
                    self.query_fields, query, 100, {"minimum_should_match": min_match, "original_query": original_query}
                )
            else:
                match_expr = None
        
        return match_expr, keywords

    def hybrid_similarity(self, avec, bvecs, atks, btkss, tkweight=0.3, vtweight=0.7):
        """
        计算混合相似度
        
        Args:
            avec: 查询向量
            bvecs: 文档向量列表
            atks: 查询关键词
            btkss: 文档关键词列表
            tkweight: 关键词权重
            vtweight: 向量权重
            
        Returns:
            tuple: (混合相似度, 关键词相似度, 向量相似度)
        """
        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np
        
        sims = cosine_similarity([avec], bvecs)
        tksim = self.token_similarity(atks, btkss)
        if np.sum(sims[0]) == 0:
            return np.array(tksim), tksim, sims[0]
        return np.array(sims[0]) * vtweight + np.array(tksim) * tkweight, tksim, sims[0]

    def token_similarity(self, atks, btkss):
        """
        计算token相似度
        
        Args:
            atks: 查询关键词
            btkss: 文档关键词列表
            
        Returns:
            list: 相似度列表
        """
        def to_dict(tks):
            if isinstance(tks, str):
                tks = tks.split()
            d = defaultdict(int)
            wts = self.tw.weights(tks, preprocess=False)
            for i, (t, c) in enumerate(wts):
                d[t] += c
            return d
        
        atks = to_dict(atks)
        btkss = [to_dict(tks) for tks in btkss]
        return [self.similarity(atks, btks) for btks in btkss]

    def similarity(self, qtwt, dtwt):
        """
        计算两个词权重字典之间的相似度
        
        Args:
            qtwt: 查询词权重字典
            dtwt: 文档词权重字典
            
        Returns:
            float: 相似度
        """
        if isinstance(dtwt, type("")):
            dtwt = {t: w for t, w in self.tw.weights(self.tw.split(dtwt), preprocess=False)}
        if isinstance(qtwt, type("")):
            qtwt = {t: w for t, w in self.tw.weights(self.tw.split(qtwt), preprocess=False)}
        s = 1e-9
        for k, v in qtwt.items():
            if k in dtwt:
                s += v
        q = 1e-9
        for k, v in qtwt.items():
            q += v
        return s / q
