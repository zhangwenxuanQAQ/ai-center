"""
Naive文档切片方法
支持PDF、DOCX、Excel、TXT、Markdown、HTML等多种文档格式的解析和切片
"""

import re
import os
import logging
from functools import reduce
from io import BytesIO
from timeit import default_timer as timer

logger = logging.getLogger(__name__)


def chunk(filename, binary=None, from_page=0, to_page=100000, lang="Chinese", callback=None, **kwargs):
    """
    核心文档切片函数
    
    支持的文件格式: docx, pdf, excel, txt, markdown, html, json
    
    Args:
        filename: 文件名或文件路径
        binary: 文件二进制数据（可选）
        from_page: 起始页码
        to_page: 结束页码
        lang: 语言 ("Chinese" 或 "English")
        callback: 进度回调函数 callback(progress, message)
        **kwargs: 其他参数，包括:
            - parser_config: 解析配置字典
            - tenant_id: 租户ID
            
    Returns:
        list: 切片后的文档列表，每个元素是一个包含文档信息的字典
    """
    from ..nlp import (
        find_codec,
        naive_merge,
        naive_merge_with_images,
        rag_tokenizer,
        tokenize_chunks,
        tokenize_chunks_with_images,
        tokenize_table,
        concat_img,
        num_tokens_from_string,
        is_english,
    )
    from ..utils import (
        extract_embed_file,
        extract_links_from_pdf,
        extract_links_from_docx,
        extract_html,
        normalize_overlapped_percent,
        normalize_layout_recognizer,
        ProgressCallback,
    )
    
    urls = set()
    url_res = []
    
    if not callback:
        callback = ProgressCallback()
        
    is_eng = lang.lower() == "english"
    parser_config = kwargs.get("parser_config", {
        "chunk_token_num": 512,
        "delimiter": "\n",
        "layout_recognize": "DeepDOC",
        "analyze_hyperlink": True,
    })
    
    child_deli = (parser_config.get("children_delimiter") or "").encode("utf-8").decode("unicode_escape").encode("latin1").decode("utf-8")
    cust_child_deli = re.findall(r"`([^`]+)`", child_deli)
    child_deli = "|".join(re.sub(r"`([^`]+)`", "", child_deli))
    if cust_child_deli:
        cust_child_deli = sorted(set(cust_child_deli), key=lambda x: -len(x))
        cust_child_deli = "|".join(re.escape(t) for t in cust_child_deli if t)
        child_deli += cust_child_deli

    is_markdown = False
    table_context_size = max(0, int(parser_config.get("table_context_size", 0) or 0))
    image_context_size = max(0, int(parser_config.get("image_context_size", 0) or 0))

    doc = {"docnm_kwd": filename, "title_tks": rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename))}
    doc["title_sm_tks"] = rag_tokenizer.fine_grained_tokenize(doc["title_tks"])
    res = []
    pdf_parser = None
    section_images = None

    is_root = kwargs.get("is_root", True)
    embed_res = []
    
    if is_root:
        # 提取嵌入文件
        embeds = []
        if binary is not None:
            embeds = extract_embed_file(binary)
        else:
            raise Exception("Embedding extraction from file path is not supported.")

        # 递归处理嵌入文件
        for embed_filename, embed_bytes in embeds:
            try:
                sub_res = chunk(
                    embed_filename, 
                    binary=embed_bytes, 
                    lang=lang, 
                    callback=callback, 
                    is_root=False, 
                    **kwargs
                ) or []
                embed_res.extend(sub_res)
            except Exception as e:
                error_msg = f"Failed to chunk embed {embed_filename}: {e}"
                logger.error(error_msg)
                if callback:
                    callback(0.05, error_msg)
                continue

    # DOCX文件处理
    if re.search(r"\.docx$", filename, re.IGNORECASE):
        callback(0.1, "开始解析DOCX文件")
        
        if parser_config.get("analyze_hyperlink", False) and is_root:
            urls = extract_links_from_docx(binary)
            for index, url in enumerate(urls):
                html_bytes, metadata = extract_html(url)
                if not html_bytes:
                    continue
                try:
                    sub_url_res = chunk(url, html_bytes, callback=callback, lang=lang, is_root=False, **kwargs)
                except Exception as e:
                    logger.info(f"Failed to chunk url in docx {url}: {e}")
                    sub_url_res = chunk(f"{index}.html", html_bytes, callback=callback, lang=lang, is_root=False, **kwargs)
                url_res.extend(sub_url_res)

        sections = _parse_docx(filename, binary)
        
        chunks, images = _naive_merge_docx(
            sections, 
            int(parser_config.get("chunk_token_num", 128)), 
            parser_config.get("delimiter", "\n"),
            table_context_size, 
            image_context_size
        )

        # 将字典列表转换为tokenize_chunks_with_images期望的格式
        text_chunks = []
        image_list = []
        for ck in chunks:
            text_chunks.append(ck["text"])
            image_list.append(ck["image"])

        callback(0.8, "DOCX解析完成")
        st = timer()

        res.extend(tokenize_chunks_with_images(text_chunks, doc, is_eng, image_list, child_delimiters_pattern=child_deli))
        logger.info(f"naive_merge({filename}): {timer() - st:.2f}s")
        res.extend(embed_res)
        res.extend(url_res)
        return res

    # PDF文件处理
    elif re.search(r"\.pdf$", filename, re.IGNORECASE):
        layout_recognizer, _ = normalize_layout_recognizer(parser_config.get("layout_recognize", "DeepDOC"))

        if parser_config.get("analyze_hyperlink", False) and is_root:
            urls = extract_links_from_pdf(binary)

        if isinstance(layout_recognizer, bool):
            layout_recognizer = "DeepDOC" if layout_recognizer else "Plain Text"

        callback(0.1, "开始解析PDF文件")

        sections, tables, pdf_parser = _parse_pdf(
            filename=filename,
            binary=binary,
            from_page=from_page,
            to_page=to_page,
            lang=lang,
            callback=callback,
            layout_recognizer=layout_recognizer,
            **kwargs,
        )

        if not sections and not tables:
            return []

        if table_context_size or image_context_size:
            tables = _append_context2table_image4pdf(sections, tables, image_context_size)

        res = tokenize_table(tables, doc, is_eng)
        callback(0.8, "PDF解析完成")

    # Excel文件处理
    elif re.search(r"\.(csv|xlsx?)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析Excel文件")
        sections, tables = _parse_excel(binary, filename)
        res = tokenize_table(tables, doc, is_eng)
        callback(0.8, "Excel解析完成")

    # TXT/代码文件处理
    elif re.search(r"\.(txt|py|js|java|c|cpp|h|php|go|ts|sh|cs|kt|sql)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析文本文件")
        sections = _parse_txt(binary, filename, parser_config)
        callback(0.8, "文本文件解析完成")

    # Markdown文件处理
    elif re.search(r"\.(md|markdown|mdx)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析Markdown文件")
        markdown_parser = _Markdown(int(parser_config.get("chunk_token_num", 128)))
        sections, tables, section_images = markdown_parser(
            filename,
            binary,
            separate_tables=False,
            delimiter=parser_config.get("delimiter", "\n"),
            return_section_images=True,
        )
        is_markdown = True
        res = tokenize_table(tables, doc, is_eng)
        callback(0.8, "Markdown解析完成")

    # HTML文件处理
    elif re.search(r"\.(htm|html)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析HTML文件")
        chunk_token_num = int(parser_config.get("chunk_token_num", 128))
        sections = _parse_html(filename, binary, chunk_token_num)
        sections = [(_, "") for _ in sections if _]
        callback(0.8, "HTML解析完成")

    # JSON文件处理
    elif re.search(r"\.(json|jsonl|ldjson)$", filename, re.IGNORECASE):
        callback(0.1, "开始解析JSON文件")
        chunk_token_num = int(parser_config.get("chunk_token_num", 128))
        sections = _parse_json(binary, chunk_token_num)
        sections = [(_, "") for _ in sections if _]
        callback(0.8, "JSON解析完成")

    else:
        raise NotImplementedError(f"不支持的文件类型: {filename} (支持: pdf, xlsx, doc, docx, txt, md)")

    # 合并文本块
    st = timer()
    overlapped_percent = normalize_overlapped_percent(parser_config.get("overlapped_percent", 0))
    
    if is_markdown:
        merged_chunks = []
        merged_images = []
        chunk_limit = max(0, int(parser_config.get("chunk_token_num", 128)))

        current_text = ""
        current_tokens = 0
        current_image = None

        for idx, sec in enumerate(sections):
            text = sec[0] if isinstance(sec, tuple) else sec
            sec_tokens = num_tokens_from_string(text)
            sec_image = section_images[idx] if section_images and idx < len(section_images) else None

            if current_text and current_tokens + sec_tokens > chunk_limit:
                merged_chunks.append(current_text)
                merged_images.append(current_image)
                overlap_part = ""
                if overlapped_percent > 0:
                    overlap_len = int(len(current_text) * overlapped_percent / 100)
                    if overlap_len > 0:
                        overlap_part = current_text[-overlap_len:]
                current_text = overlap_part
                current_tokens = num_tokens_from_string(current_text)
                current_image = current_image if overlap_part else None

            if current_text:
                current_text += "\n" + text
            else:
                current_text = text
            current_tokens += sec_tokens

            if sec_image:
                current_image = concat_img(current_image, sec_image) if current_image else sec_image

        if current_text:
            merged_chunks.append(current_text)
            merged_images.append(current_image)

        chunks = merged_chunks
        has_images = merged_images and any(img is not None for img in merged_images)

        if has_images:
            res.extend(tokenize_chunks_with_images(chunks, doc, is_eng, merged_images, child_delimiters_pattern=child_deli))
        else:
            res.extend(tokenize_chunks(chunks, doc, is_eng, pdf_parser, child_delimiters_pattern=child_deli))
    else:
        if section_images:
            if all(image is None for image in section_images):
                section_images = None

        if section_images:
            chunks, images = naive_merge_with_images(
                sections, 
                section_images, 
                int(parser_config.get("chunk_token_num", 128)), 
                parser_config.get("delimiter", "\n"), 
                overlapped_percent
            )
            res.extend(tokenize_chunks_with_images(chunks, doc, is_eng, images, child_delimiters_pattern=child_deli))
        else:
            chunks = naive_merge(
                sections, 
                int(parser_config.get("chunk_token_num", 128)), 
                parser_config.get("delimiter", "\n"), 
                overlapped_percent
            )
            res.extend(tokenize_chunks(chunks, doc, is_eng, pdf_parser, child_delimiters_pattern=child_deli))

    # 处理超链接
    if urls and parser_config.get("analyze_hyperlink", False) and is_root:
        for index, url in enumerate(urls):
            html_bytes, metadata = extract_html(url)
            if not html_bytes:
                continue
            try:
                sub_url_res = chunk(url, html_bytes, callback=callback, lang=lang, is_root=False, **kwargs)
            except Exception as e:
                logger.info(f"Failed to chunk url {url}: {e}")
                sub_url_res = chunk(f"{index}.html", html_bytes, callback=callback, lang=lang, is_root=False, **kwargs)
            url_res.extend(sub_url_res)

    logger.info(f"naive_merge({filename}): {timer() - st:.2f}s")

    if embed_res:
        res.extend(embed_res)
    if url_res:
        res.extend(url_res)
        
    return res


