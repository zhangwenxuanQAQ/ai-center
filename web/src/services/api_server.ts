/**
 * API接口服务
 * 提供API服务分类、API服务配置、API接口相关的API调用
 */

import http from '../utils/request';

export interface ApiServerCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  children?: ApiServerCategory[];
}

export interface ApiServer {
  id: string;
  name: string;
  description?: string;
  url?: string;
  avatar?: string;
  headers?: string;
  configs?: string;
  category_id?: string;
  status?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ApiInterface {
  id: string;
  name: string;
  title?: string;
  description?: string;
  server_id: string;
  configs?: string | Record<string, any>;
  status: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SwaggerImportParams {
  swagger_url?: string;
  swagger_json?: string;
  include_patterns?: string[];
  exclude_patterns?: string[];
}

// 请求头参数类型选项
export const HEADER_TYPE_OPTIONS = [
  { label: 'string', value: 'string' },
  { label: 'integer', value: 'integer' },
  { label: 'array', value: 'array' },
  { label: 'object', value: 'object' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
];

// 解析headers JSON字符串为动态行数组
export const parseHeaders = (headersStr?: string): Array<{ key: string; value: string; type: string }> => {
  if (!headersStr) return [];
  try {
    const parsed = JSON.parse(headersStr);
    if (Array.isArray(parsed)) {
      return parsed.map((h: any) => ({ key: h.key || '', value: h.value || '', type: h.type || 'string' }));
    }
    // 兼容旧的字典格式
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed).map(([key, value]) => ({ key, value: String(value), type: 'string' }));
    }
    return [];
  } catch {
    return [];
  }
};

// 将headers动态行数组转为JSON字符串
export const stringifyHeaders = (headers: Array<{ key: string; value: string; type: string }>): string => {
  const filtered = (headers || []).filter(h => h.key && h.key.trim());
  return filtered.length > 0 ? JSON.stringify(filtered) : '';
};

export const apiService = {
  /**
   * 获取API服务分类列表
   */
  getCategories: async (skip: number = 0, limit: number = 100): Promise<ApiServerCategory[]> => {
    return http.get<ApiServerCategory[]>(`/aicenter/v1/api_server/category?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取API服务分类树形结构
   */
  getCategoryTree: async (): Promise<ApiServerCategory[]> => {
    return http.get<ApiServerCategory[]>('/aicenter/v1/api_server/category/tree');
  },

  /**
   * 创建API服务分类
   */
  createCategory: async (data: Partial<ApiServerCategory>): Promise<ApiServerCategory> => {
    return http.post<ApiServerCategory>('/aicenter/v1/api_server/category', data);
  },

  /**
   * 更新API服务分类
   */
  updateCategory: async (id: string, data: Partial<ApiServerCategory>): Promise<ApiServerCategory> => {
    return http.post<ApiServerCategory>(`/aicenter/v1/api_server/category/${id}`, data);
  },

  /**
   * 删除API服务分类
   */
  deleteCategory: async (id: string): Promise<ApiServerCategory> => {
    return http.post<ApiServerCategory>(`/aicenter/v1/api_server/category/${id}/delete`);
  },

  /**
   * 获取API服务列表（分页）
   */
  getServers: async (page: number = 1, pageSize: number = 12, category_id?: string, name?: string, status?: string, description?: string): Promise<{ data: ApiServer[], total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (category_id) params.push(`category_id=${category_id}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (status !== undefined && status !== '') params.push(`status=${status}`);
    if (description) params.push(`description=${encodeURIComponent(description)}`);
    return http.get<{ data: ApiServer[], total: number }>(`/aicenter/v1/api_server/server?${params.join('&')}`);
  },

  /**
   * 获取单个API服务
   */
  getServer: async (id: string): Promise<ApiServer> => {
    return http.get<ApiServer>(`/aicenter/v1/api_server/server/${id}`);
  },

  /**
   * 创建API服务
   */
  createServer: async (data: Partial<ApiServer>): Promise<ApiServer> => {
    return http.post<ApiServer>('/aicenter/v1/api_server/server', data);
  },

  /**
   * 更新API服务
   */
  updateServer: async (id: string, data: Partial<ApiServer>): Promise<ApiServer> => {
    return http.post<ApiServer>(`/aicenter/v1/api_server/server/${id}`, data);
  },

  /**
   * 删除API服务
   */
  deleteServer: async (id: string): Promise<ApiServer> => {
    return http.post<ApiServer>(`/aicenter/v1/api_server/server/${id}/delete`);
  },

  /**
   * 获取API接口列表（分页）
   */
  getInterfaces: async (page: number = 1, pageSize: number = 10, server_id?: string, name?: string, status?: string, path?: string, method?: string): Promise<{ data: ApiInterface[], total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (server_id) params.push(`server_id=${server_id}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (status !== undefined && status !== '') params.push(`status=${status}`);
    if (path) params.push(`path=${encodeURIComponent(path)}`);
    if (method) params.push(`method=${encodeURIComponent(method)}`);
    return http.get<{ data: ApiInterface[], total: number }>(`/aicenter/v1/api_server/interface?${params.join('&')}`);
  },

  /**
   * 获取单个API接口
   */
  getInterface: async (id: string): Promise<ApiInterface> => {
    return http.get<ApiInterface>(`/aicenter/v1/api_server/interface/${id}`);
  },

  /**
   * 创建API接口
   */
  createInterface: async (data: Partial<ApiInterface>): Promise<ApiInterface> => {
    return http.post<ApiInterface>('/aicenter/v1/api_server/interface', data);
  },

  /**
   * 更新API接口
   */
  updateInterface: async (id: string, data: Partial<ApiInterface>): Promise<ApiInterface> => {
    return http.post<ApiInterface>(`/aicenter/v1/api_server/interface/${id}`, data);
  },

  /**
   * 删除API接口
   */
  deleteInterface: async (id: string): Promise<ApiInterface> => {
    return http.post<ApiInterface>(`/aicenter/v1/api_server/interface/${id}/delete`);
  },

  /**
   * 测试API接口
   */
  testInterface: async (id: string, data?: any): Promise<any> => {
    return http.post<any>(`/aicenter/v1/api_server/interface/${id}/test`, data || {});
  },

  /**
   * 批量删除API接口
   */
  batchDeleteInterfaces: async (ids: string[]): Promise<{ deleted_count: number }> => {
    return http.post<{ deleted_count: number }>('/aicenter/v1/api_server/interfaces/batch_delete', ids);
  },

  /**
   * 解析Swagger文档并返回接口列表
   */
  parseSwagger: async (serverId: string, params: SwaggerImportParams): Promise<{ data: ApiInterface[], total: number }> => {
    return http.post<{ data: ApiInterface[], total: number }>(`/aicenter/v1/api_server/server/${serverId}/parse_swagger`, params);
  },

  /**
   * 批量导入API接口
   */
  importInterfaces: async (serverId: string, interfaces: Partial<ApiInterface>[]): Promise<ApiInterface[]> => {
    return http.post<ApiInterface[]>(`/aicenter/v1/api_server/server/${serverId}/import_apis`, interfaces);
  },
};
