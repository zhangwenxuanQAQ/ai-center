/**
 * 全局HTTP请求工具类
 * 统一处理API请求、错误处理和消息提示
 */

import { message } from 'antd';

/**
 * API响应接口
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * 请求配置接口
 */
export interface RequestConfig extends RequestInit {
  showError?: boolean; // 是否显示错误提示，默认true
  showSuccess?: boolean; // 是否显示成功提示，默认false
  successMessage?: string; // 自定义成功消息
}

/**
 * 获取API基础URL
 */
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  return '';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * 全局HTTP请求函数
 * 
 * @param url - 请求URL
 * @param config - 请求配置
 * @returns Promise<T> - 返回数据
 */
export async function request<T = any>(
  url: string,
  config: RequestConfig = {}
): Promise<T> {
  const {
    showError = true,
    showSuccess = false,
    successMessage = '操作成功',
    ...requestConfig
  } = config;

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  try {
    const response = await fetch(fullUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...requestConfig,
    });

    // 检查HTTP状态码
    if (!response.ok) {
      const errorMsg = `HTTP Error: ${response.status} ${response.statusText}`;
      if (showError) {
        message.error(`网络请求失败: ${errorMsg}`);
      }
      throw new Error(errorMsg);
    }

    const result: ApiResponse<T> = await response.json();

    // 检查业务状态码
    if (result.code !== 200 && result.code !== 201) {
      if (showError) {
        message.error(result.message || '请求失败');
      }
      throw new Error(result.message || '请求失败');
    }

    // 显示成功消息
    if (showSuccess) {
      message.success(successMessage);
    }

    return result.data;
  } catch (error) {
    // 处理网络错误或其他异常
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      const errorMsg = '网络连接失败，请检查网络或后端服务是否启动';
      if (showError) {
        message.error(errorMsg);
      }
      throw new Error(errorMsg);
    }

    // 如果是其他错误且未显示过，则显示
    if (showError && error instanceof Error && !error.message.includes('HTTP Error')) {
      message.error(error.message || '请求异常');
    }

    throw error;
  }
}

/**
 * GET请求
 */
export async function get<T = any>(
  url: string,
  config?: RequestConfig
): Promise<T> {
  return request<T>(url, { ...config, method: 'GET' });
}

/**
 * POST请求
 */
export async function post<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<T> {
  return request<T>(url, {
    ...config,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT请求
 */
export async function put<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<T> {
  return request<T>(url, {
    ...config,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE请求
 */
export async function del<T = any>(
  url: string,
  config?: RequestConfig
): Promise<T> {
  return request<T>(url, { ...config, method: 'DELETE' });
}

/**
 * 导出默认请求对象
 */
export default {
  request,
  get,
  post,
  put,
  del,
};
