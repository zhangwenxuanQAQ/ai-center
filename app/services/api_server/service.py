"""
API服务类，提供API服务分类、API服务配置、API接口的CRUD操作
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from app.database.models import ApiServerCategory, ApiServer, Api
from app.services.api_server.dto import (
    ApiServerCategoryCreate, ApiServerCategoryUpdate,
    ApiServerCreate, ApiServerUpdate,
    ApiCreate, ApiUpdate,
)
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError

logger = logging.getLogger(__name__)


class ApiServerCategoryService:
    """
    API服务分类服务类

    提供API服务分类的创建、查询、更新、删除等操作
    """

    @staticmethod
    def _get_or_create_default_category():
        """
        获取或创建默认分类

        Returns:
            ApiServerCategory: 默认分类对象
        """
        default_category = ApiServerCategory.select().where(
            (ApiServerCategory.name == "默认分类") &
            (ApiServerCategory.deleted == False)
        ).first()
        if not default_category:
            default_category = ApiServerCategory(
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
    def create_category(category: ApiServerCategoryCreate):
        """
        创建API服务分类

        Args:
            category: API服务分类创建DTO

        Returns:
            ApiServerCategory: 创建的分类对象

        Raises:
            DuplicateResourceError: 同一父分类下名称已存在
        """
        parent_id = category.parent_id

        existing = ApiServerCategory.select().where(
            (ApiServerCategory.name == category.name) &
            (ApiServerCategory.parent_id == parent_id if parent_id else ApiServerCategory.parent_id.is_null()) &
            (ApiServerCategory.deleted == False)
        ).first()

        if existing:
            raise DuplicateResourceError(f"分类名称 '{category.name}' 已存在")

        db_category = ApiServerCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category

    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100):
        """
        获取API服务分类列表

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            List[ApiServerCategory]: 分类列表
        """
        return list(ApiServerCategory.select().where(
            ApiServerCategory.deleted == False
        ).offset(skip).limit(limit))

    @staticmethod
    def get_category_tree():
        """
        获取API服务分类树形结构

        Returns:
            List[dict]: 分类树形结构
        """
        categories = list(ApiServerCategory.select().where(
            ApiServerCategory.deleted == False
        ).order_by(ApiServerCategory.sort_order))

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
        获取单个API服务分类

        Args:
            category_id: 分类ID

        Returns:
            ApiServerCategory: 分类对象，不存在则返回None
        """
        try:
            category = ApiServerCategory.get_by_id(category_id)
            if category.deleted:
                return None
            return category
        except ApiServerCategory.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: ApiServerCategoryUpdate):
        """
        更新API服务分类

        Args:
            category_id: 分类ID
            category: 分类更新DTO

        Returns:
            ApiServerCategory: 更新后的分类对象

        Raises:
            ResourceNotFoundError: 分类不存在
            DuplicateResourceError: 同一父分类下名称已存在
        """
        try:
            db_category = ApiServerCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"API服务分类 {category_id} 不存在")
        except ApiServerCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"API服务分类 {category_id} 不存在")

        update_data = category.model_dump(exclude_unset=True)

        if 'name' in update_data:
            parent_id = update_data.get('parent_id', db_category.parent_id)
            existing = ApiServerCategory.select().where(
                (ApiServerCategory.name == update_data['name']) &
                (ApiServerCategory.parent_id == parent_id if parent_id else ApiServerCategory.parent_id.is_null()) &
                (ApiServerCategory.id != category_id) &
                (ApiServerCategory.deleted == False)
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
        删除API服务分类（逻辑删除）

        Args:
            category_id: 分类ID

        Returns:
            ApiServerCategory: 被删除的分类对象

        Raises:
            ResourceNotFoundError: 分类不存在
            ValueError: 分类下存在API服务，无法删除
        """
        try:
            db_category = ApiServerCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"API服务分类 {category_id} 不存在")
        except ApiServerCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"API服务分类 {category_id} 不存在")

        def get_all_child_category_ids(parent_id: str) -> list:
            child_ids = [parent_id]
            children = ApiServerCategory.select().where(
                (ApiServerCategory.parent_id == parent_id) &
                (ApiServerCategory.deleted == False)
            )
            for child in children:
                child_ids.extend(get_all_child_category_ids(child.id))
            return child_ids

        all_category_ids = get_all_child_category_ids(category_id)

        server_count = ApiServer.select().where(
            (ApiServer.category_id.in_(all_category_ids)) &
            (ApiServer.deleted == False)
        ).count()

        if server_count > 0:
            raise ValueError(f"该分类或其子分类下存在 {server_count} 个API服务，无法删除")

        db_category.deleted = True
        db_category.deleted_at = datetime.now()
        db_category.save()
        return db_category


class ApiServerService:
    """
    API服务类

    提供API服务配置的创建、查询、更新、删除等操作
    """

    @staticmethod
    @handle_transaction
    def create_server(server: ApiServerCreate):
        """
        创建API服务

        Args:
            server: API服务创建DTO

        Returns:
            ApiServer: 创建的API服务对象

        Raises:
            DuplicateResourceError: 名称已存在
        """
        server_data = server.model_dump()

        if not server_data.get('category_id'):
            default_category = ApiServerCategoryService._get_or_create_default_category()
            server_data['category_id'] = default_category.id

        existing = ApiServer.select().where(
            (ApiServer.name == server_data['name']) &
            (ApiServer.deleted == False)
        ).first()

        if existing:
            raise DuplicateResourceError(f"API服务名称 '{server_data['name']}' 已存在")

        db_server = ApiServer(**server_data)
        db_server.save(force_insert=True)
        return db_server

    @staticmethod
    def get_servers(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, status: str = None, description: str = None):
        """
        获取API服务列表

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID（可选）
            name: 服务名称（模糊查询）
            status: 状态（true/false，可选）
            description: 服务描述（模糊查询，可选）

        Returns:
            List[ApiServer]: API服务列表
        """
        query = ApiServer.select().where(ApiServer.deleted == False)

        if category_id:
            query = query.where(ApiServer.category_id == category_id)

        if name:
            query = query.where(ApiServer.name.contains(name))

        if description:
            query = query.where(ApiServer.description.contains(description))

        if status is not None and status != '':
            status_bool = status.lower() == 'true'
            query = query.where(ApiServer.status == status_bool)

        return list(query.order_by(ApiServer.created_at.desc()).offset(skip).limit(limit))

    @staticmethod
    def count_servers(category_id: str = None, name: str = None, status: str = None, description: str = None) -> int:
        """
        统计API服务总数

        Args:
            category_id: 分类ID（可选）
            name: 服务名称（模糊查询）
            status: 状态（true/false，可选）
            description: 服务描述（模糊查询，可选）

        Returns:
            int: API服务总数
        """
        query = ApiServer.select().where(ApiServer.deleted == False)

        if category_id:
            query = query.where(ApiServer.category_id == category_id)

        if name:
            query = query.where(ApiServer.name.contains(name))

        if description:
            query = query.where(ApiServer.description.contains(description))

        if status is not None and status != '':
            status_bool = status.lower() == 'true'
            query = query.where(ApiServer.status == status_bool)

        return query.count()

    @staticmethod
    def get_server(server_id: str):
        """
        获取单个API服务

        Args:
            server_id: API服务ID

        Returns:
            ApiServer: API服务对象，不存在则返回None
        """
        try:
            server = ApiServer.get_by_id(server_id)
            if server.deleted:
                return None
            return server
        except ApiServer.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_server(server_id: str, server: ApiServerUpdate):
        """
        更新API服务

        Args:
            server_id: API服务ID
            server: API服务更新DTO

        Returns:
            ApiServer: 更新后的API服务对象

        Raises:
            ResourceNotFoundError: API服务不存在
            DuplicateResourceError: 名称已存在
        """
        try:
            db_server = ApiServer.get_by_id(server_id)
            if db_server.deleted:
                raise ResourceNotFoundError(message=f"API服务 {server_id} 不存在")
        except ApiServer.DoesNotExist:
            raise ResourceNotFoundError(message=f"API服务 {server_id} 不存在")

        update_data = server.model_dump(exclude_unset=True)

        if 'name' in update_data:
            existing = ApiServer.select().where(
                (ApiServer.name == update_data['name']) &
                (ApiServer.id != server_id) &
                (ApiServer.deleted == False)
            ).first()

            if existing:
                raise DuplicateResourceError(f"API服务名称 '{update_data['name']}' 已存在")

        for field, value in update_data.items():
            setattr(db_server, field, value)
        db_server.updated_at = datetime.now()
        db_server.save()
        return db_server

    @staticmethod
    @handle_transaction
    def delete_server(server_id: str):
        """
        删除API服务（逻辑删除）

        Args:
            server_id: API服务ID

        Returns:
            ApiServer: 被删除的API服务对象

        Raises:
            ResourceNotFoundError: API服务不存在
        """
        try:
            db_server = ApiServer.get_by_id(server_id)
            if db_server.deleted:
                raise ResourceNotFoundError(message=f"API服务 {server_id} 不存在")
        except ApiServer.DoesNotExist:
            raise ResourceNotFoundError(message=f"API服务 {server_id} 不存在")

        db_server.deleted = True
        db_server.deleted_at = datetime.now()
        db_server.save()
        return db_server


class ApiService:
    """
    API接口服务类

    提供API接口的创建、查询、更新、删除及Swagger批量导入等操作
    """

    @staticmethod
    @handle_transaction
    def create_api(api: ApiCreate):
        """
        创建API接口

        Args:
            api: API接口创建DTO

        Returns:
            Api: 创建的API接口对象
        """
        db_api = Api(**api.model_dump())
        db_api.save(force_insert=True)
        return db_api

    @staticmethod
    def get_apis(skip: int = 0, limit: int = 100, server_id: str = None,
                 name: str = None, status: str = None, path: str = None, method: str = None):
        """
        获取API接口列表

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            server_id: API服务ID，可选
            name: 接口名称（模糊查询）
            status: 状态（true/false）
            path: 请求路径（模糊查询，在configs中搜索）
            method: 请求方法（在configs中搜索）

        Returns:
            List[Api]: API接口列表
        """
        query = Api.select().where(Api.deleted == False)
        if server_id:
            query = query.where(Api.server_id == server_id)
        if name:
            query = query.where(Api.name.contains(name))
        if status is not None and status != '':
            status_bool = status.lower() == 'true'
            query = query.where(Api.status == status_bool)
        if path:
            # 在configs JSON中搜索路径值
            query = query.where(Api.configs.contains(path))
        if method:
            # 在configs JSON中搜索请求方法
            query = query.where(Api.configs.contains(method))
        return list(query.order_by(Api.created_at.desc()).offset(skip).limit(limit))

    @staticmethod
    def count_apis(server_id: str = None, name: str = None, status: str = None, path: str = None, method: str = None) -> int:
        """
        统计API接口总数

        Args:
            server_id: API服务ID，可选
            name: 接口名称（模糊查询）
            status: 状态（true/false）
            path: 请求路径（模糊查询）
            method: 请求方法（在configs中搜索）

        Returns:
            int: API接口总数
        """
        query = Api.select().where(Api.deleted == False)
        if server_id:
            query = query.where(Api.server_id == server_id)
        if name:
            query = query.where(Api.name.contains(name))
        if status is not None and status != '':
            status_bool = status.lower() == 'true'
            query = query.where(Api.status == status_bool)
        if path:
            query = query.where(Api.configs.contains(path))
        if method:
            query = query.where(Api.configs.contains(method))
        return query.count()

    @staticmethod
    def get_api(api_id: str):
        """
        获取单个API接口

        Args:
            api_id: API接口ID

        Returns:
            Api: API接口对象，不存在则返回None
        """
        try:
            api = Api.get_by_id(api_id)
            if api.deleted:
                return None
            return api
        except Api.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_api(api_id: str, api: ApiUpdate):
        """
        更新API接口

        Args:
            api_id: API接口ID
            api: API接口更新DTO

        Returns:
            Api: 更新后的API接口对象

        Raises:
            ResourceNotFoundError: API接口不存在
        """
        try:
            db_api = Api.get_by_id(api_id)
            if db_api.deleted:
                raise ResourceNotFoundError(message=f"API接口 {api_id} 不存在")
        except Api.DoesNotExist:
            raise ResourceNotFoundError(message=f"API接口 {api_id} 不存在")

        update_data = api.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_api, field, value)
        db_api.updated_at = datetime.now()
        db_api.save()
        return db_api

    @staticmethod
    @handle_transaction
    def delete_api(api_id: str):
        """
        删除API接口（逻辑删除）

        Args:
            api_id: API接口ID

        Returns:
            Api: 被删除的API接口对象

        Raises:
            ResourceNotFoundError: API接口不存在
        """
        try:
            db_api = Api.get_by_id(api_id)
            if db_api.deleted:
                raise ResourceNotFoundError(message=f"API接口 {api_id} 不存在")
        except Api.DoesNotExist:
            raise ResourceNotFoundError(message=f"API接口 {api_id} 不存在")

        db_api.deleted = True
        db_api.deleted_at = datetime.now()
        db_api.save()
        return db_api

    @staticmethod
    @handle_transaction
    def batch_delete_apis(api_ids: list) -> int:
        """
        批量删除API接口（逻辑删除）

        Args:
            api_ids: API接口ID列表

        Returns:
            int: 删除成功的接口数量
        """
        if not api_ids:
            return 0

        now = datetime.now()
        updated = Api.update(
            deleted=True,
            deleted_at=now
        ).where(
            (Api.id.in_(api_ids)) &
            (Api.deleted == False)
        ).execute()

        return updated

    @staticmethod
    def parse_swagger(server_id: str, swagger_url: str = None, swagger_json: str = None,
                      include_patterns: list = None, exclude_patterns: list = None,
                      headers_str: str = None) -> list:
        """
        解析Swagger/OpenAPI文档并返回API接口列表（不入库）

        Args:
            server_id: API服务ID
            swagger_url: Swagger文档URL
            swagger_json: Swagger文档JSON字符串
            include_patterns: 包含的API路径模式列表（正则表达式）
            exclude_patterns: 排除的API路径模式列表（正则表达式）
            headers_str: 请求头JSON字符串（覆盖服务级headers，用于访问需认证的Swagger文档）

        Returns:
            list: API接口列表，每项包含name/title/description/configs/status

        Raises:
            ResourceNotFoundError: API服务不存在
            ValueError: 解析失败
        """
        try:
            db_server = ApiServer.get_by_id(server_id)
            if db_server.deleted:
                raise ResourceNotFoundError(message=f"API服务 {server_id} 不存在")
        except ApiServer.DoesNotExist:
            raise ResourceNotFoundError(message=f"API服务 {server_id} 不存在")

        # 解析服务headers
        headers = {}
        if db_server.headers:
            try:
                parsed_headers = json.loads(db_server.headers)
                # 兼容数组格式 [{key, value, type}] 和字典格式 {key: value}
                if isinstance(parsed_headers, list):
                    headers = {h['key']: h['value'] for h in parsed_headers if h.get('key')}
                elif isinstance(parsed_headers, dict):
                    headers = parsed_headers
            except json.JSONDecodeError:
                pass

        # 解析传入的headers_str（覆盖服务级headers）
        if headers_str:
            try:
                input_headers = json.loads(headers_str)
                if isinstance(input_headers, list):
                    for h in input_headers:
                        if h.get('key'):
                            headers[h['key']] = h.get('value', '')
                elif isinstance(input_headers, dict):
                    headers.update(input_headers)
            except json.JSONDecodeError:
                pass

        # 确定base_url
        base_url = db_server.url or ''

        # 使用SwaggerConverter
        from app.utils.swagger_converter import SwaggerConverter
        converter = SwaggerConverter(base_url=base_url, headers=headers)

        if swagger_url:
            swagger_doc = converter.load_from_url(swagger_url)
        else:
            swagger_doc = converter.load_from_json(swagger_json)

        apis = converter.convert_to_apis(
            swagger_doc=swagger_doc,
            server_id=server_id,
            include_patterns=include_patterns,
            exclude_patterns=exclude_patterns
        )

        return apis

    @staticmethod
    @handle_transaction
    def import_apis(server_id: str, apis: list):
        """
        批量导入API接口

        Args:
            server_id: API服务ID
            apis: API接口列表，每项包含name/title/description/configs/status

        Returns:
            List[Api]: 导入的API接口列表

        Raises:
            ResourceNotFoundError: API服务不存在
        """
        try:
            db_server = ApiServer.get_by_id(server_id)
            if db_server.deleted:
                raise ResourceNotFoundError(message=f"API服务 {server_id} 不存在")
        except ApiServer.DoesNotExist:
            raise ResourceNotFoundError(message=f"API服务 {server_id} 不存在")

        imported_apis = []
        for api_data in apis:
            # 跳过同一服务下重复名称的接口
            existing = Api.select().where(
                (Api.name == api_data.get('name')) &
                (Api.server_id == server_id) &
                (Api.deleted == False)
            ).first()

            if existing:
                continue

            api_data['server_id'] = server_id
            # 确保configs是JSON字符串
            if 'configs' in api_data and api_data['configs'] and isinstance(api_data['configs'], dict):
                api_data['configs'] = json.dumps(api_data['configs'], ensure_ascii=False)

            new_api = Api(**api_data)
            new_api.save(force_insert=True)
            imported_apis.append(new_api)

        return imported_apis
