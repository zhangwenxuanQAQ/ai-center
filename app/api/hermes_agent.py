"""
Hermes 智能体控制器，提供基于 hermes CLI 的智能体管理 API 接口
"""

from fastapi import APIRouter, Query, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
from starlette.responses import Response
from pydantic import BaseModel, Field
from typing import Optional

from app.core.agent.hermes_agent import HermesAgentService, HermesAgentError
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()

# 服务实例（无状态，可全局复用）
hermes_service = HermesAgentService()


class HermesAgentCreate(BaseModel):
    """创建 hermes 智能体 DTO"""
    name: str = Field(..., min_length=1, max_length=64, description="智能体名称（小写字母、数字、连字符）")
    description: Optional[str] = Field(None, max_length=500, description="智能体描述")
    clone_from: Optional[str] = Field(None, description="克隆来源智能体名称，默认 default")


class HermesAgentUpdate(BaseModel):
    """更新 hermes 智能体 DTO"""
    new_name: Optional[str] = Field(None, min_length=1, max_length=64, description="新名称")
    description: Optional[str] = Field(None, max_length=500, description="智能体描述")


class HermesFileUpdate(BaseModel):
    """更新 hermes 智能体文件内容 DTO"""
    content: str = Field(default="", description="文件内容")


class HermesModelConfigUpdate(BaseModel):
    """更新 hermes 智能体模型配置 DTO"""
    model: Optional[str] = Field(None, max_length=128, description="模型名称")
    api_key: Optional[str] = Field(None, max_length=512, description="API 密钥（可选）")
    url: Optional[str] = Field(None, max_length=512, description="OpenAI 兼容接口地址（可选）")


class HermesSkillDirCreate(BaseModel):
    """技能目录内新建文件夹 DTO"""
    path: str = Field(..., min_length=1, max_length=512, description="技能内相对路径")


class HermesSkillNodeDelete(BaseModel):
    """删除技能内文件/目录 DTO"""
    path: str = Field(..., min_length=1, max_length=512, description="技能内相对路径")


class HermesSkillNodeRename(BaseModel):
    """重命名技能内文件/目录 DTO"""
    path: str = Field(..., min_length=1, max_length=512, description="技能内相对路径")
    new_name: str = Field(..., min_length=1, max_length=255, description="新名称（仅名称部分）")


def _handle_error(e: Exception) -> ApiResponse:
    """统一异常处理"""
    if isinstance(e, HermesAgentError):
        return ResponseUtil.error(message=str(e))
    return ResponseUtil.error(message=f"智能体操作失败: {str(e)}")


# ==================== 智能体列表接口 ====================

@router.get("/hermes/agents", response_model=ApiResponse)
def list_hermes_agents(
    name: str = Query(None, description="智能体名称（模糊查询）"),
    description: str = Query(None, description="智能体描述（模糊查询）"),
):
    """
    获取 hermes 智能体列表（支持名称与描述过滤）
    """
    try:
        agents = hermes_service.list_agents()
        if name:
            agents = [a for a in agents if name.lower() in a["name"].lower()]
        if description:
            agents = [a for a in agents if description.lower() in (a.get("description") or "").lower()]
        return ResponseUtil.success(data=agents, message="获取智能体列表成功")
    except Exception as e:
        return _handle_error(e)


# ==================== 智能体详情接口 ====================

@router.get("/hermes/agents/{agent_name}", response_model=ApiResponse)
def get_hermes_agent(agent_name: str):
    """
    获取单个 hermes 智能体详情（含 SOUL/MEMORY/USER 内容）
    """
    try:
        return ResponseUtil.success(data=hermes_service.get_agent(agent_name), message="获取智能体详情成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents", response_model=ApiResponse)
def create_hermes_agent(agent: HermesAgentCreate):
    """
    创建 hermes 智能体（默认从 default 克隆）
    """
    try:
        data = hermes_service.create_agent(
            name=agent.name,
            description=agent.description or "",
            clone_from=agent.clone_from,
        )
        return ResponseUtil.success(data=data, message="智能体创建成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}", response_model=ApiResponse)
