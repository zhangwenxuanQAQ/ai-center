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
    return http.get<KnowledgebaseCategory[]>(
      '/aicenter/v1/knowledgebase/category/tree'
    ) || [];
  },

  /**
   * 创建分类
   */
  createCategory: async (data: Partial<KnowledgebaseCategory>): Promise<KnowledgebaseCategory> => {
    return http.post<KnowledgebaseCategory>(
      '/aicenter/v1/knowledgebase/category',
      data
    );
  },

  /**
   * 更新分类
   */
  updateCategory: async (id: string, data: Partial<KnowledgebaseCategory>): Promise<KnowledgebaseCategory> => {
    return http.post<KnowledgebaseCategory>(
      `/aicenter/v1/knowledgebase/category/${id}`,
      data
    );
  },

  /**
   * 删除分类
   */
  deleteCategory: async (id: string): Promise<KnowledgebaseCategory> => {
    return http.post<KnowledgebaseCategory>(
      `/aicenter/v1/knowledgebase/category/${id}/delete`
    );
  },

  /**
   * 获取知识库列表（分页）
   */
  getKnowledgebases: async (page: number = 1, pageSize: number = 100, categoryId?: string | null, name?: string, code?: string, status?: string): Promise<{ data: Knowledgebase[]; total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (categoryId) {
      params.push(`category_id=${categoryId}`);
    }
    if (name) {
      params.push(`name=${encodeURIComponent(name)}`);
    }
    if (code) {
      params.push(`code=${encodeURIComponent(code)}`);
    }
    if (status !== undefined) {
      params.push(`status=${status}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<{ data: Knowledgebase[]; total: number }>(
      `/aicenter/v1/knowledgebase${queryString}`
    ) || { data: [], total: 0 };
  },

  /**
   * 获取单个知识库
   */
  getKnowledgebase: async (id: string): Promise<Knowledgebase> => {
    return http.get<Knowledgebase>(
      `/aicenter/v1/knowledgebase/${id}`
    );
  },

  /**
   * 检查编码是否唯一
   */
  checkCodeUnique: async (code: string): Promise<boolean> => {
    try {
      return http.get<boolean>(
        `/aicenter/v1/knowledgebase/check_code?code=${code}`
      );
    } catch (error) {
      console.error('Failed to check code uniqueness:', error);
      return true;
    }
  },

  /**
   * 创建知识库
   */
  createKnowledgebase: async (data: Partial<Knowledgebase>): Promise<Knowledgebase> => {
    return http.post<Knowledgebase>(
      '/aicenter/v1/knowledgebase',
      data
    );
  },

  /**
   * 更新知识库
   */
  updateKnowledgebase: async (id: string, data: Partial<Knowledgebase>): Promise<Knowledgebase> => {
    return http.post<Knowledgebase>(
      `/aicenter/v1/knowledgebase/${id}`,
      data
    );
  },

  /**
   * 删除知识库
   */
  deleteKnowledgebase: async (id: string): Promise<Knowledgebase> => {
    return http.post<Knowledgebase>(
      `/aicenter/v1/knowledgebase/${id}/delete`
    );
  },
};
