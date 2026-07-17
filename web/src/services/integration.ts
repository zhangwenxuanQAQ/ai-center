/**
 * 机器人插件集成服务
 * 提供机器人第三方插件集成相关的API调用
 */

import http from '../utils/request';

export interface IntegrationConfig {
  id: string;
  chatbot_id: string;
  api_key: string[];
  openai_base_url: string;
  configs?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface IntegrationConfigParam {
  key: string;
  label: string;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  default?: any;
  description?: string;
  options?: Array<{ label: string; value: string; color?: string }>;
  presets?: Array<{ label: string; key: string; color: string }>;
  avatar_type?: 'user' | 'bot';
  children?: IntegrationConfigParam[];
}

export interface IntegrationConfigsDetail {
  integration: IntegrationConfig | null;
  configs: {
    api_config: {
      chat: {
        request_example: {
          curl: string;
          python: string;
        };
        response_example: string;
      };
      get_messages: {
        request_example: {
          curl: string;
          python: string;
        };
        response_example: string;
      };
    };
    interface_config: {
      common_config: {
        theme: string;
        theme_mode: string;
        gradient_end_color: string;
        user_avatar: string;
        bot_avatar: string;
      };
      sidebar: Record<string, any>;
      iframe: Record<string, any>;
    };
    chat_config: {
      input_placeholder: string;
      max_input_length: number;
      welcome_messages: string[];
    };
    html_code: {
      sidebar: string;
      iframe: string;
    };
  };
}

export const integrationService = {
  /**
   * 获取机器人集成配置
   */
  getIntegration: async (chatbotId: string): Promise<IntegrationConfig | null> => {
    return http.get<IntegrationConfig | null>(`/aicenter/v1/integration/chatbot/${chatbotId}/integration`);
  },

  /**
   * 创建或更新集成配置
   */
  saveIntegration: async (chatbotId: string, data?: Record<string, any>): Promise<IntegrationConfig> => {
    return http.post<IntegrationConfig>(`/aicenter/v1/integration/chatbot/${chatbotId}/integration`, data);
  },

  /**
   * 重新生成API密钥
   */
  regenerateApiKey: async (chatbotId: string): Promise<IntegrationConfig> => {
    return http.post<IntegrationConfig>(`/aicenter/v1/integration/chatbot/${chatbotId}/integration/regenerate_key`);
  },

  /**
   * 获取嵌入HTML代码
   */
  getHtmlCode: async (chatbotId: string, type: string = 'sidebar'): Promise<{ html_code: string; type: string }> => {
    return http.get<{ html_code: string; type: string }>(`/aicenter/v1/integration/chatbot/${chatbotId}/integration/html_code?type=${type}`);
  },

  /**
   * 获取集成配置详情（含示例代码）
   */
  getIntegrationConfigs: async (chatbotId: string): Promise<IntegrationConfigsDetail> => {
    return http.get<IntegrationConfigsDetail>(`/aicenter/v1/integration/chatbot/${chatbotId}/integration/configs`);
  },

  /**
   * 获取集成配置参数定义（CONFIG_PARAMS）
   */
  getConfigParams: async (chatbotId?: string): Promise<IntegrationConfigParam[]> => {
    const url = chatbotId
      ? `/aicenter/v1/integration/config_params?chatbot_id=${chatbotId}`
      : `/aicenter/v1/integration/config_params`;
    return http.get<IntegrationConfigParam[]>(url);
  },

  /**
   * 重置集成配置到默认状态
   */
  resetIntegration: async (chatbotId: string): Promise<IntegrationConfig> => {
    return http.post<IntegrationConfig>(`/aicenter/v1/integration/chatbot/${chatbotId}/integration/reset`);
  },

  /**
   * 下载插件离线部署包
   */
  downloadPackage: (chatbotId: string, type: string = 'iframe'): string => {
    return `/aicenter/v1/integration/chatbot/${chatbotId}/integration/download?type=${type}`;
  },

  /**
   * 生成预览URL
   */
  generatePreviewUrl: async (params: Record<string, any>): Promise<{ token: string; preview_url: string }> => {
    return http.post<{ token: string; preview_url: string }>(`/aicenter/v1/integration/preview`, params);
  },
};
