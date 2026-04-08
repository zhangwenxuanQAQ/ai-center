"""
标签分类文档切片方法
支持Excel、CSV、TXT格式的标签数据解析和分类
"""

import json
import re
import csv
import copy
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class Excel:
    """Excel标签格式解析器"""
    
    def __call__(self, fnm, binary=None, from_page=0, to_page=10000000000, callback=None, **kwargs):
        """
        解析Excel格式的标签数据
        
        假设Excel有两列：第一列是内容(Content)，第二列是标签(Tags)
        """
        try:
            import pandas as pd
            from io import BytesIO
        except ImportError:
            raise ImportError("请安装pandas和openpyxl: pip install pandas openpyxl")
        
        if binary:
            df = pd.read_excel(BytesIO(binary))
        else:
            df = pd.read_excel(fnm)
        
        tag_pairs = []
        columns = list(df.columns)
        
        # 自动检测列
        content_col = None
        tags_col = None
        
        for col in columns:
            col_lower = str(col).lower().strip()
            if col_lower in ['content', 'text', '内容', '文本', 'question', 'q']:
                content_col = col
            elif col_lower in ['tags', 'tag', 'label', 'labels', '标签', 'answer', 'a']:
                tags_col = col
        
        # 使用前两列作为默认值
        if content_col is None and len(columns) >= 1:
            content_col = columns[0]
        if tags_col is None and len(columns) >= 2:
            tags_col = columns[1]
        
        if content_col and tags_col:
            for idx, row in df.iterrows():
                if idx < from_page or idx >= to_page:
                    continue
                    
                q = str(row[content_col]).strip() if pd.notna(row[content_col]) else ""
                a = str(row[tags_col]).strip() if pd.notna(row[tags_col]) else ""
                
                if q:
                    tag_pairs.append((q, a))
                    
        callback(0.3, f"提取了 {len(tag_pairs)} 个标签对")
        return tag_pairs


def beAdoc(d, q, a, eng, row_num=-1):
    """
    构建标签文档对象
    
    Args:
        d: 文档字典
        q: 内容
        a: 标签（逗号分隔）
        eng: 是否英文
        row_num: 行号（可选）
        
    Returns:
        dict: 格式化后的文档字典
    """
    from ..nlp import rag_tokenizer
    
    d["content_with_weight"] = q
    d["content_ltks"] = rag_tokenizer.tokenize(q)
    d["content_sm_ltks"] = rag_tokenizer.fine_grained_tokenize(d["content_ltks"])
    d["tag_kwd"] = [t.strip().replace(".", "_") for t in a.split(",") if t.strip()]
    
    if row_num >= 0:
        d["top_int"] = [row_num]
    
    return d


