/**
 * 代码脚本服务
 * 提供代码脚本相关的API调用
 */

import http from '../utils/request';

export interface CodeScriptParam {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: any;
}

export interface CodeScript {
  id: string;
  name: string;
  description?: string;
  content?: string;
  params?: CodeScriptParam[];
  category_id?: string;
  status?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CodeScriptCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order?: number;
  is_default?: boolean;
  children?: CodeScriptCategory[];
}

export interface CodeScriptValidateResult {
  valid: boolean;
  error?: string;
  stage?: string;
}

export interface CodeScriptTestResult {
  /** main函数返回的原始结果（任意JSON值） */
  result?: any;
  [key: string]: any;
}

export const codeScriptService = {
  /**
   * 获取代码脚本列表（分页）
   */
  getScripts: async (page: number = 1, pageSize: number = 12, category_id?: string, name?: string, status?: string, description?: string): Promise<{ data: CodeScript[], total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (category_id) params.push(`category_id=${category_id}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (status !== undefined && status !== '') params.push(`status=${status}`);
    if (description) params.push(`description=${encodeURIComponent(description)}`);
    return http.get<{ data: CodeScript[], total: number }>(`/aicenter/v1/code_script/script?${params.join('&')}`);
  },

  /**
   * 获取单个代码脚本
   */
  getScript: async (id: string): Promise<CodeScript> => {
    return http.get<CodeScript>(`/aicenter/v1/code_script/script/${id}`);
  },

  /**
   * 创建代码脚本
   */
  createScript: async (data: Partial<CodeScript>): Promise<CodeScript> => {
    return http.post<CodeScript>('/aicenter/v1/code_script/script', data);
  },

  /**
   * 更新代码脚本
   */
  updateScript: async (id: string, data: Partial<CodeScript>): Promise<CodeScript> => {
    return http.post<CodeScript>(`/aicenter/v1/code_script/script/${id}`, data);
  },

  /**
   * 删除代码脚本
   */
  deleteScript: async (id: string): Promise<CodeScript> => {
    return http.post<CodeScript>(`/aicenter/v1/code_script/script/${id}/delete`);
  },

  /**
   * 校验代码内容（语法/main函数/安全检查）
   */
  validateScript: async (content: string): Promise<CodeScriptValidateResult> => {
    return http.post<CodeScriptValidateResult>('/aicenter/v1/code_script/script/validate', { content });
  },

  /**
   * 格式化代码内容（black规范）
   */
  formatScript: async (content: string): Promise<{ content: string }> => {
    return http.post<{ content: string }>('/aicenter/v1/code_script/script/format', { content });
  },

  /**
   * 测试执行代码内容（未保存的临时代码，支持传参）
   */
  testScriptContent: async (content: string, timeout: number = 30, params?: Record<string, any>, paramDefinitions?: CodeScriptParam[]): Promise<CodeScriptTestResult> => {
    return http.post<CodeScriptTestResult>('/aicenter/v1/code_script/script/test', { content, timeout, params, param_definitions: paramDefinitions });
  },

  /**
   * 测试执行已保存的代码脚本（支持传参）
   */
  testScript: async (id: string, timeout: number = 30, params?: Record<string, any>): Promise<CodeScriptTestResult> => {
    return http.post<CodeScriptTestResult>(`/aicenter/v1/code_script/script/${id}/test`, { timeout, params });
  },

  // ==================== 分类相关 ====================

  /**
   * 获取代码脚本分类树
   */
  getCategoryTree: async (): Promise<CodeScriptCategory[]> => {
    return http.get<CodeScriptCategory[]>('/aicenter/v1/code_script/category/tree');
  },

  /**
   * 创建代码脚本分类
   */
  createCategory: async (data: Partial<CodeScriptCategory>): Promise<CodeScriptCategory> => {
    return http.post<CodeScriptCategory>('/aicenter/v1/code_script/category', data);
  },

  /**
   * 更新代码脚本分类
   */
  updateCategory: async (id: string, data: Partial<CodeScriptCategory>): Promise<CodeScriptCategory> => {
    return http.post<CodeScriptCategory>(`/aicenter/v1/code_script/category/${id}`, data);
  },

  /**
   * 删除代码脚本分类
   */
  deleteCategory: async (id: string): Promise<CodeScriptCategory> => {
    return http.post<CodeScriptCategory>(`/aicenter/v1/code_script/category/${id}/delete`);
  },
};
