/**
 * 知识库服务
 * 提供知识库相关的API调用
 */

import http from '../utils/request';

export interface Knowledge {
  id: number;
  name: string;
  description: string;
  file_path: string;
  status: boolean;
  created_at: string;
  updated_at?: string;
}

export const knowledgeService = {
  /**
   * 获取知识库列表
   */
  getKnowledges: async (skip: number = 0, limit: number = 100): Promise<Knowledge[]> => {
    return http.get<Knowledge[]>(`/aicenter/v1/knowledge?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取单个知识库
   */
  getKnowledge: async (id: number): Promise<Knowledge> => {
    return http.get<Knowledge>(`/aicenter/v1/knowledge/${id}`);
  },

  /**
   * 创建知识库
   */
  createKnowledge: async (data: Partial<Knowledge>): Promise<Knowledge> => {
    return http.post<Knowledge>('/aicenter/v1/knowledge', data);
  },

  /**
   * 更新知识库
   */
  updateKnowledge: async (id: number, data: Partial<Knowledge>): Promise<Knowledge> => {
    return http.post<Knowledge>(`/aicenter/v1/knowledge/${id}`, data);
  },

  /**
   * 删除知识库
   */
  deleteKnowledge: async (id: number): Promise<Knowledge> => {
    return http.post<Knowledge>(`/aicenter/v1/knowledge/${id}/delete`);
  },
};
