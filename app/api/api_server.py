"""
API接口控制器，提供API服务分类、API服务配置、API接口相关的API接口
"""

import json
import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Body, Query, Request
from app.services.api_server.service import ApiServerCategoryService, ApiServerService, ApiService
from app.services.api_server.dto import (
    ApiServerCategoryCreate, ApiServerCategoryUpdate, ApiServerCategory,
    ApiServerCreate, ApiServerUpdate, ApiServer,
    ApiCreate, ApiUpdate, Api,
    SwaggerImportRequest,
)
from app.utils.response import ResponseUtil, ApiResponse
from app.core.tools import ToolResult

logger = logging.getLogger(__name__)

router = APIRouter()


# API服务分类相关接口
@router.post("/category", response_model=ApiResponse)
def create_api_category(category: ApiServerCategoryCreate):
    """
    创建API服务分类

    Args:
        category: API服务分类创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ApiServerCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="API服务分类创建成功")


@router.get("/category", response_model=ApiResponse)
def get_api_categories(skip: int = 0, limit: int = 100):
    """
    获取API服务分类列表

    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = ApiServerCategoryService.get_categories(skip, limit)
    categories_data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取API服务分类列表成功")


@router.get("/category/tree", response_model=ApiResponse)
def get_api_category_tree():
    """
    获取API服务分类树形结构

    Returns:
        ApiResponse: 统一格式的响应对象，包含分类树形结构
    """
    tree = ApiServerCategoryService.get_category_tree()
    return ResponseUtil.success(data=tree, message="获取API服务分类树成功")


@router.get("/category/{category_id}", response_model=ApiResponse)
def get_api_category(category_id: str):
    """
    获取单个API服务分类

    Args:
        category_id: 分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = ApiServerCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"API服务分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取API服务分类成功")


@router.post("/category/{category_id}", response_model=ApiResponse)
def update_api_category(category_id: str, category: ApiServerCategoryUpdate):
    """
    更新API服务分类

    Args:
        category_id: 分类ID
        category: 分类更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = ApiServerCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=db_category.__data__, message="API服务分类更新成功")


@router.post("/category/{category_id}/delete", response_model=ApiResponse)
def delete_api_category(category_id: str):
    """
    删除API服务分类

    Args:
        category_id: 分类ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = ApiServerCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="API服务分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# API服务相关接口
@router.post("/server", response_model=ApiResponse)
def create_api_server(server: ApiServerCreate):
    """
    创建API服务

    Args:
        server: API服务创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_server = ApiServerService.create_server(server)
    return ResponseUtil.created(data=db_server.__data__, message="API服务创建成功")


@router.get("/server", response_model=ApiResponse)
def get_api_servers(
    page: int = Query(1, description="页码，从1开始"),
    page_size: int = Query(12, description="每页数量"),
    category_id: str = Query(None, description="分类ID"),
    name: str = Query(None, description="服务名称（模糊查询）"),
    status: str = Query(None, description="状态（true/false）"),
    description: str = Query(None, description="服务描述（模糊查询）")
):
    """
    获取API服务列表（分页）

    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        category_id: 分类ID（可选）
        name: 服务名称（模糊查询，可选）
        status: 状态（true/false，可选）
        description: 服务描述（模糊查询，可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    servers = ApiServerService.get_servers(skip, page_size, category_id, name, status, description)
    total = ApiServerService.count_servers(category_id, name, status, description)
    servers_data = [server.__data__ for server in servers]
    return ResponseUtil.success(data={"data": servers_data, "total": total}, message="获取API服务列表成功")


@router.get("/server/{server_id}", response_model=ApiResponse)
def get_api_server(server_id: str):
    """
    获取单个API服务

    Args:
        server_id: API服务ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    server = ApiServerService.get_server(server_id)
    if server is None:
        return ResponseUtil.not_found(message=f"API服务 {server_id} 不存在")
    return ResponseUtil.success(data=server.__data__, message="获取API服务成功")


