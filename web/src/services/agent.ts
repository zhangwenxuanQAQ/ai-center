/**
 * 智能体服务
 * 提供智能体相关的API调用
 */

import http from '../utils/request';

export interface AgentCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  is_default: boolean;
  is_default_select?: boolean;
  created_at: string;
  updated_at?: string;
  children?: AgentCategory[];
}

export interface AgentInstance {
  id: string;
  name: string;
  code: string;
  description?: string;
  category_id?: string;
  avatar?: string;
  dsl?: any;
  tags?: string;
  status: boolean;
  is_template: boolean;
  created_at: string;
  updated_at?: string;
}

export const agentService = {
  /**
   * 获取智能体分类树
   */
  getCategoryTree: async (): Promise<AgentCategory[]> => {
    return http.get<AgentCategory[]>(
      '/aicenter/v1/agent/categories/tree'
    ) || [];
  },

  /**
   * 创建分类
   */
  createCategory: async (data: Partial<AgentCategory>): Promise<AgentCategory> => {
    return http.post<AgentCategory>(
      '/aicenter/v1/agent/categories',
      data
    );
  },

  /**
   * 更新分类
   */
  updateCategory: async (id: string, data: Partial<AgentCategory>): Promise<AgentCategory> => {
    return http.post<AgentCategory>(
      `/aicenter/v1/agent/categories/${id}`,
      data
    );
  },

  /**
   * 删除分类
   */
  deleteCategory: async (id: string): Promise<AgentCategory> => {
    return http.post<AgentCategory>(
      `/aicenter/v1/agent/categories/${id}/delete`
    );
  },

  /**
   * 获取智能体列表（分页）
   */
  getAgents: async (page: number = 1, pageSize: number = 100, categoryId?: string | null, name?: string, code?: string, status?: string): Promise<{ data: AgentInstance[]; total: number }> => {
    let params = ['page=' + page, 'page_size=' + pageSize];
    if (categoryId) {
      params.push('category_id=' + categoryId);
    }
    if (name) {
      params.push('name=' + encodeURIComponent(name));
    }
    if (code) {
      params.push('code=' + encodeURIComponent(code));
    }
    if (status !== undefined && status !== '') {
      params.push('status=' + status);
    }
    const queryString = params.length > 0 ? '?' + params.join('&') : '';
    return http.get<{ data: AgentInstance[]; total: number }>(
      '/aicenter/v1/agent/instances' + queryString
    ) || { data: [], total: 0 };
  },

  /**
   * 获取单个智能体
   */
  getAgent: async (id: string): Promise<AgentInstance> => {
    return http.get<AgentInstance>(
      `/aicenter/v1/agent/instances/${id}`
    );
  },

  /**
   * 创建智能体
   */
  createAgent: async (data: Partial<AgentInstance>): Promise<AgentInstance> => {
    return http.post<AgentInstance>(
      '/aicenter/v1/agent/instances',
      data
    );
  },

  /**
   * 更新智能体
   */
  updateAgent: async (id: string, data: Partial<AgentInstance>): Promise<AgentInstance> => {
    return http.post<AgentInstance>(
      `/aicenter/v1/agent/instances/${id}`,
      data
    );
  },

  /**
   * 删除智能体
   */
  deleteAgent: async (id: string): Promise<AgentInstance> => {
    return http.post<AgentInstance>(
      `/aicenter/v1/agent/instances/${id}/delete`
    );
  },
};