def _parse_docx(filename, binary=None):
    """解析DOCX文件"""
    from docx import Document
    from docx.text.paragraph import Paragraph
    from docx.table import Table as DocxTable
    from PIL import Image
    
    def clean_line(line):
        line = re.sub(r"\u3000", " ", line).strip()
        return line

    try:
        doc = Document(filename) if not binary else Document(BytesIO(binary))
    except Exception as e:
        logger.error(f"Failed to parse DOCX file: {e}")
        return []

    lines = []
    
    for block in doc._element.body:
        if block.tag.endswith("p"):
            p = Paragraph(block, doc)
            text = p.text.strip()
            
            if text:
                lines.append({"text": clean_line(text), "image": None, "table": None})
                
        elif block.tag.endswith("tbl"):
            tb = DocxTable(block, doc)
            html = "<table>"
            for r in tb.rows:
                html += "<tr>"
                col_idx = 0
                try:
                    while col_idx < len(r.cells):
                        span = 1
                        c = r.cells[col_idx]
                        for j in range(col_idx + 1, len(r.cells)):
                            if c.text == r.cells[j].text:
                                span += 1
                                col_idx = j
                            else:
                                break
                        col_idx += 1
                        html += f"<td>{c.text}</td>" if span == 1 else f"<td colspan='{span}'>{c.text}</td>"
                except Exception as e:
                    logger.warning(f"Error parsing table: {e}")
                html += "</tr>"
            html += "</table>"
            lines.append({"text": "", "image": None, "table": html})

    new_line = [(line.get("text"), line.get("image"), line.get("table")) for line in lines]
    return new_line


