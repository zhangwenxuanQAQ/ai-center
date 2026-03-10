/**
 * 聊天机器人服务
 * 提供聊天机器人相关的API调用
 */

import http from '../utils/request';

export interface ChatbotCategory {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  parent_id?: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  children?: ChatbotCategory[];
}

export interface Chatbot {
  id: number;
  code: string;
  name: string;
  description: string;
  model_id: number;
  category_id?: number;
  avatar?: string;
  greeting?: string;
  prompt_id?: number;
  knowledge_id?: number;
  source_type?: string;
  source_config?: string;
  created_at: string;
  updated_at?: string;
  mcp_ids?: number[];
}

export const chatbotService = {
  /**
   * 获取聊天机器人分类列表
   * @param parent_id - 父分类ID，为null时获取顶级分类
   */
  getCategories: async (parent_id?: string | null): Promise<ChatbotCategory[]> => {
    let params = [];
    if (parent_id !== undefined && parent_id !== null) {
      params.push(`parent_id=${parent_id}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<ChatbotCategory[]>(`/aicenter/v1/chatbot_category${queryString}`);
  },

  /**
   * 获取分类树结构
   */
  getCategoryTree: async (): Promise<ChatbotCategory[]> => {
    return http.get<ChatbotCategory[]>('/aicenter/v1/chatbot_category/tree');
  },

  /**
   * 创建分类
   * @param data - 分类数据
   */
  createCategory: async (data: Partial<ChatbotCategory>): Promise<ChatbotCategory> => {
    return http.post<ChatbotCategory>('/aicenter/v1/chatbot_category', data);
  },

  /**
   * 更新分类
   * @param id - 分类ID
   * @param data - 分类数据
   */
  updateCategory: async (id: string, data: Partial<ChatbotCategory>): Promise<ChatbotCategory> => {
    return http.post<ChatbotCategory>(`/aicenter/v1/chatbot_category/${id}`, data);
  },

  /**
   * 删除分类
   * @param id - 分类ID
   */
  deleteCategory: async (id: string): Promise<ChatbotCategory> => {
    return http.post<ChatbotCategory>(`/aicenter/v1/chatbot_category/${id}/delete`);
  },

  /**
   * 更新分类排序
   * @param id - 分类ID
   * @param sort_order - 新的排序值
   */
  updateCategoryOrder: async (id: string, sort_order: number): Promise<ChatbotCategory> => {
    return http.post<ChatbotCategory>(`/aicenter/v1/chatbot_category/${id}/order`, { sort_order });
  },

  /**
   * 获取聊天机器人列表
   * @param categoryId - 分类ID（可选）
   * @param page - 页码，默认1
   * @param pageSize - 每页数量，默认12
   * @param name - 机器人名称（模糊查询）
   * @param sourceType - 来源类型
   * @param code - 机器人编码（模糊查询）
   */
  getChatbots: async (categoryId?: string, page: number = 1, pageSize: number = 12, name?: string, sourceType?: string, code?: string): Promise<{ data: Chatbot[], total: number }> => {
    let params = [];
    if (categoryId) params.push(`category_id=${categoryId}`);
    params.push(`page=${page}`);
    params.push(`page_size=${pageSize}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (sourceType) params.push(`source_type=${encodeURIComponent(sourceType)}`);
    if (code) params.push(`code=${encodeURIComponent(code)}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<{ data: Chatbot[], total: number }>(`/aicenter/v1/chatbot${queryString}`);
  },

  /**
   * 获取单个聊天机器人
   * @param id - 聊天机器人ID
   */
  getChatbot: async (id: number): Promise<Chatbot> => {
    return http.get<Chatbot>(`/aicenter/v1/chatbot/${id}`);
  },

  /**
   * 获取来源类型列表
   */
  getSourceTypes: async (): Promise<any[]> => {
    return http.get<any[]>('/aicenter/v1/chatbot/source_types');
  },

  /**
   * 创建聊天机器人
   * @param data - 聊天机器人数据
   */
  createChatbot: async (data: Partial<Chatbot>): Promise<Chatbot> => {
    return http.post<Chatbot>('/aicenter/v1/chatbot', data);
  },

  /**
   * 更新聊天机器人
   * @param id - 聊天机器人ID
   * @param data - 聊天机器人数据
   */
  updateChatbot: async (id: number, data: Partial<Chatbot>): Promise<Chatbot> => {
    return http.post<Chatbot>(`/aicenter/v1/chatbot/${id}`, data);
  },

  /**
   * 删除聊天机器人
   * @param id - 聊天机器人ID
   */
  deleteChatbot: async (id: number): Promise<Chatbot> => {
    return http.post<Chatbot>(`/aicenter/v1/chatbot/${id}/delete`);
  },
};
