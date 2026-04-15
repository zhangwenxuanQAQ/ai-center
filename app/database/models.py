"""
数据库模型定义
基于数据库实际表结构生成
"""

from peewee import Model, CharField, TextField, DateTimeField, BooleanField, IntegerField, ForeignKeyField, FloatField, BigIntegerField
from app.database.database import db
import uuid
from datetime import datetime


class BaseModel(Model):
    """
    基础模型类
    所有模型都继承此类，包含公共字段
    """
    id = CharField(max_length=40, primary_key=True, default=lambda: uuid.uuid4().hex)
    created_at = DateTimeField(default=datetime.now, verbose_name="创建时间")
    updated_at = DateTimeField(null=True, verbose_name="更新时间")
    create_user_id = CharField(max_length=40, null=True, verbose_name="创建用户ID")
    update_user_id = CharField(max_length=40, null=True, verbose_name="更新用户ID")
    
    class Meta:
        database = db
    
    def save(self, *args, **kwargs):
        """
        保存时自动更新updated_at字段
        """
        if self.id is None:
            self.created_at = datetime.now()
        self.updated_at = datetime.now()
        return super(BaseModel, self).save(*args, **kwargs)


class SoftDeleteModel(BaseModel):
    """
    软删除模型类
    包含软删除相关字段
    """
    deleted = BooleanField(default=False, verbose_name="是否删除")
    deleted_at = DateTimeField(null=True, verbose_name="删除时间")
    deleted_user_id = CharField(max_length=40, null=True, verbose_name="删除用户ID")
    
    class Meta:
        database = db
    
    def delete_instance(self, permanently=False, *args, **kwargs):
        """
        删除实例
        Args:
            permanently: 是否永久删除，默认为False（软删除）
        """
        if permanently:
            return super(SoftDeleteModel, self).delete_instance(*args, **kwargs)
        else:
            self.deleted = True
            self.deleted_at = datetime.now()
            return self.save()


class User(SoftDeleteModel):
    """
    用户模型
    
    存储用户基本信息
    """
    username = CharField(max_length=255, unique=True, index=True, verbose_name="用户名")
    password = CharField(max_length=255, verbose_name="密码")
    email = CharField(max_length=255, unique=True, verbose_name="邮箱")
    is_admin = BooleanField(default=False, verbose_name="是否管理员")
    
    class Meta:
        table_name = 'user'


class ChatbotCategory(SoftDeleteModel):
    """
    机器人分类模型
    
    存储机器人分类信息，支持树形结构
    """
    name = CharField(max_length=255, index=True, verbose_name="分类名称")
    description = TextField(null=True, verbose_name="分类描述")
    is_default = BooleanField(default=False, verbose_name="是否默认分类")
    parent_id = CharField(max_length=40, null=True, index=True, verbose_name="父分类ID")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    
    class Meta:
        table_name = 'chatbot_category'
        indexes = (
            (('parent_id', 'sort_order'), False),
        )


class KnowledgebaseCategory(SoftDeleteModel):
    """
    知识库分类模型

    存储知识库分类信息，支持树形结构
    """
    name = CharField(max_length=255, index=True, verbose_name="分类名称")
    description = TextField(null=True, verbose_name="分类描述")
    parent_id = CharField(max_length=40, null=True, index=True, verbose_name="父分类ID")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    is_default = BooleanField(default=False, verbose_name="是否默认分类")

    class Meta:
        table_name = 'knowledgebase_category'
        indexes = (
            (('parent_id', 'sort_order'), False),
        )


class Knowledgebase(SoftDeleteModel):
    """
    知识库模型

    存储知识库信息
    """
    name = CharField(max_length=255, index=True, verbose_name="知识库名称")
    code = CharField(max_length=100, index=True, verbose_name="知识库编码")
    description = TextField(null=False, verbose_name="知识库描述")
    avatar = TextField(null=True, verbose_name="知识库头像")
    category_id = CharField(max_length=40, null=True, index=True, verbose_name="分类ID")
    embedding_model_id = CharField(max_length=40, null=True, index=True, verbose_name="Embedding模型ID")
    rerank_model_id = CharField(max_length=40, null=True, index=True, verbose_name="Rerank模型ID")
    text_model_id = CharField(max_length=40, null=True, index=True, verbose_name="Text模型ID")
    doc_num = IntegerField(default=0, verbose_name="文档数量")
    token_num = IntegerField(default=0, verbose_name="文档总Token数")
    chunk_num = IntegerField(default=0, verbose_name="文档总Chunk数")
    retrieval_config = TextField(null=True, verbose_name="检索配置JSON")
    status = BooleanField(default=True, verbose_name="状态")

    class Meta:
        table_name = 'knowledgebase'


