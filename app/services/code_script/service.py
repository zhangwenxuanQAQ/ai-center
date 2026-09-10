"""
代码脚本服务类，提供代码脚本的CRUD操作、分类管理与校验、测试执行
"""

import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from app.core.tools.builtin_tools.code_script import (
    run_code_script,
    validate_code,
    validate_params_definitions,
    parse_params_json,
)
from app.database.db_utils import handle_transaction
from app.database.models import CodeScript, CodeScriptCategory
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError
from app.services.code_script.dto import (
    CodeScriptCreate,
    CodeScriptUpdate,
    CodeScriptCategoryCreate,
    CodeScriptCategoryUpdate,
)

logger = logging.getLogger(__name__)


def _dump_params(params) -> Optional[str]:
    """将入参定义列表序列化为JSON字符串存储。"""
    if params is None:
        return None
    if isinstance(params, str):
        return params
    return json.dumps(params, ensure_ascii=False)


def _load_params(params_json) -> List[Dict[str, Any]]:
    """将入参定义JSON字符串解析为列表。"""
    return parse_params_json(params_json)


def _script_to_data(script: CodeScript) -> Dict[str, Any]:
    """将代码脚本对象转为字典，params字段反序列化为列表。"""
    data = dict(script.__data__)
    data["params"] = _load_params(data.get("params"))
    return data


