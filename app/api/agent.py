"""
智能体控制器，提供智能体相关的API接口
"""

import json
from fastapi import APIRouter, Query
from app.services.agent.service import (
    AgentCategoryService, AgentComponentService, AgentInstanceService
)
from app.services.agent.dto import (
    AgentCategoryCreate, AgentCategoryUpdate, AgentCategory as AgentCategorySchema,
    AgentComponentCreate, AgentComponentUpdate, AgentComponent as AgentComponentSchema,
    AgentInstanceCreate, AgentInstanceUpdate, AgentInstance as AgentInstanceSchema
)
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


def format_category_data(data: dict) -> dict:
    """格式化分类数据，移除ID中的横杠"""
    if data.get('id'):
        data['id'] = str(data['id']).replace('-', '')
    if data.get('parent_id'):
        data['parent_id'] = str(data['parent_id']).replace('-', '')
    return data


def format_category_tree(tree: list) -> list:
    """格式化分类树数据，移除ID中的横杠"""
    result = []
    for node in tree:
        formatted_node = format_category_data(node.copy())
        if formatted_node.get('children'):
            formatted_node['children'] = format_category_tree(formatted_node['children'])
        result.append(formatted_node)
    return result


# ==================== 智能体分类接口 ====================

@router.post("/categories", response_model=ApiResponse)
def create_category(category: AgentCategoryCreate):
    """
    创建智能体分类
    """
    db_category = AgentCategoryService.create_category(category)
    return ResponseUtil.created(data=format_category_data(db_category.__data__.copy()), message="智能体分类创建成功")


@router.get("/categories", response_model=ApiResponse)
def get_categories(skip: int = 0, limit: int = 100, parent_id: str = None):
    """
    获取智能体分类列表
    """
    categories = AgentCategoryService.get_categories(skip, limit, parent_id)
    categories_data = [format_category_data(category.__data__.copy()) for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取智能体分类列表成功")


@router.get("/categories/tree", response_model=ApiResponse)
def get_category_tree():
    """
    获取分类树结构
    """
    category_tree = AgentCategoryService.get_category_tree()
    return ResponseUtil.success(data=format_category_tree(category_tree), message="获取分类树结构成功")


@router.get("/categories/{category_id}", response_model=ApiResponse)
def get_category(category_id: str):
    """
    获取单个智能体分类
    """
    category = AgentCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"智能体分类 {category_id} 不存在")
    return ResponseUtil.success(data=format_category_data(category.__data__.copy()), message="获取智能体分类成功")


@router.post("/categories/{category_id}", response_model=ApiResponse)
def update_category(category_id: str, category: AgentCategoryUpdate):
    """
    更新智能体分类
    """
    db_category = AgentCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=format_category_data(db_category.__data__.copy()), message="智能体分类更新成功")


@router.post("/categories/{category_id}/delete", response_model=ApiResponse)
def delete_category(category_id: str):
    """
    删除智能体分类
    """
    db_category = AgentCategoryService.delete_category(category_id)
    return ResponseUtil.success(data=format_category_data(db_category.__data__.copy()), message="智能体分类删除成功")


# ==================== 智能体组件接口 ====================

@router.post("/components", response_model=ApiResponse)
def create_component(component: AgentComponentCreate):
    """
    创建智能体组件
    """
    db_component = AgentComponentService.create_component(component)
    return ResponseUtil.created(data=db_component.__data__, message="智能体组件创建成功")


@router.get("/components", response_model=ApiResponse)
def get_components(skip: int = 0, limit: int = 100, component_type: str = None, category: str = None, status: int = None):
    """
    获取智能体组件列表
    """
    components = AgentComponentService.get_components(skip, limit, component_type, category, status)
    components_data = [component.__data__ for component in components]
    return ResponseUtil.success(data=components_data, message="获取智能体组件列表成功")


@router.get("/components/all", response_model=ApiResponse)
def get_all_components(component_type: str = None, category: str = None, status: int = None):
    """
    获取所有智能体组件（不分页）
    """
    components = AgentComponentService.get_all_components(component_type, category, status)
    components_data = []
    for component in components:
        data = component.__data__
        data['css'] = json.loads(data.get('css') or '{}')
        data['default_params'] = json.loads(data.get('default_params') or '{}')
        components_data.append(data)
    return ResponseUtil.success(data=components_data, message="获取所有智能体组件成功")


