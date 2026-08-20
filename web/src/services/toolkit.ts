/**
 * 工具箱服务
 * 提供工具箱分类相关的API调用
 */

import http from '../utils/request';

export interface ToolkitCategory {
  id: string;
  name: string;
  description?: string;
  type?: string;
  parent_id?: string;
  sort_order: number;
  is_default?: boolean;
  tool_count?: number;
  created_at?: string;
  updated_at?: string;
  children?: ToolkitCategory[];
}

export interface BuiltinToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
}

export interface BuiltinTool {
  name: string;
  title: string;
  description: string;
  created_at?: string;
  params: BuiltinToolParam[];
}

export const toolkitService = {
  /**
   * 获取工具箱分类列表
   */
  getCategories: async (skip: number = 0, limit: number = 100, type?: string): Promise<ToolkitCategory[]> => {
    let url = `/aicenter/v1/toolkit/category?skip=${skip}&limit=${limit}`;
    if (type) url += `&type=${type}`;
    return http.get<ToolkitCategory[]>(url);
  },

  /**
   * 获取工具箱分类树形结构
   */
  getCategoryTree: async (type?: string): Promise<ToolkitCategory[]> => {
    let url = '/aicenter/v1/toolkit/category/tree';
    if (type) url += `?type=${type}`;
    return http.get<ToolkitCategory[]>(url);
  },

  /**
   * 创建工具箱分类
   */
  createCategory: async (data: Partial<ToolkitCategory>): Promise<ToolkitCategory> => {
    return http.post<ToolkitCategory>('/aicenter/v1/toolkit/category', data);
  },

  /**
   * 更新工具箱分类
   */
  updateCategory: async (id: string, data: Partial<ToolkitCategory>): Promise<ToolkitCategory> => {
    return http.post<ToolkitCategory>(`/aicenter/v1/toolkit/category/${id}`, data);
  },

  /**
   * 删除工具箱分类
   */
  deleteCategory: async (id: string): Promise<ToolkitCategory> => {
    return http.post<ToolkitCategory>(`/aicenter/v1/toolkit/category/${id}/delete`);
  },

  /**
   * 获取支持的工具类型
   */
  getToolTypes: async (): Promise<Record<string, string>> => {
    return http.get<Record<string, string>>('/aicenter/v1/toolkit/tool_types');
  },

  /**
   * 分页获取内置工具列表
   */
  getBuiltinTools: async (page: number = 1, pageSize: number = 12, name?: string): Promise<{ data: BuiltinTool[], total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    return http.get<{ data: BuiltinTool[], total: number }>(`/aicenter/v1/toolkit/builtin_tools?${params.join('&')}`);
  },

  /**
   * 获取单个内置工具详情
   */
  getBuiltinTool: async (toolName: string): Promise<BuiltinTool> => {
    return http.get<BuiltinTool>(`/aicenter/v1/toolkit/builtin_tools/${toolName}`);
  },
};
