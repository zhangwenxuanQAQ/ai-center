"""
SKILL API控制器，包含SKILL管理和文件操作

controller 仅做参数解析 + 路由分发
业务逻辑全部委托给 app.services.skill.service 与 app.core.skill.file_manager
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
from app.services.skill.service import SkillService
from app.services.skill.dto import SkillCreate, SkillCreateWithUpload, SkillUpdate, FileContentUpdate
from app.utils.response import ResponseUtil, ApiResponse
from app.core.skill.file_manager import FileUploadManager

router = APIRouter()


# ==================== SKILL基本信息管理 ====================

@router.post("", response_model=ApiResponse)
def create_skill(skill: SkillCreate):
    """手动创建技能（自动创建目录和SKILL.md）"""
    try:
        result = SkillService.create_skill(skill)
        return ResponseUtil.created(data=result, message="技能创建成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.get("", response_model=ApiResponse)
def get_skills(
    page: int = 1,
    page_size: int = 20,
    category_id: Optional[str] = None,
    keyword: Optional[str] = None,
    status: Optional[bool] = None
):
    """获取技能列表（分页）"""
    result = SkillService.get_skills(page, page_size, category_id, keyword, status)
    return ResponseUtil.success(data=result, message="获取技能列表成功")


@router.get("/{skill_id}", response_model=ApiResponse)
def get_skill(skill_id: str, with_md: bool = True):
    """获取技能详情"""
    result = SkillService.get_skill(skill_id, with_md=with_md)
    if not result:
        return ResponseUtil.error(message="技能不存在")
    return ResponseUtil.success(data=result, message="获取技能成功")


@router.post("/{skill_id}", response_model=ApiResponse)
def update_skill(skill_id: str, skill: SkillUpdate):
    """更新技能"""
    try:
        result = SkillService.update_skill(skill_id, skill)
        return ResponseUtil.success(data=result, message="技能更新成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/{skill_id}/delete", response_model=ApiResponse)
def delete_skill(skill_id: str):
    """删除技能（软删除 + 物理删除目录）"""
    try:
        SkillService.delete_skill(skill_id)
        return ResponseUtil.success(message="技能删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# ==================== 上传（委托给 FileUploadManager） ====================

@router.post("/upload/prepare", response_model=ApiResponse)
def prepare_upload(skill_id: Optional[str] = Form(None)):
    """准备上传：获取/创建目标目录"""
    directory = SkillService.prepare_upload_directory(skill_id)
    return ResponseUtil.success(data={"directory": directory}, message="准备上传目录成功")


@router.post("/upload/file", response_model=ApiResponse)
async def upload_file(
    directory: str = Form(...),
    sub_path: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    """上传单个文件到指定skill目录"""
    try:
        content = await file.read()
        filename = file.filename or "uploaded_file"
        FileUploadManager.save_file(directory, filename, content, sub_path)
        return ResponseUtil.success(message=f"文件 {filename} 上传成功")
    except Exception as e:
        return ResponseUtil.error(message=f"文件上传失败: {str(e)}")


@router.post("/upload/files", response_model=ApiResponse)
async def upload_multiple_files(
    directory: str = Form(...),
    sub_path: Optional[str] = Form(None),
    files: List[UploadFile] = File(...)
):
    """批量上传文件"""
    try:
        result = await FileUploadManager.save_files(directory, files, sub_path)
        total = len(files)
        failed = len(result['failed_files'])
        return ResponseUtil.success(
            data=result,
            message=f"批量上传完成：成功 {total - failed} 个，失败 {failed} 个"
        )
    except Exception as e:
        return ResponseUtil.error(message=f"批量上传失败: {str(e)}")


@router.post("/upload/zip", response_model=ApiResponse)
async def upload_zip(
    directory: str = Form(...),
    sub_path: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    """上传并解压zip/tar包到skill目录（用于上传整个文件夹）"""
    try:
        content = await file.read()
        filename = file.filename or ""
        extracted_count = await FileUploadManager.save_archive(directory, content, filename, sub_path)
        return ResponseUtil.success(
            data={"extracted_count": extracted_count},
            message=f"解压成功，共提取 {extracted_count} 个文件"
        )
    except Exception as e:
        return ResponseUtil.error(message=f"解压上传失败: {str(e)}")


@router.post("/create_and_register", response_model=ApiResponse)
def create_skill_with_directory(
    name: str = Form(...),
    directory: str = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON array
    avatar: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None),  # JSON object
    category_id: Optional[str] = Form(None),
    status: bool = Form(True)
):
    """
    上传完成后，将准备好的目录注册为正式技能

    支持 Form 中传入 JSON 字符串形式的 tags / metadata，自动反序列化
    """
    try:
        import json
        parsed_tags = None
        if tags:
            try:
                parsed_tags = json.loads(tags)
            except ValueError:
                parsed_tags = [tags] if tags else None

        parsed_meta = None
        if metadata:
            try:
                parsed_meta = json.loads(metadata)
            except ValueError:
                parsed_meta = None

        dto = SkillCreateWithUpload(
            name=name,
            title=title,
            description=description,
            tags=parsed_tags,
            avatar=avatar,
            content=content,
            metadata=parsed_meta,
            category_id=category_id,
            status=status,
        )
        result = SkillService.create_skill_from_upload(dto, directory)
        return ResponseUtil.created(data=result, message="技能创建成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# ==================== 文件目录浏览与操作 ====================

@router.get("/{skill_id}/files", response_model=ApiResponse)
def list_files(skill_id: str, sub_path: Optional[str] = None):
    """列出skill目录下的文件和文件夹"""
    try:
        result = SkillService.list_directory(skill_id, sub_path)
        return ResponseUtil.success(data=result, message="获取文件目录成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.get("/{skill_id}/files/tree", response_model=ApiResponse)
def list_files_tree(skill_id: str, sub_path: Optional[str] = None):
    """递归列出skill目录下的完整目录树"""
    try:
        result = SkillService.list_directory_tree(skill_id, sub_path)
        return ResponseUtil.success(data=result, message="获取文件目录树成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.get("/{skill_id}/file/content", response_model=ApiResponse)
def get_file_content(skill_id: str, path: str):
    """读取文件内容"""
    try:
        result = SkillService.read_file_content(skill_id, path)
        return ResponseUtil.success(data=result, message="获取文件内容成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/{skill_id}/file/content", response_model=ApiResponse)
def update_file_content(skill_id: str, path: str, body: FileContentUpdate):
    """写入文件内容"""
    try:
        SkillService.write_file_content(skill_id, path, body.content)
        return ResponseUtil.success(message="文件保存成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/{skill_id}/file/delete", response_model=ApiResponse)
def delete_file_or_dir(skill_id: str, body: dict):
    """删除文件或文件夹"""
    path = body.get('path') if isinstance(body, dict) else None
    if not path:
        return ResponseUtil.error(message="缺少path参数")
    try:
        SkillService.delete_file_or_dir(skill_id, path)
        return ResponseUtil.success(message="删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/{skill_id}/directory/create", response_model=ApiResponse)
def create_sub_directory(skill_id: str, body: dict):
    """创建子文件夹"""
    parent_path = body.get('parent_path') if isinstance(body, dict) else None
    dir_name = body.get('dir_name') if isinstance(body, dict) else None
    if not dir_name:
        return ResponseUtil.error(message="缺少dir_name参数")
    try:
        SkillService.create_directory(skill_id, parent_path or '', dir_name)
        return ResponseUtil.success(message="文件夹创建成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/{skill_id}/file/rename", response_model=ApiResponse)
def rename_file_or_dir(skill_id: str, body: dict):
    """重命名文件或文件夹（根目录 SKILL.md 禁止重命名）"""
    path = body.get('path') if isinstance(body, dict) else None
    new_name = body.get('new_name') if isinstance(body, dict) else None
    if not path or not new_name:
        return ResponseUtil.error(message="缺少path或new_name参数")
    try:
        SkillService.rename_file_or_dir(skill_id, path, new_name)
        return ResponseUtil.success(message="重命名成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/{skill_id}/files/check-conflicts", response_model=ApiResponse)
def check_upload_conflicts(skill_id: str, body: dict):
    """检查上传条目是否与目标目录同名冲突，返回冲突名称列表"""
    sub_path = (body.get('sub_path') or '') if isinstance(body, dict) else ''
    names = body.get('names') if isinstance(body, dict) else None
    if not names or not isinstance(names, list):
        return ResponseUtil.error(message="缺少names参数")
    try:
        conflicts = SkillService.check_upload_conflicts(skill_id, sub_path, names)
        return ResponseUtil.success(data={"conflicts": conflicts}, message="校验完成")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))
