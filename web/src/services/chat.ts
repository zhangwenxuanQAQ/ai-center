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
  is_top: boolean;
  model_id?: string;
  chatbot_id?: string;
  config?: string | Record<string, any>;
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
   * 获取对话详情
   * @param conversationId - 对话ID
   */
  getConversation: async (conversationId: string): Promise<Conversation> => {
    return http.get<Conversation>(`/aicenter/v1/chat/${conversationId}`);
  },

  /**
   * 创建对话
   * @param title - 对话标题
   * @param modelId - 模型ID
   * @param chatbotId - 机器人ID
   * @param config - 对话配置
   * @param systemPrompt - 系统提示词
   */
  createConversation: async (
    title: string = '新对话',
    modelId?: string,
    chatbotId?: string,
    config?: { temperature?: number; max_tokens?: number; top_p?: number },
    systemPrompt?: string
  ): Promise<Conversation> => {
    return http.post<Conversation>('/aicenter/v1/chat/create', {
      title,
      model_id: modelId,
      chatbot_id: chatbotId,
      config: config,
      system_prompt: systemPrompt
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
   * @param content - 消息内容
   * @param modelId - 模型ID
   * @param chatbotId - 机器人ID
   * @param chatId - 对话ID
   * @param config - 对话配置
   * @param stream - 是否流式输出，默认true
   */
  sendMessage: async (
    content: string,
    modelId?: string,
    chatbotId?: string,
    chatId?: string,
    config?: { temperature?: number; max_tokens?: number; top_p?: number },
    stream: boolean = true
  ): Promise<Message> => {
    return http.post<Message>('/aicenter/v1/chat/completions', {
      query: [{ type: 'text', content }],
      model_id: modelId,
      chatbot_id: chatbotId,
      chat_id: chatId,
      config: config,
      stream: stream
    });
  },

  /**
   * 流式发送消息
   * @param content - 消息内容
   * @param modelId - 模型ID
   * @param chatbotId - 机器人ID
   * @param chatId - 对话ID
   * @param config - 对话配置
   * @param messageId - 消息ID，用于标识重新回答或编辑问题
   * @param systemPrompt - 系统提示词
   * @param onMessage - 消息回调函数
   * @param onError - 错误回调函数
   * @param onComplete - 完成回调函数
   */
  sendMessageStream: async (
    content: string,
    modelId?: string,
    chatbotId?: string,
    chatId?: string,
    config?: { temperature?: number; max_tokens?: number; top_p?: number },
    messageId?: string,
    systemPrompt?: string,
    onMessage?: (data: any) => void,
    onError?: (error: any) => void,
    onComplete?: () => void
  ) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
    const url = `${API_BASE_URL}/aicenter/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: [{ type: 'text', content }],
        model_id: modelId,
        chatbot_id: chatbotId,
        chat_id: chatId,
        config: config,
        stream: true,
        message_id: messageId,
        system_prompt: systemPrompt
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (onError) {
        onError(error);
      }
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      if (onError) {
        onError(new Error('No response body'));
      }
      return;
    }

    const decoder = new TextDecoder();
    let fullResponse = '';
    let fullReasoning = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (dataStr === '[DONE]') {
              if (onComplete) {
                onComplete();
              }
              return;
            }
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                if (onError) {
                  onError(data.error);
                }
                return;
              }
              
              if (data.text) {
                fullResponse += data.text;
              }
              
              if (data.reasoning_content) {
                fullReasoning += data.reasoning_content;
              }
              
              if (onMessage) {
                onMessage({
                  ...data,
                  full_text: fullResponse,
                  full_reasoning: fullReasoning
                });
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    } finally {
      reader.releaseLock();
    }
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
   * 更新对话配置
   * @param conversationId - 对话ID
   * @param config - 配置信息
   */
  updateConversationConfig: async (
    conversationId: string,
    config: {
      system_prompt?: string;
      config?: Record<string, any>;
      model_id?: string;
      chatbot_id?: string;
    }
  ): Promise<Conversation> => {
    return http.post<Conversation>(`/aicenter/v1/chat/update/${conversationId}`, config);
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
   * 清空对话消息
   * @param conversationId - 对话ID
   */
  clearMessages: async (conversationId: string): Promise<boolean> => {
    await http.post<void>(`/aicenter/v1/chat/${conversationId}/clear_messages`);
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
