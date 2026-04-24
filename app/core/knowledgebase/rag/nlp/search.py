"""
NLP核心功能模块
提供文本合并、分词、搜索等核心功能
"""

import re
import copy
import logging
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter, defaultdict

from .rag_tokenizer import tokenizer, tokenize, fine_grained_tokenize

logger = logging.getLogger(__name__)


def is_english(texts) -> bool:
    """判断文本是否为英文"""
    if not texts:
        return False
    
    pattern = re.compile(r"[`a-zA-Z0-9\s.,':;/\"?<>!\(\)\-]")
    
    if isinstance(texts, str):
        texts = list(texts)
    elif isinstance(texts, list):
        texts = [t for t in texts if isinstance(t, str) and t.strip()]
    else:
        return False
        
    if not texts:
        return False
        
    eng = sum(1 for t in texts if pattern.fullmatch(t.strip()))
    return (eng / len(texts)) > 0.8


def is_chinese(text: str) -> bool:
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


def find_codec(blob: bytes) -> str:
    """检测文本编码"""
    try:
        import chardet
        detected = chardet.detect(blob[:1024])
        if detected['confidence'] > 0.5:
            if detected['encoding'] == "ascii":
                return "utf-8"
    except ImportError:
        pass
        
    all_codecs = [
        'utf-8', 'gb2312', 'gbk', 'utf_16', 'ascii', 'big5',
        'utf_32', 'latin_1', 'windows-1252'
    ]
    
    for c in all_codecs:
        try:
            blob[:1024].decode(c)
            return c
        except Exception:
            pass
    return "utf-8"


def concat_img(img1, img2):
    """
    合并两张图片（垂直拼接）
    
    Args:
        img1: 第一张图片 (PIL Image)
        img2: 第二张图片 (PIL Image)
        
    Returns:
        PIL Image or None
    """
    from PIL import Image
    
    if img1 and not img2:
        return img1
    if not img1 and img2:
        return img2
    if not img1 and not img2:
        return None

    if img1 is img2:
        return img1

    if isinstance(img1, Image.Image) and isinstance(img2, Image.Image):
        pixel_data1 = img1.tobytes()
        pixel_data2 = img2.tobytes()
        if pixel_data1 == pixel_data2:
            return img1

        width1, height1 = img1.size
        width2, height2 = img2.size

        new_width = max(width1, width2)
        new_height = height1 + height2
        new_image = Image.new('RGB', (new_width, new_height))

        new_image.paste(img1, (0, 0))
        new_image.paste(img2, (0, height1))
        return image


def naive_merge(sections, chunk_token_num=128, delimiter="\n", overlapped_percent=0):
    """
    简单文本合并，将切片按token数合并成chunk
    
    Args:
        sections: 文本段落列表
        chunk_token_num: 每个chunk的最大token数
        delimiter: 分隔符
        overlapped_percent: 重叠百分比
        
    Returns:
        list: 合并后的chunk列表
    """
    if not sections:
        return []
    if isinstance(sections, str):
        sections = [sections]
    if isinstance(sections[0], str):
        sections = [(s, "") for s in sections]
        
    cks = [""]
    tk_nums = [0]

    def add_chunk(t, pos):
        nonlocal cks, tk_nums, delimiter
        tnum = num_tokens_from_string(t)
        if not pos:
            pos = ""
        if tnum < 8:
            pos = ""
            
        if cks[-1] == "" or tk_nums[-1] > chunk_token_num * (100 - overlapped_percent) / 100.:
            if cks:
                overlapped = cks[-1][-int(len(cks[-1]) * (100 - overlapped_percent) / 100.):] if cks[-1] else ""
                t = overlapped + t
            if t.find(pos) < 0:
                t += pos
            cks.append(t)
            tk_nums.append(tnum)
        else:
            if cks[-1].find(pos) < 0:
                t += pos
            cks[-1] += t
            tk_nums[-1] += tnum

    custom_delimiters = [m.group(1) for m in re.finditer(r"`([^`]+)`", delimiter)]
    has_custom = bool(custom_delimiters)
    
    if has_custom:
        custom_pattern = "|".join(re.escape(t) for t in sorted(set(custom_delimiters), key=len, reverse=True))
        cks, tk_nums = [], []
        for sec, pos in sections:
            split_sec = re.split(r"(%s)" % custom_pattern, sec, flags=re.DOTALL)
            for sub_sec in split_sec:
                if re.fullmatch(custom_pattern, sub_sec or ""):
                    continue
                text = "\n" + sub_sec
                local_pos = pos
                if num_tokens_from_string(text) < 8:
                    local_pos = ""
                if local_pos and text.find(local_pos) < 0:
                    text += local_pos
                cks.append(text)
                tk_nums.append(num_tokens_from_string(text))
        return cks

    for sec, pos in sections:
        add_chunk("\n" + sec, pos)

    return cks


