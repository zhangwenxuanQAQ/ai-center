"""
知识库服务类，提供知识库分类、知识库、知识库文档相关的CRUD操作
"""

import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from app.database.models import KnowledgebaseCategory, Knowledgebase, KnowledgebaseDocument, KnowledgebaseDocumentCategory
from app.services.knowledgebase.dto import (
    KnowledgebaseCategoryCreate, KnowledgebaseCategoryUpdate,
    KnowledgebaseCreate, KnowledgebaseUpdate,
    KnowledgebaseDocumentCreate, KnowledgebaseDocumentUpdate,
    KnowledgebaseDocumentCategoryCreate, KnowledgebaseDocumentCategoryUpdate
)
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError


class KnowledgebaseCategoryService:
    """
    知识库分类服务类

    提供知识库分类的创建、查询、更新、删除等操作
    """

    @staticmethod
    def _get_or_create_default_category():
        """
        获取或创建默认分类

        Returns:
            KnowledgebaseCategory: 默认分类对象
        """
        default_category = KnowledgebaseCategory.select().where(
            KnowledgebaseCategory.name == "默认分类"
        ).first()
        if not default_category:
            default_category = KnowledgebaseCategory(
                name="默认分类",
                description="系统默认分类",
                is_default=True
            )
            default_category.save(force_insert=True)
        elif not default_category.is_default:
            default_category.is_default = True
            default_category.save()
        return default_category

    @staticmethod
    @handle_transaction
    def create_category(category: KnowledgebaseCategoryCreate):
        """
        创建知识库分类

        Args:
            category: 知识库分类创建DTO

        Returns:
            KnowledgebaseCategory: 创建的知识库分类对象

        Raises:
            DuplicateResourceError: 同一父分类下名称已存在
        """
        parent_id = category.parent_id

        existing = KnowledgebaseCategory.select().where(
            (KnowledgebaseCategory.name == category.name) &
            (KnowledgebaseCategory.parent_id == parent_id if parent_id else KnowledgebaseCategory.parent_id.is_null()) &
            (KnowledgebaseCategory.deleted == False)
        ).first()

        if existing:
            raise DuplicateResourceError(f"分类名称 '{category.name}' 已存在")

        db_category = KnowledgebaseCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category

    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100):
        """
        获取知识库分类列表

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            List[KnowledgebaseCategory]: 知识库分类列表
        """
        return list(KnowledgebaseCategory.select().where(
            KnowledgebaseCategory.deleted == False
        ).offset(skip).limit(limit))

    @staticmethod
    def get_category_tree():
        """
        获取知识库分类树形结构

        Returns:
            List[dict]: 分类树形结构
        """
        categories = list(KnowledgebaseCategory.select().where(
            KnowledgebaseCategory.deleted == False
        ).order_by(KnowledgebaseCategory.sort_order))

        def build_tree(parent_id=None):
            tree = []
            for cat in categories:
                if cat.parent_id == parent_id:
                    node = {
                        "id": str(cat.id),
                        "name": cat.name,
                        "description": cat.description,
                        "is_default": cat.is_default,
                        "parent_id": str(cat.parent_id) if cat.parent_id else None,
                        "sort_order": cat.sort_order,
                        "children": build_tree(cat.id)
                    }
                    tree.append(node)
            return tree

        return build_tree()

    @staticmethod
    def get_category(category_id: str):
        """
        获取单个知识库分类

        Args:
            category_id: 知识库分类ID

        Returns:
            KnowledgebaseCategory: 知识库分类对象，不存在则返回None
        """
        try:
            category = KnowledgebaseCategory.get_by_id(category_id)
            if category.deleted:
                return None
            return category
        except KnowledgebaseCategory.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: KnowledgebaseCategoryUpdate):
        """
        更新知识库分类

        Args:
            category_id: 知识库分类ID
            category: 知识库分类更新DTO

        Returns:
            KnowledgebaseCategory: 更新后的知识库分类对象

        Raises:
            ResourceNotFoundError: 知识库分类不存在
            DuplicateResourceError: 同一父分类下名称已存在
        """
        try:
            db_category = KnowledgebaseCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"知识库分类 {category_id} 不存在")
        except KnowledgebaseCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库分类 {category_id} 不存在")

        update_data = category.model_dump(exclude_unset=True)

        if 'name' in update_data:
            parent_id = update_data.get('parent_id', db_category.parent_id)
            existing = KnowledgebaseCategory.select().where(
                (KnowledgebaseCategory.name == update_data['name']) &
                (KnowledgebaseCategory.parent_id == parent_id if parent_id else KnowledgebaseCategory.parent_id.is_null()) &
                (KnowledgebaseCategory.id != category_id) &
                (KnowledgebaseCategory.deleted == False)
            ).first()

            if existing:
                raise DuplicateResourceError(f"分类名称 '{update_data['name']}' 已存在")

        for field, value in update_data.items():
            setattr(db_category, field, value)
        db_category.updated_at = datetime.now()
        db_category.save()
        return db_category

    @staticmethod
    @handle_transaction
    def delete_category(category_id: str):
        """
        删除知识库分类（逻辑删除）

        Args:
            category_id: 知识库分类ID

        Returns:
            KnowledgebaseCategory: 被删除的知识库分类对象

        Raises:
            ResourceNotFoundError: 知识库分类不存在
            ValueError: 分类下存在知识库，无法删除
        """
        try:
            db_category = KnowledgebaseCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"知识库分类 {category_id} 不存在")
        except KnowledgebaseCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库分类 {category_id} 不存在")

        def get_all_child_category_ids(parent_id: str) -> list:
            child_ids = [parent_id]
            children = KnowledgebaseCategory.select().where(
                (KnowledgebaseCategory.parent_id == parent_id) &
                (KnowledgebaseCategory.deleted == False)
            )
            for child in children:
                child_ids.extend(get_all_child_category_ids(child.id))
            return child_ids

        all_category_ids = get_all_child_category_ids(category_id)

        kb_count = Knowledgebase.select().where(
            (Knowledgebase.category_id.in_(all_category_ids)) &
            (Knowledgebase.deleted == False)
        ).count()

        if kb_count > 0:
            raise ValueError(f"该分类或其子分类下存在 {kb_count} 个知识库，无法删除")

        db_category.deleted = True
        db_category.deleted_at = datetime.now()
        db_category.save()
        return db_category