class KnowledgebaseDocumentCategory(SoftDeleteModel):
    """
    知识库文档分类模型

    存储知识库下的文档分类信息，支持树形结构
    """
    kb_id = CharField(max_length=40, index=True, verbose_name="知识库ID")
    name = CharField(max_length=255, index=True, verbose_name="分类名称")
    description = TextField(null=True, verbose_name="分类描述")
    parent_id = CharField(max_length=40, null=True, index=True, verbose_name="父分类ID")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    is_default = BooleanField(default=False, verbose_name="是否默认分类")

    class Meta:
        table_name = 'knowledgebase_document_category'
        indexes = (
            (('kb_id', 'parent_id', 'sort_order'), False),
        )


class KnowledgebaseDocument(SoftDeleteModel):
    """
    知识库文档模型

    存储知识库下的文档信息
    """
    kb_id = CharField(max_length=40, index=True, verbose_name="知识库ID")
    category_id = CharField(max_length=40, null=True, index=True, verbose_name="文档分类ID")
    tags = TextField(null=True, verbose_name="文档标签JSON数组")
    chunk_method = CharField(max_length=50, verbose_name="文档Chunk方法")
    chunk_config = TextField(null=True, verbose_name="文档Chunk配置JSON")
    token_num = IntegerField(default=0, verbose_name="文档Token数")
    chunk_num = IntegerField(default=0, verbose_name="文档Chunk数")
    file_type = CharField(max_length=50, null=True, verbose_name="文档文件类型")
    file_name = CharField(max_length=2000, null=True, verbose_name="文档文件名")
    location = TextField(null=True, verbose_name="文档存储路径")
    file_size = BigIntegerField(default=0, verbose_name="文档文件大小(字节)")
    mime_type = CharField(max_length=100, null=True, verbose_name="文件MIME类型")
    source_type = CharField(max_length=50, null=True, verbose_name="来源类型")
    source_config = TextField(null=True, verbose_name="来源配置JSON")
    thumbnail = TextField(null=True, verbose_name="文件缩略图")
    running_status = CharField(max_length=50, default="pending", verbose_name="文档解析状态")
    status = BooleanField(default=True, verbose_name="文档状态")
    task_progress = FloatField(default=0, verbose_name="文档解析进度(0-1)")
    task_begin_at = DateTimeField(null=True, verbose_name="文档解析开始时间")
    task_end_at = DateTimeField(null=True, verbose_name="文档解析结束时间")
    task_duration = IntegerField(default=0, verbose_name="文档解析耗时(毫秒)")

    class Meta:
        table_name = 'knowledgebase_document'
        indexes = (
            (('kb_id', 'created_at'), False),
        )


class LLMCategory(SoftDeleteModel):
    """
    LLM模型分类模型
    
    存储LLM模型分类信息，支持树形结构
    """
    name = CharField(max_length=255, index=True, verbose_name="分类名称")
    description = TextField(null=True, verbose_name="分类描述")
    parent_id = CharField(max_length=40, null=True, index=True, verbose_name="父分类ID")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    is_default = BooleanField(default=False, verbose_name="是否默认分类")
    
    class Meta:
        table_name = 'llm_category'
        indexes = (
            (('parent_id', 'sort_order'), False),
        )


class LLMModel(SoftDeleteModel):
    """
    LLM模型配置
    
    存储大语言模型配置信息
    """
    name = CharField(max_length=255, index=True, verbose_name="模型名称")
    provider = CharField(max_length=255, null=True, verbose_name="提供商")
    api_key = CharField(max_length=255, verbose_name="API密钥")
    endpoint = CharField(max_length=512, verbose_name="端点地址")
    model_type = CharField(max_length=255, verbose_name="模型类型")
    category_id = CharField(max_length=40, null=True, index=True, verbose_name="分类ID")
    tags = TextField(null=True, verbose_name="标签数组JSON")
    config = TextField(null=True, verbose_name="模型参数配置JSON")
    support_image = BooleanField(default=False, verbose_name="是否支持图片")
    status = BooleanField(default=True, verbose_name="状态")
    
    class Meta:
        table_name = 'llm_model'


class PromptCategory(SoftDeleteModel):
    """
    提示词分类模型
    
    存储提示词分类信息，支持树形结构
    """
    name = CharField(max_length=255, index=True, verbose_name="分类名称")
    description = TextField(null=True, verbose_name="分类描述")
    parent_id = CharField(max_length=40, null=True, index=True, verbose_name="父分类ID")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    is_default = BooleanField(default=False, verbose_name="是否默认分类")
    
    class Meta:
        table_name = 'prompt_category'
        indexes = (
            (('parent_id', 'sort_order'), False),
        )


