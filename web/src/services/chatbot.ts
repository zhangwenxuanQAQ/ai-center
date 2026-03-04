const API_BASE_URL = '/aicenter/v1';

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

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  
  const result: ApiResponse<T> = await response.json();
  return result.data;
}

export const chatbotService = {
  getCategories: async (): Promise<ChatbotCategory[]> => {
    return fetchApi<ChatbotCategory[]>(`${API_BASE_URL}/chatbot_category`);
  },

  getChatbots: async (categoryId?: number): Promise<Chatbot[]> => {
    const params = categoryId ? `?category_id=${categoryId}` : '';
    return fetchApi<Chatbot[]>(`${API_BASE_URL}/chatbot${params}`);
  },

  getChatbot: async (id: number): Promise<Chatbot> => {
    return fetchApi<Chatbot>(`${API_BASE_URL}/chatbot/${id}`);
  },

  getSourceTypes: async (): Promise<any[]> => {
    return fetchApi<any[]>(`${API_BASE_URL}/chatbot/source_types`);
  }
};
