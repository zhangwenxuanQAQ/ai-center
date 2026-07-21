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
  role: 'user' | 'assistant' | 'tool';
  content: string;
  extra_content?: any;
  created_at: string;
  reasoning_content?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface QueryItem {
  type: 'text' | 'file_base64' | 'document';
  content: string | Record<string, any>;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
}

export interface FileInfo {
  type: 'local' | 'datasource';
  file_name: string;
  mime_type?: string;
  file_size?: number;
  base64_content?: string;
  datasource_id?: string;
  bucket?: string;
  location?: string;
}

export const chatService = {
  abort_controller: null as AbortController | null,
  // 按对话ID存储各自的abort_controller，支持多对话同时流式输出
  abortControllersMap: new Map<string, AbortController>(),
  // 按对话ID存储正在接收的流式消息缓存
  streamingMessagesMap: new Map<string, {
    messages: Message[];
    isStreaming: boolean;
    userMessageId: string;
    assistantMessageId: string;
    currentContent: string;
    currentReasoningContent: string;
  }>(),

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
   * 发送消息（支持文件）
   * @param query - 查询数组，支持text/file_base64/document类型
   * @param modelId - 模型ID
   * @param chatbotId - 机器人ID
   * @param chatId - 对话ID
   * @param config - 对话配置
   * @param stream - 是否流式输出，默认true
   */
  sendMessageWithFiles: async (
    query: QueryItem[],
    modelId?: string,
    chatbotId?: string,
    chatId?: string,
    config?: { temperature?: number; max_tokens?: number; top_p?: number },
    stream: boolean = true
  ): Promise<Message> => {
    return http.post<Message>('/aicenter/v1/chat/completions', {
      query,
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
    config?: { temperature?: number; max_tokens?: number; top_p?: number; deep_thinking?: boolean },
    messageId?: string,
    systemPrompt?: string,
    onMessage?: (data: any) => void,
    onError?: (error: any) => void,
    onComplete?: () => void
  ) => {
    // 调用 sendMessageStreamWithFiles 方法，将文本内容转换为 query 数组
    return chatService.sendMessageStreamWithFiles(
      [{ type: 'text', content }],
      modelId,
      chatbotId,
      chatId,
      config,
      messageId,
      systemPrompt,
      onMessage,
      onError,
      onComplete
    );
  },

  /**
   * 流式发送消息（支持文件）
   * @param query - 查询数组，支持text/file_base64/document类型
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
  sendMessageStreamWithFiles: async (
    query: QueryItem[],
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
    // 如果有 chatId，使用按对话分离的 abort_controller
    // 否则使用全局的 abort_controller（兼容旧逻辑）
    let abortController: AbortController;
    
    if (chatId) {
      // 中断该对话之前的请求
      const existingController = chatService.abortControllersMap.get(chatId);
      if (existingController) {
        existingController.abort();
      }
      
      // 创建新的 abort_controller
      abortController = new AbortController();
      chatService.abortControllersMap.set(chatId, abortController);
      
      // 初始化该对话的流式消息缓存
      chatService.streamingMessagesMap.set(chatId, {
        messages: [],
        isStreaming: true,
        userMessageId: '',
        assistantMessageId: '',
        currentContent: '',
        currentReasoningContent: ''
      });
    } else {
      // 兼容旧逻辑：没有 chatId 时使用全局 abort_controller
      if (chatService.abort_controller) {
        chatService.abort_controller.abort();
      }
      abortController = new AbortController();
      chatService.abort_controller = abortController;
    }
    
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
    const url = `${API_BASE_URL}/aicenter/v1/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          model_id: modelId,
          chatbot_id: chatbotId,
          chat_id: chatId,
          config: config,
          stream: true,
          message_id: messageId,
          system_prompt: systemPrompt
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const error = await response.json();
        // 清理缓存
        if (chatId) {
          chatService.streamingMessagesMap.delete(chatId);
        }
        if (onError) {
          onError(error);
        }
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        // 清理缓存
        if (chatId) {
          chatService.streamingMessagesMap.delete(chatId);
        }
        if (onError) {
          onError(new Error('No response body'));
        }
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              if (dataStr === '[DONE]') {
                // 完成时清理该对话的流式缓存
                if (chatId) {
                  const cache = chatService.streamingMessagesMap.get(chatId);
                  if (cache) {
                    cache.isStreaming = false;
                  }
                }
                if (onComplete) {
                  onComplete();
                }
                return;
              }
              
              try {
                const data = JSON.parse(dataStr);
                
                // 将消息存储到缓存中（无论是否有error字段）
                if (chatId) {
                  chatService.addToStreamingCache(chatId, data);
                }
                
                // 即使包含 error 字段，也通过 onMessage 传递，让前端统一处理
                // 前端会根据 status === 'error' 来决定如何显示错误信息
                if (onMessage) {
                  onMessage(data);
                }
              } catch (error) {
                console.error('Error parsing SSE data:', error);
              }
            }
          }
        }
        
        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              if (dataStr === '[DONE]') {
                // 完成时清理该对话的流式缓存
                if (chatId) {
                  const cache = chatService.streamingMessagesMap.get(chatId);
                  if (cache) {
                    cache.isStreaming = false;
                  }
                }
                if (onComplete) {
                  onComplete();
                }
                return;
              }
              
              try {
                const data = JSON.parse(dataStr);
                
                // 将消息存储到缓存中（无论是否有error字段）
                if (chatId) {
                  chatService.addToStreamingCache(chatId, data);
                }
                
                // 即使包含 error 字段，也通过 onMessage 传递，让前端统一处理
                if (onMessage) {
                  onMessage(data);
                }
              } catch (error) {
                console.error('Error parsing remaining SSE data:', error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted by user');
        // 用户中断时保留缓存（切换对话场景）
        if (chatId) {
          const cache = chatService.streamingMessagesMap.get(chatId);
          if (cache) {
            cache.isStreaming = false;
          }
        }
        if (onComplete) {
          onComplete();
        }
      } else {
        console.error('Fetch error:', error);
        // 其他错误时清理缓存
        if (chatId) {
          chatService.streamingMessagesMap.delete(chatId);
        }
        if (onError) {
          onError(error);
        }
      }
    }
  },

  /**
   * 将消息添加到流式缓存
   * @param chatId - 对话ID
   * @param data - SSE消息数据
   */
  addToStreamingCache: (chatId: string, data: any) => {
    const cache = chatService.streamingMessagesMap.get(chatId);
    if (!cache) return;
    
    // 根据消息类型更新缓存
    if (data.user_message_id) {
      cache.userMessageId = data.user_message_id;
    }
    if (data.assistant_message_id) {
      cache.assistantMessageId = data.assistant_message_id;
    }
    if (data.text) {
      cache.currentContent += data.text;
    }
    if (data.reasoning_content) {
      cache.currentReasoningContent += data.reasoning_content;
    }
    
    // 存储完整的消息数据用于恢复
    cache.messages.push(data);
  },

  /**
   * 获取对话的流式消息缓存
   * @param chatId - 对话ID
   */
  getStreamingCache: (chatId: string) => {
    return chatService.streamingMessagesMap.get(chatId);
  },

  /**
   * 清理对话的流式消息缓存
   * @param chatId - 对话ID
   */
  clearStreamingCache: (chatId: string) => {
    chatService.streamingMessagesMap.delete(chatId);
    chatService.abortControllersMap.delete(chatId);
  },

  /**
   * 检查对话是否有正在进行的流式输出
   * @param chatId - 对话ID
   */
  isStreaming: (chatId: string) => {
    const cache = chatService.streamingMessagesMap.get(chatId);
    return cache?.isStreaming ?? false;
  },

  /**
   * 中断指定对话的流式输出（不清理缓存）
   * @param chatId - 对话ID
   */
  abortConversation: (chatId: string) => {
    const controller = chatService.abortControllersMap.get(chatId);
    if (controller) {
      controller.abort();
    }
  },

  stopCurrentRequest: () => {
    if (chatService.abort_controller) {
      chatService.abort_controller.abort();
      chatService.abort_controller = null;
    }
  },

  stopChat: async (chatId: string): Promise<any> => {
    return http.post(`/aicenter/v1/chat/stop`, {
      chat_id: chatId
    });
  },

  /**
   * 更新消息的extra_content
   * @param chatId - 对话ID
   * @param messageId - 消息ID
   * @param extraContent - 额外内容JSON
   */
  updateMessageExtraContent: async (
    chatId: string,
    messageId: string,
    extraContent: any
  ): Promise<any> => {
    return http.post(`/aicenter/v1/chat/update_message_extra_content`, {
      chat_id: chatId,
      message_id: messageId,
      extra_content: extraContent
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
  },

  /**
   * 下载文件
   * @param fileType - 文件类型：local/datasource
   * @param fileName - 文件名
   * @param base64Content - 本地文件的base64内容（local类型时必填）
   * @param datasourceId - 数据源ID（datasource类型时必填）
   * @param bucket - 桶名称（datasource类型时可选）
   * @param location - 文件路径（datasource类型时必填）
   */
  downloadFile: async (
    fileType: 'local' | 'datasource',
    fileName: string,
    base64Content?: string,
    datasourceId?: string,
    bucket?: string,
    location?: string
  ): Promise<void> => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
    
    try {
      let response;
      
      if (fileType === 'local' && base64Content) {
        // 对于本地文件，使用POST请求的body发送base64内容
        response = await fetch(`${API_BASE_URL}/aicenter/v1/chat/download_file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            file_type: fileType,
            file_name: fileName,
            base64_content: base64Content
          })
        });
      } else if (fileType === 'datasource') {
        // 对于数据源文件，使用URL查询参数
        let url = `${API_BASE_URL}/aicenter/v1/chat/download_file?file_type=${fileType}&file_name=${encodeURIComponent(fileName)}`;
        
        if (datasourceId) {
          url += `&datasource_id=${datasourceId}`;
        }
        if (bucket) {
          url += `&bucket=${encodeURIComponent(bucket)}`;
        }
        if (location) {
          url += `&location=${encodeURIComponent(location)}`;
        }
        
        response = await fetch(url, {
          method: 'POST'
        });
      } else {
        throw new Error('无效的文件类型或参数');
      }

      if (!response.ok) {
        throw new Error('下载文件失败');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('下载文件失败:', error);
      throw error;
    }
  },

  /**
   * 查询指定对话的流式状态
   * 用于F5刷新后检测是否有正在进行的流式任务
   * @param chatId - 对话ID
   */
  getStreamingStatus: async (chatId: string): Promise<{ is_streaming: boolean; status: string; chunks_count: number }> => {
    return http.get<{ is_streaming: boolean; status: string; chunks_count: number }>(`/aicenter/v1/chat/streaming_status/${chatId}`);
  },

  /**
   * 重连流式输出
   * F5刷新后，通过此方法重新获取流式数据（包含历史chunks + 新chunks）
   * @param chatId - 对话ID
   * @param onMessage - 消息回调函数
   * @param onError - 错误回调函数
   * @param onComplete - 完成回调函数
   */
  reconnectStream: async (
    chatId: string,
    onMessage?: (data: any) => void,
    onError?: (error: any) => void,
    onComplete?: () => void
  ) => {
    // 中断该对话之前的请求
    const existingController = chatService.abortControllersMap.get(chatId);
    if (existingController) {
      existingController.abort();
    }

    const abortController = new AbortController();
    chatService.abortControllersMap.set(chatId, abortController);

    // 初始化流式消息缓存
    chatService.streamingMessagesMap.set(chatId, {
      messages: [],
      isStreaming: true,
      userMessageId: '',
      assistantMessageId: '',
      currentContent: '',
      currentReasoningContent: ''
    });

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
    const url = `${API_BASE_URL}/aicenter/v1/chat/reconnect_stream/${chatId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
        signal: abortController.signal
      });

      if (!response.ok) {
        if (chatId) {
          chatService.streamingMessagesMap.delete(chatId);
        }
        if (onError) {
          onError(new Error('重连失败'));
        }
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        if (chatId) {
          chatService.streamingMessagesMap.delete(chatId);
        }
        if (onError) {
          onError(new Error('No response body'));
        }
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              if (dataStr === '[DONE]') {
                // 完成时更新缓存状态
                const cache = chatService.streamingMessagesMap.get(chatId);
                if (cache) {
                  cache.isStreaming = false;
                }
                if (onComplete) {
                  onComplete();
                }
                return;
              }

              try {
                const data = JSON.parse(dataStr);
                // 将消息存储到缓存中
                chatService.addToStreamingCache(chatId, data);
                if (onMessage) {
                  onMessage(data);
                }
              } catch (error) {
                console.error('Error parsing SSE data:', error);
              }
            }
          }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              if (dataStr === '[DONE]') {
                const cache = chatService.streamingMessagesMap.get(chatId);
                if (cache) {
                  cache.isStreaming = false;
                }
                if (onComplete) {
                  onComplete();
                }
                return;
              }
              try {
                const data = JSON.parse(dataStr);
                chatService.addToStreamingCache(chatId, data);
                if (onMessage) {
                  onMessage(data);
                }
              } catch (error) {
                console.error('Error parsing SSE data:', error);
              }
            }
          }
        }

        // 流结束但未收到[DONE]
        const cache = chatService.streamingMessagesMap.get(chatId);
        if (cache) {
          cache.isStreaming = false;
        }
        if (onComplete) {
          onComplete();
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('重连请求被中止');
        } else {
          console.error('重连流式读取错误:', error);
          if (onError) {
            onError(error);
          }
        }
      }
    } catch (error: any) {
      console.error('重连失败:', error);
      if (chatId) {
        chatService.streamingMessagesMap.delete(chatId);
      }
      if (onError) {
        onError(error);
      }
    }
  }
};
