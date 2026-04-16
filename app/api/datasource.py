"""
数据源控制器，提供数据源相关的API接口
"""

from fastapi import APIRouter
from app.services.datasource.service import DatasourceService
from app.services.datasource.dto import DatasourceCreate, DatasourceUpdate
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()


def format_datasource_data(data: dict) -> dict:
    """格式化数据源数据，移除ID中的横杠"""
    if data.get('id'):
        data['id'] = str(data['id']).replace('-', '')
    if data.get('category_id'):
        data['category_id'] = str(data['category_id']).replace('-', '')
    return data


@router.get("/types", response_model=ApiResponse)
def get_datasource_types():
    """
    获取支持的数据源类型列表
    
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    datasource_types = DatasourceService.get_datasource_types_with_config()
    return ResponseUtil.success(data=datasource_types, message="获取数据源类型列表成功")


@router.post("", response_model=ApiResponse)
def create_datasource(datasource: DatasourceCreate):
    """
    创建数据源
    
    Args:
        datasource: 数据源创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_datasource = DatasourceService.create_datasource(datasource)
    return ResponseUtil.created(data=format_datasource_data(db_datasource.__data__.copy()), message="数据源创建成功")


@router.get("", response_model=ApiResponse)
def get_datasources(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, code: str = None, datasource_type: str = None):
    """
    获取数据源列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        category_id: 分类ID（可选）
        name: 数据源名称（模糊查询）
        code: 数据源编码（模糊查询）
        datasource_type: 数据源类型
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    datasources, total = DatasourceService.get_datasources(skip, limit, category_id, name, code, datasource_type)
    return ResponseUtil.success(data={"data": datasources, "total": total}, message="获取数据源列表成功")


@router.post("/test_connection", response_model=ApiResponse)
def test_datasource_connection(data: dict):
    """
    测试数据源连接（用于新建数据源时）
    
    Args:
        data: 数据源测试数据
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    result = DatasourceService.test_connection_with_data(data)
    if result.get('success'):
        return ResponseUtil.success(data=result, message=result.get('message', '连接测试成功'))
    else:
        return ResponseUtil.error(code=400, message=result.get('message', '连接测试失败'), data=result)


@router.get("/{datasource_id}", response_model=ApiResponse)
def get_datasource(datasource_id: str):
    """
    获取单个数据源
    
    Args:
        datasource_id: 数据源ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    datasource = DatasourceService.get_datasource(datasource_id)
    if datasource is None:
        return ResponseUtil.not_found(message=f"数据源 {datasource_id} 不存在")
    return ResponseUtil.success(data=datasource, message="获取数据源成功")


@router.post("/{datasource_id}", response_model=ApiResponse)
def update_datasource(datasource_id: str, datasource: DatasourceUpdate):
    """
    更新数据源
    
    Args:
        datasource_id: 数据源ID
        datasource: 数据源更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_datasource = DatasourceService.update_datasource(datasource_id, datasource)
    return ResponseUtil.success(data=format_datasource_data(db_datasource.__data__.copy()), message="数据源更新成功")


@router.post("/{datasource_id}/delete", response_model=ApiResponse)
def delete_datasource(datasource_id: str):
    """
    删除数据源
    
    Args:
        datasource_id: 数据源ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_datasource = DatasourceService.delete_datasource(datasource_id)
    return ResponseUtil.success(data=format_datasource_data(db_datasource.__data__.copy()), message="数据源删除成功")


@router.post("/{datasource_id}/test_connection", response_model=ApiResponse)
def test_datasource_connection_by_id(datasource_id: str):
    """
    测试数据源连接
    
    Args:
        datasource_id: 数据源ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    result = DatasourceService.test_connection(datasource_id)
    if result.get('success'):
        return ResponseUtil.success(data=result, message=result.get('message', '连接测试成功'))
    else:
        return ResponseUtil.error(code=400, message=result.get('message', '连接测试失败'), data=result)


@router.post("/{datasource_id}/query", response_model=ApiResponse)
def execute_datasource_query(datasource_id: str, query_data: dict):
    """
    执行数据源查询
    
    Args:
        datasource_id: 数据源ID
        query_data: 包含查询语句和参数的对象
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    query = query_data.get('query', '')
    params = query_data.get('params')
    result = DatasourceService.execute_query(datasource_id, query, params)
    if result.get('success'):
        return ResponseUtil.success(data=result, message=result.get('message', '查询执行成功'))
    else:
        return ResponseUtil.error(code=400, message=result.get('message', '查询执行失败'), data=result)


@router.get("/{datasource_id}/schema", response_model=ApiResponse)
def get_datasource_schema(datasource_id: str):
    """
    获取数据源Schema信息
    
    Args:
        datasource_id: 数据源ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    result = DatasourceService.get_schema_info(datasource_id)
    if result.get('success'):
        return ResponseUtil.success(data=result, message=result.get('message', '获取Schema信息成功'))
    else:
        return ResponseUtil.error(code=400, message=result.get('message', '获取Schema信息失败'), data=result)