class CodeScriptCategoryService:
    """
    代码脚本分类服务类

    提供代码脚本分类的创建、查询、更新、删除等操作
    """

    @staticmethod
    @handle_transaction
    def create_category(category: CodeScriptCategoryCreate):
        """
        创建代码脚本分类

        Args:
            category: 代码脚本分类创建DTO

        Returns:
            CodeScriptCategory: 创建的分类对象

        Raises:
            DuplicateResourceError: 同一父分类下名称已存在
        """
        parent_id = category.parent_id

        existing = (
            CodeScriptCategory.select()
            .where(
                (CodeScriptCategory.name == category.name)
                & (
                    CodeScriptCategory.parent_id == parent_id
                    if parent_id
                    else CodeScriptCategory.parent_id.is_null()
                )
                & (CodeScriptCategory.deleted == False)
            )
            .first()
        )

        if existing:
            raise DuplicateResourceError(f"分类名称 '{category.name}' 已存在")

        db_category = CodeScriptCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category

    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100):
        """
        获取代码脚本分类列表

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            List[CodeScriptCategory]: 分类列表
        """
        return list(
            CodeScriptCategory.select()
            .where(CodeScriptCategory.deleted == False)
            .order_by(CodeScriptCategory.sort_order)
            .offset(skip)
            .limit(limit)
        )

    @staticmethod
    def get_category_tree():
        """
        获取代码脚本分类树形结构

        Returns:
            List[dict]: 分类树形结构
        """
        categories = list(
            CodeScriptCategory.select()
            .where(CodeScriptCategory.deleted == False)
            .order_by(CodeScriptCategory.sort_order)
        )

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
                        "children": build_tree(cat.id),
                    }
                    tree.append(node)
            return tree

        return build_tree()

    @staticmethod
    def get_category(category_id: str):
        """
        获取单个代码脚本分类

        Args:
            category_id: 分类ID

        Returns:
            CodeScriptCategory: 分类对象，不存在则返回None
        """
        try:
            category = CodeScriptCategory.get_by_id(category_id)
            if category.deleted:
                return None
            return category
        except CodeScriptCategory.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: CodeScriptCategoryUpdate):
        """
        更新代码脚本分类

        Args:
            category_id: 分类ID
            category: 分类更新DTO

        Returns:
            CodeScriptCategory: 更新后的分类对象

        Raises:
            ResourceNotFoundError: 分类不存在
            DuplicateResourceError: 同一父分类下名称已存在
        """
        try:
            db_category = CodeScriptCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(
                    message=f"代码脚本分类 {category_id} 不存在"
                )
        except CodeScriptCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"代码脚本分类 {category_id} 不存在")

        update_data = category.model_dump(exclude_unset=True)

        if "name" in update_data:
            parent_id = update_data.get("parent_id", db_category.parent_id)
            existing = (
                CodeScriptCategory.select()
                .where(
                    (CodeScriptCategory.name == update_data["name"])
                    & (
                        CodeScriptCategory.parent_id == parent_id
                        if parent_id
                        else CodeScriptCategory.parent_id.is_null()
                    )
                    & (CodeScriptCategory.id != category_id)
                    & (CodeScriptCategory.deleted == False)
                )
                .first()
            )

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
        删除代码脚本分类（逻辑删除）

        Args:
            category_id: 分类ID

        Returns:
            CodeScriptCategory: 被删除的分类对象

        Raises:
            ResourceNotFoundError: 分类不存在
            ValueError: 分类下存在代码脚本，无法删除
        """
        try:
            db_category = CodeScriptCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(
                    message=f"代码脚本分类 {category_id} 不存在"
                )
        except CodeScriptCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"代码脚本分类 {category_id} 不存在")

        def get_all_child_category_ids(parent_id: str) -> list:
            child_ids = [parent_id]
            children = CodeScriptCategory.select().where(
                (CodeScriptCategory.parent_id == parent_id)
                & (CodeScriptCategory.deleted == False)
            )
            for child in children:
                child_ids.extend(get_all_child_category_ids(child.id))
            return child_ids

        all_category_ids = get_all_child_category_ids(category_id)

        script_count = (
            CodeScript.select()
            .where(
                (CodeScript.category_id.in_(all_category_ids))
                & (CodeScript.deleted == False)
            )
            .count()
        )

        if script_count > 0:
            raise ValueError(
                f"该分类或其子分类下存在 {script_count} 个代码脚本，无法删除"
            )

        db_category.deleted = True
        db_category.deleted_at = datetime.now()
        db_category.save()
        return db_category


class CodeScriptService:
    """
    代码脚本服务类

    提供代码脚本的创建、查询、更新、删除、校验及测试执行等操作
    """

    @staticmethod
    def _validate_content_and_params(
        content: Optional[str], params: Optional[List[Dict[str, Any]]]
    ):
        """
        校验代码内容与入参定义

        Args:
            content: Python代码内容
            params: 入参定义列表

        Raises:
            ValueError: 校验不通过
        """
        if content:
            validate_result = validate_code(content)
            if not validate_result["valid"]:
                raise ValueError(f"代码校验失败: {validate_result['error']}")

        if params is not None:
            params_check = validate_params_definitions(params)
            if not params_check["valid"]:
                raise ValueError(f"入参定义校验失败: {params_check['error']}")

    @staticmethod
    @handle_transaction
    def create_script(script: CodeScriptCreate):
        """
        创建代码脚本

        Args:
            script: 代码脚本创建DTO

        Returns:
            CodeScript: 创建的代码脚本对象

        Raises:
            DuplicateResourceError: 名称已存在
            ValueError: 代码校验不通过
        """
        script_data = script.model_dump()

        existing = (
            CodeScript.select()
            .where(
                (CodeScript.name == script_data["name"]) & (CodeScript.deleted == False)
            )
            .first()
        )

        if existing:
            raise DuplicateResourceError(f"脚本名称 '{script_data['name']}' 已存在")

        # 创建时校验代码（语法/main函数/安全检查）与入参定义
        CodeScriptService._validate_content_and_params(
            script_data.get("content"),
            script_data.get("params"),
        )

        # 入参定义序列化为JSON存储
        script_data["params"] = _dump_params(script_data.get("params"))

        db_script = CodeScript(**script_data)
        db_script.save(force_insert=True)
        return db_script

    @staticmethod
    def get_scripts(
        skip: int = 0,
        limit: int = 100,
        category_id: str = None,
        name: str = None,
        status: str = None,
        description: str = None,
    ):
        """
        获取代码脚本列表

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID（可选）
            name: 脚本名称（模糊查询）
            status: 状态（true/false，可选）
            description: 脚本描述（模糊查询，可选）

        Returns:
            List[CodeScript]: 代码脚本列表
        """
        query = CodeScript.select().where(CodeScript.deleted == False)

        if category_id:
            query = query.where(CodeScript.category_id == category_id)

        if name:
            query = query.where(CodeScript.name.contains(name))

        if description:
            query = query.where(CodeScript.description.contains(description))

        if status is not None and status != "":
            status_bool = status.lower() == "true"
            query = query.where(CodeScript.status == status_bool)

        return list(
            query.order_by(CodeScript.created_at.desc()).offset(skip).limit(limit)
        )

    @staticmethod
    def count_scripts(
        category_id: str = None,
        name: str = None,
        status: str = None,
        description: str = None,
    ) -> int:
        """
        统计代码脚本总数

        Args:
            category_id: 分类ID（可选）
            name: 脚本名称（模糊查询）
            status: 状态（true/false，可选）
            description: 脚本描述（模糊查询，可选）

        Returns:
            int: 代码脚本总数
        """
        query = CodeScript.select().where(CodeScript.deleted == False)

        if category_id:
            query = query.where(CodeScript.category_id == category_id)

        if name:
            query = query.where(CodeScript.name.contains(name))

        if description:
            query = query.where(CodeScript.description.contains(description))

        if status is not None and status != "":
            status_bool = status.lower() == "true"
            query = query.where(CodeScript.status == status_bool)

        return query.count()

    @staticmethod
    def get_script(script_id: str):
        """
        获取单个代码脚本

        Args:
            script_id: 代码脚本ID

        Returns:
            CodeScript: 代码脚本对象，不存在则返回None
        """
        try:
            script = CodeScript.get_by_id(script_id)
            if script.deleted:
                return None
            return script
        except CodeScript.DoesNotExist:
            return None

    @staticmethod
    @handle_transaction
    def update_script(script_id: str, script: CodeScriptUpdate):
        """
        更新代码脚本

        Args:
            script_id: 代码脚本ID
            script: 代码脚本更新DTO

        Returns:
            CodeScript: 更新后的代码脚本对象

        Raises:
            ResourceNotFoundError: 代码脚本不存在
            DuplicateResourceError: 名称已存在
            ValueError: 代码校验不通过
        """
        try:
            db_script = CodeScript.get_by_id(script_id)
            if db_script.deleted:
                raise ResourceNotFoundError(message=f"代码脚本 {script_id} 不存在")
        except CodeScript.DoesNotExist:
            raise ResourceNotFoundError(message=f"代码脚本 {script_id} 不存在")

        update_data = script.model_dump(exclude_unset=True)

        if "name" in update_data:
            existing = (
                CodeScript.select()
                .where(
                    (CodeScript.name == update_data["name"])
                    & (CodeScript.id != script_id)
                    & (CodeScript.deleted == False)
                )
                .first()
            )

            if existing:
                raise DuplicateResourceError(f"脚本名称 '{update_data['name']}' 已存在")

        # 更新代码内容或入参定义时重新校验
        CodeScriptService._validate_content_and_params(
            update_data.get("content"),
            update_data.get("params"),
        )

        # 入参定义序列化为JSON存储
        if "params" in update_data:
            update_data["params"] = _dump_params(update_data.get("params"))

        for field, value in update_data.items():
            setattr(db_script, field, value)
        db_script.updated_at = datetime.now()
        db_script.save()
        return db_script

    @staticmethod
    @handle_transaction
    def delete_script(script_id: str):
        """
        删除代码脚本（逻辑删除）

        Args:
            script_id: 代码脚本ID

        Returns:
            CodeScript: 被删除的代码脚本对象

        Raises:
            ResourceNotFoundError: 代码脚本不存在
        """
        try:
            db_script = CodeScript.get_by_id(script_id)
            if db_script.deleted:
                raise ResourceNotFoundError(message=f"代码脚本 {script_id} 不存在")
        except CodeScript.DoesNotExist:
            raise ResourceNotFoundError(message=f"代码脚本 {script_id} 不存在")

        db_script.deleted = True
        db_script.deleted_at = datetime.now()
        db_script.save()
        return db_script

    @staticmethod
    def validate_script_content(content: str):
        """
        校验代码内容（语法/main函数/安全检查）

        Args:
            content: Python代码内容

        Returns:
            dict: 校验结果，包含valid和error字段
        """
        if not content or not content.strip():
            return {"valid": False, "error": "代码内容为空"}
        return validate_code(content)

    @staticmethod
    def test_script(
        script_id: str = None,
        content: str = None,
        timeout: int = 30,
        params: Dict[str, Any] = None,
        param_definitions: List[Dict[str, Any]] = None,
    ):
        """
        测试执行代码脚本

        所有的代码执行都通过 builtin_tool 的 run 方法执行。

        Args:
            script_id: 代码脚本ID（与content二选一）
            content: 代码内容（未保存时直接测试）
            timeout: 执行超时时间（秒）
            params: 用户传入的参数值字典（与main函数形参对应）
            param_definitions: 入参定义列表（未指定时，script_id场景取脚本保存的定义）

        Returns:
            ToolResult: 工具执行结果
        """
        if script_id:
            script = CodeScriptService.get_script(script_id)
            if not script:
                return None
            content = script.content
            if param_definitions is None:
                param_definitions = _load_params(getattr(script, "params", None))

        return run_code_script(
            code=content or "",
            script_id=script_id or "",
            timeout=timeout,
            params=params,
            param_definitions=param_definitions,
        )