def _parse_pdf(filename, binary=None, from_page=0, to_page=100000, lang="Chinese", callback=None, **kwargs):
    """解析PDF文件"""
    from app.core.knowledgebase.deepdoc.parser import PdfParser
    
    try:
        pdf_parser = PdfParser()
        sections, tables = pdf_parser(
            filename if not binary else binary, 
            from_page=from_page, 
            to_page=to_page, 
            callback=callback
        )
        return sections, tables, pdf_parser
    except Exception as e:
        logger.error(f"Failed to parse PDF file: {e}")
        return [], [], None


def _parse_excel(binary, filename):
    """解析Excel文件"""
    from app.core.knowledgebase.deepdoc.parser import ExcelParser
    
    try:
        excel_parser = ExcelParser()
        if binary:
            sections = [(_, "") for _ in excel_parser(binary) if _]
        else:
            with open(filename, 'rb') as f:
                data = f.read()
            sections = [(_, "") for _ in excel_parser(data) if _]
        
        tables = []
        return sections, tables
    except Exception as e:
        logger.error(f"Failed to parse Excel file: {e}")
        return [], []


def _parse_txt(binary, filename, parser_config):
    """解析TXT文件"""
    from app.core.knowledgebase.deepdoc.parser import TxtParser
    
    try:
        txt_parser = TxtParser()
        sections = txt_parser(
            binary if binary else filename, 
            parser_config.get("chunk_token_num", 128),
            parser_config.get("delimiter", "\n")
        )
        return sections
    except Exception as e:
        logger.error(f"Failed to parse TXT file: {e}")
        return []


