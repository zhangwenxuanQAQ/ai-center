"""
文档切片应用模块
提供不同文档类型的切片实现
"""

from .naive import chunk as naive_chunk
from .book import chunk as book_chunk
from .paper import chunk as paper_chunk
from .laws import chunk as laws_chunk
from .manual import chunk as manual_chunk
from .qa import chunk as qa_chunk
from .table import chunk as table_chunk
from .presentation import chunk as presentation_chunk
from .picture import chunk as picture_chunk
from .one import chunk as one_chunk
from .resume import chunk as resume_chunk
from .audio import chunk as audio_chunk
from .email import chunk as email_chunk
from .tag import chunk as tag_chunk

# 策略名称到函数的映射
CHUNK_STRATEGIES = {
    "naive": naive_chunk,
    "general": naive_chunk,
    "book": book_chunk,
    "paper": paper_chunk,
    "laws": laws_chunk,
    "manual": manual_chunk,
    "qa": qa_chunk,
    "table": table_chunk,
    "presentation": presentation_chunk,
    "picture": picture_chunk,
    "one": one_chunk,
    "resume": resume_chunk,
    "audio": audio_chunk,
    "email": email_chunk,
    "tag": tag_chunk,
}

__all__ = [
    'chunk',
    'naive_chunk',
    'book_chunk',
    'paper_chunk',
    'laws_chunk',
    'manual_chunk',
    'qa_chunk',
    'table_chunk',
    'presentation_chunk',
    'picture_chunk',
    'one_chunk',
    'resume_chunk',
    'audio_chunk',
    'email_chunk',
    'tag_chunk',
    'CHUNK_STRATEGIES',
]
