/**
 * 集成聊天插件 API 服务
 * 调用 /aicenter/api/v1/ 下的 OpenAI 兼容接口
 */

export interface IntegrationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_content?: string;
  created_at: string;
}

export interface IntegrationChat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationQueryItem {
  type: 'text' | 'file_base64';
  content: string;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
}

/**
 * 获取API基础URL
 * 使用环境变量配置，与 request.ts 保持一致
 */
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  // 生产环境或同域部署时使用相对路径
  return '';
};

const API_BASE_URL = getApiBaseUrl();

export const integrationChatService = {
  /**
   * 获取对话列表
   */
  getChats: async (apiKey: string): Promise<{ items: IntegrationChat[]; total: number }> => {
    const res = await fetch(`${API_BASE_URL}/aicenter/api/v1/chats`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.message || '获取对话列表失败');
    return data.data;
  },

  /**
   * 获取对话消息
   */
  getMessages: async (apiKey: string, chatId: string): Promise<{ items: IntegrationMessage[]; total: number }> => {
    const res = await fetch(`${API_BASE_URL}/aicenter/api/v1/chat/${chatId}/messages`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.message || '获取消息失败');
    return data.data;
  },

  /**
   * 流式发送消息
   */
  sendMessageStream: async (
    apiKey: string,
    query: IntegrationQueryItem[],
    chatId?: string,
    onMessage?: (data: any) => void,
    onError?: (error: any) => void,
    onComplete?: () => void,
    abortSignal?: AbortSignal,
    temporary?: boolean,
    deepThinking?: boolean
  ): Promise<void> => {
    const body: Record<string, any> = {
      query,
      stream: true,
    };
    if (chatId) body.chat_id = chatId;
    if (temporary) body.temporary = true;
    if (deepThinking) {
      body.config = { deep_thinking: true };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/aicenter/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: abortSignal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            onComplete?.();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              onError?.(parsed.error);
            } else {
              onMessage?.(parsed);
            }
          } catch {
            // skip invalid JSON
          }
        }
      }
      onComplete?.();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError?.(err);
    }
  },

  /**
   * 停止聊天（客户端中断）
   */
  createAbortController: (): AbortController => {
    return new AbortController();
  },
};
