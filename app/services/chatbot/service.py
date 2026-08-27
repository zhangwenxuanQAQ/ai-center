"""
聊天机器人服务类，提供聊天机器人相关的CRUD操作
"""

import json
from datetime import datetime
from typing import List
from app.database.models import Chatbot, ChatbotMCP, ChatbotCategory, ChatbotModel, LLMModel, ChatbotPrompt, Prompt, ChatbotTool, MCPServer, MCPTool, ChatbotKnowledgebase, Knowledgebase, KnowledgebaseDocument
from app.services.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotDTO
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError
from app.constants.chatbot_constants import SOURCE_TYPE, SOURCE_CONFIG_FIELDS
from app.database.database import db


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
            default_category.save(force_insert=True)
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
            
        Raises:
            Exception: 编码已存在
        """
        try:
            chatbot_data = chatbot.model_dump()
            mcp_server_ids = chatbot_data.pop('mcp_server_ids', [])
            
            if not chatbot_data.get('category_id'):
                default_category = ChatbotService._get_or_create_default_category()
                chatbot_data['category_id'] = default_category.id
            
            # 检查编码是否重复
            code = chatbot_data.get('code')
            if code:
                existing_chatbot = Chatbot.select().where(
                    (Chatbot.code == code) & (Chatbot.deleted == False)
                ).first()
                if existing_chatbot:
                    raise DuplicateResourceError("编码已存在")
            
            # 创建聊天机器人对象
            db_chatbot = Chatbot(**chatbot_data)
            # 保存到数据库，使用force_insert=True强制插入
            db_chatbot.save(force_insert=True)
            
            if mcp_server_ids:
                for mcp_server_id in mcp_server_ids:
                    chatbot_mcp = ChatbotMCP(chatbot_id=db_chatbot.id, mcp_server_id=mcp_server_id)
                    chatbot_mcp.save(force_insert=True)
            
            return db_chatbot
        except Exception as e:
            raise

    @staticmethod
    def get_chatbots(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, source_type: str = None, code: str = None):
        """
        获取聊天机器人列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID（可选）
            name: 机器人名称（模糊查询）
            source_type: 来源类型
            code: 机器人编码（模糊查询）
            
        Returns:
            List[dict]: 聊天机器人列表（包含mcp_ids）
        """
        try:
            # 构建查询
            query = Chatbot.select().where(Chatbot.deleted == False)
            
            # 如果指定了分类ID，添加分类过滤
            if category_id:
                query = query.where(Chatbot.category_id == category_id)
            
            # 如果指定了名称，添加名称模糊查询
            if name:
                query = query.where(Chatbot.name.contains(name))
            
            # 如果指定了来源类型，添加来源类型过滤
            if source_type:
                query = query.where(Chatbot.source_type == source_type)
            
            # 如果指定了编码，添加编码模糊查询
            if code:
                query = query.where(Chatbot.code.contains(code))
            
            # 按照创建时间倒序排序
            query = query.order_by(Chatbot.created_at.desc())
            
            # 执行查询
            chatbots = list(query.offset(skip).limit(limit))
            result = []
            for chatbot in chatbots:
                # 获取MCP服务关联
                mcp_server_ids = [str(cm.mcp_server_id) for cm in ChatbotMCP.select().where(ChatbotMCP.chatbot_id == chatbot.id)]
                # 构建聊天机器人字典
                chatbot_dict = {
                    "id": str(chatbot.id),
                    "code": chatbot.code,
                    "name": chatbot.name,
                    "description": chatbot.description,
                    "model_id": str(chatbot.model_id) if chatbot.model_id else None,
                    "category_id": str(chatbot.category_id).replace('-', '') if chatbot.category_id else None,
                    "avatar": chatbot.avatar,
                    "greeting": chatbot.greeting,
                    "source_type": chatbot.source_type,
                    "source_config": chatbot.source_config,
                    "created_at": chatbot.created_at,
                    "updated_at": chatbot.updated_at,
                    "mcp_server_ids": mcp_server_ids
                }
                result.append(chatbot_dict)
            return result
        except Exception as e:
            return []

    @staticmethod
    def get_chatbot(chatbot_id: str):
        """
        获取单个聊天机器人
        
        Args:
            chatbot_id: 聊天机器人ID
            
        Returns:
            dict: 聊天机器人对象（包含mcp_ids），不存在或已删除则返回None
        """
        try:
            chatbot = Chatbot.get_by_id(chatbot_id)
            # 检查是否已删除
            if chatbot.deleted:
                return None
        except Chatbot.DoesNotExist:
            return None
        mcp_server_ids = [str(cm.mcp_server_id) for cm in ChatbotMCP.select().where(ChatbotMCP.chatbot_id == chatbot.id)]
        chatbot_dict = {
            "id": str(chatbot.id),
            "code": chatbot.code,
            "name": chatbot.name,
            "description": chatbot.description,
            "model_id": str(chatbot.model_id) if chatbot.model_id else None,
            "category_id": str(chatbot.category_id).replace('-', '') if chatbot.category_id else None,
            "avatar": chatbot.avatar,
            "greeting": chatbot.greeting,
            "source_type": chatbot.source_type,
            "source_config": chatbot.source_config,
            "created_at": chatbot.created_at,
            "updated_at": chatbot.updated_at,
            "mcp_server_ids": mcp_server_ids
        }
        return chatbot_dict

    @staticmethod
    @handle_transaction
    def update_chatbot(chatbot_id: str, chatbot: ChatbotUpdate):
        """
        更新聊天机器人
        
        Args:
            chatbot_id: 聊天机器人ID
            chatbot: 聊天机器人更新DTO
            
        Returns:
            Chatbot: 更新后的聊天机器人对象
            
        Raises:
            ResourceNotFoundError: 聊天机器人不存在
            Exception: 编码已存在
        """
        try:
            # 检查聊天机器人是否存在
            try:
                db_chatbot = Chatbot.get_by_id(chatbot_id)
            except Chatbot.DoesNotExist:
                raise ResourceNotFoundError(
                    message=f"聊天机器人 {chatbot_id} 不存在"
                )
            
            update_data = chatbot.model_dump(exclude_unset=True)
            # 提取mcp_server_ids，不包含在Chatbot模型中
            mcp_server_ids = update_data.pop('mcp_server_ids', None)
            
            # 检查编码是否重复
            if 'code' in update_data:
                code = update_data['code']
                existing_chatbot = Chatbot.select().where(
                    (Chatbot.code == code) & (Chatbot.id != chatbot_id) & (Chatbot.deleted == False)
                ).first()
                if existing_chatbot:
                    raise DuplicateResourceError("编码已存在")
            
            # 更新聊天机器人
            if update_data:
                for field, value in update_data.items():
                    setattr(db_chatbot, field, value)
                db_chatbot.updated_at = datetime.now()
                db_chatbot.save()
            
            # 更新MCP服务关联
            if mcp_server_ids is not None:
                # 删除现有的关联
                ChatbotMCP.delete().where(ChatbotMCP.chatbot_id == chatbot_id).execute()
                # 添加新的关联
                for mcp_server_id in mcp_server_ids:
                    chatbot_mcp = ChatbotMCP(chatbot_id=chatbot_id, mcp_server_id=mcp_server_id)
                    chatbot_mcp.save(force_insert=True)
            
            return db_chatbot
        except Exception as e:
            raise

    @staticmethod
    @handle_transaction
    def delete_chatbot(chatbot_id: str, deleted_user_id: str = None):
        """
        删除聊天机器人（逻辑删除）
        
        Args:
            chatbot_id: 聊天机器人ID
            deleted_user_id: 删除用户ID
            
        Returns:
            Chatbot: 被删除的聊天机器人对象
            
        Raises:
            ResourceNotFoundError: 聊天机器人不存在
        """
        try:
            # 检查聊天机器人是否存在
            try:
                db_chatbot = Chatbot.get_by_id(chatbot_id)
            except Chatbot.DoesNotExist:
                raise ResourceNotFoundError(
                    message=f"聊天机器人 {chatbot_id} 不存在"
                )
            
            # 保存要返回的聊天机器人对象
            deleted_chatbot = db_chatbot
            
            # 逻辑删除：更新相关字段
            db_chatbot.deleted = True
            db_chatbot.deleted_at = datetime.now()
            if deleted_user_id:
                db_chatbot.deleted_user_id = deleted_user_id
            db_chatbot.save()
            
            return deleted_chatbot
        except Exception as e:
            raise
    
    @staticmethod
    def get_chatbot_models(chatbot_id: str):
        """
        获取机器人绑定的模型列表
        
        Args:
            chatbot_id: 机器人ID
            
        Returns:
            list: 绑定的模型信息列表
        """
        try:
            chatbot_models = ChatbotModel.select().where(
                (ChatbotModel.chatbot_id == chatbot_id) & 
                (ChatbotModel.deleted == False)
            )
            
            result = []
            for chatbot_model in chatbot_models:
                try:
                    llm_model = LLMModel.get_by_id(chatbot_model.model_id)
                    if not llm_model.deleted and llm_model.status:
                        model_info = {
                            "id": str(llm_model.id),
                            "name": llm_model.name,
                            "provider": llm_model.provider,
                            "model_type": llm_model.model_type,
                            "tags": json.loads(llm_model.tags) if llm_model.tags else [],
                            "avatar": llm_model.avatar if hasattr(llm_model, 'avatar') else None,
                            "binding_id": str(chatbot_model.id),
                            "config": json.loads(chatbot_model.config) if chatbot_model.config else {}
                        }
                        result.append(model_info)
                except LLMModel.DoesNotExist:
                    pass
            
            return result
        except Exception as e:
            return []
    
    @staticmethod
    def get_chatbot_model_by_type(chatbot_id: str, model_type: str):
        """
        获取机器人指定类型的绑定模型
        
        Args:
            chatbot_id: 机器人ID
            model_type: 模型类型
            
        Returns:
            dict: 绑定的模型信息，未绑定则返回None
        """
        try:
            chatbot_model = ChatbotModel.select().where(
                (ChatbotModel.chatbot_id == chatbot_id) & 
                (ChatbotModel.model_type == model_type) &
                (ChatbotModel.deleted == False)
            ).first()
            
            if not chatbot_model:
                return None
            
            llm_model = LLMModel.get_by_id(chatbot_model.model_id)
            if llm_model.deleted or not llm_model.status:
                return None
            
            model_info = {
                "id": str(llm_model.id),
                "name": llm_model.name,
                "provider": llm_model.provider,
                "model_type": llm_model.model_type,
                "endpoint": llm_model.endpoint,
                "api_key": llm_model.api_key,
                "support_image": llm_model.support_image,
                "status": llm_model.status,
                "tags": json.loads(llm_model.tags) if llm_model.tags else [],
                "avatar": llm_model.avatar if hasattr(llm_model, 'avatar') else None,
                "binding_id": str(chatbot_model.id),
                "config": json.loads(chatbot_model.config) if chatbot_model.config else {},
                "created_at": llm_model.created_at.strftime('%Y-%m-%d %H:%M:%S') if llm_model.created_at else None,
                "updated_at": llm_model.updated_at.strftime('%Y-%m-%d %H:%M:%S') if llm_model.updated_at else None
            }
            
            return model_info
        except Exception as e:
            return None
    
    @staticmethod
    @handle_transaction
    def bind_model_to_chatbot(chatbot_id: str, model_id: str, model_type: str, config: dict = None):
        """
        绑定模型到机器人
        
        Args:
            chatbot_id: 机器人ID
            model_id: 模型ID
            model_type: 模型类型
            config: 模型配置（可选）
            
        Returns:
            ChatbotModel: 绑定关系对象
            
        Raises:
            ResourceNotFoundError: 机器人或模型不存在
            Exception: 模型未启用或类型不匹配
        """
        try:
            try:
                chatbot = Chatbot.get_by_id(chatbot_id)
                if chatbot.deleted:
                    raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            except Chatbot.DoesNotExist:
                raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            
            try:
                llm_model = LLMModel.get_by_id(model_id)
                if llm_model.deleted:
                    raise ResourceNotFoundError(message=f"模型 {model_id} 不存在")
            except LLMModel.DoesNotExist:
                raise ResourceNotFoundError(message=f"模型 {model_id} 不存在")
            
            if not llm_model.status:
                raise Exception("模型未启用，无法绑定")
            
            if llm_model.model_type != model_type:
                raise Exception(f"模型类型不匹配，期望类型：{model_type}，实际类型：{llm_model.model_type}")
            
            existing_binding = ChatbotModel.select().where(
                (ChatbotModel.chatbot_id == chatbot_id) & 
                (ChatbotModel.model_type == model_type) &
                (ChatbotModel.deleted == False)
            ).first()
            
            if existing_binding:
                existing_binding.model_id = model_id
                existing_binding.config = json.dumps(config) if config else None
                existing_binding.updated_at = datetime.now()
                existing_binding.save()
                return existing_binding
            
            chatbot_model = ChatbotModel(
                chatbot_id=chatbot_id,
                model_id=model_id,
                model_type=model_type,
                config=json.dumps(config) if config else None
            )
            chatbot_model.save(force_insert=True)
            
            return chatbot_model
        except Exception as e:
            raise
    
    @staticmethod
    @handle_transaction
    def unbind_model_from_chatbot(chatbot_id: str, model_type: str):
        """
        解绑机器人的模型
        
        Args:
            chatbot_id: 机器人ID
            model_type: 模型类型
            
        Returns:
            bool: 解绑是否成功
            
        Raises:
            ResourceNotFoundError: 绑定关系不存在
        """
        try:
            chatbot_model = ChatbotModel.select().where(
                (ChatbotModel.chatbot_id == chatbot_id) & 
                (ChatbotModel.model_type == model_type) &
                (ChatbotModel.deleted == False)
            ).first()
            
            if not chatbot_model:
                raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 未绑定类型为 {model_type} 的模型")
            
            ChatbotModel.delete().where(ChatbotModel.id == chatbot_model.id).execute()
            
            return True
        except Exception as e:
            raise
    
    @staticmethod
    @handle_transaction
    def update_model_config(chatbot_id: str, model_type: str, config: dict):
        """
        更新机器人模型配置
        
        Args:
            chatbot_id: 机器人ID
            model_type: 模型类型
            config: 模型配置
            
        Returns:
            ChatbotModel: 绑定关系对象
            
        Raises:
            ResourceNotFoundError: 绑定关系不存在
        """
        try:
            chatbot_model = ChatbotModel.select().where(
                (ChatbotModel.chatbot_id == chatbot_id) & 
                (ChatbotModel.model_type == model_type) &
                (ChatbotModel.deleted == False)
            ).first()
            
            if not chatbot_model:
                raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 未绑定类型为 {model_type} 的模型")
            
            chatbot_model.config = json.dumps(config) if config else None
            chatbot_model.updated_at = datetime.now()
            chatbot_model.save()
            
            return chatbot_model
        except Exception as e:
            raise
    
    @staticmethod
    def get_chatbot_prompts(chatbot_id: str, prompt_type: str = None):
        """
        获取机器人绑定的提示词列表
        
        Args:
            chatbot_id: 机器人ID
            prompt_type: 提示词类型（可选）：system/user
            
        Returns:
            list: 绑定的提示词信息列表
        """
        try:
            query = ChatbotPrompt.select().where(
                (ChatbotPrompt.chatbot_id == chatbot_id) & 
                (ChatbotPrompt.deleted == False)
            )
            
            if prompt_type:
                query = query.where(ChatbotPrompt.prompt_type == prompt_type)
            
            query = query.order_by(ChatbotPrompt.sort_order, ChatbotPrompt.created_at)
            
            result = []
            for chatbot_prompt in query:
                prompt_info = {
                    "id": str(chatbot_prompt.id),
                    "prompt_type": chatbot_prompt.prompt_type,
                    "prompt_source": chatbot_prompt.prompt_source,
                    "sort_order": chatbot_prompt.sort_order,
                    "created_at": chatbot_prompt.created_at.strftime('%Y-%m-%d %H:%M:%S') if chatbot_prompt.created_at else None
                }
                
                if chatbot_prompt.prompt_source == 'library':
                    try:
                        prompt = Prompt.get_by_id(chatbot_prompt.prompt_id)
                        if not prompt.deleted and prompt.status:
                            prompt_info.update({
                                "prompt_id": str(prompt.id),
                                "name": prompt.name,
                                "description": prompt.description,
                                "prompt_content": prompt.content,
                                "tags": json.loads(prompt.tags) if prompt.tags else []
                            })
                            result.append(prompt_info)
                    except Prompt.DoesNotExist:
                        pass
                else:
                    prompt_info.update({
                        "name": chatbot_prompt.prompt_name,
                        "prompt_content": chatbot_prompt.prompt_content
                    })
                    result.append(prompt_info)
            
            return result
        except Exception as e:
            return []
    
    @staticmethod
    @handle_transaction
    def bind_prompt_to_chatbot(chatbot_id: str, prompt_type: str, prompt_source: str, 
                               prompt_id: str = None, prompt_name: str = None, 
                               prompt_content: str = None, sort_order: int = 0,
                               prompt_binding_id: str = None):
        """
        绑定提示词到机器人
        
        Args:
            chatbot_id: 机器人ID
            prompt_type: 提示词类型：system/user
            prompt_source: 提示词来源：library/manual
            prompt_id: 提示词ID（来自提示词库时必填）
            prompt_name: 提示词名称（手动输入时必填）
            prompt_content: 提示词内容（手动输入时必填）
            sort_order: 排序序号
            prompt_binding_id: 提示词绑定ID（编辑时必填）
            
        Returns:
            ChatbotPrompt: 绑定关系对象
            
        Raises:
            ResourceNotFoundError: 机器人或提示词不存在
        """
        try:
            try:
                chatbot = Chatbot.get_by_id(chatbot_id)
                if chatbot.deleted:
                    raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            except Chatbot.DoesNotExist:
                raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            
            if prompt_source == 'library':
                if not prompt_id:
                    raise ValueError("提示词来源为library时，prompt_id不能为空")
                try:
                    prompt = Prompt.get_by_id(prompt_id)
                    if prompt.deleted or not prompt.status:
                        raise ResourceNotFoundError(message=f"提示词 {prompt_id} 不存在或未启用")
                except Prompt.DoesNotExist:
                    raise ResourceNotFoundError(message=f"提示词 {prompt_id} 不存在")
            else:
                if not prompt_content:
                    raise ValueError("提示词来源为manual时，prompt_content不能为空")
            
            # 计算排序号
            if sort_order <= 0:
                # 获取相同类型下的最大排序号
                from peewee import fn
                max_sort_order = ChatbotPrompt.select(fn.MAX(ChatbotPrompt.sort_order)).where(
                    (ChatbotPrompt.chatbot_id == chatbot_id) &
                    (ChatbotPrompt.prompt_type == prompt_type) &
                    (ChatbotPrompt.deleted == False)
                ).scalar() or 0
                sort_order = max_sort_order + 1
            else:
                # 确保排序号不能小于1
                sort_order = max(1, sort_order)
            
            if prompt_binding_id:
                try:
                    chatbot_prompt = ChatbotPrompt.get_by_id(prompt_binding_id)
                    if chatbot_prompt.chatbot_id != chatbot_id:
                        raise ResourceNotFoundError(message=f"绑定关系不存在")
                    
                    chatbot_prompt.prompt_type = prompt_type
                    chatbot_prompt.prompt_source = prompt_source
                    chatbot_prompt.prompt_id = prompt_id if prompt_source == 'library' else None
                    chatbot_prompt.prompt_name = prompt_name if prompt_source == 'manual' else None
                    chatbot_prompt.prompt_content = prompt_content if prompt_source == 'manual' else None
                    chatbot_prompt.sort_order = sort_order
                    chatbot_prompt.save()
                    
                    return chatbot_prompt
                except ChatbotPrompt.DoesNotExist:
                    raise ResourceNotFoundError(message=f"绑定关系 {prompt_binding_id} 不存在")
            else:
                chatbot_prompt = ChatbotPrompt(
                    chatbot_id=chatbot_id,
                    prompt_type=prompt_type,
                    prompt_source=prompt_source,
                    prompt_id=prompt_id if prompt_source == 'library' else None,
                    prompt_name=prompt_name if prompt_source == 'manual' else None,
                    prompt_content=prompt_content if prompt_source == 'manual' else None,
                    sort_order=sort_order
                )
                chatbot_prompt.save(force_insert=True)
                
                return chatbot_prompt
        except Exception as e:
            raise
    
    @staticmethod
    @handle_transaction
    def unbind_prompt_from_chatbot(chatbot_id: str, prompt_binding_id: str):
        """
        解绑机器人的提示词
        
        Args:
            chatbot_id: 机器人ID
            prompt_binding_id: 提示词绑定ID
            
        Returns:
            bool: 解绑是否成功
            
        Raises:
            ResourceNotFoundError: 绑定关系不存在
        """
        try:
            chatbot_prompt = ChatbotPrompt.select().where(
                (ChatbotPrompt.id == prompt_binding_id) &
                (ChatbotPrompt.chatbot_id == chatbot_id) &
                (ChatbotPrompt.deleted == False)
            ).first()
            
            if not chatbot_prompt:
                raise ResourceNotFoundError(message=f"提示词绑定关系 {prompt_binding_id} 不存在")
            
            ChatbotPrompt.delete().where(ChatbotPrompt.id == chatbot_prompt.id).execute()
            
            return True
        except Exception as e:
            raise
    
    @staticmethod
    @handle_transaction
    def update_prompt_sort_order(chatbot_id: str, prompt_binding_id: str, sort_order: int):
        """
        更新提示词排序
        
        Args:
            chatbot_id: 机器人ID
            prompt_binding_id: 提示词绑定ID
            sort_order: 新的排序值
            
        Returns:
            ChatbotPrompt: 绑定关系对象
            
        Raises:
            ResourceNotFoundError: 绑定关系不存在
        """
        try:
            chatbot_prompt = ChatbotPrompt.select().where(
                (ChatbotPrompt.id == prompt_binding_id) &
                (ChatbotPrompt.chatbot_id == chatbot_id) &
                (ChatbotPrompt.deleted == False)
            ).first()
            
            if not chatbot_prompt:
                raise ResourceNotFoundError(message=f"提示词绑定关系 {prompt_binding_id} 不存在")
            
            # 确保排序号不能小于1
            sort_order = max(1, sort_order)
            chatbot_prompt.sort_order = sort_order
            chatbot_prompt.updated_at = datetime.now()
            chatbot_prompt.save()
            
            return chatbot_prompt
        except Exception as e:
            raise
    
    @staticmethod
    def get_chatbot_tools(chatbot_id: str):
        """
        获取机器人绑定的工具列表

        按绑定记录返回，每条记录包含 tool_type、configs 及对应类型的工具详情。
        MCP类型按服务分组并补充服务信息；其它类型尽量补充工具名称等信息。

        Args:
            chatbot_id: 机器人ID

        Returns:
            list: 绑定的工具信息列表
        """
        try:
            chatbot_tools = ChatbotTool.select().where(
                (ChatbotTool.chatbot_id == chatbot_id) &
                (ChatbotTool.deleted == False)
            )

            result = []
            for cb_tool in chatbot_tools:
                tool_type = cb_tool.tool_type or "mcp"
                configs = cb_tool.configs
                if isinstance(configs, str):
                    try:
                        configs = json.loads(configs)
                    except Exception:
                        configs = {}
                if not isinstance(configs, dict):
                    configs = {}

                item = ChatbotService._enrich_tool_binding(tool_type, configs)
                item["id"] = str(cb_tool.id)
                item["tool_type"] = tool_type
                item["configs"] = configs
                result.append(item)
            return result
        except Exception as e:
            return []

    @staticmethod
    def _enrich_tool_binding(tool_type: str, configs: dict) -> dict:
        """根据工具类型补充绑定记录的展示信息（服务名/头像、工具列表）。"""
        item = {
            "server_id": configs.get("server_id", ""),
            "server_name": "",
            "server_code": "",
            "server_avatar": "",
            "tools": [],
        }
        try:
            if tool_type == "mcp":
                server_id = configs.get("server_id", "")
                tool_ids = configs.get("tool_ids", []) or []
                server = MCPServer.get_by_id(server_id) if server_id else None
                if server and not server.deleted:
                    item["server_name"] = server.name
                    item["server_code"] = server.code
                    item["server_avatar"] = server.avatar
                if tool_ids:
                    mcp_tools = list(MCPTool.select().where(
                        (MCPTool.id.in_(tool_ids)) & (MCPTool.deleted == False)
                    ))
                    for t in mcp_tools:
                        if not t.status:
                            continue
                        item["tools"].append({
                            "tool_id": str(t.id),
                            "tool_title": t.title,
                            "tool_name": t.name,
                            "tool_description": t.description,
                            "tool_type": t.tool_type,
                        })
            elif tool_type == "api":
                server_id = configs.get("server_id", "")
                api_ids = configs.get("api_ids", []) or configs.get("tool_ids", []) or []
                from app.database.models import ApiServer, Api
                server = ApiServer.get_by_id(server_id) if server_id else None
                if server and not server.deleted:
                    item["server_name"] = server.name
                    item["server_avatar"] = server.avatar
                if api_ids:
                    apis = list(Api.select().where(
                        (Api.id.in_(api_ids)) & (Api.deleted == False)
                    ))
                    for a in apis:
                        item["tools"].append({
                            "tool_id": str(a.id),
                            "tool_title": a.title or a.name,
                            "tool_name": a.name,
                            "tool_description": a.description,
                            "tool_type": "api",
                        })
            elif tool_type == "builtin_tool":
                from app.core.tools import ToolRegistry
                tool_names = configs.get("tool_names", []) or configs.get("tool_ids", []) or []
                item["server_name"] = "内置工具"
                for name in tool_names:
                    t = ToolRegistry.get_tool(name)
                    if t:
                        item["tools"].append({
                            "tool_id": name,
                            "tool_title": getattr(t, "title", name),
                            "tool_name": getattr(t, "name", name),
                            "tool_description": getattr(t, "description", ""),
                            "tool_type": "builtin_tool",
                        })
            elif tool_type in ("code_script", "skill"):
                # 代码脚本/SKILL：暂仅回填configs中的名称信息
                ids = configs.get("tool_ids", []) or []
                names = configs.get("tool_names", []) or []
                item["server_name"] = "code_script" if tool_type == "code_script" else "skill"
                for idx, tid in enumerate(ids):
                    item["tools"].append({
                        "tool_id": tid,
                        "tool_title": names[idx] if idx < len(names) else tid,
                        "tool_name": names[idx] if idx < len(names) else tid,
                        "tool_description": "",
                        "tool_type": tool_type,
                    })
        except Exception:
            pass
        return item

    @staticmethod
    def _binding_group_key(tool_type: str, configs: dict):
        """计算绑定记录的去重分组键，用于合并同组工具。"""
        if tool_type in ("mcp", "api"):
            return ("server", configs.get("server_id", ""))
        # builtin_tool / code_script / skill：同类型合并为一条
        return ("type", tool_type)

    @staticmethod
    def _merge_configs(tool_type: str, old_configs: dict, new_configs: dict) -> dict:
        """合并同组工具的configs（对工具ID列表取并集）。"""
        merged = dict(new_configs)
        id_keys = ["tool_ids", "api_ids", "tool_names"]
        for key in id_keys:
            old_list = old_configs.get(key, []) or []
            new_list = new_configs.get(key, []) or []
            if old_list or new_list:
                seen = []
                for x in old_list + new_list:
                    if x not in seen:
                        seen.append(x)
                merged[key] = seen
        # 保留server_id等非列表字段
        for k, v in old_configs.items():
            if k not in id_keys and k not in merged:
                merged[k] = v
        return merged

    @staticmethod
    @handle_transaction
    def bind_tool_to_chatbot(chatbot_id: str, tool_type: str, configs: dict):
        """
        绑定工具到机器人

        通用工具绑定：按 tool_type + configs 存储。同组（如同server）的工具
        会合并到同一条绑定记录中。

        Args:
            chatbot_id: 机器人ID
            tool_type: 工具类型（mcp/api/code_script/builtin_tool/skill）
            configs: 绑定配置，如 {"server_id": "...", "tool_ids": [...]}

        Returns:
            ChatbotTool: 绑定关系对象

        Raises:
            ResourceNotFoundError: 机器人不存在
        """
        try:
            # 检查机器人是否存在
            try:
                chatbot = Chatbot.get_by_id(chatbot_id)
                if chatbot.deleted:
                    raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            except Chatbot.DoesNotExist:
                raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")

            if not isinstance(configs, dict):
                configs = {}

            group_key = ChatbotService._binding_group_key(tool_type, configs)

            # 查找同组已有绑定记录
            existing = None
            bindings = ChatbotTool.select().where(
                (ChatbotTool.chatbot_id == chatbot_id) &
                (ChatbotTool.tool_type == tool_type) &
                (ChatbotTool.deleted == False)
            )
            for b in bindings:
                b_configs = b.configs
                if isinstance(b_configs, str):
                    try:
                        b_configs = json.loads(b_configs)
                    except Exception:
                        b_configs = {}
                if not isinstance(b_configs, dict):
                    b_configs = {}
                if ChatbotService._binding_group_key(tool_type, b_configs) == group_key:
                    existing = b
                    existing_configs = b_configs
                    break

            if existing:
                # 合并工具ID列表
                merged = ChatbotService._merge_configs(tool_type, existing_configs, configs)
                existing.configs = json.dumps(merged, ensure_ascii=False)
                existing.save()
                return existing

            # 创建新的绑定关系
            chatbot_tool = ChatbotTool(
                chatbot_id=chatbot_id,
                tool_type=tool_type,
                configs=json.dumps(configs, ensure_ascii=False),
            )
            chatbot_tool.save(force_insert=True)
            return chatbot_tool
        except Exception as e:
            raise

    @staticmethod
    @handle_transaction
    def unbind_tool_from_chatbot(chatbot_id: str, tool_binding_id: str):
        """
        解绑机器人的工具

        Args:
            chatbot_id: 机器人ID
            tool_binding_id: 工具绑定ID

        Returns:
            bool: 解绑是否成功

        Raises:
            ResourceNotFoundError: 绑定关系不存在
        """
        try:
            chatbot_tool = ChatbotTool.select().where(
                (ChatbotTool.id == tool_binding_id) &
                (ChatbotTool.chatbot_id == chatbot_id) &
                (ChatbotTool.deleted == False)
            ).first()

            if not chatbot_tool:
                raise ResourceNotFoundError(message=f"工具绑定关系 {tool_binding_id} 不存在")

            ChatbotTool.delete().where(ChatbotTool.id == chatbot_tool.id).execute()
            return True
        except Exception as e:
            raise
    
    @staticmethod
    def get_chatbot_knowledgebases(chatbot_id: str):
        """
        获取机器人绑定的知识库列表
        
        Args:
            chatbot_id: 机器人ID
            
        Returns:
            list: 绑定的知识库信息列表
        """
        try:
            chatbot_kbs = ChatbotKnowledgebase.select().where(
                (ChatbotKnowledgebase.chatbot_id == chatbot_id) &
                (ChatbotKnowledgebase.deleted == False)
            )
            
            knowledgebases = []
            for chatbot_kb in chatbot_kbs:
                try:
                    kb = Knowledgebase.get_by_id(chatbot_kb.knowledgebase_id)
                    if kb.deleted:
                        continue
                    
                    enabled_doc_num = KnowledgebaseDocument.select().where(
                        (KnowledgebaseDocument.kb_id == kb.id) &
                        (KnowledgebaseDocument.status == True) &
                        (KnowledgebaseDocument.deleted == False)
                    ).count()
                    
                    knowledgebases.append({
                        "binding_id": str(chatbot_kb.id),
                        "kb_id": str(kb.id),
                        "kb_name": kb.name,
                        "kb_code": kb.code,
                        "kb_description": kb.description,
                        "kb_avatar": kb.avatar,
                        "enabled_doc_num": enabled_doc_num,
                        "token_num": kb.token_num,
                        "chunk_num": kb.chunk_num
                    })
                except Knowledgebase.DoesNotExist:
                    continue
            
            return knowledgebases
        except Exception as e:
            raise
    
    @staticmethod
    @handle_transaction
    def bind_knowledgebase_to_chatbot(chatbot_id: str, knowledgebase_id: str):
        """
        绑定知识库到机器人
        
        Args:
            chatbot_id: 机器人ID
            knowledgebase_id: 知识库ID
            
        Returns:
            ChatbotKnowledgebase: 绑定关系对象，如果已绑定则返回None
            
        Raises:
            ResourceNotFoundError: 机器人或知识库不存在
        """
        try:
            try:
                chatbot = Chatbot.get_by_id(chatbot_id)
                if chatbot.deleted:
                    raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            except Chatbot.DoesNotExist:
                raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            
            try:
                kb = Knowledgebase.get_by_id(knowledgebase_id)
                if kb.deleted:
                    raise ResourceNotFoundError(message=f"知识库 {knowledgebase_id} 不存在")
            except Knowledgebase.DoesNotExist:
                raise ResourceNotFoundError(message=f"知识库 {knowledgebase_id} 不存在")
            
            existing = ChatbotKnowledgebase.select().where(
                (ChatbotKnowledgebase.chatbot_id == chatbot_id) &
                (ChatbotKnowledgebase.knowledgebase_id == knowledgebase_id) &
                (ChatbotKnowledgebase.deleted == False)
            ).first()
            
            if existing:
                return None
            
            chatbot_kb = ChatbotKnowledgebase(
                chatbot_id=chatbot_id,
                knowledgebase_id=knowledgebase_id
            )
            chatbot_kb.save(force_insert=True)
            
            return chatbot_kb
        except Exception as e:
            raise
    
    @staticmethod
    @handle_transaction
    def bind_knowledgebases_to_chatbot(chatbot_id: str, knowledgebase_ids: List[str]):
        """
        批量绑定知识库到机器人
        
        Args:
            chatbot_id: 机器人ID
            knowledgebase_ids: 知识库ID列表
            
        Returns:
            List[ChatbotKnowledgebase]: 绑定关系对象列表
            
        Raises:
            ResourceNotFoundError: 机器人不存在
        """
        try:
            try:
                chatbot = Chatbot.get_by_id(chatbot_id)
                if chatbot.deleted:
                    raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            except Chatbot.DoesNotExist:
                raise ResourceNotFoundError(message=f"机器人 {chatbot_id} 不存在")
            
            bindings = []
            for knowledgebase_id in knowledgebase_ids:
                try:
                    kb = Knowledgebase.get_by_id(knowledgebase_id)
                    if kb.deleted:
                        continue
                except Knowledgebase.DoesNotExist:
                    continue
                
                existing = ChatbotKnowledgebase.select().where(
                    (ChatbotKnowledgebase.chatbot_id == chatbot_id) &
                    (ChatbotKnowledgebase.knowledgebase_id == knowledgebase_id) &
                    (ChatbotKnowledgebase.deleted == False)
                ).first()
                
                if existing:
                    continue
                
                chatbot_kb = ChatbotKnowledgebase(
                    chatbot_id=chatbot_id,
                    knowledgebase_id=knowledgebase_id
                )
                chatbot_kb.save(force_insert=True)
                bindings.append(chatbot_kb)
            
            return bindings
        except Exception as e:
            raise
    
    @staticmethod
    @handle_transaction
    def unbind_knowledgebase_from_chatbot(chatbot_id: str, kb_binding_id: str):
        """
        解绑机器人的知识库
        
        Args:
            chatbot_id: 机器人ID
            kb_binding_id: 知识库绑定ID
            
        Returns:
            bool: 解绑是否成功
            
        Raises:
            ResourceNotFoundError: 绑定关系不存在
        """
        try:
            chatbot_kb = ChatbotKnowledgebase.select().where(
                (ChatbotKnowledgebase.id == kb_binding_id) &
                (ChatbotKnowledgebase.chatbot_id == chatbot_id) &
                (ChatbotKnowledgebase.deleted == False)
            ).first()
            
            if not chatbot_kb:
                raise ResourceNotFoundError(message=f"知识库绑定关系 {kb_binding_id} 不存在")
            
            ChatbotKnowledgebase.delete().where(ChatbotKnowledgebase.id == chatbot_kb.id).execute()
            
            return True
        except Exception as e:
            raise