class Prompt(SoftDeleteModel):
    """
    提示词模型
    
    存储提示词模板
    """
    name = CharField(max_length=255, index=True, verbose_name="提示词名称")
    content = TextField(verbose_name="提示词内容")
    description = TextField(null=True, verbose_name="提示词描述")
    category_id = CharField(max_length=40, null=True, index=True, verbose_name="分类ID")
    tags = TextField(null=True, verbose_name="标签列表，JSON数组格式")
    status = BooleanField(default=True, verbose_name="状态：True启用，False禁用")
    
    class Meta:
        table_name = 'prompt'


class Chatbot(SoftDeleteModel):
    """
    机器人模型
    
    存储机器人配置信息
    """
    code = CharField(max_length=100, index=True, verbose_name="机器人编码")
    name = CharField(max_length=255, index=True, verbose_name="机器人名称")
    description = TextField(null=True, verbose_name="机器人描述")
    model_id = CharField(max_length=40, null=True, index=True, verbose_name="LLM模型ID")
    category_id = CharField(max_length=40, null=True, index=True, verbose_name="分类ID")
    avatar = TextField(null=True, verbose_name="机器人头像")
    greeting = TextField(null=True, verbose_name="欢迎语")
    source_type = CharField(max_length=255, null=True, verbose_name="来源类型")
    source_config = TextField(null=True, verbose_name="来源配置")
    
    class Meta:
        table_name = 'chatbot'


class Chat(SoftDeleteModel):
    """
    对话模型
    
    存储用户对话信息
    """
    user_id = CharField(max_length=40, index=True, null=True, verbose_name="用户ID")
    title = CharField(max_length=255, verbose_name="对话标题")
    model_id = CharField(max_length=40, null=True, index=True, verbose_name="模型ID")
    chatbot_id = CharField(max_length=40, null=True, index=True, verbose_name="机器人ID")
    config = TextField(null=True, verbose_name="对话配置JSON")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    is_top = BooleanField(default=False, verbose_name="是否置顶")
    system_prompt = TextField(null=True, verbose_name="系统提示词")
    messages = TextField(null=True, verbose_name="对话消息列表JSON")
    
    class Meta:
        table_name = 'chat'
        indexes = (
            (('user_id', 'is_top', 'sort_order'), False),
        )


class ChatMessage(SoftDeleteModel):
    """
    对话消息模型
    
    存储对话中的每条消息
    """
    message_id = CharField(max_length=40, index=True, verbose_name="消息ID")
    chat_id = CharField(max_length=40, index=True, verbose_name="对话ID")
    config = TextField(null=True, verbose_name="消息配置JSON")
    messages = TextField(null=True, verbose_name="消息内容JSON")
    role = CharField(max_length=20, verbose_name="角色：user/assistant/system")
    content = TextField(verbose_name="消息内容")
    reasoning_content = TextField(null=True, verbose_name="思考过程内容")
    reasoning_time = IntegerField(null=True, verbose_name="思考耗时（毫秒）")
    avatar = CharField(max_length=500, null=True, verbose_name="头像URL")
    model_id = CharField(max_length=40, null=True, index=True, verbose_name="模型ID")
    chatbot_id = CharField(max_length=40, null=True, index=True, verbose_name="机器人ID")
    
    class Meta:
        table_name = 'chat_message'
        indexes = (
            (('chat_id', 'created_at'), False),
        )


class MCPCategory(SoftDeleteModel):
    """
    MCP分类模型
    
    存储MCP服务分类信息，支持树形结构
    """
    name = CharField(max_length=255, index=True, verbose_name="分类名称")
    description = TextField(null=True, verbose_name="分类描述")
    parent_id = CharField(max_length=40, null=True, index=True, verbose_name="父分类ID")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    is_default = BooleanField(default=False, verbose_name="是否默认分类")
    
    class Meta:
        table_name = 'mcp_category'
        indexes = (
            (('parent_id', 'sort_order'), False),
        )


class MCPServer(SoftDeleteModel):
    """
    MCP服务模型
    
    存储MCP（模型上下文协议）服务配置
    """
    code = CharField(max_length=100, unique=True, index=True, verbose_name="MCP服务编码")
    name = CharField(max_length=255, index=True, verbose_name="MCP服务名称")
    description = TextField(null=True, verbose_name="MCP服务描述")
    url = CharField(max_length=512, null=True, verbose_name="MCP URL")
    avatar = TextField(null=True, verbose_name="MCP服务头像")
    transport_type = CharField(max_length=50, verbose_name="传输方式")
    source_type = CharField(max_length=50, verbose_name="来源类型")
    category_id = CharField(max_length=40, null=True, index=True, verbose_name="分类ID")
    config = TextField(null=True, verbose_name="MCP服务配置")
    
    class Meta:
        table_name = 'mcp_server'


