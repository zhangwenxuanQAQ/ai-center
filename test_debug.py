import sys
sys.path.insert(0, '.')

from app.database.models import KnowledgebaseDocument

print('Testing query...')
try:
    doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == '8fd09b6cae234870b0cb3f8cedfcfcf2')
    print(f'Doc found: {doc.id}')
except Exception as e:
    print(f'Error: {e}')