def naive_merge_with_images(texts, images, chunk_token_num=128, delimiter="\n", overlapped_percent=0):
    """
    带图片的简单文本合并
    
    Args:
        texts: 文本列表
        images: 图片列表
        chunk_token_num: 每个chunk的最大token数
        delimiter: 分隔符
        overlapped_percent: 重叠百分比
        
    Returns:
        tuple: (chunks, result_images)
    """
    if not texts or len(texts) != len(images):
        return [], []
        
    cks = [""]
    result_images = [None]
    tk_nums = [0]

    def add_chunk(t, image, pos=""):
        nonlocal cks, result_images, tk_nums, delimiter
        tnum = num_tokens_from_string(t)
        if not pos:
            pos = ""
        if tnum < 8:
            pos = ""
            
        if cks[-1] == "" or tk_nums[-1] > chunk_token_num * (100 - overlapped_percent) / 100.:
            if cks:
                overlapped = cks[-1][-int(len(cks[-1]) * (100 - overlapped_percent) / 100.):] if cks[-1] else ""
                t = overlapped + t
            if t.find(pos) < 0:
                t += pos
            cks.append(t)
            result_images.append(image)
            tk_nums.append(tnum)
        else:
            if cks[-1].find(pos) < 0:
                t += pos
            cks[-1] += t
            if result_images[-1] is None:
                result_images[-1] = image
            else:
                result_images[-1] = concat_img(result_images[-1], image)
            tk_nums[-1] += tnum

    custom_delimiters = [m.group(1) for m in re.finditer(r"`([^`]+)`", delimiter)]
    has_custom = bool(custom_delimiters)
    
    if has_custom:
        custom_pattern = "|".join(re.escape(t) for t in sorted(set(custom_delimiters), key=len, reverse=True))
        cks, result_images, tk_nums = [], [], []
        for text, image in zip(texts, images):
            text_str = text[0] if isinstance(text, tuple) else text
            if text_str is None:
                text_str = ""
            text_pos = text[1] if isinstance(text, tuple) and len(text) > 1 else ""
            split_sec = re.split(r"(%s)" % custom_pattern, text_str)
            for sub_sec in split_sec:
                if re.fullmatch(custom_pattern, sub_sec or ""):
                    continue
                text_seg = "\n" + sub_sec
                local_pos = text_pos
                if num_tokens_from_string(text_seg) < 8:
                    local_pos = ""
                if local_pos and text_seg.find(local_pos) < 0:
                    text_seg += local_pos
                cks.append(text_seg)
                result_images.append(image)
                tk_nums.append(num_tokens_from_string(text_seg))
        return cks, result_images

    for text, image in zip(texts, images):
        if isinstance(text, tuple):
            text_str = text[0] if text[0] is not None else ""
            text_pos = text[1] if len(text) > 1 else ""
            add_chunk("\n" + text_str, image, text_pos)
        else:
            add_chunk("\n" + (text or ""), image)

    return cks, result_images


def tokenize_chunks(chunks, doc, eng, pdf_parser=None, child_delimiters_pattern=None):
    """
    对chunks进行tokenize处理
    
    Args:
        chunks: chunk列表
        doc: 文档元信息
        eng: 是否为英文
        pdf_parser: PDF解析器（可选）
        child_delimiters_pattern: 子分隔符模式（可选）
        
    Returns:
        list: 处理后的文档列表
    """
    res = []
    for ii, ck in enumerate(chunks):
        if len(str(ck).strip()) == 0:
            continue
            
        d = copy.deepcopy(doc)
        if pdf_parser:
            try:
                d["image"], poss = pdf_parser.crop(ck, need_position=True)
                add_positions(d, poss)
                ck = pdf_parser.remove_tag(ck)
            except (NotImplementedError, AttributeError):
                pass
        else:
            add_positions(d, [[ii] * 5])

        if child_delimiters_pattern:
            d["mom_with_weight"] = ck
            res.extend(split_with_pattern(d, child_delimiters_pattern, ck, eng))
            continue

        tokenize_doc(d, ck, eng)
        res.append(d)
    return res


