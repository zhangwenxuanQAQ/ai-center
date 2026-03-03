from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.configs.config import config
from app.database.database import engine, Base
from app.services.api import router
from app.core.exceptions import (
    BaseServiceError,
    ResourceNotFoundError,
    DuplicateResourceError,
    DatabaseOperationError
)

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI()

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
    """处理所有 Service 层异常"""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": exc.message,
            "error_type": exc.__class__.__name__
        }
    )

async def resource_not_found_error_handler(request: Request, exc: ResourceNotFoundError):
    """处理资源未找到异常"""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "detail": exc.message,
            "error_type": exc.__class__.__name__
        }
    )

async def duplicate_resource_error_handler(request: Request, exc: DuplicateResourceError):
    """处理资源重复异常"""
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": exc.message,
            "error_type": exc.__class__.__name__
        }
    )

async def database_operation_error_handler(request: Request, exc: DatabaseOperationError):
    """处理数据库操作异常"""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": exc.message,
            "error_type": exc.__class__.__name__
        }
    )

# 注册异常处理器
app.add_exception_handler(BaseServiceError, base_service_error_handler)
app.add_exception_handler(ResourceNotFoundError, resource_not_found_error_handler)
app.add_exception_handler(DuplicateResourceError, duplicate_resource_error_handler)
app.add_exception_handler(DatabaseOperationError, database_operation_error_handler)

# 包含路由
app.include_router(router)

@app.get("/")
def read_root():
    return {"message": "AI Center Backend API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.server['host'], port=config.server['http_port'])