def update_hermes_agent(agent_name: str, agent: HermesAgentUpdate):
    """
    更新 hermes 智能体（重命名/描述）
    """
    try:
        data = hermes_service.update_agent(
            name=agent_name,
            new_name=agent.new_name,
            description=agent.description,
        )
        return ResponseUtil.success(data=data, message="智能体更新成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/delete", response_model=ApiResponse)
def delete_hermes_agent(agent_name: str):
    """
    删除 hermes 智能体（default 不允许删除）
    """
    try:
        data = hermes_service.delete_agent(agent_name)
        return ResponseUtil.success(data=data, message="智能体删除成功")
    except Exception as e:
        return _handle_error(e)


# ==================== 智能体头像接口 ====================

@router.get("/hermes/agents/{agent_name}/avatar")
def get_hermes_agent_avatar(agent_name: str):
    """
    获取智能体头像文件（不存在返回 404）
    """
    try:
        path, media_type = hermes_service.get_avatar(agent_name)
    except Exception as e:
        return _handle_error(e)
    if not path:
        # 无头像时返回 404，便于前端 img 触发 onError 兜底
        return Response(status_code=404)
    return FileResponse(path, media_type=media_type)


@router.post("/hermes/agents/{agent_name}/avatar", response_model=ApiResponse)
async def upload_hermes_agent_avatar(agent_name: str, file: UploadFile = File(...)):
    """
    上传智能体头像（支持 png/jpg/jpeg/webp/gif，最大 5MB）
    """
    try:
        content = await file.read()
        data = hermes_service.save_avatar(agent_name, file.filename or "", content)
        return ResponseUtil.success(data=data, message="头像上传成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/avatar/delete", response_model=ApiResponse)
def delete_hermes_agent_avatar(agent_name: str):
    """
    删除智能体头像
    """
    try:
        data = hermes_service.delete_avatar(agent_name)
        return ResponseUtil.success(data=data, message="头像删除成功")
    except Exception as e:
        return _handle_error(e)


# ==================== 智能体文件内容接口 ====================

@router.get("/hermes/agents/{agent_name}/files/{file_type}", response_model=ApiResponse)
def read_hermes_file(agent_name: str, file_type: str):
    """
    读取智能体文件内容（soul=SOUL.md, memory=MEMORY.md, user=USER.md）
    """
    try:
        content = hermes_service.read_file(agent_name, file_type)
        return ResponseUtil.success(data={"content": content}, message="读取文件成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/files/{file_type}", response_model=ApiResponse)
def write_hermes_file(agent_name: str, file_type: str, body: HermesFileUpdate):
    """
    写入智能体文件内容（soul=SOUL.md, memory=MEMORY.md, user=USER.md）
    """
    try:
        data = hermes_service.write_file(agent_name, file_type, body.content)
        return ResponseUtil.success(data=data, message="保存文件成功")
    except Exception as e:
        return _handle_error(e)


# ==================== 智能体模型配置接口 ====================

@router.get("/hermes/agents/{agent_name}/model-config", response_model=ApiResponse)
def get_hermes_model_config(agent_name: str):
    """
    获取智能体模型配置（model/api_key/url）
    """
    try:
        return ResponseUtil.success(data=hermes_service.get_model_config(agent_name), message="获取模型配置成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/model-config", response_model=ApiResponse)
def update_hermes_model_config(agent_name: str, body: HermesModelConfigUpdate):
    """
    更新智能体模型配置（手动填写或从模型库引用后调用）
    """
    try:
        data = hermes_service.update_model_config(
            name=agent_name,
            model=body.model,
            api_key=body.api_key,
            url=body.url,
        )
        return ResponseUtil.success(data=data, message="模型配置更新成功")
    except Exception as e:
        return _handle_error(e)


# ==================== 技能与工具接口 ====================

