"""
代码脚本数据传输对象（DTO）
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from app.services.base_dto import BaseDTO


class CodeScriptBase(BaseModel):
    """
    代码脚本基础DTO

    Attributes:
        name: 脚本名称
        description: 脚本描述
        content: Python代码内容，必须包含main方法作为执行入口
        params: 入参定义列表（与main函数形参对应）
        category_id: 分类ID
        status: 状态
    """
    name: str = Field(..., min_length=1, max_length=100, description="脚本名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="脚本描述，最大长度500个字符")
    content: Optional[str] = Field(None, description="Python代码内容，必须包含main方法作为执行入口")
    params: Optional[List[Dict[str, Any]]] = Field(None, description="入参定义列表，[{name, type, description, required, default}]，与main函数形参对应")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    status: bool = Field(default=True, description="状态，True表示启用，False表示禁用")

    @field_validator('params')
    @classmethod
    def validate_params(cls, v):
        """入参定义列表校验：每个参数必须包含合法name"""
        if v is None:
            return v
        if not isinstance(v, list):
            raise ValueError('params必须是JSON数组')
        for index, param in enumerate(v, start=1):
            if not isinstance(param, dict) or not param.get('name'):
                raise ValueError(f'第{index}个入参定义必须是包含name字段的对象')
        return v


class CodeScriptCreate(CodeScriptBase):
    """
    代码脚本创建DTO
    """
    pass


class CodeScriptUpdate(BaseModel):
    """
    代码脚本更新DTO

    Attributes:
        name: 脚本名称
        description: 脚本描述
        content: Python代码内容
        params: 入参定义列表
        category_id: 分类ID
        status: 状态
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="脚本名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="脚本描述，最大长度500个字符")
    content: Optional[str] = Field(None, description="Python代码内容")
    params: Optional[List[Dict[str, Any]]] = Field(None, description="入参定义列表，[{name, type, description, required, default}]")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    status: Optional[bool] = Field(None, description="状态，True表示启用，False表示禁用")


class CodeScript(CodeScriptBase, BaseDTO):
    """
    代码脚本响应DTO

    继承自CodeScriptBase和BaseDTO，包含代码脚本基本信息和公共字段
    """

    class Config:
        from_attributes = True


class CodeScriptCategoryBase(BaseModel):
    """
    代码脚本分类基础DTO

    Attributes:
        name: 分类名称
        description: 分类描述
        parent_id: 父分类ID，为None时表示顶级分类
        sort_order: 排序顺序
    """
    name: str = Field(..., min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    parent_id: Optional[str] = Field(None, description="父分类ID，为None时表示顶级分类")
    sort_order: Optional[int] = Field(default=0, description="排序顺序，默认值为0")


class CodeScriptCategoryCreate(CodeScriptCategoryBase):
    """
    代码脚本分类创建DTO
    """
    pass


class CodeScriptCategoryUpdate(BaseModel):
    """
    代码脚本分类更新DTO

    Attributes:
        name: 分类名称
        description: 分类描述
        parent_id: 父分类ID
        sort_order: 排序顺序
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述")
    parent_id: Optional[str] = Field(None, description="父分类ID")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class CodeScriptCategory(CodeScriptCategoryBase, BaseDTO):
    """
    代码脚本分类响应DTO

    继承自CodeScriptCategoryBase和BaseDTO，包含分类基本信息和公共字段
    """

    class Config:
        from_attributes = True