class KnowledgebaseService:
    """
    知识库服务类

    提供知识库的创建、查询、更新、删除等操作
    """

    @staticmethod
    def check_code_unique(code: str) -> bool:
        """
        检查知识库编码是否唯一

        Args:
            code: 知识库编码

        Returns:
            bool: 编码是否唯一（True表示唯一，False表示已存在）
        """
        existing = Knowledgebase.select().where(
            (Knowledgebase.code == code) &
            (Knowledgebase.deleted == False)
        ).first()
        
        return existing is None

    @staticmethod
    @handle_transaction
    def create_knowledgebase(kb: KnowledgebaseCreate):
        """
        创建知识库

        Args:
            kb: 知识库创建DTO

        Returns:
            Knowledgebase: 创建的知识库对象

        Raises:
            DuplicateResourceError: 编码已存在
        """
        kb_data = kb.model_dump()

        if not kb_data.get('category_id'):
            default_category = KnowledgebaseCategoryService._get_or_create_default_category()
            kb_data['category_id'] = default_category.id

        if kb_data.get('retrieval_config') and isinstance(kb_data['retrieval_config'], dict):
            kb_data['retrieval_config'] = json.dumps(kb_data['retrieval_config'], ensure_ascii=False)

        existing = Knowledgebase.select().where(
            (Knowledgebase.code == kb_data['code']) &
            (Knowledgebase.deleted == False)
        ).first()

        if existing:
            raise DuplicateResourceError(f"知识库编码 '{kb_data['code']}' 已存在")

        db_kb = Knowledgebase(**kb_data)
        db_kb.save(force_insert=True)
        return db_kb

    @staticmethod
    def get_knowledgebases(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, code: str = None, status: str = None):
        """
        获取知识库列表

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID（可选）
            name: 知识库名称（模糊查询）
            code: 知识库编码（模糊查询）
            status: 状态（可选）

        Returns:
            List[Knowledgebase]: 知识库列表
        """
        query = Knowledgebase.select().where(Knowledgebase.deleted == False)

        if category_id:
            query = query.where(Knowledgebase.category_id == category_id)

        if name:
            query = query.where(Knowledgebase.name.contains(name))

        if code:
            query = query.where(Knowledgebase.code.contains(code))

        if status is not None:
            status_bool = status.lower() == 'true'
            query = query.where(Knowledgebase.status == status_bool)

        return list(query.order_by(Knowledgebase.created_at.desc()).offset(skip).limit(limit))

    @staticmethod
    def count_knowledgebases(category_id: str = None, name: str = None, code: str = None, status: str = None) -> int:
        """
        统计知识库总数

        Args:
            category_id: 分类ID（可选）
            name: 知识库名称（模糊查询）
            code: 知识库编码（模糊查询）
            status: 状态（可选）

        Returns:
            int: 知识库总数
        """
        query = Knowledgebase.select().where(Knowledgebase.deleted == False)

        if category_id:
            query = query.where(Knowledgebase.category_id == category_id)

        if name:
            query = query.where(Knowledgebase.name.contains(name))

        if code:
            query = query.where(Knowledgebase.code.contains(code))

        if status is not None:
            status_bool = status.lower() == 'true'
            query = query.where(Knowledgebase.status == status_bool)

        return query.count()

    @staticmethod
    def get_knowledgebase(kb_id: str):
        """
        获取单个知识库

        Args:
            kb_id: 知识库ID

        Returns:
            Knowledgebase: 知识库对象，不存在则返回None
        """
        try:
            kb = Knowledgebase.get_by_id(kb_id)
            if kb.deleted:
                return None
            return kb
        except Knowledgebase.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_knowledgebase(kb_id: str, kb: KnowledgebaseUpdate):
        """
        更新知识库

        Args:
            kb_id: 知识库ID
            kb: 知识库更新DTO

        Returns:
            Knowledgebase: 更新后的知识库对象

        Raises:
            ResourceNotFoundError: 知识库不存在
            DuplicateResourceError: 编码已存在
        """
        try:
            db_kb = Knowledgebase.get_by_id(kb_id)
            if db_kb.deleted:
                raise ResourceNotFoundError(message=f"知识库 {kb_id} 不存在")
        except Knowledgebase.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库 {kb_id} 不存在")

        update_data = kb.model_dump(exclude_unset=True)

        if 'code' in update_data:
            existing = Knowledgebase.select().where(
                (Knowledgebase.code == update_data['code']) &
                (Knowledgebase.id != kb_id) &
                (Knowledgebase.deleted == False)
            ).first()

            if existing:
                raise DuplicateResourceError(f"知识库编码 '{update_data['code']}' 已存在")

        if update_data.get('retrieval_config') and isinstance(update_data['retrieval_config'], dict):
            update_data['retrieval_config'] = json.dumps(update_data['retrieval_config'], ensure_ascii=False)

        for field, value in update_data.items():
            setattr(db_kb, field, value)
        db_kb.updated_at = datetime.now()
        db_kb.save()
        return db_kb

    @staticmethod
    @handle_transaction
    def delete_knowledgebase(kb_id: str):
        """
        删除知识库（逻辑删除）

        Args:
            kb_id: 知识库ID

        Returns:
            Knowledgebase: 被删除的知识库对象

        Raises:
            ResourceNotFoundError: 知识库不存在
        """
        try:
            db_kb = Knowledgebase.get_by_id(kb_id)
            if db_kb.deleted:
                raise ResourceNotFoundError(message=f"知识库 {kb_id} 不存在")
        except Knowledgebase.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库 {kb_id} 不存在")

        db_kb.deleted = True
        db_kb.deleted_at = datetime.now()
        db_kb.save()
        return db_kb


