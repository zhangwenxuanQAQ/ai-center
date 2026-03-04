"""
聊天机器人服务类，提供聊天机器人相关的CRUD操作
"""

import json
from app.database.models import Chatbot, ChatbotMCP, ChatbotCategory
from app.services.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotDTO
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError
from app.constants.chatbot_constants import SOURCE_TYPE, SOURCE_CONFIG_FIELDS


from app.configs.config import config


class ChatbotService:
    """
    聊天机器人服务类
    
    提供聊天机器人的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def _get_or_create_default_category():
        """
        获取或创建默认分类
        
        Returns:
            ChatbotCategory: 默认分类对象
        """
        default_category = ChatbotCategory.select().where(ChatbotCategory.is_default == True).first()
        if not default_category:
            default_category = ChatbotCategory(
                name="默认分类",
                description="系统默认分类",
                is_default=True
            )
            default_category.save()
        return default_category
    
    @staticmethod
    def get_source_types():
        """
        获取支持的机器人来源类型
        
        Returns:
            dict: 来源类型字典
        """
        return SOURCE_TYPE
    
    @staticmethod
    def get_source_config_fields(source_type: str):
        """
        获取指定来源类型的配置参数字段
        
        Args:
            source_type: 来源类型
            
        Returns:
            list: 配置参数字段列表
        """
        return SOURCE_CONFIG_FIELDS.get(source_type, [])
    
    @staticmethod
    def get_source_configs_with_callback():
        """
        获取所有来源类型及其配置参数，并为企业微信添加回调地址
        
        Returns:
            list: 来源配置列表
        """
        configs = []
        for source_type in SOURCE_TYPE.keys():
            config_fields = ChatbotService.get_source_config_fields(source_type)
            
            config_item = {
                "source_type": source_type,
                "source_name": SOURCE_TYPE[source_type],
                "config_fields": config_fields
            }
            
            if source_type == "work_weixin":
                server_host = config.server.get('host', '0.0.0.0')
                server_port = config.server.get('http_port', 8081)
                callback_url = f"http://{server_host}:{server_port}/aicenter/v1/chat/work_weixin"
                for field in config_fields:
                    if field.get('name') == 'callback_url':
                        field['default_value'] = callback_url
                        break
            
            configs.append(config_item)
        
        return configs
    
    @staticmethod
    @handle_transaction
    def create_chatbot(chatbot: ChatbotCreate):
        """
        创建聊天机器人
        
        Args:
            chatbot: 聊天机器人创建DTO
            
        Returns:
            Chatbot: 创建的聊天机器人对象
        """
        chatbot_data = chatbot.model_dump()
        mcp_ids = chatbot_data.pop('mcp_ids', [])
        
        if not chatbot_data.get('category_id'):
            default_category = ChatbotService._get_or_create_default_category()
            chatbot_data['category_id'] = default_category.id
        
        db_chatbot = Chatbot(**chatbot_data)
        db_chatbot.save()
        
        for mcp_id in mcp_ids:
            chatbot_mcp = ChatbotMCP(chatbot_id=db_chatbot.id, mcp_id=mcp_id)
            chatbot_mcp.save()
        
        db_chatbot = Chatbot.get_by_id(db_chatbot.id)
        return db_chatbot

    @staticmethod
    def get_chatbots(skip: int = 0, limit: int = 100):
        """
        获取聊天机器人列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[dict]: 聊天机器人列表（包含mcp_ids）
        """
        chatbots = Chatbot.select().offset(skip).limit(limit)
        result = []
        for chatbot in chatbots:
            mcp_ids = [cm.mcp_id for cm in ChatbotMCP.select().where(ChatbotMCP.chatbot_id == chatbot.id)]
            chatbot_dict = {
                "id": chatbot.id,
                "name": chatbot.name,
                "description": chatbot.description,
                "model_id": chatbot.model_id,
                "category_id": chatbot.category_id,
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
    def get_chatbot(chatbot_id: int):
        """
        获取单个聊天机器人
        
        Args:
            chatbot_id: 聊天机器人ID
            
        Returns:
            dict: 聊天机器人对象（包含mcp_ids），不存在则返回None
        """
        try:
            chatbot = Chatbot.get_by_id(chatbot_id)
        except Chatbot.DoesNotExist:
            return None
        mcp_ids = [cm.mcp_id for cm in ChatbotMCP.select().where(ChatbotMCP.chatbot_id == chatbot.id)]
        chatbot_dict = {
            "id": chatbot.id,
            "name": chatbot.name,
            "description": chatbot.description,
            "model_id": chatbot.model_id,
            "category_id": chatbot.category_id,
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
    def update_chatbot(chatbot_id: int, chatbot: ChatbotUpdate):
        """
        更新聊天机器人
        
        Args:
            chatbot_id: 聊天机器人ID
            chatbot: 聊天机器人更新DTO
            
        Returns:
            Chatbot: 更新后的聊天机器人对象
            
        Raises:
            ResourceNotFoundError: 聊天机器人不存在
        """
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
    def delete_chatbot(chatbot_id: int):
        """
        删除聊天机器人
        
        Args:
            chatbot_id: 聊天机器人ID
            
        Returns:
            Chatbot: 被删除的聊天机器人对象
            
        Raises:
            ResourceNotFoundError: 聊天机器人不存在
        """
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