class MCPTool(SoftDeleteModel):
    """
    MCP工具模型
    
    存储MCP工具配置
    """
    name = CharField(max_length=255, index=True, verbose_name="工具名称")
    title = CharField(max_length=255, null=True, verbose_name="工具标题")
    description = TextField(null=True, verbose_name="工具描述")
    tool_type = CharField(max_length=50, verbose_name="工具类型")
    server_id = CharField(max_length=40, index=True, verbose_name="MCP服务ID")
    config = TextField(null=True, verbose_name="工具配置")
    extra_config = TextField(null=True, verbose_name="额外配置")
    status = BooleanField(verbose_name="状态")
    
    class Meta:
        table_name = 'mcp_tool'


class ChatbotMCP(BaseModel):
    """
    机器人MCP关联模型
    
    存储机器人与MCP服务的关联关系
    """
    deleted = BooleanField(default=False, verbose_name="是否删除")
    deleted_at = DateTimeField(null=True, verbose_name="删除时间")
    deleted_user_id = CharField(max_length=40, null=True, verbose_name="删除用户ID")
    chatbot_id = CharField(max_length=40, index=True, verbose_name="机器人ID")
    mcp_server_id = CharField(max_length=40, index=True, verbose_name="MCP服务ID")
    
    class Meta:
        table_name = 'chatbot_mcp'


class ChatbotModel(BaseModel):
    """
    机器人模型关联模型
    
    存储机器人与LLM模型的绑定关系
    """
    deleted = BooleanField(default=False, verbose_name="是否删除")
    deleted_at = DateTimeField(null=True, verbose_name="删除时间")
    deleted_user_id = CharField(max_length=40, null=True, verbose_name="删除用户ID")
    chatbot_id = CharField(max_length=40, index=True, verbose_name="机器人ID")
    model_id = CharField(max_length=40, index=True, verbose_name="模型ID")
    model_type = CharField(max_length=50, index=True, verbose_name="模型类型")
    config = TextField(null=True, verbose_name="模型配置JSON")
    
    class Meta:
        table_name = 'chatbot_model'
        indexes = (
            (('chatbot_id', 'model_type'), True),
        )


class ChatbotPrompt(BaseModel):
    """
    机器人提示词关联模型
    
    存储机器人与提示词的绑定关系
    """
    deleted = BooleanField(default=False, verbose_name="是否删除")
    deleted_at = DateTimeField(null=True, verbose_name="删除时间")
    deleted_user_id = CharField(max_length=40, null=True, verbose_name="删除用户ID")
    chatbot_id = CharField(max_length=40, index=True, verbose_name="机器人ID")
    prompt_id = CharField(max_length=40, null=True, index=True, verbose_name="提示词ID（来自提示词库）")
    prompt_type = CharField(max_length=50, index=True, verbose_name="提示词类型：system/user")
    prompt_source = CharField(max_length=50, verbose_name="提示词来源：library/manual")
    prompt_name = CharField(max_length=255, null=True, verbose_name="提示词名称（手动输入时）")
    prompt_content = TextField(null=True, verbose_name="提示词内容（手动输入时）")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    
    class Meta:
        table_name = 'chatbot_prompt'
        indexes = (
            (('chatbot_id', 'prompt_type'), False),
        )


class ChatbotTool(BaseModel):
    """
    机器人工具关联模型
    
    存储机器人与MCP工具的绑定关系
    """
    deleted = BooleanField(default=False, verbose_name="是否删除")
    deleted_at = DateTimeField(null=True, verbose_name="删除时间")
    deleted_user_id = CharField(max_length=40, null=True, verbose_name="删除用户ID")
    chatbot_id = CharField(max_length=40, index=True, verbose_name="机器人ID")
    mcp_tool_id = CharField(max_length=40, index=True, verbose_name="MCP工具ID")
    mcp_server_id = CharField(max_length=40, index=True, verbose_name="MCP服务ID")
    
    class Meta:
        table_name = 'chatbot_tool'
        indexes = (
            (('chatbot_id', 'mcp_tool_id'), True),
        )


def create_tables():
    """
    创建所有数据表
    如果表不存在则创建，已存在则不做任何操作
    """
    tables = [
        User,
        ChatbotCategory,
        KnowledgebaseCategory,
        Knowledgebase,
        KnowledgebaseDocumentCategory,
        KnowledgebaseDocument,
        LLMCategory,
        LLMModel,
        PromptCategory,
        Prompt,
        Chatbot,
        Chat,
        ChatMessage,
        MCPCategory,
        MCPServer,
        MCPTool,
        ChatbotMCP,
        ChatbotModel,
        ChatbotPrompt,
        ChatbotTool
    ]
    
    for table in tables:
        if not table.table_exists():
            table.create_table()
            print(f"表 {table._meta.table_name} 创建成功")
        else:
            print(f"表 {table._meta.table_name} 已存在")


if __name__ == "__main__":
    create_tables()
