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
  knowledge_id?: string;
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

  /**
   * 获取机器人绑定的模型列表
   * @param chatbotId - 机器人ID
   */
  getChatbotModels: async (chatbotId: string): Promise<any[]> => {
    return http.get<any[]>(`/aicenter/v1/chatbot/${chatbotId}/models`);
  },

  /**
   * 获取机器人指定类型的绑定模型
   * @param chatbotId - 机器人ID
   * @param modelType - 模型类型
   */
  getChatbotModelByType: async (chatbotId: string, modelType: string): Promise<any> => {
    return http.get<any>(`/aicenter/v1/chatbot/${chatbotId}/models/${modelType}`);
  },

  /**
   * 绑定模型到机器人
   * @param chatbotId - 机器人ID
   * @param modelId - 模型ID
   * @param modelType - 模型类型
   * @param config - 模型配置
   */
  bindModelToChatbot: async (chatbotId: string, modelId: string, modelType: string, config?: any): Promise<any> => {
    return http.post<any>(`/aicenter/v1/chatbot/${chatbotId}/models/bind`, {
      model_id: modelId,
      model_type: modelType,
      config: config
    });
  },

  /**
   * 解绑机器人的模型
   * @param chatbotId - 机器人ID
   * @param modelType - 模型类型
   */
  unbindModelFromChatbot: async (chatbotId: string, modelType: string): Promise<any> => {
    return http.post<any>(`/aicenter/v1/chatbot/${chatbotId}/models/unbind`, {
      model_type: modelType
    });
  },

  /**
   * 更新机器人模型配置
   * @param chatbotId - 机器人ID
   * @param modelType - 模型类型
   * @param config - 模型配置
   */
  updateModelConfig: async (chatbotId: string, modelType: string, config: any): Promise<any> => {
    return http.post<any>(`/aicenter/v1/chatbot/${chatbotId}/models/config`, {
      model_type: modelType,
      config: config
    });
  },

  /**
   * 获取机器人绑定的提示词列表
   * @param chatbotId - 机器人ID
   * @param promptType - 提示词类型（可选）
   */
  getChatbotPrompts: async (chatbotId: string, promptType?: string): Promise<any[]> => {
    let url = `/aicenter/v1/chatbot/${chatbotId}/prompts`;
    if (promptType) {
      url += `?prompt_type=${promptType}`;
    }
    return http.get<any[]>(url);
  },

  /**
   * 绑定提示词到机器人
   * @param chatbotId - 机器人ID
   * @param data - 绑定数据
   */
  bindPromptToChatbot: async (chatbotId: string,    data: {
      prompt_type: string;
      prompt_source: string;
      prompt_id?: string;
      prompt_name?: string;
      prompt_content?: string;
      sort_order?: number;
    }
  ): Promise<any> => {
    return http.post<any>(`/aicenter/v1/chatbot/${chatbotId}/prompts/bind`, data);
  },

  /**
   * 解绑机器人的提示词
   * @param chatbotId - 机器人ID
   * @param promptBindingId - 提示词绑定ID
   */
  unbindPromptFromChatbot: async (chatbotId: string, promptBindingId: string): Promise<any> => {
    return http.post<any>(`/aicenter/v1/chatbot/${chatbotId}/prompts/unbind`, {
      prompt_binding_id: promptBindingId
    });
  },

  /**
   * 更新提示词排序
   * @param chatbotId - 机器人ID
   * @param promptBindingId - 提示词绑定ID
   * @param sortOrder - 排序序号
   */
  updatePromptSortOrder: async (chatbotId: string, promptBindingId: string, sortOrder: number): Promise<any> => {
    return http.post<any>(`/aicenter/v1/chatbot/${chatbotId}/prompts/sort`, {
      prompt_binding_id: promptBindingId,
      sort_order: sortOrder
    });
  },

  /**
   * 获取机器人绑定的工具列表
   * @param chatbotId - 机器人ID
   */
  getChatbotTools: async (chatbotId: string): Promise<any[]> => {
    return http.get<any[]>(`/aicenter/v1/chatbot/${chatbotId}/tools`);
  },

  /**
   * 绑定工具到机器人
   * @param chatbotId - 机器人ID
   * @param mcpServerId - MCP服务ID
   * @param mcpToolId - MCP工具ID
   */
  bindToolToChatbot: async (chatbotId: string, mcpServerId: string, mcpToolId: string): Promise<any> => {
    return http.post<any>(`/aicenter/v1/chatbot/${chatbotId}/tools/bind`, {
      mcp_server_id: mcpServerId,
      mcp_tool_id: mcpToolId
    });
  },

  /**
   * 解绑机器人的工具
   * @param chatbotId - 机器人ID
   * @param toolBindingId - 工具绑定ID
   */
  unbindToolFromChatbot: async (chatbotId: string, toolBindingId: string): Promise<any> => {
    return http.post<any>(`/aicenter/v1/chatbot/${chatbotId}/tools/unbind`, {
      tool_binding_id: toolBindingId
    });
  },
};