def _parse_html(filename, binary, chunk_token_num):
    """解析HTML文件"""
    from app.core.knowledgebase.deepdoc.parser import HtmlParser
    
    try:
        html_parser = HtmlParser()
        sections = html_parser(binary if binary else filename, chunk_token_num)
        return sections
    except Exception as e:
        logger.error(f"Failed to parse HTML file: {e}")
        return []


def _parse_json(binary, chunk_token_num):
    """解析JSON文件"""
    from app.core.knowledgebase.deepdoc.parser import JsonParser
    
    try:
        json_parser = JsonParser(chunk_token_num)
        sections = json_parser(binary)
        return sections
    except Exception as e:
        logger.error(f"Failed to parse JSON file: {e}")
        return []


class _Markdown:
    """Markdown解析器内部类"""
    
    def __init__(self, chunk_token_num=128):
        self.chunk_token_num = chunk_token_num
        
    def __call__(self, filename, binary=None, separate_tables=True, delimiter="\n", return_section_images=False):
        from app.core.knowledgebase.deepdoc.parser import MarkdownParser, MarkdownElementExtractor
        from ..nlp import find_codec, concat_img
        
        try:
            markdown_parser = MarkdownParser(self.chunk_token_num)
            
            if binary:
                encoding = find_codec(binary)
                txt = binary.decode(encoding, errors="ignore")
            else:
                with open(filename, "r") as f:
                    txt = f.read()

            remainder, tables = self._extract_tables_and_remainder(txt, separate_tables)
            extractor = MarkdownElementExtractor(txt)
            
            element_sections = extractor.extract_elements(delimiter, include_meta=True)
            sections = []
            section_images = []

            for element in element_sections:
                content = element["content"]
                sections.append((content, ""))
                section_images.append(None)

            tbls = []
            for table in tables:
                tbls.append(((None, table), ""))
                
            if return_section_images:
                return sections, tbls, section_images
            return sections, tbls
            
        except Exception as e:
            logger.error(f"Failed to parse Markdown: {e}")
            if return_section_images:
                return [], [], []
            return [], []

    @staticmethod
    def _extract_tables_and_remainder(text, separate_tables=True):
        """提取表格和剩余内容"""
        import re
        
        tables = []
        remainder = text
        
        if separate_tables:
            # 简单的表格提取逻辑
            table_pattern = r'\|.*?\|\n\|[-:\s|]+\|.*?(?=\n\n|\Z)'
            matches = re.findall(table_pattern, text, re.DOTALL | re.MULTILINE)
            tables = [(m,) for m in matches]
            
        return remainder, tables


def _naive_merge_docx(sections, chunk_token_num=128, delimiter="\n", table_context_size=0, image_context_size=0):
    """DOCX文件的naive合并"""
    if not sections:
        return [], []

    cks, tables, images, has_custom = _build_cks(sections, delimiter)

    if table_context_size > 0:
        for i in tables:
            _add_context(cks, i, table_context_size)

    if image_context_size > 0:
        for i in images:
            _add_context(cks, i, image_context_size)
    
    merged_cks, merged_image_idx = _merge_cks(cks, chunk_token_num, has_custom)

    return merged_cks, merged_image_idx


