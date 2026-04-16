#!/usr/bin/env python3
"""
测试修改文档分类的脚本
"""

from app.services.knowledgebase.service import KnowledgebaseDocumentService, KnowledgebaseDocumentCategoryService
from app.services.knowledgebase.dto import KnowledgebaseDocumentUpdate

try:
    # 文档ID
    document_id = '5ff8f9cda9f245ce855ef29bdc5e346a'
    
    # 新分类ID
    new_category_id = 'c5f9812950974e7ba4a227dcd5c228c0'  # 默认分类
    
    # 旧分类ID
    from app.database.models import KnowledgebaseDocument
    doc = KnowledgebaseDocument.get_by_id(document_id)
    old_category_id = doc.category_id
    
    print(f"当前文档分类: {old_category_id}")
    print(f"新分类: {new_category_id}")
    
    # 测试 get_category_path 方法
    old_path = KnowledgebaseDocumentCategoryService.get_category_path(old_category_id)
    new_path = KnowledgebaseDocumentCategoryService.get_category_path(new_category_id)
    
    print(f"旧分类路径: {old_path}")
    print(f"新分类路径: {new_path}")
    
    # 构建完整路径
    filename = doc.location.split('/')[-1]
    old_full_path = f"{old_path}/{filename}" if old_path else filename
    new_full_path = f"{new_path}/{filename}" if new_path else filename
    
    print(f"旧完整路径: {old_full_path}")
    print(f"新完整路径: {new_full_path}")
    
    # 检查RustFS中的文件
    from app.database.storage.rustfs_utils import rustfs_utils
    kb_id = doc.kb_id
    
    print(f"\n检查RustFS文件:")
    print(f"文件存在于旧路径: {rustfs_utils.object_exists(kb_id, old_full_path)}")
    print(f"文件存在于新路径: {rustfs_utils.object_exists(kb_id, new_full_path)}")
    print(f"文件存在于location: {rustfs_utils.object_exists(kb_id, doc.location)}")
    
    # 列出桶中的所有文件
    print(f"\n桶 {kb_id} 中的文件:")
    objects = rustfs_utils.list_objects(kb_id)
    for obj in objects:
        print(f"  - {obj['Key']}")
    
    print(f"\n尝试修改文档 {document_id} 的分类为 {new_category_id}")
    
    # 创建更新对象
    update_data = KnowledgebaseDocumentUpdate(category_id=new_category_id)
    
    # 执行更新
    result = KnowledgebaseDocumentService.update_document(document_id, update_data)
    
    print(f"\n更新成功！")
    print(f"新的分类ID: {result.category_id}")
    print(f"新的location: {result.location}")
    
    # 再次查询文档信息
    doc = KnowledgebaseDocument.get_by_id(document_id)
    print(f"数据库中的location: {doc.location}")
    
    # 再次检查RustFS中的文件
    print(f"\n再次检查RustFS文件:")
    print(f"文件存在于旧路径: {rustfs_utils.object_exists(kb_id, old_full_path)}")
    print(f"文件存在于新路径: {rustfs_utils.object_exists(kb_id, new_full_path)}")
    print(f"文件存在于location: {rustfs_utils.object_exists(kb_id, doc.location)}")
    
    # 列出桶中的所有文件
    print(f"\n桶 {kb_id} 中的文件:")
    objects = rustfs_utils.list_objects(kb_id)
    for obj in objects:
        print(f"  - {obj['Key']}")
    
    print("\n测试完成！")
    
except Exception as e:
    print('Error:', str(e))
    import traceback
    traceback.print_exc()
