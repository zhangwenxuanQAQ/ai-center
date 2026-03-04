/**
 * 提示词服务
 * 提供提示词相关的API调用
 */

import http from '../utils/request';

export interface Prompt {
  id: number;
  name: string;
  content: string;
  category: string;
  created_at: string;
  updated_at?: string;
}

export const promptService = {
  /**
   * 获取提示词列表
   */
  getPrompts: async (skip: number = 0, limit: number = 100): Promise<Prompt[]> => {
    return http.get<Prompt[]>(`/aicenter/v1/prompt?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取单个提示词
   */
  getPrompt: async (id: number): Promise<Prompt> => {
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
  updatePrompt: async (id: number, data: Partial<Prompt>): Promise<Prompt> => {
    return http.post<Prompt>(`/aicenter/v1/prompt/${id}`, data);
  },

  /**
   * 删除提示词
   */
  deletePrompt: async (id: number): Promise<Prompt> => {
    return http.post<Prompt>(`/aicenter/v1/prompt/${id}/delete`);
  },
};
