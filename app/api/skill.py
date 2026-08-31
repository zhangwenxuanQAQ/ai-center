"""
SKILL API控制器，包含SKILL管理和文件操作
"""

import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional, List
from app.services.skill.service import SkillService, get_skill_abs_dir, ensure_skill_root
from app.services.skill.dto import SkillCreate, SkillCreateWithUpload, SkillUpdate, FileContentUpdate
from app.utils.response import ResponseUtil, ApiResponse
import zipfile
import tarfile
import shutil
import uuid

router = APIRouter()


# ==================== SKILL基本信息管理 ====================

@router.post("", response_model=ApiResponse)
def create_skill(skill: SkillCreate):
    """手动创建SKILL（自动创建目录和SKILL.md）"""
    try:
        result = SkillService.create_skill(skill)
        return ResponseUtil.created(data=result, message="SKILL创建成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.get("", response_model=ApiResponse)
def get_skills(page: int = 1, page_size: int = 20, category_id: Optional[str] = None,
               keyword: Optional[str] = None, status: Optional[bool] = None):
    """获取SKILL列表（分页）"""
    result = SkillService.get_skills(page, page_size, category_id, keyword, status)
    return ResponseUtil.success(data=result, message="获取SKILL列表成功")


@router.get("/{skill_id}", response_model=ApiResponse)
def get_skill(skill_id: str, with_md: bool = True):
    """获取单个SKILL详情"""
    result = SkillService.get_skill(skill_id, with_md=with_md)
    if result is None:
        return ResponseUtil.not_found(message=f"SKILL {skill_id} 不存在")
    return ResponseUtil.success(data=result, message="获取SKILL成功")


@router.post("/{skill_id}", response_model=ApiResponse)
def update_skill(skill_id: str, skill: SkillUpdate):
    """更新SKILL基本信息"""
    try:
        result = SkillService.update_skill(skill_id, skill)
        return ResponseUtil.success(data=result, message="SKILL更新成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("/{skill_id}/delete", response_model=ApiResponse)
def delete_skill(skill_id: str):
    """删除SKILL（同时删除物理目录）"""
    try:
        SkillService.delete_skill(skill_id)
        return ResponseUtil.success(message="SKILL删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


# ==================== 文件上传 ====================

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
        SkillService.save_uploaded_file(directory, filename, content, sub_path)
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
    ensure_skill_root()
    success_count = 0
    failed_files = []
    for file in files:
        try:
            content = await file.read()
            filename = file.filename or "uploaded_file"
            SkillService.save_uploaded_file(directory, filename, content, sub_path)
            success_count += 1
        except Exception as e:
            failed_files.append(f"{file.filename}: {str(e)}")
    return ResponseUtil.success(
        data={"success_count": success_count, "failed_files": failed_files},
        message=f"批量上传完成：成功 {success_count} 个，失败 {len(failed_files)} 个"
    )


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
        ensure_skill_root()
        abs_dir = get_skill_abs_dir(directory)
        if sub_path:
            abs_dir = os.path.join(abs_dir, sub_path)
        os.makedirs(abs_dir, exist_ok=True)
        
        # 临时保存压缩文件
        temp_id = uuid.uuid4().hex
        temp_file_path = os.path.join(abs_dir, f"_temp_{temp_id}_{filename}")
        with open(temp_file_path, 'wb') as f:
            f.write(content)
        
        extracted_count = 0
        try:
            if filename.lower().endswith('.zip'):
                with zipfile.ZipFile(temp_file_path, 'r') as zf:
                    # 检测是否包含顶层单个文件夹
                    names = zf.namelist()
                    common_prefix = None
                    if names:
                        first = names[0].split('/')[0]
                        if all(n.startswith(first + '/') for n in names if n):
                            common_prefix = first + '/'
                    for member in zf.namelist():
                        # 跳过 __MACOSX 等隐藏目录
                        if any(p.startswith('__') or p.startswith('.') for p in member.split('/')):
                            continue
                        target_name = member[len(common_prefix):] if common_prefix else member
                        if not target_name:
                            continue
                        target_path = os.path.join(abs_dir, target_name)
                        if member.endswith('/'):
                            os.makedirs(target_path, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            with zf.open(member) as src, open(target_path, 'wb') as dst:
                                shutil.copyfileobj(src, dst)
                            extracted_count += 1
            elif filename.lower().endswith(('.tar', '.tar.gz', '.tgz', '.tar.bz2')):
                mode = 'r:gz' if filename.lower().endswith(('.tar.gz', '.tgz')) else 'r:bz2' if filename.lower().endswith('.tar.bz2') else 'r:'
                with tarfile.open(temp_file_path, mode) as tf:
                    members = tf.getmembers()
                    common_prefix = None
                    if members:
                        first = members[0].name.split('/')[0]
                        if all(m.name.startswith(first + '/') for m in members if m.name):
                            common_prefix = first + '/'
                    for member in members:
                        if any(p.startswith('__') or p.startswith('.') for p in member.name.split('/')):
                            continue
                        target_name = member.name[len(common_prefix):] if common_prefix else member.name
                        if not target_name:
                            continue
                        target_path = os.path.join(abs_dir, target_name)
                        if member.isdir():
                            os.makedirs(target_path, exist_ok=True)
                        else:
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            tf.extract(member, abs_dir)
                            # 重定向到去除前缀后的位置
                            if common_prefix:
                                src = os.path.join(abs_dir, member.name)
                                if os.path.exists(src):
                                    shutil.move(src, target_path)
                            extracted_count += 1
            else:
                return ResponseUtil.error(message="不支持的压缩格式，请上传zip/tar/tar.gz/tar.bz2文件")
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            # 清理可能残留的顶层空文件夹
            if filename.lower().endswith(('.tar', '.tar.gz', '.tgz', '.tar.bz2')):
                try:
                    for item in os.listdir(abs_dir):
                        item_path = os.path.join(abs_dir, item)
                        if os.path.isdir(item_path) and not os.listdir(item_path):
                            os.rmdir(item_path)
                except Exception:
                    pass
        
        return ResponseUtil.success(data={"extracted_count": extracted_count}, message=f"解压成功，共提取 {extracted_count} 个文件")
    except Exception as e:
        return ResponseUtil.error(message=f"解压上传失败: {str(e)}")


@router.post("/create_and_register", response_model=ApiResponse)
def create_skill_with_directory(
    name: str = Form(...),
    code: str = Form(...),
    directory: str = Form(...),
    description: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),
    status: bool = Form(True)
):
    """上传完成后，将准备好的目录注册为正式SKILL"""
    try:
        dto = SkillCreateWithUpload(
            name=name,
            code=code,
            description=description,
            category_id=category_id,
            status=status
        )
        result = SkillService.create_skill_from_upload(dto, directory)
        return ResponseUtil.created(data=result, message="SKILL创建成功")
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
    path = body.get('path')
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
    parent_path = body.get('parent_path') or ''
    dir_name = body.get('dir_name')
    if not dir_name:
        return ResponseUtil.error(message="缺少dir_name参数")
    try:
        SkillService.create_directory(skill_id, parent_path, dir_name)
        return ResponseUtil.success(message="文件夹创建成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))
