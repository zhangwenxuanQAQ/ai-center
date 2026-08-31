"""
SKILL分类API控制器
"""

from fastapi import APIRouter
from app.services.skill_category.service import SkillCategoryService
from app.services.skill_category.dto import SkillCategoryCreate, SkillCategoryUpdate
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter(prefix="/category")


def format_category_data(data: dict) -> dict:
    if data.get('id'):
        data['id'] = str(data['id']).replace('-', '')
    if data.get('parent_id'):
        data['parent_id'] = str(data['parent_id']).replace('-', '')
    return data


def format_category_tree(tree: list) -> list:
    result = []
    for node in tree:
        formatted_node = format_category_data(node.copy())
        if formatted_node.get('children'):
            formatted_node['children'] = format_category_tree(formatted_node['children'])
        result.append(formatted_node)
    return result


@router.post("", response_model=ApiResponse)
def create_category(category: SkillCategoryCreate):
    """创建SKILL分类"""
    db_category = SkillCategoryService.create_category(category)
    return ResponseUtil.created(data=format_category_data(db_category.__data__.copy()), message="SKILL分类创建成功")


@router.get("", response_model=ApiResponse)
def get_categories(skip: int = 0, limit: int = 100, parent_id: str = None):
    """获取SKILL分类列表"""
    categories = SkillCategoryService.get_categories(skip, limit, parent_id)
    data = [format_category_data(c.__data__.copy()) for c in categories]
    return ResponseUtil.success(data=data, message="获取SKILL分类列表成功")


@router.get("/tree", response_model=ApiResponse)
def get_category_tree():
    """获取分类树结构"""
    tree = SkillCategoryService.get_category_tree()
    return ResponseUtil.success(data=format_category_tree(tree), message="获取分类树结构成功")


@router.post("/{category_id}/order", response_model=ApiResponse)
def update_category_order(category_id: str, order_data: dict):
    """更新分类排序"""
    new_order = order_data.get('sort_order', 0)
    db_category = SkillCategoryService.update_category_order(category_id, new_order)
    return ResponseUtil.success(data=format_category_data(db_category.__data__.copy()), message="分类排序更新成功")


@router.get("/{category_id}", response_model=ApiResponse)
def get_category(category_id: str):
    """获取单个SKILL分类"""
    category = SkillCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"SKILL分类 {category_id} 不存在")
    return ResponseUtil.success(data=format_category_data(category.__data__.copy()), message="获取SKILL分类成功")


@router.post("/{category_id}", response_model=ApiResponse)
def update_category(category_id: str, category: SkillCategoryUpdate):
    """更新SKILL分类"""
    db_category = SkillCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=format_category_data(db_category.__data__.copy()), message="SKILL分类更新成功")


@router.post("/{category_id}/delete", response_model=ApiResponse)
def delete_category(category_id: str):
    """删除SKILL分类"""
    db_category = SkillCategoryService.delete_category(category_id)
    return ResponseUtil.success(data=format_category_data(db_category.__data__.copy()), message="SKILL分类删除成功")
