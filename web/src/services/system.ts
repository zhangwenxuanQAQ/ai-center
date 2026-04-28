/**
 * 系统监控服务
 * 提供系统监控相关的API调用
 */

import http from '../utils/request';

export interface MonitorMetric {
  name_en: string;
  name_zh: string;
  value: number | string;
  unit: string;
  status: string;
  description?: string;
}

export interface MonitorStat {
  name_en: string;
  name_zh: string;
  value: number | string;
  unit: string;
  description?: string;
}

export interface MonitorInfo {
  status: 'connected' | 'disconnected';
  version: string;
  metrics: MonitorMetric[];
  stats: MonitorStat[];
  error?: string;
}

export interface DatabaseInfo {
  name: string;
  type: string;
  host: string;
  port: number;
  database?: string;
  user?: string;
  db?: number;
  max_connections?: number;
  monitor_info: MonitorInfo | null;
}

export interface ModuleStats {
  chatbot_count: number;
  knowledgebase_count: number;
  document_count: number;
  mcp_server_count: number;
  mcp_tool_count: number;
  prompt_count: number;
  model_count: number;
  datasource_count: number;
}

export interface SystemOverview {
  version: string;
  databases: DatabaseInfo[];
  modules: ModuleStats;
}

/** 分类统计数据项 */
export interface CategoryStatItem {
  category: string;
  count: number;
}

/** 知识库详情项 */
export interface KnowledgebaseDetailItem {
  name: string;
  document_count: number;
  category: string;
}

/** 类型统计项 */
export interface TypeStatItem {
  type: string;
  count: number;
}

/** 知识库统计（含分类和详情） */
export interface KnowledgebaseStats {
  categories: CategoryStatItem[];
  detail: KnowledgebaseDetailItem[];
}

/** 模型统计（含分类和类型） */
export interface ModelStats {
  categories: CategoryStatItem[];
  types: TypeStatItem[];
}

/** 数据源统计（含分类和类型） */
export interface DatasourceStats {
  categories: CategoryStatItem[];
  types: TypeStatItem[];
}

export const systemService = {
  /**
   * 获取系统版本号
   */
  getVersion: async (): Promise<{ version: string }> => {
    return http.get<{ version: string }>('/aicenter/v1/system/monitor/version');
  },

  /**
   * 获取数据库状态
   */
  getDatabaseStatus: async (): Promise<DatabaseInfo[]> => {
    return http.get<DatabaseInfo[]>('/aicenter/v1/system/monitor/databases');
  },

  /**
   * 获取功能模块统计
   */
  getModuleStats: async (): Promise<ModuleStats> => {
    return http.get<ModuleStats>('/aicenter/v1/system/monitor/modules');
  },

  /**
   * 获取系统监控概览
   */
  getOverview: async (): Promise<SystemOverview> => {
    return http.get<SystemOverview>('/aicenter/v1/system/monitor/overview');
  },

  /**
   * 获取机器人分类统计
   */
  getChatbotStats: async (): Promise<CategoryStatItem[]> => {
    return http.get<CategoryStatItem[]>('/aicenter/v1/system/monitor/stats/chatbot');
  },

  /**
   * 获取知识库分类统计（含每个知识库的文档数量）
   */
  getKnowledgebaseStats: async (): Promise<KnowledgebaseStats> => {
    return http.get<KnowledgebaseStats>('/aicenter/v1/system/monitor/stats/knowledgebase');
  },

  /**
   * 获取MCP服务分类统计
   */
  getMcpStats: async (): Promise<CategoryStatItem[]> => {
    return http.get<CategoryStatItem[]>('/aicenter/v1/system/monitor/stats/mcp');
  },

  /**
   * 获取提示词分类统计
   */
  getPromptStats: async (): Promise<CategoryStatItem[]> => {
    return http.get<CategoryStatItem[]>('/aicenter/v1/system/monitor/stats/prompt');
  },

  /**
   * 获取模型分类和类型统计
   */
  getModelStats: async (): Promise<ModelStats> => {
    return http.get<ModelStats>('/aicenter/v1/system/monitor/stats/model');
  },

  /**
   * 获取数据源分类和类型统计
   */
  getDatasourceStats: async (): Promise<DatasourceStats> => {
    return http.get<DatasourceStats>('/aicenter/v1/system/monitor/stats/datasource');
  },
};
