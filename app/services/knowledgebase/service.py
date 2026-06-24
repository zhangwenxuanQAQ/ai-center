"""
知识库服务类，提供知识库分类、知识库、知识库文档相关的CRUD操作
"""

import json
import logging
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
from app.database.es_utils import es_utils

logger = logging.getLogger(__name__)


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

        knowledgebases = list(query.order_by(Knowledgebase.created_at.desc()).offset(skip).limit(limit))
        
        for kb in knowledgebases:
            enabled_doc_count = KnowledgebaseDocument.select().where(
                (KnowledgebaseDocument.kb_id == kb.id) &
                (KnowledgebaseDocument.status == True) &
                (KnowledgebaseDocument.deleted == False)
            ).count()
            kb.enabled_doc_num = enabled_doc_count
        
        return knowledgebases

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
        删除知识库（逻辑删除），同时删除ES中的切片数据

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

        try:
            if es_utils.is_available:
                index_name = kb_id
                if es_utils.client.indices.exists(index=index_name):
                    es_utils.client.indices.delete(index=index_name)
                    logger.info(f"成功删除ES索引: {index_name}")
                else:
                    logger.info(f"ES索引不存在: {index_name}")
            else:
                logger.warning("ES不可用，跳过删除ES索引")
        except Exception as e:
            logger.error(f"删除ES索引失败 {kb_id}: {e}")

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

        if doc_data.get('document_config') and isinstance(doc_data['document_config'], dict):
            doc_data['document_config'] = json.dumps(doc_data['document_config'], ensure_ascii=False)

        if doc_data.get('source_config') and isinstance(doc_data['source_config'], dict):
            doc_data['source_config'] = json.dumps(doc_data['source_config'], ensure_ascii=False)

        if doc_data.get('tags') and isinstance(doc_data['tags'], list):
            doc_data['tags'] = json.dumps(doc_data['tags'], ensure_ascii=False)

        # 自动获取 mime_type 和 file_type
        from app.core.knowledgebase.utils.file_utils import get_mime_type, filename_type
        from app.constants.knowledgebase_document_constants import validate_chunk_method, get_default_chunk_method
        
        # 优先使用 file_name，其次使用 location
        filename = doc_data.get('file_name') or doc_data.get('location')
        file_type_str = doc_data.get('file_type')
        
        if filename:
            # 获取 MIME 类型
            if not doc_data.get('mime_type'):
                doc_data['mime_type'] = get_mime_type(filename)
            # 获取文件类型
            if not file_type_str:
                file_type_str = filename_type(filename)
                doc_data['file_type'] = file_type_str
        
        # 验证并设置切片方法
        chunk_method = doc_data.get('chunk_method')
        if chunk_method and file_type_str:
            is_valid, message = validate_chunk_method(chunk_method, file_type_str, filename)
            if not is_valid:
                # 使用默认的切片方法
                doc_data['chunk_method'] = get_default_chunk_method(file_type_str, filename)
                logger.warning(f"{message}，使用默认方法: {doc_data['chunk_method']}")
        elif not chunk_method and file_type_str:
            # 如果没有指定切片方法，使用默认的
            doc_data['chunk_method'] = get_default_chunk_method(file_type_str, filename)

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
        title: str = None,
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
            title: 知识标题（模糊查询，可选）
            file_type: 文件类型（可选）
            running_status: 解析状态列表（可选）
            status: 文档状态（可选）
            chunk_method: Chunk方法列表（可选）
            skip: 跳过记录数（默认0）
            limit: 返回记录数（默认20）

        Returns:
            List[dict]: 知识库文档列表，包含分类名称
        """
        query = KnowledgebaseDocument.select().where(KnowledgebaseDocument.deleted == False)

        if kb_id:
            query = query.where(KnowledgebaseDocument.kb_id == kb_id)

        if category_id:
            query = query.where(KnowledgebaseDocument.category_id == category_id)

        if name:
            query = query.where(KnowledgebaseDocument.file_name.contains(name))

        if title:
            from peewee import fn
            query = query.where(fn.LOWER(KnowledgebaseDocument.title).contains(title.lower()))

        if file_type:
            query = query.where(KnowledgebaseDocument.file_type == file_type)

        if running_status:
            if isinstance(running_status, list):
                query = query.where(KnowledgebaseDocument.running_status.in_(running_status))
            else:
                query = query.where(KnowledgebaseDocument.running_status == running_status)

        if status is not None:
            if isinstance(status, str):
                status = status.lower() == 'true'
            query = query.where(KnowledgebaseDocument.status == status)

        if chunk_method:
            if isinstance(chunk_method, list):
                query = query.where(KnowledgebaseDocument.chunk_method.in_(chunk_method))
            else:
                query = query.where(KnowledgebaseDocument.chunk_method == chunk_method)

        documents = []
        category_cache = {}
        
        for doc in query.order_by(KnowledgebaseDocument.created_at.desc()).offset(skip).limit(limit):
            doc_dict = doc.__data__
            
            if doc_dict.get('category_id'):
                if doc_dict['category_id'] not in category_cache:
                    try:
                        category = KnowledgebaseDocumentCategory.get_by_id(doc_dict['category_id'])
                        category_cache[doc_dict['category_id']] = category.name if not category.deleted else None
                    except KnowledgebaseDocumentCategory.DoesNotExist:
                        category_cache[doc_dict['category_id']] = None
                doc_dict['category_name'] = category_cache.get(doc_dict['category_id'])
            else:
                doc_dict['category_name'] = None
            
            if doc_dict.get('tags'):
                try:
                    parsed_tags = json.loads(doc_dict['tags'])
                    doc_dict['tags'] = parsed_tags if isinstance(parsed_tags, list) else []
                except:
                    doc_dict['tags'] = []
            else:
                doc_dict['tags'] = []
            if doc_dict.get('chunk_config'):
                try:
                    doc_dict['chunk_config'] = json.loads(doc_dict['chunk_config'])
                except:
                    doc_dict['chunk_config'] = {}
            else:
                doc_dict['chunk_config'] = {}
            
            if doc_dict.get('document_config'):
                try:
                    doc_dict['document_config'] = json.loads(doc_dict['document_config'])
                except:
                    doc_dict['document_config'] = {}
            else:
                doc_dict['document_config'] = {}
            
            if doc_dict.get('source_config'):
                try:
                    doc_dict['source_config'] = json.loads(doc_dict['source_config'])
                except:
                    doc_dict['source_config'] = {}
            else:
                doc_dict['source_config'] = {}
            documents.append(doc_dict)

        return documents

    @staticmethod
    def count_documents(
        kb_id: str = None, 
        category_id: str = None,
        tags: list = None,
        name: str = None,
        title: str = None,
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
            title: 知识标题（模糊查询，可选）
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

        if title:
            from peewee import fn
            query = query.where(fn.LOWER(KnowledgebaseDocument.title).contains(title.lower()))

        if file_type:
            query = query.where(KnowledgebaseDocument.file_type == file_type)

        if running_status:
            if isinstance(running_status, list):
                query = query.where(KnowledgebaseDocument.running_status.in_(running_status))
            else:
                query = query.where(KnowledgebaseDocument.running_status == running_status)

        if status is not None:
            if isinstance(status, str):
                status = status.lower() == 'true'
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
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == document_id)
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
            db_doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == document_id)
            if db_doc.deleted:
                raise ResourceNotFoundError(message=f"知识库文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库文档 {document_id} 不存在")

        update_data = document.model_dump(exclude_unset=True)

        if update_data.get('chunk_config') and isinstance(update_data['chunk_config'], dict):
            update_data['chunk_config'] = json.dumps(update_data['chunk_config'], ensure_ascii=False)

        if update_data.get('document_config'):
            if isinstance(update_data['document_config'], dict):
                update_data['document_config'] = json.dumps(update_data['document_config'], ensure_ascii=False)
            else:
                update_data['document_config'] = None

        if update_data.get('source_config') and isinstance(update_data['source_config'], dict):
            update_data['source_config'] = json.dumps(update_data['source_config'], ensure_ascii=False)

        if 'tags' in update_data:
            if update_data['tags'] and isinstance(update_data['tags'], list):
                update_data['tags'] = json.dumps(update_data['tags'], ensure_ascii=False)
            else:
                update_data['tags'] = None

        # 自动获取 mime_type 和 file_type
        from app.core.knowledgebase.utils.file_utils import get_mime_type, filename_type
        
        # 优先使用 file_name，其次使用 location
        filename = update_data.get('file_name') or update_data.get('location')
        # 如果更新数据中没有文件名，则使用数据库中的文件名
        if not filename:
            filename = db_doc.file_name or db_doc.location
        
        if filename:
            # 获取 MIME 类型
            if 'mime_type' not in update_data:
                update_data['mime_type'] = get_mime_type(filename)
            # 获取文件类型
            if 'file_type' not in update_data:
                file_type_str = filename_type(filename)
                update_data['file_type'] = file_type_str

        if 'category_id' in update_data and update_data['category_id'] != db_doc.category_id:
            from app.database.storage.rustfs_utils import rustfs_utils
            
            old_category_id = db_doc.category_id
            new_category_id = update_data['category_id']
            
            logger.info(f"文档分类变更: 从 {old_category_id} 到 {new_category_id}")
            logger.info(f"当前文档 location: {db_doc.location}")
            logger.info(f"当前文档 source_type: {db_doc.source_type}")
            logger.info(f"RustFS 可用: {rustfs_utils.is_available}")
            
            # 只移动本地文档的文件
            if db_doc.location and rustfs_utils.is_available and db_doc.source_type == 'local_document':
                filename = db_doc.location.split('/')[-1]
                
                # 构建新的完整路径
                new_category_path = KnowledgebaseDocumentCategoryService.get_category_path(new_category_id) if new_category_id else ""
                new_full_path = f"{new_category_path}/{filename}" if new_category_path else filename
                
                # 构建新的 location 值（相对于分类路径的文件名）
                if new_category_path:
                    new_location = f"{new_category_path}/{filename}"
                else:
                    new_location = filename
                
                logger.info(f"新完整路径: {new_full_path}")
                logger.info(f"新 location: {new_location}")
                
                try:
                    # 尝试查找源文件
                    source_key = None
                    
                    # 方法1: 基于旧分类路径查找
                    old_category_path = KnowledgebaseDocumentCategoryService.get_category_path(old_category_id) if old_category_id else ""
                    old_full_path = f"{old_category_path}/{filename}" if old_category_path else filename
                    if rustfs_utils.object_exists(db_doc.kb_id, old_full_path):
                        source_key = old_full_path
                        logger.info(f"找到源文件: {db_doc.kb_id}/{source_key}")
                    
                    # 方法2: 直接使用 location 作为路径（兼容旧数据）
                    if not source_key and rustfs_utils.object_exists(db_doc.kb_id, db_doc.location):
                        source_key = db_doc.location
                        logger.info(f"找到源文件: {db_doc.kb_id}/{source_key}")
                    
                    # 方法3: 遍历桶中的所有文件，查找文件名匹配的文件
                    if not source_key:
                        logger.info(f"尝试遍历桶 {db_doc.kb_id} 查找文件 {filename}")
                        objects = rustfs_utils.list_objects(db_doc.kb_id)
                        for obj in objects:
                            if obj['Key'].endswith(f"/{filename}") or obj['Key'] == filename:
                                source_key = obj['Key']
                                logger.info(f"找到源文件: {db_doc.kb_id}/{source_key}")
                                break
                    
                    if source_key:
                        logger.info(f"尝试复制文件: {db_doc.kb_id}/{source_key} -> {db_doc.kb_id}/{new_full_path}")
                        
                        copy_success = rustfs_utils.copy_object(
                            source_bucket=db_doc.kb_id,
                            source_key=source_key,
                            dest_bucket=db_doc.kb_id,
                            dest_key=new_full_path
                        )
                        
                        logger.info(f"复制结果: {copy_success}")
                        
                        if copy_success:
                            # 检查目标文件是否存在
                            dest_exists = rustfs_utils.object_exists(db_doc.kb_id, new_full_path)
                            logger.info(f"目标文件存在: {dest_exists}")
                            
                            if dest_exists:
                                rustfs_utils.delete_object(
                                    bucket_name=db_doc.kb_id,
                                    object_key=source_key
                                )
                                update_data['location'] = new_location
                                logger.info(f"文档分类变更，文件路径已更新: {source_key} -> {new_full_path}")
                            else:
                                logger.warning(f"目标文件不存在，复制可能失败: {db_doc.kb_id}/{new_full_path}")
                        else:
                            logger.warning(f"文档分类变更，但文件复制失败: {source_key} -> {new_full_path}")
                    else:
                        logger.warning(f"未找到源文件: {filename}")
                        # 即使找不到源文件，也要更新数据库中的 location 字段
                        update_data['location'] = new_location
                        logger.info(f"更新数据库中的 location 字段为: {new_location}")
                except Exception as e:
                    logger.error(f"文档分类变更，文件移动失败: {e}")
                    # 即使出现异常，也要更新数据库中的 location 字段
                    update_data['location'] = new_location
                    logger.info(f"更新数据库中的 location 字段为: {new_location}")
            else:
                # 非本地文档，不更新 location 字段
                logger.info(f"非本地文档，跳过 location 字段更新: source_type={db_doc.source_type}")

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
            db_doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == document_id)
            if db_doc.deleted:
                raise ResourceNotFoundError(message=f"知识库文档 {document_id} 不存在")
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识库文档 {document_id} 不存在")

        # 删除RustFS中的文件 - 只删除本地文档
        from app.database.storage.rustfs_utils import rustfs_utils
        if db_doc.location and rustfs_utils.is_available and db_doc.source_type == 'local_document':
            try:
                rustfs_utils.delete_object(
                    bucket_name=db_doc.kb_id,
                    object_key=db_doc.location,
                )
            except Exception as e:
                logger.warning(f"删除RustFS文件失败 {db_doc.kb_id}/{db_doc.location}: {e}")

        # 删除ES中的切片数据
        try:
            from app.core.knowledgebase.server import task_executor
            task_executor.delete_document_chunks(db_doc.kb_id, document_id)
        except Exception as e:
            logger.warning(f"删除ES切片数据失败: {e}")

        db_doc.deleted = True
        db_doc.deleted_at = datetime.now()
        db_doc.save()

        Knowledgebase.update(
            doc_num=Knowledgebase.doc_num - 1,
            token_num=Knowledgebase.token_num - (db_doc.token_num or 0)
        ).where(Knowledgebase.id == db_doc.kb_id).execute()

        return db_doc
    
    @staticmethod
    @handle_transaction
    def batch_delete_documents(document_ids: List[str]):
        """
        批量删除知识库文档（逻辑删除，同时删除RustFS中的文件）

        Args:
            document_ids: 文档ID列表

        Returns:
            int: 成功删除的文档数量

        Raises:
            ResourceNotFoundError: 文档不存在
        """
        if not document_ids:
            return 0
        
        # 检查所有文档是否存在且未删除
        existing_docs = list(KnowledgebaseDocument.select().where(
            (KnowledgebaseDocument.id.in_(document_ids)) &
            (KnowledgebaseDocument.deleted == False)
        ))
        
        existing_ids = {doc.id for doc in existing_docs}
        missing_ids = set(document_ids) - existing_ids
        
        if missing_ids:
            raise ResourceNotFoundError(message=f"文档 {', '.join(missing_ids)} 不存在")
        
        # 删除RustFS中的文件 - 只删除本地文档
        from app.database.storage.rustfs_utils import rustfs_utils
        if rustfs_utils.is_available:
            for doc in existing_docs:
                if doc.location and doc.source_type == 'local_document':
                    try:
                        rustfs_utils.delete_object(
                            bucket_name=doc.kb_id,
                            object_key=doc.location,
                        )
                    except Exception as e:
                        logger.warning(f"删除RustFS文件失败 {doc.kb_id}/{doc.location}: {e}")
        
        # 删除ES中的切片数据
        try:
            from app.core.knowledgebase.server import task_executor
            for doc in existing_docs:
                task_executor.delete_document_chunks(doc.kb_id, doc.id)
        except Exception as e:
            logger.warning(f"删除ES切片数据失败: {e}")
        
        # 按知识库分组统计删除的文档数量和token数
        kb_stats = {}
        for doc in existing_docs:
            if doc.kb_id not in kb_stats:
                kb_stats[doc.kb_id] = {'doc_count': 0, 'token_count': 0}
            kb_stats[doc.kb_id]['doc_count'] += 1
            kb_stats[doc.kb_id]['token_count'] += doc.token_num or 0
        
        # 批量更新文档状态
        from datetime import datetime
        now = datetime.now()
        
        updated = KnowledgebaseDocument.update(
            deleted=True,
            deleted_at=now
        ).where(
            (KnowledgebaseDocument.id.in_(document_ids)) &
            (KnowledgebaseDocument.deleted == False)
        ).execute()
        
        # 更新每个知识库的统计信息
        for kb_id, stats in kb_stats.items():
            Knowledgebase.update(
                doc_num=Knowledgebase.doc_num - stats['doc_count'],
                token_num=Knowledgebase.token_num - stats['token_count']
            ).where(Knowledgebase.id == kb_id).execute()
        
        return updated

    @staticmethod
    @handle_transaction
    def update_document_metadata(document_id: str, kb_id: str, metadatas: dict):
        """
        更新数据集元数据，同步更新数据库和ES索引
        支持增量更新：只有当元数据发生变化时才更新ES

        Args:
            document_id: 文档ID
            kb_id: 知识库ID
            metadatas: 元数据字典

        Returns:
            dict: 更新结果
        """
        try:
            db_doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == document_id)
        except KnowledgebaseDocument.DoesNotExist:
            raise ResourceNotFoundError(message=f"文档 {document_id} 不存在")

        old_metadatas = {}
        if db_doc.metadatas:
            try:
                old_metadatas = json.loads(db_doc.metadatas)
            except (json.JSONDecodeError, TypeError):
                pass

        db_doc.metadatas = json.dumps(metadatas, ensure_ascii=False)
        db_doc.save()

        def dict_equal(d1: dict, d2: dict) -> bool:
            if set(d1.keys()) != set(d2.keys()):
                return False
            for key in d1:
                if isinstance(d1[key], dict) and isinstance(d2[key], dict):
                    if not dict_equal(d1[key], d2[key]):
                        return False
                elif isinstance(d1[key], list) and isinstance(d2[key], list):
                    if len(d1[key]) != len(d2[key]):
                        return False
                    for i, item in enumerate(d1[key]):
                        if isinstance(item, dict) and isinstance(d2[key][i], dict):
                            if not dict_equal(item, d2[key][i]):
                                return False
                        elif item != d2[key][i]:
                            return False
                elif d1[key] != d2[key]:
                    return False
            return True

        if dict_equal(old_metadatas, metadatas):
            logger.info(f"元数据未变化，跳过ES更新: {document_id}")
            return {"success": True, "message": "元数据未变化"}

        try:
            from app.database.es_utils import es_utils
            if es_utils.is_available:
                index_name = kb_id
                if es_utils.client.indices.exists(index=index_name):
                    changed_keys = []
                    for key in metadatas:
                        if key not in old_metadatas or not dict_equal(
                            {key: metadatas[key]}, {key: old_metadatas[key]}
                        ):
                            changed_keys.append(key)

                    deleted_keys = [key for key in old_metadatas if key not in metadatas]

                    updates = {k: v for k, v in metadatas.items() if k in changed_keys}

                    if updates:
                        es_utils.client.update_by_query(
                            index=index_name,
                            body={
                                "query": {"term": {"doc_id": document_id}},
                                "script": {
                                    "source": "ctx._source.putAll(params.updates)",
                                    "params": {"updates": updates}
                                }
                            }
                        )

                    if deleted_keys:
                        delete_script = "; ".join(
                            [f"ctx._source.remove('{key}')" for key in deleted_keys]
                        )
                        es_utils.client.update_by_query(
                            index=index_name,
                            body={
                                "query": {"term": {"doc_id": document_id}},
                                "script": {
                                    "source": delete_script
                                }
                            }
                        )

                    logger.info(f"成功增量更新ES元数据: {document_id}, 更新: {changed_keys}, 删除: {deleted_keys}")
        except Exception as e:
            logger.warning(f"更新ES元数据失败: {e}")

        return {"document_id": document_id, "metadatas": metadatas}

    @staticmethod
    def get_chunks(
        kb_id: str,
        doc_id: str = None,
        page: int = 1,
        page_size: int = 10,
        available: int = None,
        keyword: str = None
    ) -> Dict[str, Any]:
        """
        分页查询知识库切片列表
        
        Args:
            kb_id: 知识库ID
            doc_id: 文档ID（可选）
            page: 页码
            page_size: 每页数量
            available: 可用状态过滤
            keyword: 关键词搜索
            
        Returns:
            Dict: 包含切片列表和分页信息
        """
        if not es_utils.is_available:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            }
        
        must_conditions = []
        
        if doc_id:
            must_conditions.append({"term": {"doc_id": doc_id}})
        
        if available is not None:
            must_conditions.append({"term": {"available_int": available}})
        
        if keyword:
            must_conditions.append({
                "bool": {
                    "should": [
                        {
                            "match": {
                                "content_with_weight": {
                                    "query": keyword,
                                    "operator": "and"
                                }
                            }
                        },
                        {
                            "match": {
                                "important_kwd": keyword
                            }
                        }
                    ],
                    "minimum_should_match": 1
                }
            })
        
        query = {
            "bool": {
                "must": must_conditions if must_conditions else [{"match_all": {}}]
            }
        }
        
        from_ = (page - 1) * page_size
        
        sort = [
            {"page_num_int": {"order": "asc", "missing": "_last", "unmapped_type": "integer"}},
            {"top_int": {"order": "asc", "missing": "_last", "unmapped_type": "integer"}},
            {"create_timestamp_flt": {"order": "desc", "missing": "_last", "unmapped_type": "float"}}
        ]
        
        chunks = es_utils.search_documents(
            index_name=kb_id,
            query=query,
            size=page_size,
            from_=from_,
            include_id=True,
            sort=sort
        )
        
        for chunk in chunks:
            if 'tkn_cnt_int' in chunk:
                chunk['token_num_int'] = chunk['tkn_cnt_int']
        
        total = es_utils.count_documents(index_name=kb_id, query=query)
        
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        
        return {
            "items": chunks,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }

    @staticmethod
    def toggle_chunk_available(
        kb_id: str,
        chunk_id: str,
        available: int
    ) -> bool:
        """
        切换切片的可用状态
        
        Args:
            kb_id: 知识库ID
            chunk_id: 切片ID（ES文档ID）
            available: 可用状态
            
        Returns:
            bool: 是否更新成功
        """
        if not es_utils.is_available:
            logger.warning("ES不可用，无法更新切片状态")
            return False
        
        try:
            success = es_utils.update_document(
                index_name=kb_id,
                doc_id=chunk_id,
                doc={"available_int": available}
            )
            return success
        except Exception as e:
            logger.error(f"更新切片可用状态失败: {e}")
            return False

    @staticmethod
    def _prepare_chunk_fields(
        content: str,
        doc_name: str = "",
        keywords: List[str] = None,
        available: int = 1
    ) -> Dict[str, Any]:
        """
        准备切片字段数据
        
        Args:
            content: 切片内容
            doc_name: 文档名称
            keywords: 关键词列表
            available: 是否可用
            
        Returns:
            Dict: 切片字段字典
        """
        from app.core.knowledgebase.rag.nlp import rag_tokenizer
        
        fields = {}
        
        fields["content_with_weight"] = content
        fields["content_ltks"] = rag_tokenizer.tokenize(content)
        fields["content_sm_ltks"] = rag_tokenizer.fine_grained_tokenize(fields["content_ltks"])
        fields["available_int"] = available
        
        if doc_name:
            fields["doc_name"] = doc_name
            fields["docnm_kwd"] = doc_name
            fields["title_tks"] = rag_tokenizer.tokenize(doc_name)
        
        if keywords:
            fields["important_kwd"] = keywords
            fields["important_tks"] = rag_tokenizer.tokenize(" ".join(keywords))
        
        return fields

    @staticmethod
    def _extract_keywords_from_content(content: str, text_model_id: str = None, topn: int = 5) -> List[str]:
        """
        从内容中提取关键词
        
        Args:
            content: 切片内容
            text_model_id: 文本模型ID
            topn: 提取关键词数量
            
        Returns:
            List[str]: 关键词列表
        """
        import asyncio
        import json
        from app.core.knowledgebase.rag.prompts.generator import keyword_extraction
        from app.core.knowledgebase.rag.utils.common_utils import get_llm_cache, set_llm_cache
        from app.core.llm_model.factory import LLMFactory
        from app.database.models import LLMModel
        
        if not content or not content.strip():
            return []
        
        if not text_model_id:
            return []
        
        try:
            llm_model = LLMModel.get(LLMModel.id == text_model_id)
            if not llm_model or llm_model.deleted:
                logger.warning(f"Text模型不存在或已删除: {text_model_id}")
                return []
            
            model_config = {
                "api_key": llm_model.api_key,
                "endpoint": llm_model.endpoint,
                "name": llm_model.name,
                "provider": llm_model.provider,
            }
            
            if llm_model.config:
                try:
                    extra_config = json.loads(llm_model.config) if isinstance(llm_model.config, str) else llm_model.config
                    model_config.update(extra_config)
                except (json.JSONDecodeError, TypeError):
                    pass
            
            text_model = LLMFactory.create_model("text", model_config)
            if not text_model:
                return []
            
            model_name = llm_model.name
            gen_conf = {"topn": topn}
            
            cached = get_llm_cache(model_name, content, "keywords", gen_conf)
            if cached:
                return [k.strip() for k in cached.split(",") if k.strip()]
            
            async def extract_async():
                try:
                    kwd = await keyword_extraction(text_model, content, topn)
                    if kwd and kwd.find("**ERROR**") < 0:
                        set_llm_cache(model_name, content, kwd, "keywords", gen_conf, exp=60)
                        return kwd
                    return None
                except Exception as e:
                    logger.warning(f"关键词提取异常: {e}")
                    return None
            
            kwd = asyncio.run(extract_async())
            if kwd:
                return [k.strip() for k in kwd.split(",") if k.strip()]
            
            return []
        except Exception as e:
            logger.warning(f"关键词提取失败: {e}")
            return []

    @staticmethod
    def _embedding_chunk(
        content: str,
        doc_name: str = "",
        embedding_model_id: str = None
    ) -> Dict[str, Any]:
        """
        对切片内容进行向量化
        
        Args:
            content: 切片内容
            doc_name: 文档名称
            embedding_model_id: Embedding模型ID
            
        Returns:
            Dict: 包含向量相关字段的字典
        """
        if not embedding_model_id:
            return {}
        
        try:
            import json
            import numpy as np
            import re
            from app.core.llm_model.factory import LLMFactory
            from app.database.models import LLMModel
            
            llm_model = LLMModel.get(LLMModel.id == embedding_model_id)
            if not llm_model or llm_model.deleted:
                logger.warning(f"Embedding模型不存在或已删除: {embedding_model_id}")
                return {}
            
            model_config = {
                "api_key": llm_model.api_key,
                "endpoint": llm_model.endpoint,
                "name": llm_model.name,
                "provider": llm_model.provider,
            }
            
            if llm_model.config:
                try:
                    extra_config = json.loads(llm_model.config) if isinstance(llm_model.config, str) else llm_model.config
                    model_config.update(extra_config)
                except (json.JSONDecodeError, TypeError):
                    pass
            
            embedding_model = LLMFactory.create_model("embedding", model_config)
            if not embedding_model:
                return {}
            
            title = doc_name or "Title"
            title = re.sub(r"</?(table|td|caption|tr|th)( [^<>]{0,12})?>", " ", title)
            
            vector_content = re.sub(r"</?(table|td|caption|tr|th)( [^<>]{0,12})?>", " ", content)
            if not vector_content:
                vector_content = "None"
            
            title_embeddings = None
            content_embeddings = None
            vector_size = 0
            token_counts = []
            
            try:
                title_embeddings, _ = embedding_model.encode([title])
                title_embeddings = np.array(title_embeddings)
            except Exception as e:
                logger.warning(f"标题向量化失败: {e}")
            
            try:
                content_embeddings, token_counts = embedding_model.encode([vector_content])
                content_embeddings = np.array(content_embeddings)
            except Exception as e:
                logger.warning(f"正文向量化失败: {e}")
            
            if content_embeddings is not None and len(content_embeddings) > 0:
                vector_size = len(content_embeddings[0])
            elif title_embeddings is not None and len(title_embeddings) > 0:
                vector_size = len(title_embeddings[0])
            
            if vector_size == 0:
                return {}
            
            filename_embd_weight = 0.1
            
            if (title_embeddings is not None and content_embeddings is not None and
                title_embeddings.shape == content_embeddings.shape):
                final_embedding = filename_embd_weight * title_embeddings[0] + (1 - filename_embd_weight) * content_embeddings[0]
            elif content_embeddings is not None and len(content_embeddings) > 0:
                final_embedding = content_embeddings[0]
            elif title_embeddings is not None and len(title_embeddings) > 0:
                final_embedding = title_embeddings[0]
            else:
                final_embedding = np.zeros(vector_size)
            
            fields = {}
            q_vec_field = f"q_{vector_size}_vec"
            fields[q_vec_field] = final_embedding.tolist()
            fields["embedding"] = final_embedding.tolist()
            
            if token_counts:
                fields["tkn_cnt_int"] = token_counts[0]
                fields["token_num_int"] = token_counts[0]
            fields["char_count_int"] = len(vector_content)
            
            return fields
        except Exception as e:
            logger.warning(f"向量化失败: {e}")
            return {}

    @staticmethod
    def create_chunk(
        kb_id: str,
        doc_id: str,
        content: str,
        keywords: List[str] = None,
        available: int = 1
    ) -> Dict[str, Any]:
        """
        新增切片
        
        Args:
            kb_id: 知识库ID
            doc_id: 文档ID
            content: 切片内容
            keywords: 关键词列表
            available: 是否可用
            
        Returns:
            Dict: 包含chunk_id的字典
        """
        if not es_utils.is_available:
            raise RuntimeError("Elasticsearch不可用，无法创建切片")
        
        from datetime import datetime
        from app.database.models import KnowledgebaseDocument, Knowledgebase
        
        doc = KnowledgebaseDocument.get_by_id(doc_id)
        if not doc:
            raise ValueError(f"文档不存在: {doc_id}")
        
        kb = Knowledgebase.get_by_id(kb_id)
        if not kb:
            raise ValueError(f"知识库不存在: {kb_id}")
        
        doc_name = doc.file_name or ""
        
        extracted_keywords = []
        text_model_id = kb.text_model_id
        if text_model_id:
            extracted_keywords = KnowledgebaseDocumentService._extract_keywords_from_content(
                content, text_model_id, topn=5
            )
        
        if keywords is not None:
            all_keywords = list(set(keywords + extracted_keywords))
        else:
            all_keywords = extracted_keywords
        
        fields = KnowledgebaseDocumentService._prepare_chunk_fields(
            content=content,
            doc_name=doc_name,
            keywords=all_keywords,
            available=available
        )
        
        embedding_fields = KnowledgebaseDocumentService._embedding_chunk(
            content=content,
            doc_name=doc_name,
            embedding_model_id=kb.embedding_model_id
        )
        fields.update(embedding_fields)
        
        fields["doc_id"] = doc_id
        fields["kb_id"] = kb_id
        
        # 添加文档元数据
        if doc.metadatas:
            try:
                import json
                metadatas_dict = json.loads(doc.metadatas) if isinstance(doc.metadatas, str) else doc.metadatas
                if metadatas_dict and isinstance(metadatas_dict, dict):
                    fields["metadatas"] = metadatas_dict
            except Exception as e:
                logger.warning(f"解析文档元数据失败: {e}")
        
        now = datetime.now()
        chunk_id = f"{doc_id}_{now.strftime('%Y%m%d%H%M%S%f')}"
        fields["chunk_id"] = chunk_id
        fields["create_time"] = str(now).replace("T", " ")[:19]
        fields["create_timestamp_flt"] = now.timestamp()
        
        success = es_utils.insert_document(
            index_name=kb_id,
            doc=fields,
            doc_id=chunk_id
        )
        
        if not success:
            raise RuntimeError("切片创建失败")
        
        # 返回完整的切片数据
        created_chunk = es_utils.get_document(index_name=kb_id, doc_id=chunk_id)
        return created_chunk

    @staticmethod
    def update_chunk(
        kb_id: str,
        chunk_id: str,
        content: str = None,
        keywords: List[str] = None,
        available: int = None
    ) -> Optional[Dict[str, Any]]:
        """
        更新切片
        
        Args:
            kb_id: 知识库ID
            chunk_id: 切片ID
            content: 切片内容
            keywords: 关键词列表
            available: 是否可用
            
        Returns:
            Optional[Dict]: 更新后的切片数据，失败返回None
        """
        if not es_utils.is_available:
            logger.warning("ES不可用，无法更新切片")
            return None
        
        from app.database.models import KnowledgebaseDocument, Knowledgebase
        
        existing_chunk = es_utils.get_document(index_name=kb_id, doc_id=chunk_id)
        if not existing_chunk:
            logger.warning(f"切片不存在: {chunk_id}")
            return None
        
        update_fields = {}
        
        if content is not None:
            doc_id = existing_chunk.get("doc_id", "")
            doc = KnowledgebaseDocument.get_by_id(doc_id) if doc_id else None
            doc_name = doc.file_name if doc else existing_chunk.get("doc_name", "")
            
            extracted_keywords = []
            kb = Knowledgebase.get_by_id(kb_id)
            text_model_id = kb.text_model_id if kb else None
            if text_model_id:
                extracted_keywords = KnowledgebaseDocumentService._extract_keywords_from_content(
                    content, text_model_id, topn=5
                )
            
            if keywords is not None:
                all_keywords = list(set(keywords + extracted_keywords))
            else:
                all_keywords = extracted_keywords
            
            fields = KnowledgebaseDocumentService._prepare_chunk_fields(
                content=content,
                doc_name=doc_name,
                keywords=all_keywords,
                available=available if available is not None else existing_chunk.get("available_int", 1)
            )
            
            embedding_fields = KnowledgebaseDocumentService._embedding_chunk(
                content=content,
                doc_name=doc_name,
                embedding_model_id=kb.embedding_model_id if kb else None
            )
            fields.update(embedding_fields)
            
            # 添加文档元数据
            if doc and doc.metadatas:
                try:
                    import json
                    metadatas_dict = json.loads(doc.metadatas) if isinstance(doc.metadatas, str) else doc.metadatas
                    if metadatas_dict and isinstance(metadatas_dict, dict):
                        fields["metadatas"] = metadatas_dict
                except Exception as e:
                    logger.warning(f"解析文档元数据失败: {e}")
            
            update_fields.update(fields)
        else:
            if keywords is not None:
                from app.core.knowledgebase.rag.nlp import rag_tokenizer
                update_fields["important_kwd"] = keywords
                update_fields["important_tks"] = rag_tokenizer.tokenize(" ".join(keywords))
            
            if available is not None:
                update_fields["available_int"] = available
            
            # 添加文档元数据
            doc_id = existing_chunk.get("doc_id", "")
            if doc_id:
                doc = KnowledgebaseDocument.get_by_id(doc_id)
                if doc and doc.metadatas:
                    try:
                        import json
                        metadatas_dict = json.loads(doc.metadatas) if isinstance(doc.metadatas, str) else doc.metadatas
                        if metadatas_dict and isinstance(metadatas_dict, dict):
                            update_fields["metadatas"] = metadatas_dict
                    except Exception as e:
                        logger.warning(f"解析文档元数据失败: {e}")
        
        # 如果没有更新字段，检查是否需要更新元数据
        if not update_fields:
            doc_id = existing_chunk.get("doc_id", "")
            if doc_id:
                doc = KnowledgebaseDocument.get_by_id(doc_id)
                if doc and doc.metadatas:
                    try:
                        import json
                        metadatas_dict = json.loads(doc.metadatas) if isinstance(doc.metadatas, str) else doc.metadatas
                        if metadatas_dict and isinstance(metadatas_dict, dict):
                            # 检查元数据是否有变化
                            existing_metadatas = existing_chunk.get("metadatas", {})
                            if metadatas_dict != existing_metadatas:
                                update_fields["metadatas"] = metadatas_dict
                    except Exception as e:
                        logger.warning(f"解析文档元数据失败: {e}")
        
        if not update_fields:
            return existing_chunk
        
        try:
            success = es_utils.update_document(
                index_name=kb_id,
                doc_id=chunk_id,
                doc=update_fields
            )
            if success:
                # 获取更新后的切片数据
                updated_chunk = es_utils.get_document(index_name=kb_id, doc_id=chunk_id)
                return updated_chunk
            return None
        except Exception as e:
            logger.error(f"更新切片失败: {e}")
            return None

    @staticmethod
    def delete_chunk(
        kb_id: str,
        chunk_id: str
    ) -> bool:
        """
        删除切片
        
        Args:
            kb_id: 知识库ID
            chunk_id: 切片ID
            
        Returns:
            bool: 是否删除成功
        """
        if not es_utils.is_available:
            logger.warning("ES不可用，无法删除切片")
            return False
        
        try:
            success = es_utils.delete_document(
                index_name=kb_id,
                doc_id=chunk_id
            )
            return success
        except Exception as e:
            logger.error(f"删除切片失败: {e}")
            return False

    @staticmethod
    async def intelligent_extract(
        model_id: str,
        prompt: str,
        category_id: str,
        files: Optional[List[Any]] = None,
        text_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        智能提取方法
        
        Args:
            model_id: 模型ID
            prompt: 提取提示词
            category_id: 知识目录ID
            files: 上传的文件列表（可选）
            text_content: 文本内容（可选）
            
        Returns:
            Dict: 提取结果
            
        Raises:
            ResourceNotFoundError: 知识目录不存在
        """
        import json
        import asyncio
        from app.database.models import KnowledgebaseDocumentCategory, LLMModel
        from app.core.llm_model.utils.llm_util import convert_query_to_message, format_prompt
        from app.core.prompt.utils.system_prompt_builder import _load_prompt_file
        from app.core.llm_model.factory import LLMFactory
        from app.core.chat.chat_core import QueryItem
        from fastapi import UploadFile
        
        try:
            category = KnowledgebaseDocumentCategory.get(KnowledgebaseDocumentCategory.id == category_id)
            if not category or category.deleted:
                raise ResourceNotFoundError(message=f"知识目录 {category_id} 不存在")
        except KnowledgebaseDocumentCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"知识目录 {category_id} 不存在")
        
        try:
            llm_model = LLMModel.get(LLMModel.id == model_id)
            if not llm_model or llm_model.deleted:
                raise ResourceNotFoundError(message=f"模型 {model_id} 不存在")
        except LLMModel.DoesNotExist:
            raise ResourceNotFoundError(message=f"模型 {model_id} 不存在")
        
        document_config = json.loads(category.document_config) if isinstance(category.document_config, str) else category.document_config
        
        template_type = document_config.get('template_type', '')
        custom_fields = document_config.get('custom_fields', [])
        chapters = document_config.get('chapters', [])
        chapter_type = document_config.get('chapter_type', '')
        has_knowledge_content = document_config.get('has_knowledge_content', False)
        
        system_prompt_template = _load_prompt_file('knowledge_template_extract.md')
        
        params = {
            'TEMPLATE_TYPE': template_type,
            'HAS_CUSTOM_FIELDS': '是' if custom_fields else '否',
            'CUSTOM_FIELDS': json.dumps(custom_fields, ensure_ascii=False) if custom_fields else '无',
            'HAS_CHAPTERS': '是' if chapters else '否',
            'CHAPTER_TYPE': chapter_type or '无',
            'HAS_KNOWLEDGE_CONTENT': '是' if has_knowledge_content else '否'
        }
        
        system_prompt = format_prompt(system_prompt_template, params)
        
        query_items = []
        
        if files:
            for file in files:
                if isinstance(file, UploadFile):
                    file_content = await file.read()
                    import base64
                    base64_content = base64.b64encode(file_content).decode('utf-8')
                    
                    from app.core.knowledgebase.utils.file_utils import get_mime_type
                    mime_type = get_mime_type(file.filename)
                    
                    query_items.append(QueryItem(
                        type='file_base64',
                        content=base64_content,
                        mime_type=mime_type,
                        file_name=file.filename,
                        file_size=len(file_content)
                    ))
        
        if text_content:
            query_items.append(QueryItem(
                type='text',
                content=text_content
            ))
        
        user_message = convert_query_to_message(query_items, llm_model.model_type, model_id)
        
        user_prompt_message = {
            'role': 'user',
            'content': prompt
        }
        
        messages = [
            {'role': 'system', 'content': system_prompt},
            user_message,
            user_prompt_message
        ]
        
        model_config = {
            "api_key": llm_model.api_key,
            "endpoint": llm_model.endpoint,
            "name": llm_model.name,
            "provider": llm_model.provider,
        }
        
        if llm_model.config:
            try:
                extra_config = json.loads(llm_model.config) if isinstance(llm_model.config, str) else llm_model.config
                model_config.update(extra_config)
            except (json.JSONDecodeError, TypeError):
                pass
        
        llm_instance = LLMFactory.create_model(llm_model.model_type, model_config)
        
        if not llm_instance:
            raise RuntimeError(f"无法创建模型实例: {model_id}")
        
        try:
            result = llm_instance.generate_with_messages(messages)
            
            if 'error' in result:
                raise RuntimeError(f"模型调用失败: {result['error']}")
            
            response = result.get('text', '')
        except Exception as e:
            logger.error(f"模型调用失败: {e}")
            raise
        
        from app.core.llm_model.utils.llm_util import get_output_json_content
        json_str = get_output_json_content(response)
        
        try:
            extracted_data = json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning(f"无法解析JSON响应: {response}")
            extracted_data = {
                "custom_fields": [],
                "chapters": [],
                "content": ""
            }
        
        return {
            "extracted_info": extracted_data,
            "raw_response": response
        }


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
    def get_category_path(category_id: Optional[str]):
        """
        获取分类的完整路径（包括所有父分类）

        Args:
            category_id: 分类ID

        Returns:
            str: 分类路径，格式为：父分类id/子分类id/当前分类id
        """
        if not category_id:
            return ""
        
        path_parts = []
        current_id = category_id
        
        while current_id:
            try:
                category = KnowledgebaseDocumentCategory.get_by_id(current_id)
                if category.deleted:
                    break
                path_parts.insert(0, category.id)
                current_id = category.parent_id
            except KnowledgebaseDocumentCategory.DoesNotExist:
                break
        
        return "/".join(path_parts)

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

        category_data = category.model_dump()
        
        if category_data.get('document_config') and isinstance(category_data['document_config'], dict):
            category_data['document_config'] = json.dumps(category_data['document_config'], ensure_ascii=False)
        
        if category_data.get('chunk_config') and isinstance(category_data['chunk_config'], dict):
            category_data['chunk_config'] = json.dumps(category_data['chunk_config'], ensure_ascii=False)

        db_category = KnowledgebaseDocumentCategory(**category_data)
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
                        "is_default": cat.is_default,
                        "document_config": json.loads(cat.document_config) if cat.document_config else {},
                        "chunk_method": cat.chunk_method,
                        "chunk_config": json.loads(cat.chunk_config) if cat.chunk_config else {},
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

        if update_data.get('document_config') and isinstance(update_data['document_config'], dict):
            update_data['document_config'] = json.dumps(update_data['document_config'], ensure_ascii=False)
        
        if update_data.get('chunk_config') and isinstance(update_data['chunk_config'], dict):
            update_data['chunk_config'] = json.dumps(update_data['chunk_config'], ensure_ascii=False)

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
