from peewee import Model, CharField, TextField, IntegerField, BooleanField, DateTimeField, ForeignKeyField
from datetime import datetime
from .database import db

# 基础模型类
class BaseModel(Model):
    class Meta:
        database = db

class User(BaseModel):
    id = IntegerField(primary_key=True)
    username = CharField(max_length=255, unique=True, index=True)
    password = CharField(max_length=255)
    email = CharField(max_length=255, unique=True)
    is_admin = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(null=True)

    class Meta:
        table_name = 'users'

class LLMModel(BaseModel):
    id = IntegerField(primary_key=True)
    name = CharField(max_length=255, index=True)
    provider = CharField(max_length=255)
    api_key = CharField(max_length=255)
    endpoint = CharField(max_length=512)
    model_type = CharField(max_length=255)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(null=True)

    class Meta:
        table_name = 'llm_models'

class Prompt(BaseModel):
    id = IntegerField(primary_key=True)
    name = CharField(max_length=255, index=True)
    content = TextField()
    category = CharField(max_length=255)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(null=True)

    class Meta:
        table_name = 'prompts'

class Knowledge(BaseModel):
    id = IntegerField(primary_key=True)
    name = CharField(max_length=255, index=True)
    description = TextField()
    file_path = CharField(max_length=512)
    status = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(null=True)

    class Meta:
        table_name = 'knowledges'

class MCP(BaseModel):
    id = IntegerField(primary_key=True)
    name = CharField(max_length=255, index=True)
    url = CharField(max_length=512)
    api_key = CharField(max_length=255)
    status = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(null=True)

    class Meta:
        table_name = 'mcps'

class Chatbot(BaseModel):
    id = IntegerField(primary_key=True)
    name = CharField(max_length=255, index=True)
    description = TextField()
    model_id = ForeignKeyField(LLMModel, backref='chatbots')
    avatar = CharField(max_length=512, null=True)
    greeting = TextField(null=True)
    prompt_id = ForeignKeyField(Prompt, backref='chatbots', null=True)
    knowledge_id = ForeignKeyField(Knowledge, backref='chatbots', null=True)
    source_type = CharField(max_length=255, null=True)
    source_config = TextField(null=True)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(null=True)

    class Meta:
        table_name = 'chatbots'

class ChatbotMCP(BaseModel):
    id = IntegerField(primary_key=True)
    chatbot_id = ForeignKeyField(Chatbot, backref='chatbot_mcps')
    mcp_id = ForeignKeyField(MCP, backref='chatbot_mcps')
    created_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = 'chatbot_mcp'

class Chat(BaseModel):
    id = IntegerField(primary_key=True)
    user_id = ForeignKeyField(User, backref='chats')
    chatbot_id = ForeignKeyField(Chatbot, backref='chats')
    message = TextField()
    response = TextField()
    created_at = DateTimeField(default=datetime.now)

    class Meta:
        table_name = 'chats'

# 创建表
def create_tables():
    with db:
        db.create_tables([
            User,
            LLMModel,
            Prompt,
            Knowledge,
            MCP,
            Chatbot,
            ChatbotMCP,
            Chat
        ])