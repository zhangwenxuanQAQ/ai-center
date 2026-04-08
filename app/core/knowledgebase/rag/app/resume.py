"""
简历文档切片方法
支持PDF、DOCX、TXT格式的简历结构化解析
"""

import base64
import json
import re
import logging

try:
    import pandas as pd
except ImportError:
    pd = None

logger = logging.getLogger(__name__)

# 简历字段禁止选择列表（用于前端过滤）
forbidden_select_fields4resume = [
    "name_pinyin_kwd", 
    "edu_first_fea_kwd", 
    "degree_kwd", 
    "sch_rank_kwd", 
    "edu_fea_kwd"
]


def remote_call(filename, binary):
    """
    远程调用简历解析服务
    
    这是一个简化实现，实际项目中应该连接到简历解析微服务
    
    Args:
        filename: 文件名
        binary: 文件二进制数据
        
    Returns:
        dict: 解析后的简历数据
    """
    # TODO: 实现实际的远程调用或本地简历解析
    # 这里返回一个示例简历结构作为演示
    
    resume = {
        "name": "张三",
        "gender": "男",
        "age": 28,
        "phone": "13800138000",
        "email": "zhangsan@example.com",
        "position_name": "软件工程师",
        "work_exp": 5,
        "corporation_name": "某某科技有限公司",
        
        # 教育背景
        "first_school_name": "清华大学",
        "first_degree": "本科",
        "first_major": "计算机科学与技术",
        "highest_degree": "硕士",
        "major": "人工智能",
        "school_name": "北京大学",
        
        # 其他信息
        "expect_city_names": ["北京", "上海"],
        "industry_name": "互联网/IT",
    }
    
    return resume


def chunk(filename, binary=None, callback=None, **kwargs):
    """
    简历切片函数
    
    支持PDF、DOCX、TXT格式的简历解析，将整个简历作为一个结构化chunk
    
    Args:
        filename: 文件名或文件路径
        binary: 文件二进制数据（可选）
        callback: 进度回调函数 callback(progress, message)
        **kwargs: 其他参数，包括:
            - kb_id: 知识库ID
            
    Returns:
        list: 包含单个简历文档元素的列表
    """
    from ..nlp import rag_tokenizer, tokenize
    
    if not re.search(r"\.(pdf|doc|docx|txt)$", filename, flags=re.IGNORECASE):
        raise NotImplementedError(f"不支持的文件类型: {filename} (支持: pdf, doc, docx, txt)")
    
    if not binary:
        with open(filename, "rb") as f:
            binary = f.read()
    
    callback(0.2, "正在解析简历...")
    
    # 调用简历解析服务
    resume = remote_call(filename, binary)
    
    if len(resume.keys()) < 7:
        callback(-1, "简历解析失败")
        raise Exception("简历解析服务调用失败！")
    
    callback(0.6, "解析完成，正在生成chunk...")
    logger.debug(f"简历解析结果: {json.dumps(resume, ensure_ascii=False, indent=2)}")
    
    # 简历字段映射（用于搜索和显示）
    field_map = {
        "name_kwd": "姓名/名字",
        "name_pinyin_kwd": "姓名拼音/名字拼音",
        "gender_kwd": "性别（男，女）",
        "age_int": "年龄/岁/年纪",
        "phone_kwd": "电话/手机/微信",
        "email_tks": "email/e-mail/邮箱",
        "position_name_tks": "职位/职能/岗位/职责",
        "expect_city_names_tks": "期望城市",
        "work_exp_flt": "工作年限/工作年份/N年经验/毕业了多少年",
        "corporation_name_tks": "最近就职(上班)的公司/上一家公司",

        "first_school_name_tks": "第一学历毕业学校",
        "first_degree_kwd": "第一学历（高中，职高，硕士，本科，博士，初中，中技，中专，专科，专升本，MPA，MBA，EMBA）",
        "highest_degree_kwd": "最高学历（高中，职高，硕士，本科，博士，初中，中技，中专，专科，专升本，MPA，MBA，EMBA）",
        "first_major_tks": "第一学历专业",
        "edu_first_fea_kwd": "第一学历标签（211，留学，双一流，985，海外知名，重点大学，中专，专升本，专科，本科，大专）",

        "degree_kwd": "过往学历（高中，职高，硕士，本科，博士，初中，中技，中专，专科，专升本，MPA，MBA，EMBA）",
        "major_tks": "学过的专业/过往专业",
        "school_name_tks": "学校/毕业院校",
        "sch_rank_kwd": "学校标签（顶尖学校，精英学校，优质学校，一般学校）",
        "edu_fea_kwd": "教育标签（211，留学，双一流，985，海外知名，重点大学，中专，专升本，专科，本科，大专）",

        "corp_nm_tks": "就职过的公司/之前的公司/上过班的公司",
        "edu_end_int": "毕业年份",
        "industry_name_tks": "所在行业",

        "birth_dt": "生日/出生年份",
        "expect_position_name_tks": "期望职位/期望职能/期望岗位",
    }
    
    # 构建标题
    titles = []
    for n in ["name_kwd", "gender_kwd", "position_name_tks", "age_int"]:
        v = resume.get(n, "")
        if isinstance(v, list):
            v = v[0]
        if n.find("tks") > 0:
            v = _remove_redundant_spaces(v)
        titles.append(str(v))
    
    doc = {
        "docnm_kwd": filename,
        "title_tks": rag_tokenizer.tokenize("-".join(titles) + "-简历")
    }
    doc["title_sm_tks"] = rag_tokenizer.fine_grained_tokenize(doc["title_tks"])
    
    # 构建内容
    pairs = []
    for n, m in field_map.items():
        if not resume.get(n):
            continue
        v = resume[n]
        if isinstance(v, list):
            v = " ".join(v)
        if n.find("tks") > 0:
            v = _remove_redundant_spaces(v)
        pairs.append((m, str(v)))
    
    doc["content_with_weight"] = "\n".join(
        ["{}: {}".format(re.sub(r"（[^（）]+）", "", k), v) for k, v in pairs]
    )
    doc["content_ltks"] = rag_tokenizer.tokenize(doc["content_with_weight"])
    doc["content_sm_ltks"] = rag_tokenizer.fine_grained_tokenize(doc["content_ltks"])
    
    # 添加所有简历字段
    for n, _ in field_map.items():
        if n not in resume:
            continue
        if isinstance(resume[n], list) and (
                len(resume[n]) == 1 or n not in forbidden_select_fields4resume
        ):
            resume[n] = resume[n][0]
        if n.find("_tks") > 0:
            resume[n] = rag_tokenizer.fine_grained_tokenize(resume[n])
        doc[n] = resume[n]
    
    logger.debug(f"生成的简历chunk: {doc}")
    
    # 保存field_map到配置（可选）
    kb_id = kwargs.get("kb_id")
    if kb_id:
        # KnowledgebaseService.update_parser_config(kb_id, {"field_map": field_map})
        pass
    
    return [doc]


def _remove_redundant_spaces(text):
    """移除多余空格"""
    if not isinstance(text, str):
        return text
    return re.sub(r'\s+', ' ', text).strip()


if __name__ == "__main__":
    import sys
    
    def dummy_callback(prog=None, msg=""):
        print(f"[{prog}] {msg}" if prog else msg)
    
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'rb') as f:
            binary = f.read()
        result = chunk(sys.argv[1], binary, callback=dummy_callback)
        print(f"Total chunks: {len(result)}")
