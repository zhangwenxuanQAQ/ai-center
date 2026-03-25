/**
 * 提示词服务
 * 提供提示词相关的API调用
 */

import http from '../utils/request';

export interface PromptCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  is_default: boolean;
  children?: PromptCategory[];
  created_at: string;
  updated_at?: string;
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  category_id?: string;
  tags?: string[];
  status: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PromptListResponse {
  data: Prompt[];
  total: number;
  page: number;
  page_size: number;
}

export const promptService = {
  // ========== 分类相关接口 ==========
  
  /**
   * 获取提示词分类树
   */
  getCategoryTree: async (): Promise<PromptCategory[]> => {
    return http.get<PromptCategory[]>('/aicenter/v1/prompt/category/tree');
  },

  /**
   * 获取提示词分类列表
   */
  getCategories: async (skip: number = 0, limit: number = 100): Promise<PromptCategory[]> => {
    return http.get<PromptCategory[]>(`/aicenter/v1/prompt/category?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取单个分类
   */
  getCategory: async (id: string): Promise<PromptCategory> => {
    return http.get<PromptCategory>(`/aicenter/v1/prompt/category/${id}`);
  },

  /**
   * 创建分类
   */
  createCategory: async (data: Partial<PromptCategory>): Promise<PromptCategory> => {
    return http.post<PromptCategory>('/aicenter/v1/prompt/category', data);
  },

  /**
   * 更新分类
   */
  updateCategory: async (id: string, data: Partial<PromptCategory>): Promise<PromptCategory> => {
    return http.post<PromptCategory>(`/aicenter/v1/prompt/category/${id}`, data);
  },

  /**
   * 删除分类
   */
  deleteCategory: async (id: string): Promise<PromptCategory> => {
    return http.post<PromptCategory>(`/aicenter/v1/prompt/category/${id}/delete`);
  },

  // ========== 提示词相关接口 ==========
  
  /**
   * 获取提示词列表
   */
  getPrompts: async (page: number = 1, pageSize: number = 12, categoryId?: string, name?: string, status?: string): Promise<PromptListResponse> => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('page_size', String(pageSize));
    if (categoryId) params.append('category_id', categoryId);
    if (name) params.append('name', name);
    if (status) params.append('status', status);
    return http.get<PromptListResponse>(`/aicenter/v1/prompt?${params.toString()}`);
  },

  /**
   * 获取单个提示词
   */
  getPrompt: async (id: string): Promise<Prompt> => {
    return http.get<Prompt>(`/aicenter/v1/prompt/${id}`);
  },

  /**
   * 创建提示词
   */
  createPrompt: async (data: Partial<Prompt>): Promise<Prompt> => {
    return http.post<Prompt>('/aicenter/v1/prompt', data);
  },

  /**
   * 更新提示词
   */
  updatePrompt: async (id: string, data: Partial<Prompt>): Promise<Prompt> => {
    return http.post<Prompt>(`/aicenter/v1/prompt/${id}`, data);
  },

  /**
   * 删除提示词
   */
  deletePrompt: async (id: string): Promise<Prompt> => {
    return http.post<Prompt>(`/aicenter/v1/prompt/${id}/delete`);
  },

  /**
   * 更新提示词状态
   */
  updatePromptStatus: async (id: string, status: boolean): Promise<Prompt> => {
    return http.post<Prompt>(`/aicenter/v1/prompt/${id}/status`, { status });
  },
};
