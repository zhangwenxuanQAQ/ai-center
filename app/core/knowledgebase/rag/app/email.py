"""
邮件文档切片方法
支持EML格式邮件的结构化解析和附件处理
"""

import io
import re
import logging
from timeit import default_timer as timer
from email import policy
from email.parser import BytesParser

logger = logging.getLogger(__name__)


def chunk(
    filename,
    binary=None,
    from_page=0,
    to_page=100000,
    lang="Chinese",
    callback=None,
    **kwargs,
):
    """
    邮件切片函数
    
    解析EML格式的邮件，提取邮件头、正文、附件等内容
    
    Args:
        filename: 文件名或文件路径
        binary: 文件二进制数据（可选）
        from_page: 未使用（保留兼容性）
        to_page: 未使用（保留兼容性）
        lang: 语言 ("Chinese" 或 "English")
        callback: 进度回调函数 callback(progress, message)
        **kwargs: 其他参数
        
    Returns:
        list: 切片后的文档列表
    """
    from ..nlp import rag_tokenizer, naive_merge, tokenize_chunks
    from .naive import chunk as naive_chunk
    
    eng = lang.lower() == "english"
    
    parser_config = kwargs.get(
        "parser_config",
        {"chunk_token_num": 512, "delimiter": "\n!?。；！？", "layout_recognize": "DeepDOC"},
    )
    
    doc = {
        "docnm_kwd": filename,
        "title_tks": rag_tokenizer.tokenize(re.sub(r"\.[a-zA-Z]+$", "", filename)),
    }
    doc["title_sm_tks"] = rag_tokenizer.fine_grained_tokenize(doc["title_tks"])
    
    main_res = []
    attachment_res = []
    
    # 解析邮件
    if binary:
        buffer = io.BytesIO(binary)
        msg = BytesParser(policy=policy.default).parse(buffer)
    else:
        with open(filename, "rb") as buffer:
            msg = BytesParser(policy=policy.default).parse(buffer)
    
    text_txt = []
    html_txt = []
    
    # 提取邮件头信息
    for header, value in msg.items():
        text_txt.append(f"{header}: {value}")
    
    # 提取邮件正文
    _add_content(msg, msg.get_content_type(), text_txt, html_txt)
    
    # 处理纯文本部分
    sections_from_text = _parse_plain_text("\n".join(text_txt))
    
    # 处理HTML部分
    sections_from_html = [
        (line, "") for line in _parse_html_text(
            "\n".join(html_txt), 
            chunk_token_num=parser_config["chunk_token_num"]
        ) if line
    ]
    
    # 合并所有sections
    all_sections = sections_from_text + sections_from_html
    
    # 使用naive merge分块
    st = timer()
    chunks = naive_merge(
        all_sections,
        int(parser_config.get("chunk_token_num", 128)),
        parser_config.get("delimiter", "\n!?。；！？"),
    )
    
    main_res.extend(tokenize_chunks(chunks, doc, eng, None))
    logger.debug(f"naive_merge({filename}): {timer() - st:.2f}s")
    
    # 处理附件
    for part in msg.iter_attachments():
        content_disposition = part.get("Content-Disposition")
        if content_disposition:
            dispositions = content_disposition.strip().split(";")
            if dispositions[0].lower() == "attachment":
                attach_filename = part.get_filename()
                payload = part.get_payload(decode=True)
                
                try:
                    # 递归调用naive chunk处理附件
                    attachment_res.extend(
                        naive_chunk(attach_filename, payload, callback=callback, **kwargs)
                    )
                except Exception as e:
                    logger.warning(f"处理附件 {attach_filename} 失败: {e}")
    
    callback(0.8, f"邮件解析完成 (正文: {len(main_res)} chunks, 附件: {len(attachment_res)} chunks)")
    
    return main_res + attachment_res


def _add_content(msg, content_type, text_list, html_list):
    """
    递归提取邮件内容
    
    Args:
        msg: 邮件消息对象
        content_type: 内容类型
        text_list: 纯文本列表
        html_list: HTML文本列表
    """
    def _decode_payload(payload, charset, target_list):
        """解码payload"""
        try:
            target_list.append(payload.decode(charset))
        except (UnicodeDecodeError, LookupError):
            for enc in ["utf-8", "gb2312", "gbk", "gb18030", "latin1"]:
                try:
                    target_list.append(payload.decode(enc))
                    break
                except UnicodeDecodeError:
                    continue
            else:
                target_list.append(payload.decode("utf-8", errors="ignore"))
    
    if content_type == "text/plain":
        payload = msg.get_payload(decode=True)
        charset = msg.get_content_charset() or "utf-8"
        _decode_payload(payload, charset, text_list)
        
    elif content_type == "text/html":
        payload = msg.get_payload(decode=True)
        charset = msg.get_content_charset() or "utf-8"
        _decode_payload(payload, charset, html_list)
        
    elif "multipart" in content_type:
        if msg.is_multipart():
            for part in msg.iter_parts():
                _add_content(part, part.get_content_type(), text_list, html_list)


def _parse_plain_text(text):
    """解析纯文本为sections"""
    try:
        from app.core.knowledge.deepdoc.parser import TxtParser
        return TxtParser.parser_txt(text)
    except Exception:
        return [(line, "") for line in text.split('\n') if line.strip()]


def _parse_html_text(html_text, chunk_token_num=512):
    """解析HTML文本"""
    try:
        from app.core.knowledge.deepdoc.parser import HtmlParser
        return HtmlParser.parser_txt(html_text, chunk_token_num=chunk_token_num)
    except Exception:
        # 简单的HTML标签清理
        clean_html = re.sub(r'<[^>]+>', '', html_text)
        return [line for line in clean_html.split('\n') if line.strip()]


if __name__ == "__main__":
    import sys
    
    def dummy_callback(prog=None, msg=""):
        print(f"[{prog}] {msg}" if prog else msg)
    
    if len(sys.argv) > 1:
        result = chunk(sys.argv[1], callback=dummy_callback)
        print(f"Total chunks: {len(result)}")
