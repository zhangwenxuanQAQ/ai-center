/**
 * LLM模型服务
 * 提供LLM模型相关的API调用
 */

import http from '../utils/request';

export interface LLMCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  children?: LLMCategory[];
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  api_key: string;
  endpoint: string;
  model_type: string;
  category_id?: string;
  tags?: string;
  config?: string;
  status: boolean;
  created_at: string;
  updated_at?: string;
}

export const llmModelService = {
  /**
   * 获取LLM模型类型
   */
  getModelTypes: async (): Promise<Record<string, string>> => {
    return http.get<Record<string, string>>('/aicenter/v1/llm_model/model_types');
  },

  /**
   * 获取LLM分类列表
   */
  getCategories: async (skip: number = 0, limit: number = 100): Promise<LLMCategory[]> => {
    return http.get<LLMCategory[]>(`/aicenter/v1/llm_model/category?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取LLM分类树形结构
   */
  getCategoryTree: async (): Promise<LLMCategory[]> => {
    return http.get<LLMCategory[]>('/aicenter/v1/llm_model/category/tree');
  },

  /**
   * 创建LLM分类
   */
  createCategory: async (data: Partial<LLMCategory>): Promise<LLMCategory> => {
    return http.post<LLMCategory>('/aicenter/v1/llm_model/category', data);
  },

  /**
   * 更新LLM分类
   */
  updateCategory: async (id: string, data: Partial<LLMCategory>): Promise<LLMCategory> => {
    return http.post<LLMCategory>(`/aicenter/v1/llm_model/category/${id}`, data);
  },

  /**
   * 删除LLM分类
   */
  deleteCategory: async (id: string): Promise<LLMCategory> => {
    return http.post<LLMCategory>(`/aicenter/v1/llm_model/category/${id}/delete`);
  },

  /**
   * 获取LLM模型列表（分页）
   */
  getLLMModels: async (page: number = 1, pageSize: number = 12, category_id?: string, name?: string, model_type?: string, status?: string, tags?: string): Promise<{ data: LLMModel[], total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (category_id) params.push(`category_id=${category_id}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (model_type) params.push(`model_type=${encodeURIComponent(model_type)}`);
    if (status !== undefined && status !== '') params.push(`status=${status}`);
    if (tags) params.push(`tags=${encodeURIComponent(tags)}`);
    return http.get<{ data: LLMModel[], total: number }>(`/aicenter/v1/llm_model?${params.join('&')}`);
  },

  /**
   * 获取单个LLM模型
   */
  getLLMModel: async (id: string): Promise<LLMModel> => {
    return http.get<LLMModel>(`/aicenter/v1/llm_model/model/${id}`);
  },

  /**
   * 创建LLM模型
   */
  createLLMModel: async (data: Partial<LLMModel>): Promise<LLMModel> => {
    return http.post<LLMModel>('/aicenter/v1/llm_model', data);
  },

  /**
   * 更新LLM模型
   */
  updateLLMModel: async (id: string, data: Partial<LLMModel>): Promise<LLMModel> => {
    return http.post<LLMModel>(`/aicenter/v1/llm_model/model/${id}`, data);
  },

  /**
   * 删除LLM模型
   */
  deleteLLMModel: async (id: string): Promise<LLMModel> => {
    return http.post<LLMModel>(`/aicenter/v1/llm_model/model/${id}/delete`);
  },

  /**
   * 测试模型连接（通过模型ID）
   */
  testConnection: async (id: string): Promise<{ success: boolean; message: string; result?: string }> => {
    return http.post<{ success: boolean; message: string; result?: string }>(`/aicenter/v1/llm_model/model/${id}/test`);
  },
  
  /**
   * 测试模型配置（通过配置参数）
   */
  testModelConfig: async (data: { name: string; provider?: string; api_key: string; endpoint: string; model_type: string }): Promise<{ success: boolean; message: string; result?: string }> => {
    return http.post<{ success: boolean; message: string; result?: string }>('/aicenter/v1/llm_model/test_config', data);
  },
  
  /**
   * 获取模型标签
   */
  getModelTags: async (modelType?: string): Promise<string[]> => {
    let params = [];
    if (modelType) params.push(`model_type=${encodeURIComponent(modelType)}`);
    return http.get<string[]>(`/aicenter/v1/llm_model/tags${params.length > 0 ? `?${params.join('&')}` : ''}`);
  },

  /**
   * 获取模型配置参数
   */
  getConfigParams: async (): Promise<Record<string, any[]>> => {
    return http.get<Record<string, any[]>>('/aicenter/v1/llm_model/config_params');
  },

  /**
   * 与模型进行对话（流式输出）
   */
  chat: async (llmModelId: string, messages: any[], config?: Record<string, any>): Promise<Response> => {
    const response = await fetch(`/aicenter/v1/llm_model/model/${llmModelId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, config: config || {} }),
    });
    return response;
  },
};