def _build_cks(sections, delimiter):
    """构建chunks结构"""
    cks = []
    tables = []
    images = []

    custom_delimiters = [m.group(1) for m in re.finditer(r"`([^`]+)`", delimiter)]
    has_custom = bool(custom_delimiters)

    if has_custom:
        custom_pattern = "|".join(
            re.escape(t) for t in sorted(set(custom_delimiters), key=len, reverse=True)
        )
        pattern = r"(%s)" % custom_pattern

    seg = ""
    for text, image, table in sections:
        if not text:
            text = ""
        else:
            text = "\n" + str(text)

        if table:
            ck_text = text + str(table)
            idx = len(cks)
            cks.append({
                "text": ck_text,
                "image": image,
                "ck_type": "table",
                "tk_nums": len(ck_text.split()),
            })
            tables.append(idx)
            continue

        if image:
            idx = len(cks)
            cks.append({
                "text": text,
                "image": image,
                "ck_type": "image",
                "tk_nums": len(text.split()),
            })
            images.append(idx)
            continue

        if has_custom:
            split_sec = re.split(pattern, text)
            for sub_sec in split_sec:
                if not sub_sec or not sub_sec.strip():
                    if seg and seg.strip():
                        s = seg.strip()
                        cks.append({
                            "text": s,
                            "image": None,
                            "ck_type": "text",
                            "tk_nums": len(s.split()),
                        })
                    seg = ""
                    continue

                if re.fullmatch(custom_pattern, sub_sec.strip()):
                    if seg and seg.strip():
                        s = seg.strip()
                        cks.append({
                            "text": s,
                            "image": None,
                            "ck_type": "text",
                            "tk_nums": len(s.split()),
                        })
                    seg = ""
                    continue

                seg += sub_sec
        else:
            if text and text.strip():
                t = text.strip()
                cks.append({
                    "text": t,
                    "image": None,
                    "ck_type": "text",
                    "tk_nums": len(t.split()),
                })

    if has_custom and seg and seg.strip():
        s = seg.strip()
        cks.append({
            "text": s,
            "image": None,
            "ck_type": "text",
            "tk_nums": len(s.split()),
        })

    return cks, tables, images, has_custom


def _add_context(cks, idx, context_size):
    """为图片或表格添加上下文"""
    if cks[idx]["ck_type"] not in ("image", "table"):
        return

    prev = idx - 1
    after = idx + 1
    remain_above = context_size
    remain_below = context_size

    cks[idx]["context_above"] = ""
    cks[idx]["context_below"] = ""

    split_pat = r"([。!?？；！\n]|\. )"

    parts_above = []
    while prev >= 0 and remain_above > 0:
        if cks[prev]["ck_type"] == "text":
            tk = cks[prev]["tk_nums"]
            if tk >= remain_above:
                piece = _take_sentences_from_end(cks[prev]["text"], remain_above)
                parts_above.insert(0, piece)
                remain_above = 0
                break
            else:
                parts_above.insert(0, cks[prev]["text"])
                remain_above -= tk
        prev -= 1

    parts_below = []
    while after < len(cks) and remain_below > 0:
        if cks[after]["ck_type"] == "text":
            tk = cks[after]["tk_nums"]
            if tk >= remain_below:
                piece = _take_sentences_from_start(cks[after]["text"], remain_below)
                parts_below.append(piece)
                remain_below = 0
                break
            else:
                parts_below.append(cks[after]["text"])
                remain_below -= tk
        after += 1

    cks[idx]["context_above"] = "".join(parts_above) if parts_above else ""
    cks[idx]["context_below"] = "".join(parts_below) if parts_below else ""


def _take_sentences_from_end(cnt, need_tokens):
    """从末尾取句子"""
    split_pat = r"([。!?？；！\n]|\. )"
    txts = re.split(split_pat, cnt, flags=re.DOTALL)
    sents = []
    for j in range(0, len(txts), 2):
        sents.append(txts[j] + (txts[j + 1] if j + 1 < len(txts) else ""))
    acc = ""
    for s in reversed(sents):
        acc = s + acc
        if len(acc.split()) >= need_tokens:
            break
    return acc


