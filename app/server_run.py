"""
FastAPI应用主入口
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from app.configs.config import config
from app.database.models import create_tables
from app.api import router
from app.core.exceptions import (
    BaseServiceError,
    ResourceNotFoundError,
    DuplicateResourceError,
    DatabaseOperationError
)
from app.utils.response import ResponseUtil, ResponseCode

# 创建数据库表
create_tables()

app = FastAPI(
    title="AI Center API",
    description="AI服务中心后端API",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常处理器
async def base_service_error_handler(request: Request, exc: BaseServiceError):
    """
    处理所有Service层异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    return ResponseUtil.error(
        code=ResponseCode.INTERNAL_ERROR,
        message=exc.message,
        data={"error_type": exc.__class__.__name__, "detail": exc.detail}
    ).model_dump()

async def resource_not_found_error_handler(request: Request, exc: ResourceNotFoundError):
    """
    处理资源未找到异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    return ResponseUtil.not_found(
        message=exc.message
    ).model_dump()

async def duplicate_resource_error_handler(request: Request, exc: DuplicateResourceError):
    """
    处理资源重复异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    return ResponseUtil.error(
        code=ResponseCode.BAD_REQUEST,
        message=exc.message,
        data={"error_type": exc.__class__.__name__, "detail": exc.detail}
    ).model_dump()

async def database_operation_error_handler(request: Request, exc: DatabaseOperationError):
    """
    处理数据库操作异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    return ResponseUtil.error(
        code=ResponseCode.INTERNAL_ERROR,
        message=exc.message,
        data={"error_type": exc.__class__.__name__, "detail": exc.detail}
    ).model_dump()

# 注册异常处理器
app.add_exception_handler(BaseServiceError, base_service_error_handler)
app.add_exception_handler(ResourceNotFoundError, resource_not_found_error_handler)
app.add_exception_handler(DuplicateResourceError, duplicate_resource_error_handler)
app.add_exception_handler(DatabaseOperationError, database_operation_error_handler)

# 包含路由
app.include_router(router, prefix="/aicenter/v1")


@app.get("/")
def read_root():
    """
    根路径，返回API信息
    
    Returns:
        dict: API信息
    """
    return ResponseUtil.success(
        data={"message": "AI Center Backend API", "version": "1.0.0"},
        message="欢迎访问AI Center API"
    ).model_dump()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.server['host'], port=config.server['http_port'])