@router.get("/components/{component_id}", response_model=ApiResponse)
def get_component(component_id: str):
    """
    获取单个智能体组件
    """
    component = AgentComponentService.get_component(component_id)
    if component is None:
        return ResponseUtil.not_found(message=f"智能体组件 {component_id} 不存在")
    return ResponseUtil.success(data=component.__data__, message="获取智能体组件成功")


@router.post("/components/{component_id}", response_model=ApiResponse)
def update_component(component_id: str, component: AgentComponentUpdate):
    """
    更新智能体组件
    """
    db_component = AgentComponentService.update_component(component_id, component)
    return ResponseUtil.success(data=db_component.__data__, message="智能体组件更新成功")


@router.post("/components/{component_id}/delete", response_model=ApiResponse)
def delete_component(component_id: str):
    """
    删除智能体组件
    """
    db_component = AgentComponentService.delete_component(component_id)
    return ResponseUtil.success(data=db_component.__data__, message="智能体组件删除成功")


# ==================== 智能体实例接口 ====================

@router.post("/instances", response_model=ApiResponse)
def create_instance(instance: AgentInstanceCreate):
    """
    创建智能体实例
    """
    db_instance = AgentInstanceService.create_instance(instance)
    return ResponseUtil.created(data=db_instance.__data__, message="智能体实例创建成功")


@router.get("/instances", response_model=ApiResponse)
def get_instances(
    page: int = Query(1, description="页码"),
    page_size: int = Query(12, description="每页数量"),
    category_id: str = Query(None, description="分类ID"),
    name: str = Query(None, description="智能体名称（模糊查询）"),
    code: str = Query(None, description="智能体编码（模糊查询）"),
    status: str = Query(None, description="状态")
):
    """
    获取智能体实例列表（分页）
    
    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        category_id: 分类ID（可选）
        name: 智能体名称（模糊查询，可选）
        code: 智能体编码（模糊查询，可选）
        status: 状态（可选）
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    instances = AgentInstanceService.get_instances(skip, page_size, category_id, name, code, status)
    total = AgentInstanceService.count_instances(category_id, name, code, status)
    instances_data = []
    for instance in instances:
        data = instance.__data__.copy()
        if data.get('dsl'):
            import json
            if isinstance(data['dsl'], str):
                data['dsl'] = json.loads(data['dsl'])
        instances_data.append(data)
    return ResponseUtil.success(data={"data": instances_data, "total": total}, message="获取智能体实例列表成功")


@router.get("/instances/{instance_id}", response_model=ApiResponse)
def get_instance(instance_id: str):
    """
    获取单个智能体实例
    """
    instance = AgentInstanceService.get_instance(instance_id)
    if instance is None:
        return ResponseUtil.not_found(message=f"智能体实例 {instance_id} 不存在")
    data = instance.__data__.copy()
    if data.get('dsl'):
        import json
        if isinstance(data['dsl'], str):
            data['dsl'] = json.loads(data['dsl'])
    return ResponseUtil.success(data=data, message="获取智能体实例成功")


@router.post("/instances/{instance_id}", response_model=ApiResponse)
def update_instance(instance_id: str, instance: AgentInstanceUpdate):
    """
    更新智能体实例
    """
    db_instance = AgentInstanceService.update_instance(instance_id, instance)
    data = db_instance.__data__.copy()
    if data.get('dsl'):
        import json
        if isinstance(data['dsl'], str):
            data['dsl'] = json.loads(data['dsl'])
    return ResponseUtil.success(data=data, message="智能体实例更新成功")


@router.post("/instances/{instance_id}/delete", response_model=ApiResponse)
def delete_instance(instance_id: str):
    """
    删除智能体实例
    """
    db_instance = AgentInstanceService.delete_instance(instance_id)
    return ResponseUtil.success(data=db_instance.__data__, message="智能体实例删除成功")


@router.post("/instances/{instance_id}/publish", response_model=ApiResponse)
def publish_instance(instance_id: str):
    """
    发布智能体实例
    """
    db_instance = AgentInstanceService.publish_instance(instance_id)
    return ResponseUtil.success(data=db_instance.__data__, message="智能体实例发布成功")