def _take_sentences_from_start(cnt, need_tokens):
    """从开头取句子"""
    split_pat = r"([。!?？；！\n]|\. )"
    txts = re.split(split_pat, cnt, flags=re.DOTALL)
    acc = ""
    for j in range(0, len(txts), 2):
        acc += txts[j] + (txts[j + 1] if j + 1 < len(txts) else "")
        if len(acc.split()) >= need_tokens:
            break
    return acc


def _merge_cks(cks, chunk_token_num, has_custom):
    """合并chunks"""
    merged = []
    image_idxs = []
    prev_text_ck = -1

    for i in range(len(cks)):
        ck_type = cks[i]["ck_type"]

        if ck_type != "text":
            merged.append(cks[i])
            if ck_type == "image":
                image_idxs.append(len(merged) - 1)
            continue

        if prev_text_ck < 0 or merged[prev_text_ck]["tk_nums"] >= chunk_token_num or has_custom:
            merged.append(cks[i])
            prev_text_ck = len(merged) - 1
            continue

        merged[prev_text_ck]["text"] = (merged[prev_text_ck].get("text") or "") + (cks[i].get("text") or "")
        merged[prev_text_ck]["tk_nums"] = merged[prev_text_ck].get("tk_nums", 0) + cks[i].get("tk_nums", 0)

    return merged, image_idxs


def _append_context2table_image4pdf(sections, tabls, table_context_size=0):
    """为PDF中的表格和图片添加上下文"""
    if table_context_size <= 0:
        return tabls
        
    page_bucket = defaultdict(list)
    
    for i, item in enumerate(sections):
        if isinstance(item, (tuple, list)):
            if len(item) > 2:
                txt, _, poss = item[0], item[1], item[2]
            else:
                txt = item[0] if item else ""
                poss = item[1] if len(item) > 1 else ""
        else:
            txt = item
            poss = ""
            
        if isinstance(txt, str) and "@@" in txt:
            txt = re.sub(r"@@[0-9-]+\t[0-9.\t]+##", "", txt).strip()
            
        if poss:
            for page, left, right, top, bottom in poss:
                if isinstance(page, list):
                    page = page[0] if page else 0
                page_bucket[page].append(((left, right, top, bottom), txt))

    res = []
    for (img, tb), poss in tabls:
        if not poss:
            continue
            
        page, left, right, top, bott = poss[0]
        if isinstance(tb, list):
            tb = "\n".join(tb)

        upper = _upper_context(page_bucket, page, -1, table_context_size)
        lower = _lower_context(page_bucket, page, 0, table_context_size)
        tb = upper + tb + lower

        res.append(((img, tb), poss))
        
    return res


def _upper_context(page_bucket, page, i, table_context_size):
    """获取上方上下文"""
    from ..nlp import num_tokens_from_string
    
    txt = ""
    while num_tokens_from_string(txt) < table_context_size:
        if i < 0:
            page -= 1
            if page < 0 or page not in page_bucket:
                break
            i = len(page_bucket[page]) - 1
        blks = page_bucket.get(page, [])
        if i < 0 or i >= len(blks):
            break
        (_, _, _, _), cnt = blks[i]
        txts = re.split(r"([。!?？；！\n]|\. )", cnt, flags=re.DOTALL)[::-1]
        for j in range(0, len(txts), 2):
            txt = (txts[j+1] if j+1<len(txts) else "") + txts[j] + txt
            if num_tokens_from_string(txt) > table_context_size:
                break
        i -= 1
    return txt


def _lower_context(page_bucket, page, i, table_context_size):
    """获取下方上下文"""
    from ..nlp import num_tokens_from_string
    
    txt = ""
    while num_tokens_from_string(txt) < table_context_size:
        if i >= len(page_bucket.get(page, [])):
            page += 1
            if page not in page_bucket:
                break
            i = 0
        blks = page_bucket.get(page, [])
        if i >= len(blks):
            break
        (_, _, _, _), cnt = blks[i]
        txts = re.split(r"([。!?？；！\n]|\. )", cnt, flags=re.DOTALL)
        for j in range(0, len(txts), 2):
            txt += txts[j] + (txts[j+1] if j+1<len(txts) else "")
            if num_tokens_from_string(txt) > table_context_size:
                break
        i += 1
    return txt


if __name__ == "__main__":
    import sys
    
    def dummy_callback(prog=None, msg=""):
        print(f"[{prog}] {msg}" if prog else msg)
    
    if len(sys.argv) > 1:
        result = chunk(sys.argv[1], callback=dummy_callback)
        print(f"Total chunks: {len(result)}")
