"""
数据库模型定义
使用Peewee ORM定义所有数据库表模型
"""

from peewee import Model, CharField, TextField, BooleanField, DateTimeField, ForeignKeyField, UUIDField
from datetime import datetime
import uuid
from .database import db


class BaseModel(Model):
    """
    基础模型类
    
    所有模型类的基类，提供数据库连接配置和公共字段
    
    Attributes:
        id: 主键ID（UUID格式）
        created_at: 创建时间
        updated_at: 更新时间
        create_user_id: 创建用户ID
        update_user_id: 更新用户ID
        deleted: 是否删除
        deleted_at: 删除时间
        deleted_user_id: 删除用户ID
    """
    id = UUIDField(primary_key=True, default=uuid.uuid4, verbose_name="主键ID")
    created_at = DateTimeField(default=datetime.now, verbose_name="创建时间")
    updated_at = DateTimeField(null=True, verbose_name="更新时间")
    create_user_id = UUIDField(null=True, verbose_name="创建用户ID")
    update_user_id = UUIDField(null=True, verbose_name="更新用户ID")
    deleted = BooleanField(default=False, verbose_name="是否删除")
    deleted_at = DateTimeField(null=True, verbose_name="删除时间")
    deleted_user_id = UUIDField(null=True, verbose_name="删除用户ID")

    class Meta:
        database = db


class User(BaseModel):
    """
    用户模型
    
    存储用户基本信息
    """
    username = CharField(max_length=255, unique=True, index=True, verbose_name="用户名")
    password = CharField(max_length=255, verbose_name="密码")
    email = CharField(max_length=255, unique=True, verbose_name="邮箱地址")
    is_admin = BooleanField(default=False, verbose_name="是否为管理员")

    class Meta:
        table_name = 'user'


class LLMModel(BaseModel):
    """
    LLM模型配置
    
    存储大语言模型的配置信息
    """
    name = CharField(max_length=255, index=True, verbose_name="模型名称")
    provider = CharField(max_length=255, verbose_name="提供商")
    api_key = CharField(max_length=255, verbose_name="API密钥")
    endpoint = CharField(max_length=512, verbose_name="端点URL")
    model_type = CharField(max_length=255, verbose_name="模型类型")

    class Meta:
        table_name = 'llm_model'


class Prompt(BaseModel):
    """
    提示词模型
    
    存储提示词模板
    """
    name = CharField(max_length=255, index=True, verbose_name="提示词名称")
    content = TextField(verbose_name="提示词内容")
    category = CharField(max_length=255, verbose_name="提示词分类")

    class Meta:
        table_name = 'prompt'


class Knowledge(BaseModel):
    """
    知识库模型
    
    存储知识库配置信息
    """
    name = CharField(max_length=255, index=True, verbose_name="知识库名称")
    description = TextField(verbose_name="知识库描述")
    file_path = CharField(max_length=512, verbose_name="文件路径")
    status = BooleanField(default=True, verbose_name="状态")

    class Meta:
        table_name = 'knowledge'


class MCP(BaseModel):
    """
    MCP模型
    
    存储MCP（模型上下文协议）配置
    """
    name = CharField(max_length=255, index=True, verbose_name="MCP名称")
    url = CharField(max_length=512, verbose_name="MCP URL")
    api_key = CharField(max_length=255, verbose_name="API密钥")
    status = BooleanField(default=True, verbose_name="状态")

    class Meta:
        table_name = 'mcp'


class ChatbotCategory(BaseModel):
    """
    聊天机器人分类模型
    
    存储聊天机器人的分类信息
    """
    name = CharField(max_length=255, index=True, verbose_name="分类名称")
    description = TextField(null=True, verbose_name="分类描述")
    is_default = BooleanField(default=False, verbose_name="是否为默认分类")

    class Meta:
        table_name = 'chatbot_category'


class Chatbot(BaseModel):
    """
    聊天机器人模型
    
    存储聊天机器人配置信息
    """
    code = CharField(max_length=100, unique=True, index=True, verbose_name="机器人编码")
    name = CharField(max_length=255, index=True, verbose_name="聊天机器人名称")
    description = TextField(null=True, verbose_name="聊天机器人描述")
    model_id = ForeignKeyField(LLMModel, backref='chatbots', null=True, verbose_name="LLM模型ID")
    category_id = ForeignKeyField(ChatbotCategory, backref='chatbots', null=True, verbose_name="分类ID")
    avatar = TextField(null=True, verbose_name="头像URL或Base64")
    greeting = TextField(null=True, verbose_name="欢迎语")
    prompt_id = ForeignKeyField(Prompt, backref='chatbots', null=True, verbose_name="提示词ID")
    knowledge_id = ForeignKeyField(Knowledge, backref='chatbots', null=True, verbose_name="知识库ID")
    source_type = CharField(max_length=255, null=True, verbose_name="来源类型")
    source_config = TextField(null=True, verbose_name="来源配置")

    class Meta:
        table_name = 'chatbot'


class ChatbotMCP(BaseModel):
    """
    聊天机器人与MCP关联模型
    
    存储聊天机器人与MCP的多对多关系
    """
    chatbot_id = ForeignKeyField(Chatbot, backref='chatbot_mcps', verbose_name="聊天机器人ID")
    mcp_id = ForeignKeyField(MCP, backref='chatbot_mcps', verbose_name="MCP ID")

    class Meta:
        table_name = 'chatbot_mcp'


class Chat(BaseModel):
    """
    聊天记录模型
    
    存储用户与聊天机器人的对话记录
    """
    user_id = ForeignKeyField(User, backref='chats', verbose_name="用户ID")
    chatbot_id = ForeignKeyField(Chatbot, backref='chats', verbose_name="聊天机器人ID")
    message = TextField(verbose_name="用户消息")
    response = TextField(verbose_name="机器人回复")

    class Meta:
        table_name = 'chat'


def create_tables():
    """
    创建所有数据库表
    
    如果表不存在则创建，存在则跳过
    """
    with db:
        db.create_tables([
            User,
            LLMModel,
            Prompt,
            Knowledge,
            MCP,
            ChatbotCategory,
            Chatbot,
            ChatbotMCP,
            Chat
        ])
