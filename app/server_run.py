from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.configs.config import config
from app.database.database import engine, Base
from app.services.api import router

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

# 包含路由
app.include_router(router)

@app.get("/")
def read_root():
    return {"message": "AI Center Backend API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.server['host'], port=config.server['http_port'])