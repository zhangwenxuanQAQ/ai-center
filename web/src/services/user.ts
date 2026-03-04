/**
 * 用户服务
 * 提供用户相关的API调用
 */

import http from '../utils/request';

export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  updated_at?: string;
}

export interface UserLogin {
  username: string;
  password: string;
}

export const userService = {
  /**
   * 获取用户列表
   */
  getUsers: async (skip: number = 0, limit: number = 100): Promise<User[]> => {
    return http.get<User[]>(`/aicenter/v1/user?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取单个用户
   */
  getUser: async (id: number): Promise<User> => {
    return http.get<User>(`/aicenter/v1/user/${id}`);
  },

  /**
   * 创建用户
   */
  createUser: async (data: Partial<User>): Promise<User> => {
    return http.post<User>('/aicenter/v1/user', data);
  },

  /**
   * 更新用户
   */
  updateUser: async (id: number, data: Partial<User>): Promise<User> => {
    return http.post<User>(`/aicenter/v1/user/${id}`, data);
  },

  /**
   * 删除用户
   */
  deleteUser: async (id: number): Promise<User> => {
    return http.post<User>(`/aicenter/v1/user/${id}/delete`);
  },

  /**
   * 用户登录
   */
  login: async (data: UserLogin): Promise<{ access_token: string; token_type: string }> => {
    return http.post('/aicenter/v1/user/login', data);
  },
};
