"""
FastAPI应用主入口
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

# 运行数据库迁移，添加逻辑删除字段
print("正在运行数据库迁移...")
try:
    from app.database.database import db
    
    # 确保数据库连接
    if db.is_closed():
        db.connect()
    
    # 获取所有表名
    cursor = db.execute_sql("SHOW TABLES;")
    tables = cursor.fetchall()
    table_names = [table[0] for table in tables]
    
    print(f"发现以下表: {table_names}")
    
    for table_name in table_names:
        print(f"\n处理表: {table_name}")
        
        # 检查表是否已存在逻辑删除字段
        cursor = db.execute_sql(f"DESCRIBE {table_name};")
        columns = [column[0] for column in cursor.fetchall()]
        
        # 添加deleted字段
        if 'deleted' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted TINYINT DEFAULT 0")
                print(f"  成功添加deleted字段")
            except Exception as e:
                print(f"  添加deleted字段失败: {e}")
        else:
            print(f"  deleted字段已存在，跳过")
        
        # 添加deleted_at字段
        if 'deleted_at' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted_at DATETIME DEFAULT NULL")
                print(f"  成功添加deleted_at字段")
            except Exception as e:
                print(f"  添加deleted_at字段失败: {e}")
        else:
            print(f"  deleted_at字段已存在，跳过")
        
        # 添加deleted_user_id字段
        if 'deleted_user_id' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted_user_id VARCHAR(36) DEFAULT NULL")
                print(f"  成功添加deleted_user_id字段")
            except Exception as e:
                print(f"  添加deleted_user_id字段失败: {e}")
        else:
            print(f"  deleted_user_id字段已存在，跳过")
    
    print("\n数据库迁移完成")
except Exception as e:
    print(f"数据库迁移失败: {e}")

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
    response = ResponseUtil.error(
        code=ResponseCode.INTERNAL_ERROR,
        message=exc.message,
        data={"error_type": exc.__class__.__name__, "detail": exc.detail}
    )
    return JSONResponse(content=response.model_dump(), status_code=response.code)

async def resource_not_found_error_handler(request: Request, exc: ResourceNotFoundError):
    """
    处理资源未找到异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.not_found(
        message=exc.message
    )
    return JSONResponse(content=response.model_dump(), status_code=response.code)

async def duplicate_resource_error_handler(request: Request, exc: DuplicateResourceError):
    """
    处理资源重复异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.error(
        code=ResponseCode.BAD_REQUEST,
        message=exc.message,
        data={"error_type": exc.__class__.__name__, "detail": exc.detail}
    )
    return JSONResponse(content=response.model_dump(), status_code=response.code)

async def database_operation_error_handler(request: Request, exc: DatabaseOperationError):
    """
    处理数据库操作异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.error(
        code=ResponseCode.INTERNAL_ERROR,
        message=exc.message,
        data={"error_type": exc.__class__.__name__, "detail": exc.detail}
    )
    return JSONResponse(content=response.model_dump(), status_code=response.code)

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
