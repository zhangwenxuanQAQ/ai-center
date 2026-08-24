/**
 * 版本配置服务
 * 获取当前版本的模块配置信息，用于前端条件性渲染菜单和路由
 */

import http from '../utils/request';

/**
 * 模块配置接口
 */
export interface ModuleInfo {
  name: string;
  display_name: string;
  description: string;
  required: boolean;
  api_prefixes: string[];
  frontend_routes: string[];
  menu_keys: string[];
  dependencies: string[];
}

/**
 * 版本信息接口
 */
export interface VersionInfo {
  name: string;
  description: string;
  enabled_modules: string[];
  modules: Record<string, ModuleInfo>;
}

// 缓存版本配置，避免重复请求
let cachedVersionInfo: VersionInfo | null = null;

/**
 * 获取当前版本配置
 * 优先从缓存获取，缓存不存在时从API获取
 */
export async function getVersionConfig(forceRefresh = false): Promise<VersionInfo> {
  if (cachedVersionInfo && !forceRefresh) {
    return cachedVersionInfo;
  }

  try {
    const data = await http.get<VersionInfo>('/aicenter/v1/version/config', { showError: false });
    cachedVersionInfo = data;
    return data;
  } catch (error) {
    console.warn('[VERSION] 获取版本配置失败，默认启用所有模块', error);
    // 返回默认配置（所有模块启用）
    return getDefaultVersionInfo();
  }
}

/**
 * 获取默认版本信息（所有模块启用）
 */
function getDefaultVersionInfo(): VersionInfo {
  const allModules: ModuleInfo[] = [
    {
      name: 'user', display_name: '用户管理', description: '用户账号管理',
      required: true, api_prefixes: ['/user'], frontend_routes: ['/users'],
      menu_keys: ['user'], dependencies: []
    },
    {
      name: 'llm_model', display_name: '模型管理', description: '大语言模型配置',
      required: false, api_prefixes: ['/llm_model'], frontend_routes: ['/llm_models', '/llm_model/setting/:id'],
      menu_keys: ['llm_model'], dependencies: []
    },
    {
      name: 'prompt', display_name: '提示词', description: '系统提示词模板',
      required: false, api_prefixes: ['/prompt'], frontend_routes: ['/prompts', '/prompt/setting/:id'],
      menu_keys: ['prompt'], dependencies: []
    },
    {
      name: 'datasource', display_name: '数据源', description: '外部数据源连接配置',
      required: false, api_prefixes: ['/datasource', '/datasource_category'], frontend_routes: ['/datasources'],
      menu_keys: ['datasource'], dependencies: []
    },
    {
      name: 'knowledgebase', display_name: '知识库', description: '文档知识库、向量检索',
      required: false, api_prefixes: ['/knowledgebase'], frontend_routes: ['/knowledgebases', '/knowledgebase/create', '/knowledgebase/detail/:id'],
      menu_keys: ['knowledgebase'], dependencies: ['llm_model']
    },
    {
      name: 'mcp', display_name: 'MCP服务', description: 'MCP服务管理',
      required: false, api_prefixes: ['/mcp'], frontend_routes: ['/mcps', '/mcp/setting/:id'],
      menu_keys: ['mcp'], dependencies: []
    },
    {
      name: 'toolkit', display_name: '工具箱', description: '自定义工具和API',
      required: false, api_prefixes: ['/toolkit'], frontend_routes: ['/toolkit'],
      menu_keys: ['toolkit'], dependencies: []
    },
    {
      name: 'chatbot', display_name: '机器人', description: 'AI机器人创建与配置',
      required: false, api_prefixes: ['/chatbot', '/chatbot_category'], frontend_routes: ['/chatbots', '/chatbot/setting/:id'],
      menu_keys: ['chatbot'], dependencies: ['user', 'llm_model', 'prompt', 'knowledgebase', 'mcp', 'toolkit']
    },
    {
      name: 'chat', display_name: '聊天', description: '用户对话与消息',
      required: false, api_prefixes: ['/chat'], frontend_routes: ['/chats'],
      menu_keys: ['chat'], dependencies: ['user', 'llm_model', 'chatbot']
    },
    {
      name: 'agent', display_name: '智能体', description: 'Agent工作流编排',
      required: false, api_prefixes: ['/agent'], frontend_routes: ['/agents', '/agent/setting/:id'],
      menu_keys: ['agent'], dependencies: ['user', 'llm_model', 'prompt', 'knowledgebase', 'mcp', 'toolkit', 'chatbot']
    },
    {
      name: 'system_monitor', display_name: '系统监控', description: '系统运行状态监控',
      required: false, api_prefixes: ['/system'], frontend_routes: ['/system/monitor'],
      menu_keys: ['system_monitor'], dependencies: ['user']
    },
    {
      name: 'integration', display_name: '插件集成', description: '第三方集成与API',
      required: false, api_prefixes: ['/integration'], frontend_routes: ['/integration/chat', '/integration/sidebar', '/integration/preview'],
      menu_keys: [], dependencies: ['user', 'llm_model', 'chatbot']
    },
    {
      name: 'ontology', display_name: '本体工作台', description: '本体对象与数据抽取',
      required: false, api_prefixes: ['/ontology'], frontend_routes: ['/ontology/objects', '/ontology/tasks'],
      menu_keys: ['ontology'], dependencies: ['user', 'datasource']
    },
  ];

  const modulesMap: Record<string, ModuleInfo> = {};
  allModules.forEach(m => { modulesMap[m.name] = m; });

  return {
    name: 'full',
    description: '满血版 - 包含所有功能模块（默认）',
    enabled_modules: allModules.map(m => m.name),
    modules: modulesMap,
  };
}

