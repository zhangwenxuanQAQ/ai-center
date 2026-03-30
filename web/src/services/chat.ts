/**
 * 对话服务
 * 提供对话相关的API调用
 */

import http from '../utils/request';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  group_id?: string;
  group_name?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  reasoning_content?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export const chatService = {
  /**
   * 获取对话列表
   * @param page - 页码，默认1
   * @param pageSize - 每页数量，默认20
   */
  getConversations: async (page: number = 1, pageSize: number = 20): Promise<{ items: Conversation[], total: number, page: number, page_size: number }> => {
    return http.get<{ items: Conversation[], total: number, page: number, page_size: number }>(`/aicenter/v1/chat/list?page=${page}&page_size=${pageSize}`);
  },

  /**
   * 创建对话
   * @param title - 对话标题
   * @param modelId - 模型ID
   * @param chatbotId - 机器人ID
   * @param config - 对话配置
   */
  createConversation: async (
    title: string = '新对话',
    modelId?: string,
    chatbotId?: string,
    config?: { temperature?: number; max_tokens?: number; top_p?: number }
  ): Promise<Conversation> => {
    return http.post<Conversation>('/aicenter/v1/chat/create', {
      title,
      model_id: modelId,
      chatbot_id: chatbotId,
      config: config
    });
  },

  /**
   * 获取对话消息
   * @param conversationId - 对话ID
   * @param page - 页码，默认1
   * @param pageSize - 每页数量，默认50
   */
  getMessages: async (conversationId: string, page: number = 1, pageSize: number = 50): Promise<{ items: Message[], total: number }> => {
    return http.get<{ items: Message[], total: number }>(`/aicenter/v1/chat/${conversationId}/messages?page=${page}&page_size=${pageSize}`);
  },

  /**
   * 发送消息
   * @param conversationId - 对话ID
   * @param content - 消息内容
   */
  sendMessage: async (conversationId: string, content: string): Promise<Message> => {
    return http.post<Message>('/aicenter/v1/chat/completions', {
      chat_id: conversationId,
      query: [{ type: 'text', content }],
      stream: false
    });
  },

  /**
   * 更新对话名称
   * @param conversationId - 对话ID
   * @param title - 新的对话标题
   */
  updateConversation: async (conversationId: string, title: string): Promise<Conversation> => {
    return http.post<Conversation>(`/aicenter/v1/chat/update/${conversationId}`, {
      title
    });
  },

  /**
   * 删除对话
   * @param conversationId - 对话ID
   */
  deleteConversation: async (conversationId: string): Promise<boolean> => {
    await http.post<Conversation>(`/aicenter/v1/chat/delete/${conversationId}`);
    return true;
  },

  /**
   * 置顶/取消置顶对话
   * @param conversationId - 对话ID
   */
  togglePinConversation: async (conversationId: string): Promise<Conversation> => {
    return http.post<Conversation>(`/aicenter/v1/chat/toggle_top/${conversationId}`);
  }
};
