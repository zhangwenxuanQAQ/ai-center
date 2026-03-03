from peewee import MySQLDatabase
from app.database.models import Chatbot, ChatbotMCP
from app.core.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotDTO
from app.core.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError

class ChatbotService:
    @staticmethod
    @handle_transaction
    def create_chatbot(db: MySQLDatabase, chatbot: ChatbotCreate):
        """创建聊天机器人"""
        # 提取mcp_ids，不包含在Chatbot模型中
        chatbot_data = chatbot.model_dump()
        mcp_ids = chatbot_data.pop('mcp_ids', [])
        
        # 创建Chatbot实例
        db_chatbot = Chatbot(**chatbot_data)
        db_chatbot.save()
        
        # 创建MCP关联
        for mcp_id in mcp_ids:
            chatbot_mcp = ChatbotMCP(chatbot_id=db_chatbot.id, mcp_id=mcp_id)
            chatbot_mcp.save()
        
        # 重新获取chatbot以包含关联数据
        db_chatbot = Chatbot.get_by_id(db_chatbot.id)
        return db_chatbot

    @staticmethod
    def get_chatbots(db: MySQLDatabase, skip: int = 0, limit: int = 100):
        """获取聊天机器人列表（只读操作，不需要事务）"""
        chatbots = Chatbot.select().offset(skip).limit(limit)
        result = []
        for chatbot in chatbots:
            # 获取关联的MCP ID列表
            mcp_ids = [cm.mcp_id for cm in ChatbotMCP.select().where(ChatbotMCP.chatbot_id == chatbot.id)]
            # 构建包含mcp_ids的响应对象
            chatbot_dict = {
                "id": chatbot.id,
                "name": chatbot.name,
                "description": chatbot.description,
                "model_id": chatbot.model_id,
                "avatar": chatbot.avatar,
                "greeting": chatbot.greeting,
                "prompt_id": chatbot.prompt_id,
                "knowledge_id": chatbot.knowledge_id,
                "source_type": chatbot.source_type,
                "source_config": chatbot.source_config,
                "created_at": chatbot.created_at,
                "updated_at": chatbot.updated_at,
                "mcp_ids": mcp_ids
            }
            result.append(chatbot_dict)
        return result

    @staticmethod
    def get_chatbot(db: MySQLDatabase, chatbot_id: int):
        """获取单个聊天机器人（只读操作，不需要事务）"""
        try:
            chatbot = Chatbot.get_by_id(chatbot_id)
        except Chatbot.DoesNotExist:
            return None
        # 获取关联的MCP ID列表
        mcp_ids = [cm.mcp_id for cm in ChatbotMCP.select().where(ChatbotMCP.chatbot_id == chatbot.id)]
        # 构建包含mcp_ids的响应对象
        chatbot_dict = {
            "id": chatbot.id,
            "name": chatbot.name,
            "description": chatbot.description,
            "model_id": chatbot.model_id,
            "avatar": chatbot.avatar,
            "greeting": chatbot.greeting,
            "prompt_id": chatbot.prompt_id,
            "knowledge_id": chatbot.knowledge_id,
            "source_type": chatbot.source_type,
            "source_config": chatbot.source_config,
            "created_at": chatbot.created_at,
            "updated_at": chatbot.updated_at,
            "mcp_ids": mcp_ids
        }
        return chatbot_dict

    @staticmethod
    @handle_transaction
    def update_chatbot(db: MySQLDatabase, chatbot_id: int, chatbot: ChatbotUpdate):
        """更新聊天机器人"""
        try:
            db_chatbot = Chatbot.get_by_id(chatbot_id)
        except Chatbot.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"聊天机器人 {chatbot_id} 不存在"
            )
        
        update_data = chatbot.model_dump(exclude_unset=True)
        # 提取mcp_ids，不包含在Chatbot模型中
        mcp_ids = update_data.pop('mcp_ids', None)
        
        # 更新基本字段
        for field, value in update_data.items():
            setattr(db_chatbot, field, value)
        db_chatbot.save()
        
        # 更新MCP关联
        if mcp_ids is not None:
            # 删除现有的关联
            ChatbotMCP.delete().where(ChatbotMCP.chatbot_id == chatbot_id).execute()
            # 添加新的关联
            for mcp_id in mcp_ids:
                chatbot_mcp = ChatbotMCP(chatbot_id=chatbot_id, mcp_id=mcp_id)
                chatbot_mcp.save()
        
        # 重新获取chatbot以包含关联数据
        db_chatbot = Chatbot.get_by_id(chatbot_id)
        return db_chatbot

    @staticmethod
    @handle_transaction
    def delete_chatbot(db: MySQLDatabase, chatbot_id: int):
        """删除聊天机器人"""
        try:
            db_chatbot = Chatbot.get_by_id(chatbot_id)
        except Chatbot.DoesNotExist:
            raise ResourceNotFoundError(
                message=f"聊天机器人 {chatbot_id} 不存在"
            )
        
        # 删除相关的MCP关联
        ChatbotMCP.delete().where(ChatbotMCP.chatbot_id == chatbot_id).execute()
        
        # 删除聊天机器人
        db_chatbot.delete_instance()
        return db_chatbot