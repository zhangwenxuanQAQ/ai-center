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
from app.constants.llm_constants import MODEL_TYPE
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
                    health = es_utils.get_cluster_health()
                    cluster_stats = es_utils.get_cluster_stats()
                    
                    health_status = health.get("status", "unknown")
                    health_status_color = "normal" if health_status == "green" else ("warning" if health_status == "yellow" else "danger")
                    
                    active_shards_percent = health.get("active_shards_percent_as_number", 0)
                    shard_status = "normal" if active_shards_percent >= 95 else ("warning" if active_shards_percent >= 80 else "danger")
                    
                    unassigned_shards = health.get("unassigned_shards", 0)
                    pending_tasks = health.get("number_of_pending_tasks", 0)
                    
                    heap_used_gb = cluster_stats.get("heap_used_in_bytes", 0) / (1024 ** 3)
                    heap_max_gb = cluster_stats.get("heap_max_in_bytes", 0) / (1024 ** 3)
                    heap_usage_percent = (heap_used_gb / heap_max_gb * 100) if heap_max_gb > 0 else 0
                    heap_status = "normal" if heap_usage_percent < 70 else ("warning" if heap_usage_percent < 85 else "danger")
                    
                    store_size_gb = cluster_stats.get("store_size_in_bytes", 0) / (1024 ** 3)
                    
                    es_info['monitor_info'] = {
                        "status": "connected",
                        "version": version,
                        "metrics": [
                            {"name_en": "cluster_health", "name_zh": "集群健康", "value": health_status.upper(), "unit": "", "status": health_status_color, "description": "Elasticsearch集群的整体健康状态，green表示所有分片正常，yellow表示部分副本未分配，red表示主分片不可用"},
                            {"name_en": "nodes_count", "name_zh": "节点数", "value": health.get("number_of_nodes", 0), "unit": "个", "status": "normal", "description": "集群中的节点总数"},
                            {"name_en": "data_nodes", "name_zh": "数据节点", "value": health.get("number_of_data_nodes", 0), "unit": "个", "status": "normal", "description": "集群中的数据节点数量"},
                            {"name_en": "active_shards", "name_zh": "活跃分片", "value": health.get("active_shards", 0), "unit": "个", "status": shard_status, "description": "当前活跃的分片总数"},
                            {"name_en": "active_primary_shards", "name_zh": "活跃主分片", "value": health.get("active_primary_shards", 0), "unit": "个", "status": shard_status, "description": "当前活跃的主分片数量"},
                            {"name_en": "unassigned_shards", "name_zh": "未分配分片", "value": unassigned_shards, "unit": "个", "status": "normal" if unassigned_shards == 0 else "danger", "description": "未分配的分片数量，非零表示集群存在问题"},
                            {"name_en": "pending_tasks", "name_zh": "待处理任务", "value": pending_tasks, "unit": "个", "status": "normal" if pending_tasks == 0 else "warning", "description": "集群中等待执行的任务数量"},
                            {"name_en": "heap_usage", "name_zh": "堆内存使用", "value": f"{heap_usage_percent:.1f}%", "unit": "", "status": heap_status, "description": f"JVM堆内存使用率，当前使用 {heap_used_gb:.2f} GB / {heap_max_gb:.2f} GB"},
                        ],
                        "stats": [
                            {"name_en": "indices_count", "name_zh": "索引数量", "value": cluster_stats.get("indices_count", 0), "unit": "个", "description": "集群中的索引总数"},
                            {"name_en": "docs_count", "name_zh": "文档总数", "value": cluster_stats.get("docs_count", 0), "unit": "个", "description": "集群中的文档总数"},
                            {"name_en": "store_size", "name_zh": "存储大小", "value": f"{store_size_gb:.2f}", "unit": "GB", "description": "集群占用的存储空间"},
                            {"name_en": "total_shards", "name_zh": "总分片数", "value": cluster_stats.get("shards_total", 0), "unit": "个", "description": "集群中的总分片数量"},
                            {"name_en": "primary_shards", "name_zh": "主分片数", "value": cluster_stats.get("shards_primaries", 0), "unit": "个", "description": "集群中的主分片数量"},
                            {"name_en": "relocating_shards", "name_zh": "迁移中分片", "value": health.get("relocating_shards", 0), "unit": "个", "description": "正在迁移的分片数量"},
                            {"name_en": "initializing_shards", "name_zh": "初始化分片", "value": health.get("initializing_shards", 0), "unit": "个", "description": "正在初始化的分片数量"},
                        ]
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

        try:
            mcp_config = app_config.config.get('mcp', {})
            mcp_enabled = mcp_config.get('enabled', True)
            mcp_host = mcp_config.get('host', '127.0.0.1')
            mcp_port = mcp_config.get('port', 8082)

            mcp_info = {
                "name": "MCP Server",
                "type": "mcp",
                "host": mcp_host,
                "port": mcp_port,
                "monitor_info": {
                    "status": "disconnected",
                    "version": "",
                    "metrics": [
                        {"name_en": "mcp_status", "name_zh": "服务状态", "value": "未运行", "unit": "", "status": "danger", "description": "MCP Server服务未启动"}
                    ],
                    "stats": []
                }
            }

            if not mcp_enabled:
                mcp_info['monitor_info']['metrics'] = [
                    {"name_en": "mcp_status", "name_zh": "服务状态", "value": "已禁用", "unit": "", "status": "warning", "description": "MCP Server已禁用"}
                ]
            else:
                try:
                    import asyncio
                    from app.core.mcp.client.client import MCPClientFactory, StreamableHttpClient
                    
                    mcp_url = f'http://{mcp_host}:{mcp_port}/mcp'
                    
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    client = MCPClientFactory.create_client(
                        transport_type='streamable_http',
                        url=mcp_url
                    )
                    
                    tools_count = 0
                    server_version = '1.0.0'
                    
                    async def get_mcp_info():
                        nonlocal tools_count, server_version
                        async with client.connect():
                            tools = await client.list_tools()
                            tools_count = len(tools)
                            if client.session and hasattr(client.session, '_initialized'):
                                init_result = getattr(client.session, '_init_result', None)
                                if init_result and hasattr(init_result, 'serverInfo'):
                                    server_version = getattr(init_result.serverInfo, 'version', '1.0.0')
                    
                    loop.run_until_complete(get_mcp_info())
                    
                    mcp_info['monitor_info']['status'] = 'connected'
                    mcp_info['monitor_info']['version'] = server_version
                    mcp_info['monitor_info']['metrics'] = [
                        {"name_en": "mcp_status", "name_zh": "服务状态", "value": "运行中", "unit": "", "status": "normal", "description": "MCP Server服务运行状态"},
                        {"name_en": "tools_count", "name_zh": "工具数量", "value": tools_count, "unit": "个", "status": "normal", "description": "MCP Server提供的工具数量"}
                    ]
                except Exception as e:
                    mcp_info['monitor_info']['metrics'] = [
                        {"name_en": "mcp_status", "name_zh": "服务状态", "value": "异常", "unit": "", "status": "danger", "description": str(e)}
                    ]

            databases.append(mcp_info)
        except Exception as e:
            logger.error(f"获取MCP Server状态失败: {e}")

        return databases

    @staticmethod
    def get_server_status() -> List[Dict[str, Any]]:
        """获取服务状态（别名方法，与get_database_status相同）"""
        return MonitorService.get_database_status()

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
                type_label = MODEL_TYPE.get(mt, mt)
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

    @staticmethod
    def get_mcp_server_monitor() -> List[Dict[str, Any]]:
        """
        获取所有MCP Server的监控信息
        
        Returns:
            List[Dict[str, Any]]: MCP Server监控信息列表
        """
        result = []
        try:
            mcp_servers = MCPServer.select().where(MCPServer.deleted == False)
            tools_count = MCPTool.select().where(MCPTool.deleted == False).count()
            
            for server in mcp_servers:
                server_tools_count = MCPTool.select().where(
                    (MCPTool.server_id == server.id) & (MCPTool.deleted == False)
                ).count()
                
                server_info = {
                    "id": server.id,
                    "name": server.name,
                    "host": server.host,
                    "port": server.port,
                    "status": "connected",
                    "error": None,
                    "tools_count": server_tools_count,
                    "version": server.version or "unknown",
                    "available_tools": [],
                    "metrics": [
                        {"name_en": "tools_count", "name_zh": "工具数量", "value": server_tools_count, "unit": "个", "status": "normal", "description": "该MCP Server注册的工具数量"},
                        {"name_en": "server_version", "name_zh": "服务版本", "value": server.version or "unknown", "unit": "", "status": "normal", "description": "MCP Server的版本号"},
                    ],
                }
                result.append(server_info)
        except Exception as e:
            logger.error(f"获取MCP Server监控信息失败: {e}")
        
        return result