@router.get("/hermes/agents/{agent_name}/skills", response_model=ApiResponse)
def list_hermes_skills(agent_name: str):
    """
    获取智能体技能列表（按分类分组数据源）
    """
    try:
        return ResponseUtil.success(data=hermes_service.list_skills(agent_name), message="获取技能列表成功")
    except Exception as e:
        return _handle_error(e)


# ==================== 技能文件接口 ====================

@router.get("/hermes/agents/{agent_name}/skills/{category}/{skill}/tree", response_model=ApiResponse)
def get_skill_tree(agent_name: str, category: str, skill: str):
    """
    获取技能文件目录树
    """
    try:
        data = hermes_service.get_skill_tree(agent_name, category, skill)
        return ResponseUtil.success(data=data, message="获取技能目录树成功")
    except Exception as e:
        return _handle_error(e)


@router.get("/hermes/agents/{agent_name}/skills/{category}/{skill}/file", response_model=ApiResponse)
def read_skill_file(agent_name: str, category: str, skill: str, path: str = Query(..., description="技能内相对路径")):
    """
    读取技能内文件内容
    """
    try:
        data = hermes_service.read_skill_file(agent_name, category, skill, path)
        return ResponseUtil.success(data=data, message="读取文件成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/skills/{category}/{skill}/file", response_model=ApiResponse)
def write_skill_file(agent_name: str, category: str, skill: str, body: HermesFileUpdate,
                     path: str = Query(..., description="技能内相对路径")):
    """
    保存技能内文件内容
    """
    try:
        data = hermes_service.write_skill_file(agent_name, category, skill, path, body.content)
        return ResponseUtil.success(data=data, message="保存文件成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/skills/{category}/{skill}/mkdir", response_model=ApiResponse)
def create_skill_dir(agent_name: str, category: str, skill: str, body: HermesSkillDirCreate):
    """
    在技能目录内新建文件夹
    """
    try:
        data = hermes_service.create_skill_dir(agent_name, category, skill, body.path)
        return ResponseUtil.success(data=data, message="文件夹创建成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/skills/{category}/{skill}/upload", response_model=ApiResponse)
async def upload_skill_files(agent_name: str, category: str, skill: str,
                             path: str = Query("", description="目标目录（技能内相对路径，根目录传空）"),
                             files: list[UploadFile] = File(...)):
    """
    上传文件到技能目录（支持多文件，按相对路径保留文件夹结构）
    """
    try:
        payload = []
        for f in files:
            rel = getattr(f, "filename", "") or ""
            # antd Upload 使用「相对目录/文件名」作为 filename 携带目录结构
            payload.append((Path(rel).name, rel, await f.read()))
        data = hermes_service.upload_skill_files(agent_name, category, skill, path, payload)
        return ResponseUtil.success(data=data, message="上传成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/skills/{category}/{skill}/delete", response_model=ApiResponse)
def delete_skill_node(agent_name: str, category: str, skill: str,
                      body: HermesSkillNodeDelete):
    """
    删除技能内文件或目录（根目录与 SKILL.md 除外）
    """
    try:
        data = hermes_service.delete_skill_node(agent_name, category, skill, body.path)
        return ResponseUtil.success(data=data, message="删除成功")
    except Exception as e:
        return _handle_error(e)


@router.post("/hermes/agents/{agent_name}/skills/{category}/{skill}/rename", response_model=ApiResponse)
def rename_skill_node(agent_name: str, category: str, skill: str,
                      body: HermesSkillNodeRename):
    """
    重命名技能内文件或目录（根目录与 SKILL.md 除外）
    """
    try:
        data = hermes_service.rename_skill_node(agent_name, category, skill, body.path, body.new_name)
        return ResponseUtil.success(data=data, message="重命名成功")
    except Exception as e:
        return _handle_error(e)


@router.get("/hermes/agents/{agent_name}/tools", response_model=ApiResponse)
def list_hermes_tools(agent_name: str):
    """
    获取智能体工具集列表
    """
    try:
        return ResponseUtil.success(data=hermes_service.list_tools(agent_name), message="获取工具集列表成功")
    except Exception as e:
        return _handle_error(e)
