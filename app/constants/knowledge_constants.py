"""
 知识库常量
"""

# 文档解析类型
DOCUMENT_PARSE_TYPE = {
  Naive = 'naive',
  Qa = 'qa',
  Resume = 'resume',
  Manual = 'manual',
  Table = 'table',
  Paper = 'paper',
  Book = 'book',
  Laws = 'laws',
  Presentation = 'presentation',
  Picture = 'picture',
  One = 'one',
  Audio = 'audio',
  Email = 'email',
  Tag = 'tag',
  KnowledgeGraph = 'knowledge_graph',
}

# 文档解析状态
DOCUMENT_RUNNING_STATUS = {
  "未开始" = 'pending', 
  "运行中" = 'running', 
  "已取消" = 'cacel', 
  "已完成" = 'done', 
  "失败" = 'fail', 
  "定时调度" = 'schedule',
}