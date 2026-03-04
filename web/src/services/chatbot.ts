/**
 * 聊天机器人服务
 * 提供聊天机器人相关的API调用
 */

import http from '../utils/request';

export interface ChatbotCategory {
  id: number;
  name: string;
  description?: string;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Chatbot {
  id: number;
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
   */
  getCategories: async (): Promise<ChatbotCategory[]> => {
    return http.get<ChatbotCategory[]>('/aicenter/v1/chatbot_category');
  },

  /**
   * 获取聊天机器人列表
   * @param categoryId - 分类ID（可选）
   */
  getChatbots: async (categoryId?: number): Promise<Chatbot[]> => {
    const params = categoryId ? `?category_id=${categoryId}` : '';
    return http.get<Chatbot[]>(`/aicenter/v1/chatbot${params}`);
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