/**
 * 检查模块是否启用
 */
export function isModuleEnabled(moduleName: string, versionInfo: VersionInfo | null): boolean {
  if (!versionInfo) return true; // 如果配置未加载，默认启用所有模块
  return versionInfo.enabled_modules.includes(moduleName);
}

/**
 * 获取启用的前端路由列表
 */
export function getEnabledFrontendRoutes(versionInfo: VersionInfo | null): string[] {
  if (!versionInfo) return [];
  const routes: string[] = [];
  versionInfo.enabled_modules.forEach(moduleName => {
    const module = versionInfo.modules[moduleName];
    if (module) {
      routes.push(...module.frontend_routes);
    }
  });
  return routes;
}

/**
 * 检查路由是否启用
 */
export function isRouteEnabled(routePath: string, versionInfo: VersionInfo | null): boolean {
  if (!versionInfo) return true;

  // 首页始终启用
  if (routePath === '/' || routePath === '') return true;

  // 集成路由特殊处理
  if (routePath.startsWith('/integration/')) {
    return isModuleEnabled('integration', versionInfo);
  }

  const enabledRoutes = getEnabledFrontendRoutes(versionInfo);
  
  // 精确匹配
  if (enabledRoutes.includes(routePath)) return true;

  // 参数化路由匹配
  for (const route of enabledRoutes) {
    if (route.includes(':id')) {
      const pattern = route.replace(':id', '[^/]+');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(routePath)) return true;
    }
  }

  return false;
}

/**
 * 清除缓存（用于测试）
 */
export function clearVersionCache(): void {
  cachedVersionInfo = null;
}

/**
 * 导出所有菜单配置
 * 用于渲染侧边栏菜单
 */
export interface MenuItemConfig {
  key: string;
  label: string;
  icon?: string;
  path?: string;
  children?: MenuItemConfig[];
  moduleName?: string;
}

/**
 * 获取当前版本可用的菜单配置
 */
export function getAvailableMenus(versionInfo: VersionInfo | null): MenuItemConfig[] {
  const allMenus: MenuItemConfig[] = [
    { key: 'home', label: '首页', icon: 'HomeOutlined', path: '/', moduleName: '__core__' },
    { key: 'chat_group', label: '聊天', icon: 'TeamOutlined', children: [
      { key: 'chat', label: '聊天', icon: 'MessageOutlined', path: '/chats', moduleName: 'chat' },
    ]},
    { key: 'ontology_group', label: '本体工作台', icon: 'PartitionOutlined', children: [
      { key: 'ontology-objects', label: '本体对象', icon: 'DatabaseOutlined', path: '/ontology/objects', moduleName: 'ontology' },
      { key: 'ontology-tasks', label: '数据抽取', icon: 'CloudServerOutlined', path: '/ontology/tasks', moduleName: 'ontology' },
    ]},
    { key: 'config_group', label: '配置', icon: 'ToolOutlined', children: [
      { key: 'chatbot', label: '机器人', icon: 'RobotOutlined', path: '/chatbots', moduleName: 'chatbot' },
      { key: 'knowledgebase', label: '知识库', icon: 'BookOutlined', path: '/knowledgebases', moduleName: 'knowledgebase' },
      { key: 'agent', label: '智能体', icon: 'ApartmentOutlined', path: '/agents', moduleName: 'agent' },
      { key: 'toolkit', label: '工具箱', icon: 'DatabaseOutlined', path: '/toolkit', moduleName: 'toolkit' },
      { key: 'prompt', label: '提示词', icon: 'CommentOutlined', path: '/prompts', moduleName: 'prompt' },
      { key: 'llm_model', label: '模型管理', icon: 'SettingOutlined', path: '/llm_models', moduleName: 'llm_model' },
      { key: 'datasource', label: '数据源', icon: 'CloudServerOutlined', path: '/datasources', moduleName: 'datasource' },
    ]},
    { key: 'log_group', label: '日志', icon: 'FileTextOutlined', children: [
      { key: 'log_chat', label: '问答日志', icon: 'HistoryOutlined', path: '/chats', moduleName: 'chat' },
    ]},
    { key: 'system_group', label: '系统', icon: 'DesktopOutlined', children: [
      { key: 'system_monitor', label: '监控', icon: 'DashboardOutlined', path: '/system/monitor', moduleName: 'system_monitor' },
    ]},
  ];

  if (!versionInfo) {
    // 如果配置未加载，返回所有菜单
    return allMenus;
  }

  // 根据启用的模块过滤菜单
  return filterMenus(allMenus, versionInfo);
}

/**
 * 过滤菜单配置
 */
function filterMenus(menus: MenuItemConfig[], versionInfo: VersionInfo): MenuItemConfig[] {
  return menus
    .filter(menu => {
      if (!menu.children) {
        // 菜单项
        return menu.moduleName === '__core__' || 
               isModuleEnabled(menu.moduleName!, versionInfo);
      }
      // 有子菜单的分组
      menu.children = filterMenus(menu.children, versionInfo);
      return menu.children.length > 0;
    })
    .map(menu => {
      // 确保菜单项的moduleName被保留
      return menu;
    });
}