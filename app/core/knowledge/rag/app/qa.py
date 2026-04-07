"""
问答对文档切片方法
支持从文档中提取问答对或直接处理QA格式数据
"""

import copy
import re
import csv
import io
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)


class Excel:
    """Excel QA格式解析器"""
    
    def __call__(self, fnm, binary=None, from_page=0, to_page=10000000000, callback=None, **kwargs):
        """
        解析Excel格式的QA数据
        
        假设Excel有两列：第一列是问题(Q)，第二列是答案(A)
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
        
        qa_pairs = []
        
        # 自动检测列名
        columns = list(df.columns)
        q_col = None
        a_col = None
        
        for col in columns:
            col_lower = str(col).lower().strip()
            if col_lower in ['question', 'q', '问题', '问']:
                q_col = col
            elif col_lower in ['answer', 'a', '答案', '答']:
                a_col = col
        
        # 如果没有检测到标准列名，使用前两列
        if q_col is None and len(columns) >= 1:
            q_col = columns[0]
        if a_col is None and len(columns) >= 2:
            a_col = columns[1]
        
        if q_col and a_col:
            for idx, row in df.iterrows():
                if idx < from_page or idx >= to_page:
                    continue
                    
                q = str(row[q_col]).strip() if pd.notna(row[q_col]) else ""
                a = str(row[a_col]).strip() if pd.notna(row[a_col]) else ""
                
                if q and a:
                    qa_pairs.append((q, a))
                    
        callback(0.3, f"提取了 {len(qa_pairs)} 个问答对")
        return qa_pairs


def chunk(filename, binary=None, from_page=0, to_page=10000000000, lang="Chinese", callback=None, **kwargs):
    """
    问答对切片函数
    
    支持Excel、CSV、TXT格式的QA数据处理，每对Q&A作为一个chunk
    
    Args:
        filename: 文件名或文件路径
        binary: 文件二进制数据（可选）
        from_page: 起始行号
        to_page: 结束行号
        lang: 语言 ("Chinese" 或 "English")
        callback: 进度回调函数 callback(progress, message)
        **kwargs: 其他参数，包括:
            - delimiter: CSV分隔符（默认逗号）
            
    Returns:
        list: 切片后的文档列表，每个元素是一个QA对
    """
    from ..nlp import rag_tokenizer, tokenize
    
    eng = lang.lower() == "english"
    res = []
    
    doc = {
        "docnm_kwd": filename,
        "title_tks": rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename)),
    }
    doc["title_sm_tks"] = rag_tokenizer.fine_grained_tokenize(doc["title_tks"])
    
    # Excel文件处理
    if re.search(r"\.xlsx?$", filename, re.IGNORECASE):
        callback(0.1, "开始解析Excel QA文件")
        
        excel_parser = Excel()
        qa_pairs = excel_parser(
            filename, 
            binary, 
            from_page=from_page, 
            to_page=to_page, 
            callback=callback, 
            **kwargs
        )
        
        for ii, (q, a) in enumerate(qa_pairs):
            d = copy.deepcopy(doc)
            d = beAdoc(d, q, a, eng, row_num=ii + 1)
            res.append(d)
        
        callback(0.6, f"完成解析，共 {len(res)} 个QA对")
        
    # TXT文件处理
    elif re.search(r"\.(txt)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析TXT QA文件")
        
        txt = _get_text(filename, binary)
        lines = txt.split("\n")
        
        # 自动检测分隔符（逗号或制表符）
        comma_count = sum(1 for line in lines if len(line.split(",")) == 2)
        tab_count = sum(1 for line in lines if len(line.split("\t")) == 2)
        delimiter = "\t" if tab_count > comma_count else ","
        
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
                    len(res) * 0.6 / len(lines),
                    f"提取QA: {len(res)}个" + (
                        f", {len(fails)}失败, 行: {','.join(fails[:3])}" if fails else ""
                    )
                )
        
        callback(0.6, f"完成解析，共 {len(res)} 个QA对")
        
    # CSV文件处理
    elif re.search(r"\.(csv)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析CSV QA文件")
        
        txt = _get_text(filename, binary)
        delimiter = kwargs.get("delimiter", ",")
        
        reader = csv.reader(io.StringIO(txt), delimiter=delimiter)
        all_rows = list(reader)
        
        fails = []
        content = ""
        
        for i, row in enumerate(all_rows[1 + from_page: 1 + to_page]):
            row = [r.strip() for r in row if r.strip()]
            if len(row) != 2:
                content += "\n" + row[0] if row else ""
            elif len(row) == 2:
                content += "\n" + row[0]
                res.append(beAdoc(copy.deepcopy(doc), content, row[1], eng, i))
                content = ""
                
            if len(res) % 999 == 0:
                callback(
                    len(res) * 0.6 / max(len(all_rows), 1),
                    f"提取QA: {len(res)}个" + (
                        f", {len(fails)}失败" if fails else ""
                    )
                )
        
        callback(0.6, f"完成解析，共 {len(res)} 个QA对")
        
    else:
        raise NotImplementedError(f"不支持的文件类型: {filename} (支持: xlsx, txt, csv)")
    
    return res


def beAdoc(d, q, a, eng, row_num=-1):
    """
    构建QA文档对象
    
    Args:
        d: 文档字典
        q: 问题
        a: 答案
        eng: 是否英文
        row_num: 行号（可选）
        
    Returns:
        dict: 格式化后的文档字典
    """
    d["content_with_weight"] = q
    d["content_ltks"] = rag_tokenizer.tokenize(q)
    d["content_sm_ltks"] = rag_tokenizer.fine_grained_tokenize(d["content_ltks"])
    d["answer_kwd"] = a.strip() if isinstance(a, str) else ", ".join(str(x) for x in a if x)
    
    if row_num >= 0:
        d["top_int"] = [row_num]
    
    return d


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
