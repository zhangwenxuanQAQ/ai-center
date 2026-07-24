"""
机器人插件集成服务
"""

import json
import uuid
import logging
import io
import zipfile
import base64
import os
import mimetypes
from datetime import datetime
from typing import Optional, List, Dict, Any
from urllib.parse import quote
from pathlib import Path

from app.database.models import ChatbotIntegration, Chatbot, ChatbotChat, ChatbotChatMessage
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError
from app.constants.integration_constants import get_integration_default_configs
from app.configs.config import config
from app.core.integration.temp_chat_store import TempChatStore

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
INTEGRATION_ASSETS_DIR = PROJECT_ROOT / 'web' / 'src' / 'integration' / 'assets'


class ChatbotIntegrationService:
    """
    机器人插件集成服务类
    
    提供机器人插件集成的创建、查询、更新等操作
    """

    @staticmethod
    def _generate_api_key() -> str:
        """
        生成API密钥

        Returns:
            str: API密钥
        """
        return 'sk-' + uuid.uuid4().hex

    @staticmethod
    def _get_base_url() -> str:
        """
        获取当前后端服务的基础URL
        优先使用配置文件中的 server.api_base_url

        Returns:
            str: 基础URL
        """
        api_base_url = config.get('server', {}).get('api_base_url', '')
        if api_base_url:
            return api_base_url.rstrip('/')
        host = config.get('server', {}).get('host', 'localhost')
        port = config.get('server', {}).get('http_port', '0.0.0.0')
        return f'http://{host}:{port}'

    @staticmethod
    def _convert_avatar_to_base64(avatar_value: str) -> str:
        """
        将头像值转换为base64字符串

        处理以下几种情况：
        1. 空字符串：直接返回
        2. 已经是base64格式（以data:开头）：直接返回
        3. 本地相对路径（如/assets/integration/...）：从本地文件读取并转base64
        4. HTTP/HTTPS URL：通过请求获取并转base64

        Args:
            avatar_value: 头像值（可能是路径、URL或base64）

        Returns:
            str: base64格式的头像字符串，或原始值（如果转换失败）
        """
        if not avatar_value:
            return avatar_value

        if avatar_value.startswith('data:'):
            return avatar_value

        try:
            file_data = None
            mime_type = None

            if avatar_value.startswith('http://') or avatar_value.startswith('https://'):
                import urllib.request
                req = urllib.request.Request(avatar_value)
                with urllib.request.urlopen(req, timeout=10) as response:
                    file_data = response.read()
                    content_type = response.headers.get('Content-Type', '')
                    if content_type:
                        mime_type = content_type.split(';')[0].strip()
            elif avatar_value.startswith('/'):
                if avatar_value.startswith('/assets/integration/'):
                    filename = avatar_value.replace('/assets/integration/', '')
                    file_path = INTEGRATION_ASSETS_DIR / filename
                else:
                    filename = avatar_value.lstrip('/')
                    file_path = PROJECT_ROOT / 'web' / 'src' / filename

                if file_path.exists():
                    file_data = file_path.read_bytes()
                    mime_type, _ = mimetypes.guess_type(str(file_path))

            if file_data:
                if not mime_type:
                    mime_type = 'image/png'
                b64_str = base64.b64encode(file_data).decode('utf-8')
                return f'data:{mime_type};base64,{b64_str}'
        except Exception as e:
            logger.warning(f'头像转base64失败: {avatar_value}, 错误: {e}')

        return avatar_value

    @staticmethod
    def _convert_avatars_in_configs(configs: dict) -> dict:
        """
        遍历配置，将用户头像和机器人头像转为base64

        Args:
            configs: 配置字典

        Returns:
            dict: 转换后的配置字典
        """
        if not configs:
            return configs

        try:
            common_cfg = configs.get('interface_config', {}).get('common_config', {})
            if 'user_avatar' in common_cfg:
                common_cfg['user_avatar'] = ChatbotIntegrationService._convert_avatar_to_base64(common_cfg['user_avatar'])
            if 'bot_avatar' in common_cfg:
                common_cfg['bot_avatar'] = ChatbotIntegrationService._convert_avatar_to_base64(common_cfg['bot_avatar'])
        except Exception as e:
            logger.warning(f'转换配置中的头像失败: {e}')

        return configs

    @staticmethod
    @handle_transaction
    def create_or_update(chatbot_id: str, data: dict = None) -> ChatbotIntegration:
        """
        创建或更新集成配置

        Args:
            chatbot_id: 机器人ID
            data: 配置数据
            
        Returns:
            ChatbotIntegration: 集成配置对象
        """
        # 检查机器人是否存在
        try:
            chatbot = Chatbot.get(
                (Chatbot.id == chatbot_id) &
                (Chatbot.deleted == False)
            )
        except Chatbot.DoesNotExist:
            raise ResourceNotFoundError(message='机器人不存在')

        # 查找已有的集成配置
        try:
            integration = ChatbotIntegration.get(
                (ChatbotIntegration.chatbot_id == chatbot_id) &
                (ChatbotIntegration.deleted == False)
            )
            # 更新现有配置
            if data:
                if data.get('configs'):
                    user_configs = data['configs']
                    # 重新生成html_code：先获取默认配置作为基底，合并用户配置
                    try:
                        api_keys = json.loads(integration.api_key)
                        api_key = api_keys[0] if api_keys else ""
                    except (json.JSONDecodeError, TypeError):
                        api_key = ""
                    base_url = ChatbotIntegrationService._get_base_url()
                    full_configs = get_integration_default_configs(base_url, api_key)
                    # 合并用户配置
                    for key, value in user_configs.items():
                        if isinstance(value, dict) and key in full_configs:
                            full_configs[key].update(value)
                        else:
                            full_configs[key] = value
                    # 应用 fallback
                    sidebar_cfg = full_configs.get('interface_config', {}).get('sidebar', {})
                    if not sidebar_cfg.get('title'):
                        sidebar_cfg['title'] = chatbot.name or 'AI助手'
                    chat_cfg = full_configs.get('chat_config', {})
                    if not chat_cfg.get('welcome_messages') and chatbot.greeting:
                        chat_cfg['welcome_messages'] = [chatbot.greeting]
                    # 将用户头像和机器人头像转为base64
                    full_configs = ChatbotIntegrationService._convert_avatars_in_configs(full_configs)
                    # 重新生成html_code
                    full_configs['html_code'] = ChatbotIntegrationService._render_html_codes(full_configs, api_key, base_url)
                    integration.configs = json.dumps(full_configs)
                integration.save()
            logger.info(f"更新集成配置成功 - chatbot_id: {chatbot_id}")
            return integration
        except ChatbotIntegration.DoesNotExist:
            pass

        # 生成新的API密钥
        api_key = ChatbotIntegrationService._generate_api_key()
        base_url = ChatbotIntegrationService._get_base_url()

        # 生成默认配置
        default_configs = get_integration_default_configs(base_url, api_key)
        if data and data.get('configs'):
            # 合并用户自定义配置
            for key, value in data['configs'].items():
                if isinstance(value, dict) and key in default_configs:
                    default_configs[key].update(value)
                else:
                    default_configs[key] = value
        
        # fallback逻辑：title为空时取机器人名称，welcome_messages为空时取机器人欢迎语
        sidebar_cfg = default_configs.get('interface_config', {}).get('sidebar', {})
        if not sidebar_cfg.get('title') or sidebar_cfg.get('title') == 'AI助手':
            sidebar_cfg['title'] = chatbot.name or 'AI助手'
        chat_cfg = default_configs.get('chat_config', {})
        if not chat_cfg.get('welcome_messages') and chatbot.greeting:
            chat_cfg['welcome_messages'] = [chatbot.greeting]
        
        # 将用户头像和机器人头像转为base64
        default_configs = ChatbotIntegrationService._convert_avatars_in_configs(default_configs)
        
        # 生成html_code
        default_configs['html_code'] = ChatbotIntegrationService._render_html_codes(default_configs, api_key, base_url)
        
        integration = ChatbotIntegration(
            chatbot_id=chatbot_id,
            api_key=json.dumps([api_key]),
            openai_base_url=f"{base_url}/aicenter/api/v1",
            configs=json.dumps(default_configs)
        )
        integration.save(force_insert=True)
        logger.info(f"创建集成配置成功 - chatbot_id: {chatbot_id}")
        return integration

    @staticmethod
    def get_by_chatbot_id(chatbot_id: str) -> Optional[ChatbotIntegration]:
        """
        根据机器人ID获取集成配置

        Args:
            chatbot_id: 机器人ID
            
        Returns:
            ChatbotIntegration: 集成配置对象，不存在返回None
        """
        try:
            return ChatbotIntegration.get(
                (ChatbotIntegration.chatbot_id == chatbot_id) &
                (ChatbotIntegration.deleted == False)
            )
        except ChatbotIntegration.DoesNotExist:
            return None

    @staticmethod
    def get_by_api_key(api_key: str) -> Optional[ChatbotIntegration]:
        """
        根据API密钥获取集成配置

        Args:
            api_key: API密钥
            
        Returns:
            ChatbotIntegration: 集成配置对象，不存在返回None
        """
        try:
            integrations = ChatbotIntegration.select().where(
                ChatbotIntegration.deleted == False
            )
            for integration in integrations:
                try:
                    keys = json.loads(integration.api_key)
                    if api_key in keys:
                        return integration
                except (json.JSONDecodeError, TypeError):
                    continue
        except Exception as e:
            logger.error(f"根据API密钥查询集成配置失败: {str(e)}")
        return None

    @staticmethod
    @handle_transaction
    def regenerate_api_key(chatbot_id: str) -> ChatbotIntegration:
        """
        重新生成API密钥

        Args:
            chatbot_id: 机器人ID
            
        Returns:
            ChatbotIntegration: 更新后的集成配置对象
        """
        try:
            integration = ChatbotIntegration.get(
                (ChatbotIntegration.chatbot_id == chatbot_id) &
                (ChatbotIntegration.deleted == False)
            )
        except ChatbotIntegration.DoesNotExist:
            raise ResourceNotFoundError(message='集成配置不存在')

        new_api_key = ChatbotIntegrationService._generate_api_key()
        integration.api_key = json.dumps([new_api_key])
        
        # 更新配置中的API密钥引用
        base_url = ChatbotIntegrationService._get_base_url()
        new_configs = get_integration_default_configs(base_url, new_api_key)
        try:
            old_configs = json.loads(integration.configs) if integration.configs else {}
            # 保留用户的界面配置和聊天配置
            if 'interface_config' in old_configs:
                new_configs['interface_config'] = old_configs['interface_config']
            if 'chat_config' in old_configs:
                new_configs['chat_config'] = old_configs['chat_config']
        except (json.JSONDecodeError, TypeError):
            pass
        
        # 将用户头像和机器人头像转为base64
        new_configs = ChatbotIntegrationService._convert_avatars_in_configs(new_configs)
        
        # 重新生成html_code
        new_configs['html_code'] = ChatbotIntegrationService._render_html_codes(new_configs, new_api_key, base_url)
        integration.configs = json.dumps(new_configs)
        integration.save()
        logger.info(f"重新生成API密钥成功 - chatbot_id: {chatbot_id}")
        return integration

    @staticmethod
    def _render_html_codes(configs: dict, api_key: str, base_url: str) -> dict:
        """
        根据配置参数渲染HTML嵌入代码，将模板中的变量替换为实际值

        Args:
            configs: 完整配置参数
            api_key: API密钥
            base_url: 后端服务地址

        Returns:
            dict: 包含sidebar和iframe嵌入代码的字典
        """
        # 获取原始模板（未替换变量的）
        templates = get_integration_default_configs('', '')['html_code']

        # 从配置中提取实际值
        common_cfg = configs.get('interface_config', {}).get('common_config', {})
        sidebar_cfg = configs.get('interface_config', {}).get('sidebar', {})
        iframe_cfg = configs.get('interface_config', {}).get('iframe', {})

        theme_mode = common_cfg.get('theme_mode', 'light')
        color_theme = common_cfg.get('color_theme', 'default_blue')
        title = sidebar_cfg.get('title', 'AI助手')
        position = sidebar_cfg.get('position', 'bottom-right')
        width = sidebar_cfg.get('width', 400)
        height = sidebar_cfg.get('height', 600)
        resizable = 'true' if sidebar_cfg.get('resizable', True) else 'false'
        maximizable = 'true' if sidebar_cfg.get('maximizable', True) else 'false'
        iframe_width = iframe_cfg.get('width', '100%')
        iframe_height = iframe_cfg.get('height', '100%')

        # 替换变量
        sidebar_code = templates['sidebar'].format(
            api_key=api_key,
            base_url=base_url,
            color_theme=color_theme,
            theme_mode=theme_mode,
            position=position,
            title=title,
            width=width,
            height=height,
            resizable=resizable,
            maximizable=maximizable
        )

        iframe_code = templates['iframe'].format(
            api_key=api_key,
            base_url=base_url,
            color_theme=color_theme,
            theme_mode=theme_mode,
            title_encoded=quote(title, safe=''),
            iframe_width=iframe_width,
            iframe_height=iframe_height
        )

        return {
            'sidebar': sidebar_code,
            'iframe': iframe_code
        }

    @staticmethod
    def get_html_code(chatbot_id: str, integration_type: str = 'sidebar') -> str:
        """
        获取嵌入HTML代码

        Args:
            chatbot_id: 机器人ID
            integration_type: 集成类型（sidebar/iframe）
            
        Returns:
            str: HTML嵌入代码
        """
        integration = ChatbotIntegrationService.get_by_chatbot_id(chatbot_id)
        if not integration:
            raise ResourceNotFoundError(message='集成配置不存在')

        try:
            api_keys = json.loads(integration.api_key)
            api_key = api_keys[0] if api_keys else ""
        except (json.JSONDecodeError, TypeError):
            api_key = ""

        base_url = ChatbotIntegrationService._get_base_url()
        try:
            configs = json.loads(integration.configs) if integration.configs else {}
        except (json.JSONDecodeError, TypeError):
            configs = {}

        # 动态渲染html_code，确保变量替换为实际值
        html_codes = ChatbotIntegrationService._render_html_codes(configs, api_key, base_url)
        return html_codes.get(integration_type, '')

    @staticmethod
    @handle_transaction
    def reset_to_defaults(chatbot_id: str) -> ChatbotIntegration:
        """
        重置集成配置到默认状态

        保留API密钥，其他配置恢复默认值并保存到数据库

        Args:
            chatbot_id: 机器人ID
            
        Returns:
            ChatbotIntegration: 重置后的集成配置对象
        """
        try:
            integration = ChatbotIntegration.get(
                (ChatbotIntegration.chatbot_id == chatbot_id) &
                (ChatbotIntegration.deleted == False)
            )
        except ChatbotIntegration.DoesNotExist:
            raise ResourceNotFoundError(message='集成配置不存在')

        chatbot = None
        try:
            chatbot = Chatbot.get(
                (Chatbot.id == chatbot_id) &
                (Chatbot.deleted == False)
            )
        except Chatbot.DoesNotExist:
            pass
        
        try:
            api_keys = json.loads(integration.api_key)
            api_key = api_keys[0] if api_keys else ""
        except (json.JSONDecodeError, TypeError):
            api_key = ""
        
        base_url = ChatbotIntegrationService._get_base_url()
        default_configs = get_integration_default_configs(base_url, api_key)
        
        # fallback逻辑
        sidebar_cfg = default_configs.get('interface_config', {}).get('sidebar', {})
        if (not sidebar_cfg.get('title') or sidebar_cfg.get('title') == 'AI助手') and chatbot:
            sidebar_cfg['title'] = chatbot.name or 'AI助手'
        chat_cfg = default_configs.get('chat_config', {})
        if not chat_cfg.get('welcome_messages') and chatbot and chatbot.greeting:
            chat_cfg['welcome_messages'] = [chatbot.greeting]

        # 将用户头像和机器人头像转为base64
        default_configs = ChatbotIntegrationService._convert_avatars_in_configs(default_configs)

        # 重置 openai_base_url 为当前服务地址
        integration.openai_base_url = f"{base_url}/aicenter/api/v1"
        # 重新生成html_code
        default_configs['html_code'] = ChatbotIntegrationService._render_html_codes(default_configs, api_key, base_url)
        integration.configs = json.dumps(default_configs)
        integration.save()
        logger.info(f"重置集成配置成功 - chatbot_id: {chatbot_id}")
        return integration

    @staticmethod
    def list_chats(api_key_or_integration, keyword: Optional[str] = None, preview_token: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        获取该API密钥下的所有对话列表

        包括正式会话（数据库存储）和临时会话（Redis存储）。

        Args:
            api_key_or_integration: API密钥字符串 或 ChatbotIntegration 对象
            keyword: 搜索关键词（可选）
            
        Returns:
            List[Dict]: 对话列表
        """
        if isinstance(api_key_or_integration, str):
            integration = ChatbotIntegrationService.get_by_api_key(api_key_or_integration)
            if not integration:
                raise ResourceNotFoundError(message='API密钥无效')
        else:
            integration = api_key_or_integration

        query = ChatbotChat.select().where(
            ChatbotChat.integration_id == integration.id
        )

        if keyword and keyword.strip():
            keyword = keyword.strip()
            query = query.where(ChatbotChat.title.contains(keyword))

        chats = query.order_by(ChatbotChat.created_at.desc())

        result = []
        for chat in chats:
            title = chat.title or '新对话'
            msgs = []
            try:
                messages_data = chat.messages
                if isinstance(messages_data, str):
                    msgs = json.loads(messages_data)
                elif isinstance(messages_data, list):
                    msgs = messages_data
            except (json.JSONDecodeError, TypeError):
                pass

            first_content = ''
            if msgs and len(msgs) > 0:
                first_content = msgs[0].get('content', '')
                if len(first_content) > 50:
                    first_content = first_content[:50] + '...'

            result.append({
                'id': chat.id,
                'title': title,
                'created_at': chat.created_at.strftime('%Y-%m-%d %H:%M:%S') if chat.created_at else '',
                'updated_at': chat.updated_at.strftime('%Y-%m-%d %H:%M:%S') if hasattr(chat, 'updated_at') and chat.updated_at else '',
            })

        # 预览token隔离：不同preview_token使用不同的scope_id，数据互相隔离
        scope_id = f"{integration.id}:preview:{preview_token}" if preview_token else None
        temp_chats = TempChatStore.list_chats(integration.id, scope_id=scope_id)
        for temp_chat in temp_chats:
            temp_title = temp_chat.get('title', '临时对话')
            if keyword and keyword.strip() and keyword.strip() not in temp_title:
                continue
            result.append({
                'id': temp_chat.get('id', ''),
                'title': temp_title,
                'created_at': temp_chat.get('created_at', ''),
                'updated_at': temp_chat.get('updated_at', ''),
                'temporary': True,
            })

        return result

    @staticmethod
    def update_chat_title(api_key_or_integration, chat_id: str, title: str) -> Dict[str, Any]:
        """
        修改对话名称

        Args:
            api_key_or_integration: API密钥字符串 或 ChatbotIntegration 对象
            chat_id: 对话ID
            title: 新的对话名称
            
        Returns:
            Dict: 更新后的对话信息
        """
        if isinstance(api_key_or_integration, str):
            integration = ChatbotIntegrationService.get_by_api_key(api_key_or_integration)
            if not integration:
                raise ResourceNotFoundError(message='API密钥无效')
        else:
            integration = api_key_or_integration

        try:
            chat = ChatbotChat.get(
                (ChatbotChat.id == chat_id) &
                (ChatbotChat.integration_id == integration.id)
            )
            chat.title = title
            chat.save()
            return {
                'id': chat.id,
                'title': chat.title or '新对话',
                'created_at': chat.created_at.strftime('%Y-%m-%d %H:%M:%S') if chat.created_at else '',
                'updated_at': chat.updated_at.strftime('%Y-%m-%d %H:%M:%S') if hasattr(chat, 'updated_at') and chat.updated_at else '',
            }
        except ChatbotChat.DoesNotExist:
            raise ResourceNotFoundError(message='对话不存在')

    @staticmethod
    def delete_chat(api_key_or_integration, chat_id: str, preview_token: Optional[str] = None) -> bool:
        """
        删除对话

        Args:
            api_key_or_integration: API密钥字符串 或 ChatbotIntegration 对象
            chat_id: 对话ID
            preview_token: 预览token（可选），用于临时会话数据隔离
            
        Returns:
            bool: 是否删除成功
        """
        if isinstance(api_key_or_integration, str):
            integration = ChatbotIntegrationService.get_by_api_key(api_key_or_integration)
            if not integration:
                raise ResourceNotFoundError(message='API密钥无效')
        else:
            integration = api_key_or_integration

        # 临时会话：从Redis删除
        if chat_id.startswith('temp_'):
            scope_id = f"{integration.id}:preview:{preview_token}" if preview_token else None
            try:
                # 删除消息列表和聊天信息
                from app.core.integration.temp_chat_store import TempChatStore
                from app.database.redis_utils import redis_utils
                messages_key = TempChatStore._get_messages_key(scope_id or integration.id, chat_id)
                chat_key = TempChatStore._get_chat_key(scope_id or integration.id, chat_id)
                chats_list_key = TempChatStore._get_chats_list_key(scope_id or integration.id)
                # 从列表中移除
                if redis_utils.is_available:
                    redis_utils.client.lrem(chats_list_key, 0, chat_id)
                    redis_utils.client.delete(messages_key)
                    redis_utils.client.delete(chat_key)
                return True
            except Exception as e:
                logger.error(f"删除临时对话失败: {e}")
                raise ResourceNotFoundError(message='对话不存在')

        try:
            chat = ChatbotChat.get(
                (ChatbotChat.id == chat_id) &
                (ChatbotChat.integration_id == integration.id)
            )
            ChatbotChatMessage.delete().where(
                ChatbotChatMessage.chat_id == chat_id
            ).execute()
            chat.delete_instance()
            return True
        except ChatbotChat.DoesNotExist:
            raise ResourceNotFoundError(message='对话不存在')

    @staticmethod
    def get_configs_with_examples(chatbot_id: str) -> dict:
        """
        获取配置及示例代码等信息

        Args:
            chatbot_id: 机器人ID
            
        Returns:
            dict: 配置及示例代码等信息
        """
        integration = ChatbotIntegrationService.get_by_chatbot_id(chatbot_id)
        if not integration:
            # 如果集成配置不存在，返回空数据而不是抛出异常
            return {
                "integration": None,
                "configs": {}
            }
        
        base_url = ChatbotIntegrationService._get_base_url()
        
        try:
            api_keys = json.loads(integration.api_key)
            api_key = api_keys[0] if api_keys else ""
        except (json.JSONDecodeError, TypeError):
            api_key = ""
        
        # 获取默认配置（包含示例代码）
        default_configs = get_integration_default_configs(base_url, api_key)
        
        # 用用户的实际配置覆盖默认值
        try:
            configs = json.loads(integration.configs) if integration.configs else {}
        except (json.JSONDecodeError, TypeError):
            configs = {}
        
        # 构建最终配置：使用默认配置的api_config和html_code，但合并用户的界面和聊天配置
        fresh_configs = {
            'api_config': default_configs.get('api_config', {}),
            'interface_config': default_configs.get('interface_config', {}),
            'chat_config': default_configs.get('chat_config', {}),
            'html_code': default_configs.get('html_code', {}),
        }
        
        # 保留用户自定义的interface_config（深度合并）
        if "interface_config" in configs:
            for sub_key, sub_val in configs["interface_config"].items():
                if isinstance(sub_val, dict) and sub_key in fresh_configs.get("interface_config", {}):
                    fresh_configs["interface_config"][sub_key].update(sub_val)
                else:
                    fresh_configs["interface_config"][sub_key] = sub_val
        if "chat_config" in configs:
            for sub_key, sub_val in configs["chat_config"].items():
                fresh_configs["chat_config"][sub_key] = sub_val
        configs = fresh_configs
        
        # 应用fallback逻辑：title为空取机器人名称，welcome_messages为空取机器人欢迎语
        try:
            chatbot = Chatbot.get(
                (Chatbot.id == chatbot_id) &
                (Chatbot.deleted == False)
            )
            sidebar_cfg = configs.get('interface_config', {}).get('sidebar', {})
            if not sidebar_cfg.get('title') or sidebar_cfg.get('title') == 'AI助手':
                sidebar_cfg['title'] = chatbot.name or 'AI助手'
            chat_cfg = configs.get('chat_config', {})
            if not chat_cfg.get('welcome_messages') and chatbot.greeting:
                chat_cfg['welcome_messages'] = [chatbot.greeting]
        except Chatbot.DoesNotExist:
            pass
        
        # 重新渲染html_code，用合并后的配置参数替换变量
        configs['html_code'] = ChatbotIntegrationService._render_html_codes(configs, api_key, base_url)
        
        return {
            'integration': integration,
            'configs': configs,
        }

    @staticmethod
    def generate_widget_package(chatbot_id: str, widget_type: str = 'iframe') -> bytes:
        """
        生成独立可部署的聊天插件部署包（zip格式）

        Args:
            chatbot_id: 机器人ID
            widget_type: 插件类型（iframe/sidebar）
            
        Returns:
            bytes: zip压缩包内容
        """
        integration = ChatbotIntegrationService.get_by_chatbot_id(chatbot_id)
        if not integration:
            raise ResourceNotFoundError(message='集成配置不存在')
        
        try:
            api_keys = json.loads(integration.api_key)
            api_key = api_keys[0] if api_keys else ""
        except (json.JSONDecodeError, TypeError):
            api_key = ""
        
        base_url = ChatbotIntegrationService._get_base_url()
        
        # 读取用户自定义配置
        try:
            configs = json.loads(integration.configs) if integration.configs else {}
        except (json.JSONDecodeError, TypeError):
            configs = {}
        
        # 获取界面配置
        interface_cfg = configs.get('interface_config', {})
        common_cfg = interface_cfg.get('common_config', {})
        sidebar_cfg = interface_cfg.get('sidebar', {})
        iframe_cfg = interface_cfg.get('iframe', {})
        chat_cfg = configs.get('chat_config', {})
        
        theme_color = (sidebar_cfg if widget_type == 'sidebar' else iframe_cfg).get('theme', '#1677ff')
        color_theme = common_cfg.get('color_theme', 'default_blue')
        title = sidebar_cfg.get('title', 'AI助手')
        position = sidebar_cfg.get('position', 'bottom-right')
        ball_size = sidebar_cfg.get('size', 52)
        animation = sidebar_cfg.get('animation', 'bounce')
        panel_width = sidebar_cfg.get('width', 400)
        panel_height = sidebar_cfg.get('height', 600)
        input_placeholder = chat_cfg.get('input_placeholder', '请输入您的问题...')
        max_input_length = chat_cfg.get('max_input_length', 4000)
        welcome_messages = chat_cfg.get('welcome_messages', [])
        
        # 生成自包含HTML
        html_content = ChatbotIntegrationService._generate_standalone_html(
            api_key=api_key,
            base_url=base_url,
            widget_type=widget_type,
            theme_color=theme_color,
            color_theme=color_theme,
            title=title,
            position=position,
            ball_size=ball_size,
            animation=animation,
            panel_width=panel_width,
            panel_height=panel_height,
            input_placeholder=input_placeholder,
            max_input_length=max_input_length,
            welcome_messages=welcome_messages,
        )
        
        # 打包为zip
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('index.html', html_content)
            zf.writestr('README.txt', (
                f'AI助手插件部署包 ({widget_type})\n'
                f'================================\n\n'
                f'部署方法：\n'
                f'1. 将 index.html 文件放到您的项目目录中\n'
                f'2. 在浏览器中直接打开 index.html 即可使用\n'
                f'3. 或在您的网页中通过 iframe 引入：\n'
                f'   <iframe src="./index.html" style="width:100%;height:600px;border:none;"></iframe>\n\n'
                f'如果是悬浮球模式，也可以直接在任意 HTML 页面中引入 index.html 的内容。\n\n'
                f'API服务器地址: {base_url}\n'
                f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n'
            ))
        buf.seek(0)
        return buf.read()

    @staticmethod
    def _generate_standalone_html(
        api_key: str, base_url: str, widget_type: str,
        theme_color: str, color_theme: str, title: str, position: str,
        ball_size: int, animation: str, panel_width: int, panel_height: int,
        input_placeholder: str, max_input_length: int,
        welcome_messages: List[str],
    ) -> str:
        """生成自包含的独立HTML聊天插件页面"""
        welcome_json = json.dumps(welcome_messages, ensure_ascii=False)
        
        css = """
:root{--p:""" + theme_color + """;--ph:""" + theme_color + """cc;--bg:#fff;--bg2:#f5f5f5;--bg3:#fafafa;--t:#1f1f1f;--t2:#666;--t3:#999;--bd:#e8e8e8;--r:8px;--rl:12px;--sh:0 2px 8px rgba(0,0,0,.08);--shl:0 6px 24px rgba(0,0,0,.12)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:var(--t);background:var(--bg);height:100vh;overflow:hidden}
.ct{display:flex;width:100%;height:100%}
.hs{width:240px;border-right:1px solid var(--bd);display:flex;flex-direction:column;flex-shrink:0}
.hs.hd{display:none}
.hh{padding:12px 16px;border-bottom:1px solid var(--bd);font-weight:600;font-size:14px}
.hl{flex:1;overflow-y:auto;padding:8px}
.hi{padding:10px 12px;border-radius:var(--r);cursor:pointer;margin-bottom:4px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hi:hover{background:var(--bg2)}.hi.ac{background:var(--bg2);font-weight:500}
.ht{font-size:11px;color:var(--t3);margin-top:2px}
.nb{margin:8px;padding:8px;border:1px dashed var(--bd);border-radius:var(--r);background:transparent;color:var(--p);cursor:pointer;font-size:13px;text-align:center}
.nb:hover{background:var(--bg2)}
.ca{flex:1;display:flex;flex-direction:column;min-width:0}
.ch{padding:12px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px}
.tb{background:none;border:none;color:var(--t2);cursor:pointer;padding:4px 8px;border-radius:4px;font-size:16px}
.tb:hover{background:var(--bg2)}
.ct2{flex:1;font-size:14px;font-weight:600}
.ms{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px}
.mg{display:flex;gap:10px;max-width:85%;animation:fi .3s ease}
@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.mg.u{align-self:flex-end;flex-direction:row-reverse}
.av{width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600}
.av.u{background:var(--p);color:#fff}.av.a{background:var(--bg2);color:var(--t);border:1px solid var(--bd)}
.bb{padding:10px 14px;border-radius:var(--rl);line-height:1.6;font-size:14px;word-wrap:break-word}
.mg.u .bb{background:var(--p);color:#fff;border-bottom-right-radius:4px}
.mg.a .bb{background:var(--bg2);color:var(--t);border-bottom-left-radius:4px}
.bb pre{background:var(--bg3);border-radius:6px;padding:12px;margin:8px 0;overflow-x:auto;font-size:13px}
.bb code{font-family:Consolas,monospace;font-size:13px}
.bb p{margin:4px 0}
.wa{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--t2)}
.wt{font-size:20px;font-weight:600;color:var(--t)}
.wm{padding:8px 16px;background:var(--bg2);border-radius:var(--r);font-size:13px}
.ia{padding:12px 16px;border-top:1px solid var(--bd)}
.iw{display:flex;gap:8px;align-items:flex-end}
.iw textarea{flex:1;resize:none;border:1px solid var(--bd);border-radius:var(--r);padding:10px 12px;font-size:14px;font-family:inherit;line-height:1.5;background:var(--bg);color:var(--t);outline:none;min-height:44px;max-height:120px}
.iw textarea:focus{border-color:var(--p)}
.sb{width:40px;height:40px;border-radius:50%;border:none;background:var(--p);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.sb:hover:not(:disabled){opacity:.85;transform:scale(1.05)}.sb:disabled{opacity:.5;cursor:not-allowed}
.sb.st{background:#ff4d4f}
.ld{display:flex;align-items:center;justify-content:center;padding:4px}
.ld span{width:8px;height:8px;border-radius:50%;background:var(--p);margin:0 3px;animation:dp 1.4s ease-in-out infinite}
.ld span:nth-child(2){animation-delay:.2s}.ld span:nth-child(3){animation-delay:.4s}
@keyframes dp{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
""" + (
            f'.fb{{position:fixed;width:{ball_size}px;height:{ball_size}px;border-radius:50%;background:var(--p);color:#fff;cursor:grab;display:flex;align-items:center;justify-content:center;font-size:{int(ball_size*0.46)}px;box-shadow:var(--shl);z-index:99999;user-select:none;touch-action:none}}'
        ) + """
.fb:hover{box-shadow:0 8px 32px rgba(0,0,0,.2)}
.fb.br{bottom:48px;right:48px}.fb.bl{bottom:48px;left:48px}.fb.tr{top:48px;right:48px}.fb.tl{top:48px;left:48px}
.sp{position:fixed;z-index:99998;background:var(--bg);border-radius:var(--rl);box-shadow:var(--shl);overflow:hidden;transition:all .3s cubic-bezier(.16,1,.3,1)}
.sp.br{bottom:112px;right:48px}.sp.bl{bottom:112px;left:48px}.sp.tr{top:112px;right:48px}.sp.tl{top:112px;left:48px}
.sp.hd{opacity:0;transform:scale(.9);pointer-events:none}.sp.vs{opacity:1;transform:scale(1);pointer-events:all}
"""
        pos_class = {'bottom-right': 'br', 'bottom-left': 'bl', 'top-right': 'tr', 'top-left': 'tl'}.get(position, 'br')
        
        js = f"""
const C={{apiKey:"{api_key}",baseUrl:"{base_url}",theme:"{theme_color}",title:"{title}",type:"{widget_type}",pos:"{pos_class}",pw:{panel_width},ph:{panel_height},placeholder:"{input_placeholder}",maxLen:{max_input_length},welcome:{welcome_json}}};
let chatId=null,msgs=[],isOpen=false,loading=false,abortCtrl=null,histHidden=C.type==='sidebar';
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function renderMsgs(){{
  const mc=$('#msgs');if(!mc)return;
  if(msgs.length===0){{
    mc.innerHTML=`<div class="wa"><div class="wt">${{C.title}}</div>${{C.welcome.map(w=>`<div class="wm">${{w}}</div>`).join('')}}</div>`;
    return;
  }}
  mc.innerHTML=msgs.map(m=>`<div class="mg ${{m.role==='user'?'u':'a'}}"><div class="av ${{m.role==='user'?'u':'a'}}">${{m.role==='user'?'U':'AI'}}</div><div class="bb">${{m.role==='user'?esc(m.content):renderMd(m.content||'')}}</div></div>`).join('<div style="height:1px"></div>')+'<div id="me"></div>';
  const me=$('#me');if(me)me.scrollIntoView({{behavior:'smooth'}});
}}
function esc(s){{return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}}
function renderMd(s){{
  return s.replace(/```(\\w*)\\n([\\s\\S]*?)```/g,'<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
    .replace(/\\n/g,'<br>');
}}
async function loadChats(){{
  try{{const r=await fetch(C.baseUrl+'/aicenter/api/v1/chats',{{headers:{{'Authorization':'Bearer '+C.apiKey}}}});
  const d=await r.json();if(d.code===200&&d.data?.items){{
    const hl=$('#hl');if(!hl)return;
    hl.innerHTML=d.data.items.map(c=>`<div class="hi${{c.id===chatId?' ac':''}}" onclick="selChat('${{c.id}}')"><div>${{esc(c.title)}}</div><div class="ht">${{c.created_at||''}}</div></div>`).join('')||'<div style="text-align:center;padding:24px;color:#999;font-size:13px">暂无对话</div>';
  }}}}catch(e){{console.error(e)}}
}}
async function loadMsgs(id){{
  try{{const r=await fetch(C.baseUrl+'/aicenter/api/v1/chat/'+id+'/messages',{{headers:{{'Authorization':'Bearer '+C.apiKey}}}});
  const d=await r.json();if(d.code===200&&d.data?.items){{
    msgs=d.data.items.map(m=>({{id:m.id,role:m.role,content:m.content,status:'done'}}));
    chatId=id;renderMsgs();loadChats();
  }}}}catch(e){{console.error(e)}}
}}
async function sendMsg(){{
  const ta=$('#msg-input');if(!ta)return;
  const text=ta.value.trim();if(!text||loading)return;
  ta.value='';msgs.push({{role:'user',content:text,status:'done'}});renderMsgs();
  loading=true;const btn=$('#send-btn');if(btn)btn.disabled=true;
  abortCtrl=new AbortController();
  try{{
    const r=await fetch(C.baseUrl+'/aicenter/api/v1/chat/completions',{{
      method:'POST',headers:{{'Content-Type':'application/json','Authorization':'Bearer '+C.apiKey}},
      body:JSON.stringify({{query:[{{type:'text',content:text}}],stream:true,chat_id:chatId}}),
      signal:abortCtrl.signal
    }});
    const reader=r.body.getReader();const decoder=new TextDecoder();
    let buf='',aiMsg={{role:'assistant',content:'',status:'streaming'}};
    msgs.push(aiMsg);renderMsgs();
    while(true){{
      const {{done,value}}=await reader.read();if(done)break;
      buf+=decoder.decode(value,{{stream:true}});
      const lines=buf.split('\\n');buf=lines.pop();
      for(const line of lines){{
        if(!line.startsWith('data: '))continue;
        const data=line.slice(6).trim();if(data==='[DONE]')continue;
        try{{
          const j=JSON.parse(data);
          if(j.chat_id&&!chatId){{chatId=j.chat_id;}}
          if(j.content!==undefined){{aiMsg.content=j.content;aiMsg.status=j.status||'streaming';renderMsgs();}}
        }}catch(e){{}}
      }}
    }}
    aiMsg.status='done';renderMsgs();loadChats();
  }}catch(e){{if(e.name!=='AbortError'){{msgs.push({{role:'assistant',content:'网络错误，请重试',status:'done'}});renderMsgs();}}}}
  loading=false;if(btn)btn.disabled=false;
}}
function selChat(id){{chatId=id;loadMsgs(id);if(window.innerWidth<768){{document.querySelector('.hs').classList.add('hd');histHidden=true;}}}}
function newChat(){{chatId=null;msgs=[];renderMsgs();$$('.hi').forEach(h=>h.classList.remove('ac'));}}
function toggleHist(){{const hs=document.querySelector('.hs');if(!hs)return;histHidden=!histHidden;hs.classList.toggle('hd',histHidden);}}
function stopGen(){{if(abortCtrl)abortCtrl.abort();}}
document.addEventListener('DOMContentLoaded',function(){{
  if(C.type==='sidebar'){{
    const fb=document.createElement('div');fb.className='fb '+C.pos;fb.innerHTML='\U0001f4ac';
    let dragStart=null,hasMoved=false;
    fb.addEventListener('mousedown',function(e){{hasMoved=false;const r=fb.getBoundingClientRect();dragStart={{x:e.clientX,y:e.clientY,bx:r.left,by:r.top}};}});
    document.addEventListener('mousemove',function(e){{if(!dragStart)return;const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;if(Math.abs(dx)>3||Math.abs(dy)>3)hasMoved=true;fb.style.top=Math.max(0,Math.min(window.innerHeight-{ball_size},dragStart.by+dy))+'px';fb.style.left=Math.max(0,Math.min(window.innerWidth-{ball_size},dragStart.bx+dx))+'px';fb.style.bottom='auto';fb.style.right='auto';fb.style.cursor='grabbing';}});
    document.addEventListener('mouseup',function(){{if(!dragStart)return;dragStart=null;fb.style.cursor='grab';if(hasMoved)return;togglePanel();}});
    fb.addEventListener('touchstart',function(e){{const t=e.touches[0];hasMoved=false;const r=fb.getBoundingClientRect();dragStart={{x:t.clientX,y:t.clientY,bx:r.left,by:r.top}};}});
    document.addEventListener('touchmove',function(e){{if(!dragStart)return;const t=e.touches[0],dx=t.clientX-dragStart.x,dy=t.clientY-dragStart.y;if(Math.abs(dx)>3||Math.abs(dy)>3){{hasMoved=true;e.preventDefault();}}fb.style.top=Math.max(0,Math.min(window.innerHeight-{ball_size},dragStart.by+dy))+'px';fb.style.left=Math.max(0,Math.min(window.innerWidth-{ball_size},dragStart.bx+dx))+'px';fb.style.bottom='auto';fb.style.right='auto';}},{{passive:false}});
    document.addEventListener('touchend',function(){{if(!dragStart)return;dragStart=null;if(!hasMoved)togglePanel();}});
    function togglePanel(){{isOpen=!isOpen;const sp=$('.sp');sp.classList.toggle('vs',isOpen);sp.classList.toggle('hd',!isOpen);fb.innerHTML=isOpen?'\u2715':'\U0001f4ac';}}
    document.body.appendChild(fb);
    const sp=$('.sp');if(sp){{sp.classList.add('hd');}}
  }}
  const sendBtn=$('#send-btn');if(sendBtn)sendBtn.addEventListener('click',function(){{if(loading)stopGen();else sendMsg();}});
  const ta=$('#msg-input');if(ta)ta.addEventListener('keydown',function(e){{if(e.key==='Enter'&&!e.shiftKey){{e.preventDefault();sendMsg();}}}});
  const nb=$('#new-chat-btn');if(nb)nb.addEventListener('click',newChat);
  const tb=$('#toggle-hist');if(tb)tb.addEventListener('click',toggleHist);
  loadChats();renderMsgs();
}});
"""
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
<div class="ct">
  <div class="hs{' hd' if widget_type == 'iframe' else ''}">
    <div class="hh">{title}</div>
    <button id="new-chat-btn" class="nb">+ 新对话</button>
    <div class="hl" id="hl"></div>
  </div>
  <div class="ca">
    <div class="ch">
      <button id="toggle-hist" class="tb">☰</button>
      <div class="ct2">{title}</div>
    </div>
    <div class="ms" id="msgs"></div>
    <div class="ia">
      <div class="iw">
        <textarea id="msg-input" rows="1" placeholder="{input_placeholder}" maxlength="{max_input_length}"></textarea>
        <button id="send-btn" class="sb">➤</button>
      </div>
    </div>
  </div>
</div>
{'<div class="fb ' + pos_class + '" style="display:none"></div>' if widget_type == 'sidebar' else ''}
<div class="sp {' + pos_class + '}" style="width:{panel_width}px;height:{panel_height}px;display:none"></div>
<script>{js}</script>
</body>
</html>"""
        return html
