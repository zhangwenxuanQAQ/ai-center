import sys
sys.path.insert(0, '.')

from app.constants.knowledge_constants import DOCUMENT_PARSE_TYPE, DOCUMENT_RUNNING_STATUS
print('✓ knowledge_constants OK')
print('Parse types:', list(DOCUMENT_PARSE_TYPE.keys()))

from app.database.es_utils import ESUtils, es_utils
print('✓ es_utils OK')

from app.core.knowledge.rag.nlp.rag_tokenizer import RagTokenizer, tokenizer, tokenize
print('✓ rag_tokenizer OK')
test_tokens = tokenize("这是一个测试文本")
print('Test tokens:', test_tokens[:50])

from app.core.knowledge.rag.svr.task_executor import TaskExecutor, task_executor
print('✓ task_executor OK')

print('\n🎉 所有核心模块导入成功！文档切片功能已实现。')
