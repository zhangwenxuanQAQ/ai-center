"""
知识库数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional
from app.services.base_dto import BaseDTO


class KnowledgebaseCategoryBase(BaseModel):
    """
    知识库分类基础DTO

    Attributes:
        name: 分类名称
        description: 分类描述
        parent_id: 父分类ID
        sort_order: 排序顺序
        is_default: 是否默认分类
    """
    name: str = Field(..., min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    parent_id: Optional[str] = Field(None, description="父分类ID，UUID格式")
    sort_order: int = Field(default=0, description="排序顺序")
    is_default: Optional[bool] = Field(default=False, description="是否默认分类")


class KnowledgebaseCategoryCreate(KnowledgebaseCategoryBase):
    """
    知识库分类创建DTO
    """


class KnowledgebaseCategoryUpdate(BaseModel):
    """
    知识库分类更新DTO

    Attributes:
        name: 分类名称
        description: 分类描述
        parent_id: 父分类ID
        sort_order: 排序顺序
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="分类名称，长度1-100个字符")
    description: Optional[str] = Field(None, max_length=500, description="分类描述，最大长度500个字符")
    parent_id: Optional[str] = Field(None, description="父分类ID，UUID格式")
    sort_order: Optional[int] = Field(None, description="排序顺序")


class KnowledgebaseCategory(KnowledgebaseCategoryBase, BaseDTO):
    """
    知识库分类响应DTO

    继承自KnowledgebaseCategoryBase和BaseDTO，包含知识库分类基本信息和公共字段
    """

    class Config:
        from_attributes = True


class KnowledgebaseBase(BaseModel):
    """
    知识库基础DTO

    Attributes:
        name: 知识库名称
        code: 知识库编码
        description: 知识库描述
        avatar: 知识库头像
        category_id: 分类ID
        embedding_model_id: Embedding模型ID
        doc_num: 文档数量
        token_num: 文档总Token数
        chunk_num: 文档总Chunk数
        retrieval_config: 检索配置JSON
    """
    name: str = Field(..., min_length=1, max_length=100, description="知识库名称，长度1-100个字符")
    code: str = Field(..., min_length=1, max_length=100, description="知识库编码，全局唯一")
    description: str = Field(..., min_length=1, max_length=500, description="知识库描述，长度1-500个字符")
    avatar: Optional[str] = Field(None, description="知识库头像，base64格式字符串或URL")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    embedding_model_id: Optional[str] = Field(None, description="Embedding模型ID，UUID格式")
    doc_num: int = Field(default=0, description="文档数量")
    token_num: int = Field(default=0, description="文档总Token数")
    chunk_num: int = Field(default=0, description="文档总Chunk数")
    retrieval_config: Optional[dict] = Field(None, description="检索配置JSON对象")


class KnowledgebaseCreate(KnowledgebaseBase):
    """
    知识库创建DTO
    """