@router.post("/server/{server_id}", response_model=ApiResponse)
def update_api_server(server_id: str, server: ApiServerUpdate):
    """
    更新API服务

    Args:
        server_id: API服务ID
        server: API服务更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_server = ApiServerService.update_server(server_id, server)
    return ResponseUtil.success(data=db_server.__data__, message="API服务更新成功")


@router.post("/server/{server_id}/delete", response_model=ApiResponse)
def delete_api_server(server_id: str):
    """
    删除API服务

    Args:
        server_id: API服务ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_server = ApiServerService.delete_server(server_id)
    return ResponseUtil.success(data=db_server.__data__, message="API服务删除成功")


# API接口相关接口
@router.post("/interface", response_model=ApiResponse)
def create_api_interface(api: ApiCreate):
    """
    创建API接口

    Args:
        api: API接口创建DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_api = ApiService.create_api(api)
    return ResponseUtil.created(data=db_api.__data__, message="API接口创建成功")


@router.get("/interface", response_model=ApiResponse)
def get_api_interfaces(
    page: int = Query(1, description="页码，从1开始"),
    page_size: int = Query(10, description="每页数量"),
    server_id: str = Query(None, description="API服务ID"),
    name: str = Query(None, description="接口名称（模糊查询）"),
    status: str = Query(None, description="状态（true/false）"),
    path: str = Query(None, description="请求路径（模糊查询）"),
    method: str = Query(None, description="请求方法（GET/POST/PUT/DELETE/PATCH）")
):
    """
    获取API接口列表（分页）

    Args:
        page: 页码，从1开始
        page_size: 每页数量，默认10
        server_id: API服务ID，可选
        name: 接口名称（模糊查询，可选）
        status: 状态（true/false，可选）
        path: 请求路径（模糊查询，可选）
        method: 请求方法（可选）

    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    apis = ApiService.get_apis(skip, page_size, server_id, name, status, path, method)
    total = ApiService.count_apis(server_id, name, status, path, method)
    apis_data = []
    for api in apis:
        api_dict = api.__data__
        # configs字段解析为对象便于前端使用
        if api_dict.get('configs'):
            try:
                if isinstance(api_dict['configs'], str):
                    api_dict['configs'] = json.loads(api_dict['configs'])
            except json.JSONDecodeError:
                pass
        apis_data.append(api_dict)
    return ResponseUtil.success(data={"data": apis_data, "total": total}, message="获取API接口列表成功")


@router.get("/interface/{api_id}", response_model=ApiResponse)
def get_api_interface(api_id: str):
    """
    获取单个API接口

    Args:
        api_id: API接口ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    api = ApiService.get_api(api_id)
    if api is None:
        return ResponseUtil.not_found(message=f"API接口 {api_id} 不存在")
    api_dict = api.__data__
    if api_dict.get('configs'):
        try:
            if isinstance(api_dict['configs'], str):
                api_dict['configs'] = json.loads(api_dict['configs'])
        except json.JSONDecodeError:
            pass
    return ResponseUtil.success(data=api_dict, message="获取API接口成功")


@router.post("/interface/{api_id}", response_model=ApiResponse)
def update_api_interface(api_id: str, api: ApiUpdate):
    """
    更新API接口

    Args:
        api_id: API接口ID
        api: API接口更新DTO

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_api = ApiService.update_api(api_id, api)
    return ResponseUtil.success(data=db_api.__data__, message="API接口更新成功")


@router.post("/interface/{api_id}/delete", response_model=ApiResponse)
def delete_api_interface(api_id: str):
    """
    删除API接口

    Args:
        api_id: API接口ID

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_api = ApiService.delete_api(api_id)
    return ResponseUtil.success(data=db_api.__data__, message="API接口删除成功")


@router.post("/interfaces/batch_delete", response_model=ApiResponse)
async def batch_delete_api_interfaces(request: Request):
    """
    批量删除API接口

    Args:
        request: 请求对象，包含API接口ID列表

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        api_ids = await request.json()
        if not isinstance(api_ids, list):
            return ResponseUtil.error(message="请求体必须是API接口ID列表")
        deleted_count = ApiService.batch_delete_apis(api_ids)
        return ResponseUtil.success(data={"deleted_count": deleted_count}, message=f"成功删除 {deleted_count} 个接口")
    except Exception as e:
        return ResponseUtil.error(message=f"批量删除失败: {str(e)}")


