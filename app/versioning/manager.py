"""
版本管理器
负责加载模块配置、解析依赖关系、提供版本控制查询接口
"""

import os
import yaml
import logging
from typing import List, Dict, Optional, Set

logger = logging.getLogger(__name__)


class ModuleConfig:
    """单个模块的配置信息"""

    def __init__(self, name: str, config: dict):
        self.name = name
        self.display_name = config.get('name', name)
        self.description = config.get('description', '')
        self.required = config.get('required', False)
        self.api_prefixes: List[str] = config.get('api_prefixes', [])
        self.frontend_routes: List[str] = config.get('frontend_routes', [])
        self.menu_keys: List[str] = config.get('menu_keys', [])
        self.database_tables: List[str] = config.get('database_tables', [])
        self.dependencies: List[str] = config.get('dependencies', [])

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'required': self.required,
            'api_prefixes': self.api_prefixes,
            'frontend_routes': self.frontend_routes,
            'menu_keys': self.menu_keys,
            'database_tables': self.database_tables,
            'dependencies': self.dependencies,
        }

    def to_frontend_dict(self) -> dict:
        """转换为前端可用的字典"""
        return {
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'required': self.required,
            'api_prefixes': self.api_prefixes,
            'frontend_routes': self.frontend_routes,
            'menu_keys': self.menu_keys,
            'dependencies': self.dependencies,
        }


