"""
数据库模型定义
基于数据库实际表结构生成
"""

from peewee import Model, CharField, TextField, DateTimeField, BooleanField, IntegerField, ForeignKeyField
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


class Knowledge(SoftDeleteModel):
    """
    知识库模型
    
    存储知识库信息
    """
    name = CharField(max_length=255, index=True, verbose_name="知识库名称")
    description = TextField(verbose_name="知识库描述")
    file_path = CharField(max_length=512, verbose_name="文件路径")
    status = BooleanField(verbose_name="状态")
    
    class Meta:
        table_name = 'knowledge'


class LLMModel(SoftDeleteModel):
    """
    LLM模型配置
    
    存储大语言模型配置信息
    """
    name = CharField(max_length=255, index=True, verbose_name="模型名称")
    provider = CharField(max_length=255, verbose_name="提供商")
    api_key = CharField(max_length=255, verbose_name="API密钥")
    endpoint = CharField(max_length=512, verbose_name="端点地址")
    model_type = CharField(max_length=255, verbose_name="模型类型")
    
    class Meta:
        table_name = 'llm_model'


class Prompt(SoftDeleteModel):
    """
    提示词模型
    
    存储提示词模板
    """
    name = CharField(max_length=255, index=True, verbose_name="提示词名称")
    content = TextField(verbose_name="提示词内容")
    category = CharField(max_length=255, verbose_name="提示词分类")
    
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
    prompt_id = CharField(max_length=40, null=True, index=True, verbose_name="提示词ID")
    knowledge_id = CharField(max_length=40, null=True, index=True, verbose_name="知识库ID")
    source_type = CharField(max_length=255, null=True, verbose_name="来源类型")
    source_config = TextField(null=True, verbose_name="来源配置")
    
    class Meta:
        table_name = 'chatbot'


class Chat(SoftDeleteModel):
    """
    聊天记录模型
    
    存储用户与机器人的聊天记录
    """
    user_id = CharField(max_length=40, index=True, verbose_name="用户ID")
    chatbot_id = CharField(max_length=40, index=True, verbose_name="机器人ID")
    message = TextField(verbose_name="用户消息")
    response = TextField(verbose_name="机器人回复")
    
    class Meta:
        table_name = 'chat'


class MCPCategory(SoftDeleteModel):
    """
    MCP分类模型
    
    存储MCP服务分类信息，支持树形结构
    """
    name = CharField(max_length=255, index=True, verbose_name="分类名称")
    description = TextField(null=True, verbose_name="分类描述")
    parent_id = CharField(max_length=40, null=True, index=True, verbose_name="父分类ID")
    sort_order = IntegerField(default=0, verbose_name="排序序号")
    
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
    description = TextField(null=True, verbose_name="工具描述")
    tool_type = CharField(max_length=50, verbose_name="工具类型")
    server_id = CharField(max_length=40, index=True, verbose_name="MCP服务ID")
    config = TextField(null=True, verbose_name="工具配置")
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


def create_tables():
    """
    创建所有数据表
    如果表不存在则创建，已存在则不做任何操作
    """
    tables = [
        User,
        ChatbotCategory,
        Knowledge,
        LLMModel,
        Prompt,
        Chatbot,
        Chat,
        MCPCategory,
        MCPServer,
        MCPTool,
        ChatbotMCP
    ]
    
    for table in tables:
        if not table.table_exists():
            table.create_table()
            print(f"表 {table._meta.table_name} 创建成功")
        else:
            print(f"表 {table._meta.table_name} 已存在")


if __name__ == "__main__":
    create_tables()
