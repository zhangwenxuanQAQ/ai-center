export const RETRIEVAL_CONFIGS = [
  {
    key: "vector_similarity",
    label: "文本相似度阈值",
    type: "slider",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.2,
    description: "文本相似度阈值，用于筛选检索结果"
  },
  {
    key: "keyword_similarity",
    label: "关键词相似度阈值",
    type: "slider",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3,
    description: "关键词相似度阈值，用于筛选检索结果"
  },
  {
    key: "vector_similarity_weight",
    label: "向量相似度权重",
    type: "slider",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.7,
    description: "向量相似度权重，关键词相似度权重=1-此值"
  },
  {
    key: "top_k",
    label: "召回数量",
    type: "slider",
    min: 1,
    max: 20,
    step: 1,
    default: 5,
    description: "检索时返回的最大结果数量"
  },
  {
    key: "sort_by",
    label: "排序方式",
    type: "select",
    options: [
      { value: "sim", label: "混合相似度" },
      { value: "vsim", label: "向量相似度" },
      { value: "tsim", label: "关键词相似度" }
    ],
    default: "sim",
    description: "检索结果的排序方式"
  }
];

export const DOCUMENT_RUNNING_STATUS = {
  pending: "未开始",
  waiting: "等待执行",
  running: "运行中",
  cancel: "已取消",
  done: "已完成",
  fail: "失败",
  schedule: "定时调度"
};

export const DOCUMENT_CHUNK_METHOD = {
  naive: "Naive",
  qa: "QA",
  resume: "Resume",
  manual: "Manual",
  table: "Table",
  paper: "Paper",
  book: "Book",
  laws: "Laws",
  presentation: "Presentation",
  picture: "Picture",
  one: "One",
  audio: "Audio",
  email: "Email"
};

export const METADATA_FILTER_TYPES = [
  {
    key: "term",
    title: "精准匹配",
    query: "term",
    description: "查询语句: term\n性能: 最快，要求完全匹配，不适用于模糊搜索",
  },
  // 暂时隐藏短语匹配选项
  // {
  //   key: "match_phrase",
  //   title: "短语匹配",
  //   query: "match_phrase",
  //   description: "查询语句: match_phrase\n性能: 中等，保留词语顺序和邻近关系，适用于text类型字段的精确短语查找",
  // },
  {
    key: "match",
    title: "全文搜索",
    query: "match",
    description: "查询语句: match\n性能: 较快，分词后全文检索，不要求词语顺序和完整性，适用于text类型字段",
  },
  {
    key: "wildcard",
    title: "通配符匹配",
    query: "wildcard",
    description: "查询语句: wildcard\n性能: 最慢，支持通配符（*匹配任意字符, ?匹配单个字符）\n检索样例: 输入 \"test*\" 可匹配 test, testing, tester 等",
  },
];