# Swagger批量导入相关接口
@router.post("/server/{server_id}/parse_swagger", response_model=ApiResponse)
def parse_swagger(server_id: str, request: SwaggerImportRequest):
    """
    解析Swagger/OpenAPI文档并返回API接口列表（不入库）

    Args:
        server_id: API服务ID
        request: Swagger导入请求DTO

    Returns:
        ApiResponse: 统一格式的响应对象，包含接口列表和总数
    """
    try:
        apis = ApiService.parse_swagger(
            server_id=server_id,
            swagger_url=request.swagger_url,
            swagger_json=request.swagger_json,
            include_patterns=request.include_patterns,
            exclude_patterns=request.exclude_patterns,
            headers_str=request.headers
        )
        return ResponseUtil.success(data={"data": apis, "total": len(apis)}, message="Swagger解析成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))
    except Exception as e:
        logger.error(f"Swagger解析失败, 服务ID: {server_id}, 错误: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"Swagger解析失败: {str(e)}")


@router.post("/server/{server_id}/import_apis", response_model=ApiResponse)
def import_apis(server_id: str, apis: list = Body(...)):
    """
    批量导入API接口

    Args:
        server_id: API服务ID
        apis: API接口列表

    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        imported_apis = ApiService.import_apis(server_id, apis)
        apis_data = [api.__data__ for api in imported_apis]
        return ResponseUtil.success(data=apis_data, message=f"成功导入 {len(apis_data)} 个API接口")
    except Exception as e:
        return ResponseUtil.error(message=f"导入接口失败: {str(e)}")


# 测试API接口
class TestInterfaceRequest(BaseModel):
    """测试接口请求体"""
    headers: Optional[Dict[str, Any]] = Field(None, description="请求头")
    parameters: Optional[List[Dict[str, Any]]] = Field(None, description="请求参数")
    body: Optional[Any] = Field(None, description="请求体")


@router.post("/interface/{interface_id}/test", response_model=ApiResponse)
def test_api_interface(interface_id: str, request: TestInterfaceRequest = None):
    """
    测试API接口（发送真实请求并返回结果）

    通过内置的 api_call 工具执行实际的接口调用动作，
    接口配置（方法/路径/请求头/参数）与测试覆盖参数合并后交由工具发起请求。

    Args:
        interface_id: API接口ID
        request: 测试请求体（覆盖参数/请求头/请求体）

    Returns:
        ApiResponse: 统一格式的响应对象，包含测试结果
    """
    try:
        from app.core.tools.builtin_tools.api_call import (
            api_call, normalize_headers, split_params,
        )

        api = ApiService.get_api(interface_id)
        if not api:
            return ResponseUtil.error(message="接口不存在")

        server = ApiServerService.get_server(api.server_id)
        if not server:
            return ResponseUtil.error(message="所属服务不存在")

        # 解析configs
        configs = api.configs
        if isinstance(configs, str):
            configs = json.loads(configs)

        method = configs.get('method', 'GET').upper()
        path = configs.get('path', '/')

        # 合并请求头：服务级 -> 接口级 -> 测试覆盖
        headers: Dict[str, Any] = {}
        headers.update(normalize_headers(server.headers))
        headers.update(normalize_headers(configs.get('headers', [])))
        if request and request.headers:
            headers.update(request.headers)

        # 合并参数：接口配置默认值 -> 测试覆盖
        params, path_params = split_params(configs.get('parameters', []), value_key='default')
        if request and request.parameters:
            override_query, override_path = split_params(request.parameters)
            params.update(override_query)
            path_params.update(override_path)

        # 测试body
        body = request.body if request and request.body is not None else None

        # 通过内置工具执行实际请求
        result = api_call().run(
            server_url=server.url or '',
            path=path,
            method=method,
            headers=headers,
            query_params=params,
            path_params=path_params,
            body=body,
        )

        if isinstance(result, ToolResult):
            if not result.success:
                return ResponseUtil.error(message=result.message)
            return ResponseUtil.success(data=result.result, message="测试完成")
        # 兼容工具返回非ToolResult的情况
        return ResponseUtil.success(data=result, message="测试完成")
    except Exception as e:
        logger.error(f"测试接口失败, 接口ID: {interface_id}, 错误: {str(e)}", exc_info=True)
        return ResponseUtil.error(message=f"测试失败: {str(e)}")