def chunk(filename, binary=None, lang="Chinese", callback=None, **kwargs):
    """
    标签分类切片函数
    
    支持Excel、CSV、TXT格式的标签数据处理，每行作为一个带标签的chunk
    
    Args:
        filename: 文件名或文件路径
        binary: 文件二进制数据（可选）
        lang: 语言 ("Chinese" 或 "English")
        callback: 进度回调函数 callback(progress, message)
        **kwargs: 其他参数，包括:
            - delimiter: CSV/TXT分隔符（默认自动检测）
            
    Returns:
        list: 切片后的文档列表，每个元素包含内容和标签
    """
    from ..nlp import rag_tokenizer
    
    eng = lang.lower() == "english"
    res = []
    
    doc = {
        "docnm_kwd": filename,
        "title_tks": rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename)),
    }
    
    # Excel文件处理
    if re.search(r"\.xlsx?$", filename, re.IGNORECASE):
        callback(0.1, "开始解析Excel标签文件")
        
        excel_parser = Excel()
        tag_pairs = excel_parser(
            filename, 
            binary, 
            callback=callback, 
            **kwargs
        )
        
        for ii, (q, a) in enumerate(tag_pairs):
            res.append(beAdoc(copy.deepcopy(doc), q, a, eng, ii))
        
        callback(0.6, f"完成解析，共 {len(res)} 个标签对")
        
    # TXT文件处理
    elif re.search(r"\.(txt)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析TXT标签文件")
        
        txt = _get_text(filename, binary)
        lines = txt.split("\n")
        
        # 自动检测分隔符
        comma_count = sum(1 for line in lines if len(line.split(",")) == 2)
        tab_count = sum(1 for line in lines if len(line.split("\t")) == 2)
        delimiter = "\t" if tab_count >= comma_count else ","
        
        fails = []
        content = ""
        i = 0
        while i < len(lines):
            arr = lines[i].split(delimiter)
            if len(arr) != 2:
                content += "\n" + lines[i]
            elif len(arr) == 2:
                content += "\n" + arr[0]
                res.append(beAdoc(copy.deepcopy(doc), content, arr[1], eng, i))
                content = ""
            i += 1
            if len(res) % 999 == 0:
                callback(
                    len(res) * 0.6 / max(len(lines), 1),
                    f"提取标签: {len(res)}个" + (
                        f", {len(fails)}失败" if fails else ""
                    )
                )
        
        callback(0.6, f"完成解析，共 {len(res)} 个标签对")
        
    # CSV文件处理
    elif re.search(r"\.(csv)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析CSV标签文件")
        
        txt = _get_text(filename, binary)
        lines = txt.split("\n")
        
        fails = []
        content = ""
        reader = csv.reader(lines)
        
        for i, row in enumerate(reader):
            row = [r.strip() for r in row if r.strip()]
            if len(row) != 2:
                content += "\n" + lines[i] if i < len(lines) else ""
            elif len(row) == 2:
                content += "\n" + row[0]
                res.append(beAdoc(copy.deepcopy(doc), content, row[1], eng, i))
                content = ""
            if len(res) % 999 == 0:
                callback(
                    len(res) * 0.6 / max(len(lines), 1),
                    f"提取标签: {len(res)}个" + (
                        f", {len(fails)}失败" if fails else ""
                    )
                )
        
        callback(0.6, f"完成解析，共 {len(res)} 个标签对")
        
    else:
        raise NotImplementedError(f"不支持的文件类型: {filename} (支持: xlsx, txt, csv)")
    
    return res


def label_question(question, kbs, **kwargs):
    """
    使用知识库中的标签对问题进行自动标注
    
    Args:
        question: 问题文本
        kbs: 知识库列表
        **kwargs: 额外参数
        
    Returns:
        list or None: 推荐的标签列表
    """
    # TODO: 实现基于知识库的自动标注功能
    # 这需要集成检索服务和标签匹配算法
    
    tags = None
    
    # 示例实现（需要根据实际项目调整）
    tag_kb_ids = []
    for kb in kbs:
        if hasattr(kb, 'parser_config') and kb.parser_config.get("tag_kb_ids"):
            tag_kb_ids.extend(kb.parser_config["tag_kb_ids"])
    
    if tag_kb_ids:
        # 从缓存或数据库获取所有标签
        all_tags = _get_all_tags(tag_kb_ids)
        
        if all_tags:
            # 使用简单的关键词匹配进行标注
            tags = _match_tags_to_question(question, all_tags, top_n=kwargs.get("topn_tags", 3))
    
    return tags


def _get_all_tags(kb_ids):
    """获取知识库中的所有标签"""
    # TODO: 从数据库获取标签
    return []


def _match_tags_to_question(question, all_tags, top_n=3):
    """将问题与标签进行匹配"""
    # TODO: 实现更智能的标签匹配算法
    # 可以使用TF-IDF、向量相似度等方法
    
    simple_matches = []
    for tag in all_tags:
        if isinstance(tag, str) and tag.lower() in question.lower():
            simple_matches.append(tag)
    
    return simple_matches[:top_n] if simple_matches else None


def _get_text(filename, binary=None):
    """获取文本内容"""
    from ..nlp import find_codec
    
    if binary:
        encoding = find_codec(binary)
        return binary.decode(encoding, errors="ignore")
    else:
        with open(filename, 'rb') as f:
            blob = f.read()
        encoding = find_codec(blob)
        return blob.decode(encoding, errors="ignore")


if __name__ == "__main__":
    import sys
    
    def dummy_callback(prog=None, msg=""):
        print(f"[{prog}] {msg}" if prog else msg)
    
    if len(sys.argv) > 1:
        result = chunk(sys.argv[1], callback=dummy_callback)
        print(f"Total chunks: {len(result)}")