def tokenize_chunks_with_images(chunks, doc, eng, images, child_delimiters_pattern=None):
    """
    对带图片的chunks进行tokenize处理
    """
    res = []
    for ii, (ck, image) in enumerate(zip(chunks, images)):
        if len(str(ck).strip()) == 0:
            continue
            
        d = copy.deepcopy(doc)
        d["image"] = image
        add_positions(d, [[ii] * 5])
        
        if child_delimiters_pattern:
            d["mom_with_weight"] = ck
            res.extend(split_with_pattern(d, child_delimiters_pattern, ck, eng))
            continue
            
        tokenize_doc(d, ck, eng)
        res.append(d)
    return res


def tokenize_table(tbls, doc, eng, batch_size=10):
    """
    对表格进行tokenize处理
    """
    res = []
    for (img, rows), poss in tbls:
        if not rows:
            continue
        if isinstance(rows, str):
            d = copy.deepcopy(doc)
            tokenize_doc(d, rows, eng)
            d["content_with_weight"] = rows
            d["doc_type_kwd"] = "table"
            if img:
                d["image"] = img
                if d["content_with_weight"].find("<tr>") < 0:                    d["doc_type_kwd"] = "image"
            if poss:
                add_positions(d, poss)
            res.append(d)
            continue
            
        de = "; " if eng else "； "
        for i in range(0, len(rows), batch_size):
            d = copy.deepcopy(doc)
            r = de.join(rows[i:i + batch_size])
            tokenize_doc(d, r, eng)
            d["doc_type_kwd"] = "table"
            if img:
                d["image"] = img
                if d["content_with_weight"].find("<tr>") < 0:                    d["doc_type_kwd"] = "image"
            add_positions(d, poss)
            res.append(d)
    return res


def tokenize_doc(d, txt, eng):
    """文档tokenize函数，将文本进行分词处理并更新文档"""
    d["content_with_weight"] = txt
    t = re.sub(r"</?(table|td|caption|tr|th)( [^<>]{0,12})?>", " ", txt)
    d["content_ltks"] = tokenize(t)
    d["content_sm_ltks"] = fine_grained_tokenize(d["content_ltks"])


def split_with_pattern(d, pattern: str, content: str, eng) -> list:
    """按照pattern分割内容"""
    docs = []
    
    try:
        compiled_pattern = re.compile(r"(%s)" % pattern, flags=re.DOTALL)
    except re.error as e:
        logger.warning(f"Invalid delimiter regex pattern '{pattern}': {e}")
        dd = copy.deepcopy(d)
        tokenize_doc(dd, content, eng)
        return [dd]

    txts = [txt for txt in compiled_pattern.split(content)]
    for j in range(0, len(txts), 2):
        txt = txts[j]
        if not txt:
            continue
        if j + 1 < len(txts):
            txt += txts[j + 1]
        dd = copy.deepcopy(d)
        tokenize_doc(dd, txt, eng)
        docs.append(dd)
    return docs


def add_positions(d, poss):
    """添加位置信息到文档"""
    if not poss:
        return
    page_num_int = []
    position_int = []
    top_int = []
    for pn, left, right, top, bottom in poss:
        page_num_int.append(int(pn + 1))
        top_int.append(int(top))
        position_int.append((int(pn + 1), int(left), int(right), int(top), int(bottom)))
    d["page_num_int"] = page_num_int
    d["position_int"] = position_int
    d["top_int"] = top_int


__all__ = [
    'is_english',
    'is_chinese', 
    'find_codec',
    'concat_img',
    'naive_merge',
    'naive_merge_with_images',
    'num_tokens_from_string',
    'tokenize_chunks',
    'tokenize_chunks_with_images',
    'tokenize_table',
    'add_positions',
    'tokenize_doc',
]
