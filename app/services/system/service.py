"""
系统监控服务

提供系统版本、数据库状态、功能模块统计等监控信息
"""

import os
import logging
from typing import Any, Dict, List

from app.configs.config import config as app_config
from app.database.models import (
    Chatbot, Knowledgebase, KnowledgebaseDocument,
    LLMModel, MCPServer, MCPTool, Prompt, Datasource,
    ChatbotCategory, KnowledgebaseCategory, MCPCategory,
    PromptCategory, LLMCategory, DatasourceCategory
)
from app.database.es_utils import es_utils
from app.database.redis_utils import redis_utils
from app.database.storage.rustfs_utils import RustFSUtils
from app.core.datasource.factory import DatasourceFactory
from app.constants.datasource_constants import DatasourceType, DATASOURCE_TYPE_LABELS

logger = logging.getLogger(__name__)


class MonitorService:
    """
    系统监控服务类
    
    提供系统版本号、数据库状态、功能模块统计等监控信息的获取
    """

    @staticmethod
    def get_version() -> str:
        """
        获取系统版本号
        
        从项目根目录的PROJECT_VERSION文件读取版本信息
        
        Returns:
            str: 系统版本号
        """
        try:
            version_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                'PROJECT_VERSION'
            )
            if os.path.exists(version_path):
                with open(version_path, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            return "unknown"
        except Exception as e:
            logger.error(f"读取版本号失败: {e}")
            return "unknown"

    @staticmethod
    def get_database_status() -> List[Dict[str, Any]]:
        """
        获取系统数据库状态
        
        读取server_config.yaml中的数据库配置，并获取各数据库的监控信息
        敏感信息（密码等）不会返回
        
        Returns:
            List[Dict[str, Any]]: 数据库状态列表
        """
        databases = []

        mysql_config = app_config.config.get('mysql', {})
        if mysql_config:
            db_info = {
                "name": "MySQL",
                "type": "mysql",
                "host": mysql_config.get('host', ''),
                "port": mysql_config.get('port', 3306),
                "database": mysql_config.get('name', ''),
                "user": mysql_config.get('user', ''),
                "max_connections": mysql_config.get('max_connections', 0),
                "monitor_info": None,
            }
            try:
                ds_config = {
                    'host': mysql_config.get('host', 'localhost'),
                    'port': mysql_config.get('port', 3306),
                    'username': mysql_config.get('user', ''),
                    'password': mysql_config.get('password', ''),
                    'database': mysql_config.get('name', ''),
                    'charset': 'utf8mb4',
                }
                ds = DatasourceFactory.create(DatasourceType.MYSQL, ds_config)
                result = ds.get_monitor_info()
                if result.get('success'):
                    db_info['monitor_info'] = result.get('data')
                else:
                    db_info['monitor_info'] = {
                        "status": "disconnected",
                        "version": "",
                        "metrics": [],
                        "stats": [],
                        "error": result.get('message', '')
                    }
            except Exception as e:
                db_info['monitor_info'] = {
                    "status": "disconnected",
                    "version": "",
                    "metrics": [],
                    "stats": [],
                    "error": str(e)
                }
            databases.append(db_info)

        es_config = app_config.config.get('es', {})
        if es_config:
            es_info = {
                "name": "Elasticsearch",
                "type": "elasticsearch",
                "host": es_config.get('host', ''),
                "port": es_config.get('port', 9200),
                "monitor_info": None,
            }
            try:
                if es_utils.is_available:
                    version = es_utils.version
                    es_info['monitor_info'] = {
                        "status": "connected",
                        "version": version,
                        "metrics": [],
                        "stats": []
                    }
                else:
                    es_info['monitor_info'] = {
                        "status": "disconnected",
                        "version": "",
                        "metrics": [],
                        "stats": [],
                        "error": "ES服务不可用"
                    }
            except Exception as e:
                es_info['monitor_info'] = {
                    "status": "disconnected",
                    "version": "",
                    "metrics": [],
                    "stats": [],
                    "error": str(e)
                }
            databases.append(es_info)

        redis_config = app_config.config.get('redis', {})
        if redis_config:
            redis_info = {
                "name": "Redis",
                "type": "redis",
                "host": redis_config.get('host', ''),
                "port": redis_config.get('port', 6379),
                "db": redis_config.get('db', 0),
                "monitor_info": None,
            }
            try:
                if redis_utils.is_available:
                    info = redis_utils.info()
                    redis_info['monitor_info'] = {
                        "status": "connected",
                        "version": info.get('redis_version', '') if info else '',
                        "metrics": [
                            {"name_en": "connected_clients", "name_zh": "连接客户端数", "value": info.get('connected_clients', 0) if info else 0, "unit": "个", "status": "normal", "description": "当前连接到Redis服务器的客户端连接数"},
                            {"name_en": "ops_per_second", "name_zh": "每秒操作数", "value": info.get('instantaneous_ops_per_sec', 0) if info else 0, "unit": "次/秒", "status": "normal", "description": "Redis服务器当前每秒处理的命令数"},
                        ],
                        "stats": [
                            {"name_en": "redis_mode", "name_zh": "运行模式", "value": info.get('redis_mode', '') if info else '', "unit": "", "description": "Redis运行模式，如standalone、cluster等"},
                            {"name_en": "used_memory", "name_zh": "内存使用", "value": info.get('used_memory', '') if info else '', "unit": "", "description": "Redis服务器当前使用的内存字节数"},
                        ]
                    }
                else:
                    redis_info['monitor_info'] = {
                        "status": "disconnected",
                        "version": "",
                        "metrics": [],
                        "stats": [],
                        "error": "Redis服务不可用"
                    }
            except Exception as e:
                redis_info['monitor_info'] = {
                    "status": "disconnected",
                    "version": "",
                    "metrics": [],
                    "stats": [],
                    "error": str(e)
                }
            databases.append(redis_info)

        rustfs_config = app_config.config.get('rustfs', {})
        if rustfs_config:
            rustfs_info = {
                "name": "RustFS",
                "type": "rustfs",
                "host": rustfs_config.get('host', ''),
                "port": rustfs_config.get('port', 9000),
                "monitor_info": None,
            }
            try:
                rustfs_instance = RustFSUtils()
                if rustfs_instance.is_available:
                    ds_config = {
                        'endpoint_url': f"http://{rustfs_config.get('host', '127.0.0.1')}:{rustfs_config.get('port', 9000)}",
                        'access_key': rustfs_config.get('username', 'rustfsadmin'),
                        'secret_key': rustfs_config.get('password', 'rustfsadmin'),
                    }
                    ds = DatasourceFactory.create(DatasourceType.RUSTFS, ds_config)
                    result = ds.get_monitor_info()
                    if result.get('success'):
                        rustfs_info['monitor_info'] = result.get('data')
                    else:
                        rustfs_info['monitor_info'] = {
                            "status": "disconnected",
                            "version": "",
                            "metrics": [],
                            "stats": [],
                            "error": result.get('message', '')
                        }
                else:
                    rustfs_info['monitor_info'] = {
                        "status": "disconnected",
                        "version": "",
                        "metrics": [],
                        "stats": [],
                        "error": "RustFS服务不可用"
                    }
            except Exception as e:
                rustfs_info['monitor_info'] = {
                    "status": "disconnected",
                    "version": "",
                    "metrics": [],
                    "stats": [],
                    "error": str(e)
                }
            databases.append(rustfs_info)

        return databases

    @staticmethod
    def get_module_stats() -> Dict[str, Any]:
        """
        获取功能模块统计信息
        
        统计各功能模块的数量，包括机器人、知识库、文档、MCP服务、提示词、模型、数据源等
        
        Returns:
            Dict[str, Any]: 功能模块统计数据
        """
        try:
            chatbot_count = Chatbot.select().where(Chatbot.deleted == False).count()
        except Exception:
            chatbot_count = 0

        try:
            knowledgebase_count = Knowledgebase.select().where(Knowledgebase.deleted == False).count()
        except Exception:
            knowledgebase_count = 0

        try:
            document_count = KnowledgebaseDocument.select().where(KnowledgebaseDocument.deleted == False).count()
        except Exception:
            document_count = 0

        try:
            mcp_server_count = MCPServer.select().where(MCPServer.deleted == False).count()
        except Exception:
            mcp_server_count = 0

        try:
            mcp_tool_count = MCPTool.select().where(MCPTool.deleted == False).count()
        except Exception:
            mcp_tool_count = 0

        try:
            prompt_count = Prompt.select().where(Prompt.deleted == False).count()
        except Exception:
            prompt_count = 0

        try:
            model_count = LLMModel.select().where(LLMModel.deleted == False).count()
        except Exception:
            model_count = 0

        try:
            datasource_count = Datasource.select().where(Datasource.deleted == False).count()
        except Exception:
            datasource_count = 0

        return {
            "chatbot_count": chatbot_count,
            "knowledgebase_count": knowledgebase_count,
            "document_count": document_count,
            "mcp_server_count": mcp_server_count,
            "mcp_tool_count": mcp_tool_count,
            "prompt_count": prompt_count,
            "model_count": model_count,
            "datasource_count": datasource_count,
        }

    @staticmethod
    def _get_category_name(category_id: str, category_model, default_name: str = "未分类") -> str:
        """
        根据分类ID获取分类名称
        
        Args:
            category_id: 分类ID
            category_model: 分类模型类
            default_name: 未找到时的默认名称
            
        Returns:
            str: 分类名称
        """
        if not category_id:
            return default_name
        try:
            cat = category_model.get_or_none(
                (category_model.id == category_id) & (category_model.deleted == False)
            )
            return cat.name if cat else default_name
        except Exception:
            return default_name

    @staticmethod
    def get_chatbot_stats() -> List[Dict[str, Any]]:
        """
        获取机器人按分类统计信息
        
        Returns:
            List[Dict[str, Any]]: 每个分类下的机器人数量列表
        """
        try:
            chatbots = Chatbot.select().where(Chatbot.deleted == False)
            category_map = {}
            for cb in chatbots:
                name = MonitorService._get_category_name(cb.category_id, ChatbotCategory)
                if name not in category_map:
                    category_map[name] = 0
                category_map[name] += 1
            return [{"category": k, "count": v} for k, v in sorted(category_map.items(), key=lambda x: -x[1])]
        except Exception as e:
            logger.error(f"获取机器人分类统计失败: {e}")
            return []

    @staticmethod
    def get_knowledgebase_stats() -> Dict[str, Any]:
        """
        获取知识库按分类统计信息，包含每个知识库的文档数量
        
        Returns:
            Dict[str, Any]: 包含分类统计和知识库详情的数据
        """
        result = {"categories": [], "detail": []}
        try:
            knowledgebases = Knowledgebase.select().where(Knowledgebase.deleted == False)

            category_map = {}
            for kb in knowledgebases:
                name = MonitorService._get_category_name(kb.category_id, KnowledgebaseCategory)
                if name not in category_map:
                    category_map[name] = 0
                category_map[name] += 1

                doc_count = KnowledgebaseDocument.select().where(
                    (KnowledgebaseDocument.kb_id == kb.id) &
                    (KnowledgebaseDocument.deleted == False)
                ).count()
                result["detail"].append({
                    "name": kb.name,
                    "document_count": doc_count,
                    "category": name
                })

            result["categories"] = [{"category": k, "count": v} for k, v in sorted(category_map.items(), key=lambda x: -x[1])]
        except Exception as e:
            logger.error(f"获取知识库分类统计失败: {e}")
        return result

    @staticmethod
    def get_mcp_stats() -> List[Dict[str, Any]]:
        """
        获取MCP服务按分类统计信息
        
        Returns:
            List[Dict[str, Any]]: 每个分类下的MCP服务数量列表
        """
        try:
            servers = MCPServer.select().where(MCPServer.deleted == False)
            category_map = {}
            for server in servers:
                name = MonitorService._get_category_name(server.category_id, MCPCategory)
                if name not in category_map:
                    category_map[name] = 0
                category_map[name] += 1
            return [{"category": k, "count": v} for k, v in sorted(category_map.items(), key=lambda x: -x[1])]
        except Exception as e:
            logger.error(f"获取MCP服务分类统计失败: {e}")
            return []

    @staticmethod
    def get_prompt_stats() -> List[Dict[str, Any]]:
        """
        获取提示词按分类统计信息
        
        Returns:
            List[Dict[str, Any]]: 每个分类下的提示词数量列表
        """
        try:
            prompts = Prompt.select().where(Prompt.deleted == False)
            category_map = {}
            for p in prompts:
                name = MonitorService._get_category_name(p.category_id, PromptCategory)
                if name not in category_map:
                    category_map[name] = 0
                category_map[name] += 1
            return [{"category": k, "count": v} for k, v in sorted(category_map.items(), key=lambda x: -x[1])]
        except Exception as e:
            logger.error(f"获取提示词分类统计失败: {e}")
            return []

    @staticmethod
    def get_model_stats() -> Dict[str, Any]:
        """
        获取模型按分类和类型统计信息
        
        Returns:
            Dict[str, Any]: 包含分类统计和模型类型统计的数据
        """
        result = {"categories": [], "types": []}
        try:
            models = LLMModel.select().where(LLMModel.deleted == False)

            category_map = {}
            type_map = {}
            for m in models:
                cat_name = MonitorService._get_category_name(m.category_id, LLMCategory)
                if cat_name not in category_map:
                    category_map[cat_name] = 0
                category_map[cat_name] += 1

                mt = m.model_type or "未指定"
                type_label = {
                    "text": "文本",
                    "embedding": "向量嵌入",
                    "rerank": "重排序",
                    "image": "图像"
                }.get(mt, mt)
                if type_label not in type_map:
                    type_map[type_label] = 0
                type_map[type_label] += 1

            result["categories"] = [{"category": k, "count": v} for k, v in sorted(category_map.items(), key=lambda x: -x[1])]
            result["types"] = [{"type": k, "count": v} for k, v in sorted(type_map.items(), key=lambda x: -x[1])]
        except Exception as e:
            logger.error(f"获取模型分类统计失败: {e}")
        return result

    @staticmethod
    def get_datasource_stats() -> Dict[str, Any]:
        """
        获取数据源按分类和类型统计信息
        
        Returns:
            Dict[str, Any]: 包含分类统计和数据源类型统计的数据
        """
        result = {"categories": [], "types": []}
        try:
            datasources = Datasource.select().where(Datasource.deleted == False)

            category_map = {}
            type_map = {}
            for ds in datasources:
                cat_name = MonitorService._get_category_name(ds.category_id, DatasourceCategory)
                if cat_name not in category_map:
                    category_map[cat_name] = 0
                category_map[cat_name] += 1

                ds_type = ds.type or "未指定"
                type_label = DATASOURCE_TYPE_LABELS.get(ds_type, ds_type)
                if type_label not in type_map:
                    type_map[type_label] = 0
                type_map[type_label] += 1

            result["categories"] = [{"category": k, "count": v} for k, v in sorted(category_map.items(), key=lambda x: -x[1])]
            result["types"] = [{"type": k, "count": v} for k, v in sorted(type_map.items(), key=lambda x: -x[1])]
        except Exception as e:
            logger.error(f"获取数据源分类统计失败: {e}")
        return result
