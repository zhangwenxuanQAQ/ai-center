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
    // 只有当不是 FormData 时才设置 Content-Type
    const headers: Record<string, string> = {};
    if (!(requestConfig.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(fullUrl, {
      headers,
      ...requestConfig,
    });

    // 解析响应体
    const result: ApiResponse<T> = await response.json();

    // 检查业务状态码
    if (result.code !== 200 && result.code !== 201) {
      // 只抛出错误，不显示错误消息，由调用方处理
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

    // 处理业务错误
    if (error instanceof Error) {
      if (showError) {
        message.error(error.message);
      }
      throw error;
    }

    // 其他未知错误
    const errorMsg = '发生未知错误';
    if (showError) {
      message.error(errorMsg);
    }
    throw new Error(errorMsg);
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
  // 如果是 FormData，直接传递，不使用 JSON.stringify
  const body = data instanceof FormData 
    ? data 
    : (data ? JSON.stringify(data) : undefined);
  
  return request<T>(url, {
    ...config,
    method: 'POST',
    body,
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
