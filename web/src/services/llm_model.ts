/**
 * LLM模型服务
 * 提供LLM模型相关的API调用
 */

import http from '../utils/request';

export interface LLMModel {
  id: number;
  name: string;
  provider: string;
  api_key: string;
  endpoint: string;
  model_type: string;
  created_at: string;
  updated_at?: string;
}

export const llmModelService = {
  /**
   * 获取LLM模型列表
   */
  getLLMModels: async (skip: number = 0, limit: number = 100): Promise<LLMModel[]> => {
    return http.get<LLMModel[]>(`/aicenter/v1/llm_model?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取单个LLM模型
   */
  getLLMModel: async (id: number): Promise<LLMModel> => {
    return http.get<LLMModel>(`/aicenter/v1/llm_model/${id}`);
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
  updateLLMModel: async (id: number, data: Partial<LLMModel>): Promise<LLMModel> => {
    return http.post<LLMModel>(`/aicenter/v1/llm_model/${id}`, data);
  },

  /**
   * 删除LLM模型
   */
  deleteLLMModel: async (id: number): Promise<LLMModel> => {
    return http.post<LLMModel>(`/aicenter/v1/llm_model/${id}/delete`);
  },
};