class KnowledgebaseUpdate(BaseModel):
    """
    知识库更新DTO

    Attributes:
        name: 知识库名称
        code: 知识库编码
        description: 知识库描述
        avatar: 知识库头像
        category_id: 分类ID
        embedding_model_id: Embedding模型ID
        doc_num: 文档数量
        token_num: 文档总Token数
        chunk_num: 文档总Chunk数
        retrieval_config: 检索配置JSON
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="知识库名称，长度1-100个字符")
    code: Optional[str] = Field(None, min_length=1, max_length=100, description="知识库编码，全局唯一")
    description: Optional[str] = Field(None, max_length=500, description="知识库描述，最大长度500个字符")
    avatar: Optional[str] = Field(None, description="知识库头像，base64格式字符串或URL")
    category_id: Optional[str] = Field(None, description="分类ID，UUID格式")
    embedding_model_id: Optional[str] = Field(None, description="Embedding模型ID，UUID格式")
    doc_num: Optional[int] = Field(None, description="文档数量")
    token_num: Optional[int] = Field(None, description="文档总Token数")
    chunk_num: Optional[int] = Field(None, description="文档总Chunk数")
    retrieval_config: Optional[dict] = Field(None, description="检索配置JSON对象")


class Knowledgebase(KnowledgebaseBase, BaseDTO):
    """
    知识库响应DTO

    继承自KnowledgebaseBase和BaseDTO，包含知识库基本信息和公共字段
    """

    class Config:
        from_attributes = True


class KnowledgebaseDocumentBase(BaseModel):
    """
    知识库文档基础DTO

    Attributes:
        kb_id: 知识库ID
        chunk_method: 文档Chunk方法
        chunk_config: 文档Chunk配置JSON
        token_num: 文档Token数
        chunk_num: 文档Chunk数
        file_type: 文档文件类型
        file_name: 文档文件名
        location: 文档存储路径
        file_size: 文档文件大小
        running_status: 文档解析状态
        task_progress: 文档解析进度
        task_begin_at: 文档解析开始时间
        task_end_at: 文档解析结束时间
        task_duration: 文档解析耗时
    """
    kb_id: str = Field(..., description="知识库ID，UUID格式")
    chunk_method: str = Field(..., min_length=1, max_length=50, description="文档Chunk方法")
    chunk_config: Optional[dict] = Field(None, description="文档Chunk配置JSON对象")
    token_num: int = Field(default=0, description="文档Token数")
    chunk_num: int = Field(default=0, description="文档Chunk数")
    file_type: Optional[str] = Field(None, max_length=50, description="文档文件类型")
    file_name: Optional[str] = Field(None, max_length=255, description="文档文件名")
    location: Optional[str] = Field(None, max_length=512, description="文档存储路径")
    file_size: int = Field(default=0, description="文档文件大小(字节)")
    running_status: str = Field(default="pending", max_length=50, description="文档解析状态")
    task_progress: float = Field(default=0, ge=0, le=1, description="文档解析进度(0-1)")
    task_begin_at: Optional[str] = Field(None, description="文档解析开始时间")
    task_end_at: Optional[str] = Field(None, description="文档解析结束时间")
    task_duration: int = Field(default=0, description="文档解析耗时(毫秒)")


class KnowledgebaseDocumentCreate(KnowledgebaseDocumentBase):
    """
    知识库文档创建DTO
    """


class KnowledgebaseDocumentUpdate(BaseModel):
    """
    知识库文档更新DTO

    Attributes:
        kb_id: 知识库ID
        chunk_method: 文档Chunk方法
        chunk_config: 文档Chunk配置JSON
        token_num: 文档Token数
        chunk_num: 文档Chunk数
        file_type: 文档文件类型
        file_name: 文档文件名
        location: 文档存储路径
        file_size: 文档文件大小
        running_status: 文档解析状态
        task_progress: 文档解析进度
        task_begin_at: 文档解析开始时间
        task_end_at: 文档解析结束时间
        task_duration: 文档解析耗时
    """
    kb_id: Optional[str] = Field(None, description="知识库ID，UUID格式")
    chunk_method: Optional[str] = Field(None, min_length=1, max_length=50, description="文档Chunk方法")
    chunk_config: Optional[dict] = Field(None, description="文档Chunk配置JSON对象")
    token_num: Optional[int] = Field(None, description="文档Token数")
    chunk_num: Optional[int] = Field(None, description="文档Chunk数")
    file_type: Optional[str] = Field(None, max_length=50, description="文档文件类型")
    file_name: Optional[str] = Field(None, max_length=255, description="文档文件名")
    location: Optional[str] = Field(None, max_length=512, description="文档存储路径")
    file_size: Optional[int] = Field(None, description="文档文件大小(字节)")
    running_status: Optional[str] = Field(None, max_length=50, description="文档解析状态")
    task_progress: Optional[float] = Field(None, ge=0, le=1, description="文档解析进度(0-1)")
    task_begin_at: Optional[str] = Field(None, description="文档解析开始时间")
    task_end_at: Optional[str] = Field(None, description="文档解析结束时间")
    task_duration: Optional[int] = Field(None, description="文档解析耗时(毫秒)")


class KnowledgebaseDocument(KnowledgebaseDocumentBase, BaseDTO):
    """
    知识库文档响应DTO

    继承自KnowledgebaseDocumentBase和BaseDTO，包含知识库文档基本信息和公共字段
    """

    class Config:
        from_attributes = True
