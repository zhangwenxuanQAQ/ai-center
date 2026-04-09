/**
 * 知识库服务
 * 提供知识库相关的API调用
 */

import http from '../utils/request';

export interface Knowledgebase {
  id: string;
  name: string;
  code: string;
  description: string;
  avatar?: string;
  category_id?: string;
  embedding_model_id?: string;
  rerank_model_id?: string;
  doc_num: number;
  token_num: number;
  chunk_num: number;
  retrieval_config?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface KnowledgebaseCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
  children?: KnowledgebaseCategory[];
}

export const knowledgebaseService = {
  /**
   * 获取知识库分类树
   */
  getCategoryTree: async (): Promise<KnowledgebaseCategory[]> => {
    const response = await http.get<{ code: number; data: KnowledgebaseCategory[]; message: string }>(
      '/aicenter/v1/knowledgebase/category/tree'
    );
    return response.data || [];
  },

  /**
   * 创建分类
   */
  createCategory: async (data: Partial<KnowledgebaseCategory>): Promise<KnowledgebaseCategory> => {
    const response = await http.post<{ code: number; data: KnowledgebaseCategory; message: string }>(
      '/aicenter/v1/knowledgebase/category',
      data
    );
    return response.data;
  },

  /**
   * 更新分类
   */
  updateCategory: async (id: string, data: Partial<KnowledgebaseCategory>): Promise<KnowledgebaseCategory> => {
    const response = await http.post<{ code: number; data: KnowledgebaseCategory; message: string }>(
      `/aicenter/v1/knowledgebase/category/${id}`,
      data
    );
    return response.data;
  },

  /**
   * 删除分类
   */
  deleteCategory: async (id: string): Promise<KnowledgebaseCategory> => {
    const response = await http.post<{ code: number; data: KnowledgebaseCategory; message: string }>(
      `/aicenter/v1/knowledgebase/category/${id}/delete`
    );
    return response.data;
  },

  /**
   * 获取知识库列表（分页）
   */
  getKnowledgebases: async (page: number = 1, pageSize: number = 100): Promise<Knowledgebase[]> => {
    const response = await http.get<{ code: number; data: { data: Knowledgebase[]; total: number }; message: string }>(
      `/aicenter/v1/knowledgebase?page=${page}&page_size=${pageSize}`
    );
    return response.data?.data || [];
  },

  /**
   * 获取单个知识库
   */
  getKnowledgebase: async (id: string): Promise<Knowledgebase> => {
    const response = await http.get<{ code: number; data: Knowledgebase; message: string }>(
      `/aicenter/v1/knowledgebase/${id}`
    );
    return response.data;
  },

  /**
   * 检查编码是否唯一
   */
  checkCodeUnique: async (code: string): Promise<boolean> => {
    try {
      const response = await http.get<{ code: number; data: boolean; message: string }>(
        `/aicenter/v1/knowledgebase/check_code?code=${code}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to check code uniqueness:', error);
      return true;
    }
  },

  /**
   * 创建知识库
   */
  createKnowledgebase: async (data: Partial<Knowledgebase>): Promise<Knowledgebase> => {
    const response = await http.post<{ code: number; data: Knowledgebase; message: string }>(
      '/aicenter/v1/knowledgebase',
      data
    );
    return response.data;
  },

  /**
   * 更新知识库
   */
  updateKnowledgebase: async (id: string, data: Partial<Knowledgebase>): Promise<Knowledgebase> => {
    const response = await http.post<{ code: number; data: Knowledgebase; message: string }>(
      `/aicenter/v1/knowledgebase/${id}`,
      data
    );
    return response.data;
  },

  /**
   * 删除知识库
   */
  deleteKnowledgebase: async (id: string): Promise<Knowledgebase> => {
    const response = await http.post<{ code: number; data: Knowledgebase; message: string }>(
      `/aicenter/v1/knowledgebase/${id}/delete`
    );
    return response.data;
  },
};