class VersionManager:
    """版本管理器
    负责加载模块配置、解析传递依赖、提供查询接口
    """

    def __init__(self, config_path: str = None):
        self._modules: Dict[str, ModuleConfig] = {}
        self._enabled_modules: Set[str] = set()
        self._config_loaded = False
        self._config = {}

        if config_path is None:
            # 默认配置路径
            # __file__ = app/versioning/manager.py
            # dirname(__file__) = app/versioning/
            # dirname(...) = app/
            # dirname(...) = ai-center/ (项目根目录)
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            config_path = os.path.join(project_root, 'configs', 'modules_config.yaml')

        self._config_path = config_path

    def load_config(self, config_path: str = None):
        """
        加载模块配置文件

        Args:
            config_path: 配置文件路径，为None时使用默认路径
        """
        if config_path:
            self._config_path = config_path

        logger.info(f"[VERSION] 正在加载模块配置文件: {self._config_path}")

        if not os.path.exists(self._config_path):
            logger.warning(f"[VERSION] 模块配置文件不存在: {self._config_path}")
            logger.warning("[VERSION] 将启用所有模块作为默认行为")
            self._enable_all_modules()
            return

        try:
            with open(self._config_path, 'r', encoding='utf-8') as f:
                self._config = yaml.safe_load(f)

            # 解析模块定义
            raw_modules = self._config.get('modules', {})
            if raw_modules:
                for name, config in raw_modules.items():
                    self._modules[name] = ModuleConfig(name, config)
            else:
                # 简化结构配置（没有 modules 定义），使用默认模块定义
                logger.info("[VERSION] 配置中未找到 modules 定义，使用默认模块定义")
                self._init_default_modules()

            # 获取初始启用的模块列表
            # 兼容两种配置结构：
            # 1. 完整结构: version: {name: "xxx", enabled_modules: [...]}
            # 2. 简化结构: version: "1.0", enabled_modules: [...] （在顶层）
            initial_enabled = self._get_enabled_modules_from_config()

            if not initial_enabled:
                # 如果没有指定启用模块，启用所有模块
                logger.info("[VERSION] 未指定启用模块，启用所有模块")
                self._enable_all_modules()
                return

            # 解析依赖关系，确定最终启用的模块集合
            resolved = self._resolve_dependencies(set(initial_enabled))

            # 确保所有必需模块都被启用
            for name, mod in self._modules.items():
                if mod.required and name not in resolved:
                    logger.info(f"[VERSION] 自动启用地核心模块: {name}")
                    resolved.add(name)
                    # 再次解析依赖
                    resolved = self._resolve_dependencies(resolved)

            self._enabled_modules = resolved
            self._config_loaded = True

            logger.info(f"[VERSION] 已启用 {len(self._enabled_modules)} 个模块: {sorted(self._enabled_modules)}")

        except Exception as e:
            logger.error(f"[VERSION] 加载模块配置失败: {e}")
            logger.warning("[VERSION] 将启用所有模块作为降级行为")
            self._enable_all_modules()

    def _get_enabled_modules_from_config(self) -> list:
        """
        从配置中获取启用的模块列表
        
        兼容两种配置结构：
        1. 完整结构 (configs/modules_config.yaml):
           version:
             name: "full"
             enabled_modules: [...]
        
        2. 简化结构 (docker/versions/*/modules_config.yaml):
           version: "1.0"
           enabled_modules: [...]  # 在顶层
        """
        # 尝试方式1: 从 version.enabled_modules 获取（完整结构）
        version_config = self._config.get('version', {})
        if isinstance(version_config, dict):
            enabled = version_config.get('enabled_modules', [])
            if enabled:
                return enabled
        
        # 尝试方式2: 从顶层 enabled_modules 获取（简化结构）
        enabled = self._config.get('enabled_modules', [])
        if enabled:
            return enabled
        
        # 没有找到
        return []

    def _enable_all_modules(self):
        """启用所有模块"""
        if not self._modules:
            # 如果没有从配置文件加载模块定义，添加默认模块
            self._init_default_modules()
        self._enabled_modules = set(self._modules.keys())
        self._config_loaded = True

    def _init_default_modules(self):
        """初始化默认模块定义（当配置文件不存在时使用）"""
        default_modules = {
            'user': {'name': '用户管理', 'description': '用户账号管理', 'required': True,
                     'api_prefixes': ['/user'], 'frontend_routes': ['/users'],
                     'menu_keys': ['user'], 'database_tables': ['user'], 'dependencies': []},
            'llm_model': {'name': '模型管理', 'description': '大语言模型配置', 'required': False,
                          'api_prefixes': ['/llm_model'], 'frontend_routes': ['/llm_models', '/llm_model/setting/:id'],
                          'menu_keys': ['llm_model'], 'database_tables': ['llm_model', 'llm_category'], 'dependencies': []},
            'prompt': {'name': '提示词', 'description': '系统提示词模板', 'required': False,
                       'api_prefixes': ['/prompt'], 'frontend_routes': ['/prompts', '/prompt/setting/:id'],
                       'menu_keys': ['prompt'], 'database_tables': ['prompt', 'prompt_category'], 'dependencies': []},
            'datasource': {'name': '数据源', 'description': '外部数据源连接配置', 'required': False,
                           'api_prefixes': ['/datasource', '/datasource_category'], 'frontend_routes': ['/datasources'],
                           'menu_keys': ['datasource'], 'database_tables': ['datasource', 'datasource_category'], 'dependencies': []},
            'knowledgebase': {'name': '知识库', 'description': '文档知识库、向量检索', 'required': False,
                              'api_prefixes': ['/knowledgebase'], 'frontend_routes': ['/knowledgebases', '/knowledgebase/create', '/knowledgebase/detail/:id'],
                              'menu_keys': ['knowledgebase'], 'database_tables': ['knowledgebase', 'knowledgebase_category', 'knowledgebase_document'], 'dependencies': ['llm_model']},
            'mcp': {'name': 'MCP服务', 'description': 'MCP服务管理', 'required': False,
                    'api_prefixes': ['/mcp'], 'frontend_routes': ['/mcps', '/mcp/setting/:id'],
                    'menu_keys': ['mcp'], 'database_tables': ['mcp_server', 'mcp_category', 'mcp_tool'], 'dependencies': []},
            'toolkit': {'name': '工具箱', 'description': '自定义工具和API', 'required': False,
                        'api_prefixes': ['/toolkit'], 'frontend_routes': ['/toolkit'],
                        'menu_keys': ['toolkit'], 'database_tables': ['toolkit_category'], 'dependencies': []},
            'chatbot': {'name': '机器人', 'description': 'AI机器人创建与配置', 'required': False,
                        'api_prefixes': ['/chatbot', '/chatbot_category'], 'frontend_routes': ['/chatbots', '/chatbot/setting/:id'],
                        'menu_keys': ['chatbot'], 'database_tables': ['chatbot', 'chatbot_category', 'chatbot_model'], 'dependencies': ['user', 'llm_model', 'prompt', 'knowledgebase', 'mcp', 'toolkit']},
            'chat': {'name': '聊天', 'description': '用户对话与消息', 'required': False,
                     'api_prefixes': ['/chat'], 'frontend_routes': ['/chats'],
                     'menu_keys': ['chat'], 'database_tables': ['chat', 'chat_message'], 'dependencies': ['user', 'llm_model', 'chatbot']},
            'agent': {'name': '智能体', 'description': 'Agent工作流编排', 'required': False,
                      'api_prefixes': ['/agent'], 'frontend_routes': ['/agents', '/agent/setting/:id'],
                      'menu_keys': ['agent'], 'database_tables': ['agent_instance', 'agent_category', 'agent_component'], 'dependencies': ['user', 'llm_model', 'chatbot']},
            'system_monitor': {'name': '系统监控', 'description': '系统运行状态监控', 'required': False,
                               'api_prefixes': ['/system'], 'frontend_routes': ['/system/monitor'],
                               'menu_keys': ['system_monitor'], 'database_tables': [], 'dependencies': ['user']},
            'integration': {'name': '插件集成', 'description': '第三方集成与API', 'required': False,
                            'api_prefixes': ['/integration'], 'frontend_routes': ['/integration/chat', '/integration/sidebar', '/integration/preview'],
                            'menu_keys': [], 'database_tables': ['chatbot_chat', 'chatbot_chat_message'], 'dependencies': ['user', 'llm_model', 'chatbot']},
            'ontology': {'name': '本体工作台', 'description': '本体对象与数据抽取', 'required': False,
                         'api_prefixes': ['/ontology'], 'frontend_routes': ['/ontology/objects', '/ontology/tasks'],
                         'menu_keys': ['ontology'], 'database_tables': ['ontology_object', 'ontology_task'], 'dependencies': ['user', 'datasource']},
            'task_center': {'name': '任务中心', 'description': '任务执行与日志管理', 'required': False,
                            'api_prefixes': ['/task_center'], 'frontend_routes': ['/task_center/tasks', '/task_center/logs'],
                            'menu_keys': ['task_center'], 'database_tables': ['task_info', 'task_log'], 'dependencies': ['user']},
        }
        for name, config in default_modules.items():
            self._modules[name] = ModuleConfig(name, config)

    def _resolve_dependencies(self, enabled: Set[str]) -> Set[str]:
        """
        解析传递依赖关系

        Args:
            enabled: 初始启用的模块集合

        Returns:
            包含所有传递依赖的最终模块集合
        """
        resolved = set(enabled)
        changed = True

        while changed:
            changed = False
            current = set(resolved)

            for module_name in current:
                if module_name not in self._modules:
                    continue

                module = self._modules[module_name]
                for dep in module.dependencies:
                    if dep not in resolved:
                        resolved.add(dep)
                        changed = True
                        logger.info(f"[VERSION] 由于 {module_name} 依赖 {dep}，自动启用 {dep}")

        return resolved

    def is_module_enabled(self, module_name: str) -> bool:
        """
        检查模块是否启用

        Args:
            module_name: 模块名称

        Returns:
            是否启用
        """
        if not self._config_loaded:
            self.load_config()

        return module_name in self._enabled_modules

    def get_enabled_modules(self) -> List[str]:
        """
        获取所有启用的模块列表

        Returns:
            启用的模块名称列表
        """
        if not self._config_loaded:
            self.load_config()

        return sorted(self._enabled_modules)

    def get_all_modules(self) -> Dict[str, ModuleConfig]:
        """
        获取所有模块定义

        Returns:
            所有模块配置字典
        """
        if not self._config_loaded:
            self.load_config()

        return self._modules

    def get_module_config(self, module_name: str) -> Optional[ModuleConfig]:
        """
        获取指定模块的配置

        Args:
            module_name: 模块名称

        Returns:
            模块配置，不存在返回None
        """
        return self._modules.get(module_name)

    def get_enabled_tables(self) -> Set[str]:
        """
        获取所有启用模块关联的数据库表

        Returns:
            数据库表名集合
        """
        if not self._config_loaded:
            self.load_config()

        tables = set()
        for module_name in self._enabled_modules:
            module = self._modules.get(module_name)
            if module:
                tables.update(module.database_tables)
        return tables

    def get_enabled_api_prefixes(self) -> Set[str]:
        """
        获取所有启用模块的API前缀

        Returns:
            API前缀集合
        """
        if not self._config_loaded:
            self.load_config()

        prefixes = set()
        for module_name in self._enabled_modules:
            module = self._modules.get(module_name)
            if module:
                prefixes.update(module.api_prefixes)
        return prefixes

    def get_enabled_frontend_routes(self) -> List[str]:
        """
        获取所有启用模块的前端路由

        Returns:
            前端路由列表
        """
        if not self._config_loaded:
            self.load_config()

        routes = []
        for module_name in self._enabled_modules:
            module = self._modules.get(module_name)
            if module:
                routes.extend(module.frontend_routes)
        return routes

    def get_enabled_menu_keys(self) -> List[str]:
        """
        获取所有启用模块的菜单键

        Returns:
            菜单键列表
        """
        if not self._config_loaded:
            self.load_config()

        keys = []
        for module_name in self._enabled_modules:
            module = self._modules.get(module_name)
            if module:
                keys.extend(module.menu_keys)
        return keys

    def get_module_dependencies(self, module_name: str) -> List[str]:
        """
        获取指定模块的直接依赖

        Args:
            module_name: 模块名称

        Returns:
            依赖的模块列表
        """
        module = self._modules.get(module_name)
        if module:
            return module.dependencies
        return []

    def get_transitive_dependencies(self, module_name: str) -> Set[str]:
        """
        获取指定模块的所有传递依赖

        Args:
            module_name: 模块名称

        Returns:
            所有传递依赖的模块集合
        """
        result = set()
        self._collect_dependencies(module_name, result)
        result.discard(module_name)
        return result

    def _collect_dependencies(self, module_name: str, collected: Set[str]):
        """
        递归收集依赖

        Args:
            module_name: 模块名称
            collected: 已收集的依赖集合
        """
        if module_name in collected:
            return

        module = self._modules.get(module_name)
        if not module:
            return

        collected.add(module_name)
        for dep in module.dependencies:
            self._collect_dependencies(dep, collected)

    def get_version_info(self) -> dict:
        """
        获取版本信息（用于前端展示）

        Returns:
            版本信息字典
        """
        if not self._config_loaded:
            self.load_config()

        # 兼容两种配置结构获取版本信息
        version_config = self._config.get('version', {})
        
        if isinstance(version_config, dict):
            # 完整结构: version: {name: "xxx", description: "xxx"}
            version_name = version_config.get('name', 'unknown')
            version_desc = version_config.get('description', '')
        else:
            # 简化结构: version: "1.0", description: "xxx"
            version_name = version_config if version_config else 'unknown'
            version_desc = self._config.get('description', '')

        modules_info = {}

        for module_name in self._enabled_modules:
            module = self._modules.get(module_name)
            if module:
                modules_info[module_name] = module.to_frontend_dict()

        return {
            'name': version_name,
            'description': version_desc,
            'enabled_modules': sorted(self._enabled_modules),
            'modules': modules_info,
        }

    def is_api_enabled(self, api_path: str) -> bool:
        """
        检查API路径是否属于启用的模块

        Args:
            api_path: API路径（如 /chatbot/list）

        Returns:
            是否启用
        """
        if not self._config_loaded:
            self.load_config()

        # 确保路径以 / 开头
        if not api_path.startswith('/'):
            api_path = '/' + api_path

        enabled_prefixes = self.get_enabled_api_prefixes()
        for prefix in enabled_prefixes:
            if api_path == prefix or api_path.startswith(prefix + '/'):
                return True

        return False

    def is_route_enabled(self, route_path: str) -> bool:
        """
        检查前端路由是否属于启用的模块

        Args:
            route_path: 前端路由路径

        Returns:
            是否启用
        """
        if not self._config_loaded:
            self.load_config()

        # 首页始终启用
        if route_path == '/' or route_path == '':
            return True

        # 集成页面特殊处理
        if route_path.startswith('/integration/'):
            return self.is_module_enabled('integration')

        enabled_routes = self.get_enabled_frontend_routes()

        # 检查是否匹配某个启用的路由
        for route in enabled_routes:
            # 精确匹配
            if route_path == route:
                return True
            # 参数化路由匹配（如 /chatbot/setting/:id）
            if ':id' in route:
                # 将 :id 替换为通配符进行匹配
                pattern = route.replace(':id', '[^/]+')
                import re
                if re.match(f'^{pattern}$', route_path):
                    return True

        return False