class KnowledgebaseDocumentService:
    """
    知识库文档服务类

    提供知识库文档的创建、查询、更新、删除等操作
    """

    @staticmethod
    @handle_transaction
    def create_document(document: KnowledgebaseDocumentCreate):
        """
        创建知识库文档

        Args:
            document: 知识库文档创建DTO

        Returns:
            KnowledgebaseDocument: 创建的知识库文档对象

        Raises:
            ResourceNotFoundError: 知识库不存在
        """
        try:
            kb = Knowledgebase.get_by_id(document.kb_id)
            if kb.deleted:
                raise ResourceNotFoundError(message=f"知识库 {document.kb_id} 不存在")
        except Knowledgebase.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库 {document.kb_id} 不存在")

        doc_data = document.model_dump()

        if not doc_data.get('category_id'):
            default_category = KnowledgebaseDocumentCategoryService._get_or_create_default_category(document.kb_id)
            doc_data['category_id'] = default_category.id

        if doc_data.get('chunk_config') and isinstance(doc_data['chunk_config'], dict):
            doc_data['chunk_config'] = json.dumps(doc_data['chunk_config'], ensure_ascii=False)

        if doc_data.get('tags') and isinstance(doc_data['tags'], list):
            doc_data['tags'] = json.dumps(doc_data['tags'], ensure_ascii=False)

        db_doc = KnowledgebaseDocument(**doc_data)
        db_doc.save(force_insert=True)

        Knowledgebase.update(
            doc_num=Knowledgebase.doc_num + 1,
            token_num=Knowledgebase.token_num + (doc_data.get('token_num') or 0),
            chunk_num=Knowledgebase.chunk_num
        ).where(Knowledgebase.id == document.kb_id).execute()

        return db_doc

    @staticmethod
    def get_documents(
        kb_id: str = None, 
        category_id: str = None,
        tags: list = None,
        name: str = None,
        file_type: str = None,
        running_status: list = None,
        status: str = None,
        chunk_method: list = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[dict]:
        """
        获取知识库文档列表

        Args:
            kb_id: 知识库ID（可选）
            category_id: 文档分类ID（可选）
            tags: 标签列表（可选）
            name: 文档名称（模糊查询，可选）
            file_type: 文件类型（可选）
            running_status: 解析状态列表（可选）
            status: 文档状态（可选）
            chunk_method: Chunk方法列表（可选）
            skip: 跳过记录数（默认0）
            limit: 返回记录数（默认20）

        Returns:
            List[dict]: 知识库文档列表，包含分类名称
        """
        from peewee import JOIN
        
        # 执行左连接查询，关联分类表
        query = KnowledgebaseDocument.select(
            KnowledgebaseDocument,
            KnowledgebaseDocumentCategory.name.alias('category_name')
        ).join(
            KnowledgebaseDocumentCategory,
            on=(KnowledgebaseDocument.category_id == KnowledgebaseDocumentCategory.id),
            join_type=JOIN.LEFT_OUTER
        ).where(KnowledgebaseDocument.deleted == False)

        if kb_id:
            query = query.where(KnowledgebaseDocument.kb_id == kb_id)

        if category_id:
            query = query.where(KnowledgebaseDocument.category_id == category_id)

        if name:
            query = query.where(KnowledgebaseDocument.file_name.contains(name))

        if file_type:
            query = query.where(KnowledgebaseDocument.file_type == file_type)

        if running_status:
            if isinstance(running_status, list):
                query = query.where(KnowledgebaseDocument.running_status.in_(running_status))
            else:
                query = query.where(KnowledgebaseDocument.running_status == running_status)

        if status:
            query = query.where(KnowledgebaseDocument.status == status)

        if chunk_method:
            if isinstance(chunk_method, list):
                query = query.where(KnowledgebaseDocument.chunk_method.in_(chunk_method))
            else:
                query = query.where(KnowledgebaseDocument.chunk_method == chunk_method)

        # 执行查询并转换为字典列表
        documents = []
        for doc in query.order_by(KnowledgebaseDocument.created_at.desc()).offset(skip).limit(limit):
            doc_dict = doc.__data__
            # 处理JSON字段
            if doc_dict.get('tags'):
                try:
                    doc_dict['tags'] = json.loads(doc_dict['tags'])
                except:
                    doc_dict['tags'] = []
            if doc_dict.get('chunk_config'):
                try:
                    doc_dict['chunk_config'] = json.loads(doc_dict['chunk_config'])
                except:
                    doc_dict['chunk_config'] = {}
            if doc_dict.get('source_config'):
                try:
                    doc_dict['source_config'] = json.loads(doc_dict['source_config'])
                except:
                    doc_dict['source_config'] = {}
            documents.append(doc_dict)

        return documents

    @staticmethod
    def count_documents(
        kb_id: str = None, 
        category_id: str = None,
        tags: list = None,
        name: str = None,
        file_type: str = None,
        running_status: list = None,
        status: str = None,
        chunk_method: list = None
    ) -> int:
        """
        统计知识库文档总数

        Args:
            kb_id: 知识库ID（可选）
            category_id: 文档分类ID（可选）
            tags: 标签列表（可选）
            name: 文档名称（模糊查询，可选）
            file_type: 文件类型（可选）
            running_status: 解析状态列表（可选）
            status: 文档状态（可选）
            chunk_method: Chunk方法列表（可选）

        Returns:
            int: 知识库文档总数
        """
        query = KnowledgebaseDocument.select().where(KnowledgebaseDocument.deleted == False)

        if kb_id:
            query = query.where(KnowledgebaseDocument.kb_id == kb_id)

        if category_id:
            query = query.where(KnowledgebaseDocument.category_id == category_id)

        if name:
            query = query.where(KnowledgebaseDocument.file_name.contains(name))

        if file_type:
            query = query.where(KnowledgebaseDocument.file_type == file_type)

        if running_status:
            if isinstance(running_status, list):
                query = query.where(KnowledgebaseDocument.running_status.in_(running_status))
            else:
                query = query.where(KnowledgebaseDocument.running_status == running_status)

        if status:
            query = query.where(KnowledgebaseDocument.status == status)

        if chunk_method:
            if isinstance(chunk_method, list):
                query = query.where(KnowledgebaseDocument.chunk_method.in_(chunk_method))
            else:
                query = query.where(KnowledgebaseDocument.chunk_method == chunk_method)

        return query.count()

    @staticmethod
    def get_document(document_id: str):
        """
        获取单个知识库文档

        Args:
            document_id: 文档ID

        Returns:
            KnowledgebaseDocument: 知识库文档对象，不存在则返回None
        """
        try:
            doc = KnowledgebaseDocument.get_by_id(document_id)
            if doc.deleted:
                return None
            return doc
        except KnowledgebaseDocument.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_document(document_id: str, document: KnowledgebaseDocumentUpdate):
        """
        更新知识库文档

        Args:
            document_id: 文档ID
            document: 知识库文档更新DTO

        Returns:
            KnowledgebaseDocument: 更新后的知识库文档对象

        Raises:
            ResourceNotFoundError: 知识库文档不存在
        """
        try:
            db_doc = KnowledgebaseDocument.get_by_id(document_id)
            if db_doc.deleted:
                raise ResourceNotFoundError(message=f"知识库文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库文档 {document_id} 不存在")

        update_data = document.model_dump(exclude_unset=True)

        if update_data.get('chunk_config') and isinstance(update_data['chunk_config'], dict):
            update_data['chunk_config'] = json.dumps(update_data['chunk_config'], ensure_ascii=False)

        if 'tags' in update_data:
            if update_data['tags'] and isinstance(update_data['tags'], list):
                update_data['tags'] = json.dumps(update_data['tags'], ensure_ascii=False)
            else:
                update_data['tags'] = None

        for field, value in update_data.items():
            setattr(db_doc, field, value)
        db_doc.updated_at = datetime.now()
        db_doc.save()
        return db_doc

    @staticmethod
    @handle_transaction
    def delete_document(document_id: str):
        """
        删除知识库文档（逻辑删除，同时删除RustFS中的文件）

        Args:
            document_id: 文档ID

        Returns:
            KnowledgebaseDocument: 被删除的知识库文档对象

        Raises:
            ResourceNotFoundError: 知识库文档不存在
        """
        try:
            db_doc = KnowledgebaseDocument.get_by_id(document_id)
            if db_doc.deleted:
                raise ResourceNotFoundError(message=f"知识库文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库文档 {document_id} 不存在")

        # 删除RustFS中的文件
        from app.database.storage.rustfs_utils import rustfs_utils
        if db_doc.location and rustfs_utils.is_available:
            try:
                rustfs_utils.delete_object(
                    bucket_name=db_doc.kb_id,
                    object_key=db_doc.location,
                )
            except Exception as e:
                logger.warning(f"删除RustFS文件失败 {db_doc.kb_id}/{db_doc.location}: {e}")

        db_doc.deleted = True
        db_doc.deleted_at = datetime.now()
        db_doc.save()

        Knowledgebase.update(
            doc_num=Knowledgebase.doc_num - 1,
            token_num=Knowledgebase.token_num - (db_doc.token_num or 0)
        ).where(Knowledgebase.id == db_doc.kb_id).execute()

        return db_doc


class KnowledgebaseDocumentCategoryService:
    """
    知识库文档分类服务类

    提供知识库文档分类的创建、查询、更新、删除等操作
    """

    @staticmethod
    def _get_or_create_default_category(kb_id: str):
        """
        获取或创建默认分类

        Args:
            kb_id: 知识库ID

        Returns:
            KnowledgebaseDocumentCategory: 默认分类对象
        """
        default_category = KnowledgebaseDocumentCategory.select().where(
            (KnowledgebaseDocumentCategory.kb_id == kb_id) &
            (KnowledgebaseDocumentCategory.name == "默认分类")
        ).first()
        if not default_category:
            default_category = KnowledgebaseDocumentCategory(
                kb_id=kb_id,
                name="默认分类",
                description="系统默认分类",
                sort_order=0,
                is_default=True
            )
            default_category.save(force_insert=True)
        return default_category

    @staticmethod
    @handle_transaction
    def create_category(category: KnowledgebaseDocumentCategoryCreate):
        """
        创建知识库文档分类

        Args:
            category: 知识库文档分类创建DTO

        Returns:
            KnowledgebaseDocumentCategory: 创建的知识库文档分类对象

        Raises:
            DuplicateResourceError: 同一知识库、同一父分类下名称已存在
            ResourceNotFoundError: 知识库不存在
        """
        try:
            kb = Knowledgebase.get_by_id(category.kb_id)
            if kb.deleted:
                raise ResourceNotFoundError(message=f"知识库 {category.kb_id} 不存在")
        except Knowledgebase.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库 {category.kb_id} 不存在")

        parent_id = category.parent_id

        existing = KnowledgebaseDocumentCategory.select().where(
            (KnowledgebaseDocumentCategory.kb_id == category.kb_id) &
            (KnowledgebaseDocumentCategory.name == category.name) &
            (KnowledgebaseDocumentCategory.parent_id == parent_id if parent_id else KnowledgebaseDocumentCategory.parent_id.is_null()) &
            (KnowledgebaseDocumentCategory.deleted == False)
        ).first()

        if existing:
            raise DuplicateResourceError(f"分类名称 '{category.name}' 已存在")

        db_category = KnowledgebaseDocumentCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category

    @staticmethod
    def get_categories(kb_id: str, skip: int = 0, limit: int = 100):
        """
        获取知识库文档分类列表

        Args:
            kb_id: 知识库ID
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            List[KnowledgebaseDocumentCategory]: 知识库文档分类列表
        """
        return list(KnowledgebaseDocumentCategory.select().where(
            (KnowledgebaseDocumentCategory.kb_id == kb_id) &
            (KnowledgebaseDocumentCategory.deleted == False)
        ).offset(skip).limit(limit))

    @staticmethod
    def get_category_tree(kb_id: str):
        """
        获取知识库文档分类树形结构

        Args:
            kb_id: 知识库ID

        Returns:
            List[dict]: 分类树形结构
        """
        categories = list(KnowledgebaseDocumentCategory.select().where(
            (KnowledgebaseDocumentCategory.kb_id == kb_id) &
            (KnowledgebaseDocumentCategory.deleted == False)
        ).order_by(KnowledgebaseDocumentCategory.sort_order))

        def build_tree(parent_id=None):
            tree = []
            for cat in categories:
                if cat.parent_id == parent_id:
                    node = {
                        "id": str(cat.id),
                        "name": cat.name,
                        "description": cat.description,
                        "kb_id": str(cat.kb_id),
                        "parent_id": str(cat.parent_id) if cat.parent_id else None,
                        "sort_order": cat.sort_order,
                        "children": build_tree(cat.id)
                    }
                    tree.append(node)
            return tree

        return build_tree()

    @staticmethod
    def get_category(category_id: str):
        """
        获取单个知识库文档分类

        Args:
            category_id: 知识库文档分类ID

        Returns:
            KnowledgebaseDocumentCategory: 知识库文档分类对象，不存在则返回None
        """
        try:
            category = KnowledgebaseDocumentCategory.get_by_id(category_id)
            if category.deleted:
                return None
            return category
        except KnowledgebaseDocumentCategory.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: KnowledgebaseDocumentCategoryUpdate):
        """
        更新知识库文档分类

        Args:
            category_id: 知识库文档分类ID
            category: 知识库文档分类更新DTO

        Returns:
            KnowledgebaseDocumentCategory: 更新后的知识库文档分类对象

        Raises:
            ResourceNotFoundError: 知识库文档分类不存在
            DuplicateResourceError: 同一知识库、同一父分类下名称已存在
        """
        try:
            db_category = KnowledgebaseDocumentCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"知识库文档分类 {category_id} 不存在")
        except KnowledgebaseDocumentCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库文档分类 {category_id} 不存在")

        update_data = category.model_dump(exclude_unset=True)

        if 'name' in update_data:
            parent_id = update_data.get('parent_id', db_category.parent_id)
            existing = KnowledgebaseDocumentCategory.select().where(
                (KnowledgebaseDocumentCategory.kb_id == db_category.kb_id) &
                (KnowledgebaseDocumentCategory.name == update_data['name']) &
                (KnowledgebaseDocumentCategory.parent_id == parent_id if parent_id else KnowledgebaseDocumentCategory.parent_id.is_null()) &
                (KnowledgebaseDocumentCategory.id != category_id) &
                (KnowledgebaseDocumentCategory.deleted == False)
            ).first()

            if existing:
                raise DuplicateResourceError(f"分类名称 '{update_data['name']}' 已存在")

        for field, value in update_data.items():
            setattr(db_category, field, value)
        db_category.updated_at = datetime.now()
        db_category.save()
        return db_category

    @staticmethod
    @handle_transaction
    def delete_category(category_id: str):
        """
        删除知识库文档分类（逻辑删除）

        Args:
            category_id: 知识库文档分类ID

        Returns:
            KnowledgebaseDocumentCategory: 被删除的知识库文档分类对象

        Raises:
            ResourceNotFoundError: 知识库文档分类不存在
            ValueError: 分类下存在文档，无法删除
            ValueError: 默认分类不能删除
        """
        try:
            db_category = KnowledgebaseDocumentCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"知识库文档分类 {category_id} 不存在")
        except KnowledgebaseDocumentCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库文档分类 {category_id} 不存在")

        # 检查是否是默认分类
        if db_category.is_default:
            raise ValueError("默认分类不能删除")

        # 检查分类下是否存在文档
        doc_count = KnowledgebaseDocument.select().where(
            (KnowledgebaseDocument.category_id == category_id) &
            (KnowledgebaseDocument.deleted == False)
        ).count()

        if doc_count > 0:
            raise ValueError(f"该分类下存在 {doc_count} 个文档，无法删除")

        db_category.deleted = True
        db_category.deleted_at = datetime.now()
        db_category.save()
        return db_category
