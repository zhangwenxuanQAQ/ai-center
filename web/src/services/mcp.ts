/**
 * MCP服务
 * 提供MCP相关的API调用
 */

import http from '../utils/request';

export interface MCPCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  children?: MCPCategory[];
}

export interface MCPServer {
  id: string;
  code: string;
  name: string;
  description?: string;
  url: string;
  api_key?: string;
  transport_type: string;
  source_type: string;
  category_id?: string;
  config?: string;
  avatar?: string;
  created_at: string;
  updated_at?: string;
}

export interface MCPConnectionTest {
  transport_type: string;
  url?: string;
  config?: string;
}

export interface MCPConnectionTestResult {
  success: boolean;
  message: string;
  server_info?: Record<string, unknown>;
}

export interface MCPTool {
  id: string;
  name: string;
  title?: string;
  description?: string;
  tool_type: string;
  server_id: string;
  config?: string;
  extra_config?: string;
  status: boolean;
  created_at: string;
  updated_at?: string;
}

export const mcpService = {
  /**
   * 获取MCP分类列表
   */
  getCategories: async (skip: number = 0, limit: number = 100): Promise<MCPCategory[]> => {
    return http.get<MCPCategory[]>(`/aicenter/v1/mcp/category?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取MCP分类树形结构
   */
  getCategoryTree: async (): Promise<MCPCategory[]> => {
    return http.get<MCPCategory[]>('/aicenter/v1/mcp/category/tree');
  },

  /**
   * 创建MCP分类
   */
  createCategory: async (data: Partial<MCPCategory>): Promise<MCPCategory> => {
    return http.post<MCPCategory>('/aicenter/v1/mcp/category', data);
  },

  /**
   * 更新MCP分类
   */
  updateCategory: async (id: string, data: Partial<MCPCategory>): Promise<MCPCategory> => {
    return http.post<MCPCategory>(`/aicenter/v1/mcp/category/${id}`, data);
  },

  /**
   * 删除MCP分类
   */
  deleteCategory: async (id: string): Promise<MCPCategory> => {
    return http.post<MCPCategory>(`/aicenter/v1/mcp/category/${id}/delete`);
  },

  /**
   * 获取MCP服务来源类型
   */
  getSourceTypes: async (): Promise<Record<string, string>> => {
    return http.get<Record<string, string>>('/aicenter/v1/mcp/server/source_types');
  },

  /**
   * 获取MCP服务传输类型
   */
  getTransportTypes: async (): Promise<Record<string, string>> => {
    return http.get<Record<string, string>>('/aicenter/v1/mcp/server/transport_types');
  },

  /**
   * 获取本地MCP服务配置
   */
  getLocalMcpConfig: async (): Promise<{ host: string; port: number; transport_type: string }> => {
    return http.get<{ host: string; port: number; transport_type: string }>('/aicenter/v1/mcp/server/local_config');
  },

  /**
   * 测试MCP服务连接
   */
  testConnection: async (data: MCPConnectionTest): Promise<MCPConnectionTestResult> => {
    return http.post<MCPConnectionTestResult>('/aicenter/v1/mcp/server/test_connection', data);
  },

  /**
   * 获取MCP服务列表（分页）
   */
  getServers: async (page: number = 1, pageSize: number = 12, category_id?: string, name?: string, source_type?: string, code?: string): Promise<{ data: MCPServer[], total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (category_id) params.push(`category_id=${category_id}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (source_type) params.push(`source_type=${encodeURIComponent(source_type)}`);
    if (code) params.push(`code=${encodeURIComponent(code)}`);
    return http.get<{ data: MCPServer[], total: number }>(`/aicenter/v1/mcp/server?${params.join('&')}`);
  },

  /**
   * 获取单个MCP服务
   */
  getServer: async (id: string): Promise<MCPServer> => {
    return http.get<MCPServer>(`/aicenter/v1/mcp/server/${id}`);
  },

  /**
   * 创建MCP服务
   */
  createServer: async (data: Partial<MCPServer>): Promise<MCPServer> => {
    return http.post<MCPServer>('/aicenter/v1/mcp/server', data);
  },

  /**
   * 更新MCP服务
   */
  updateServer: async (id: string, data: Partial<MCPServer>): Promise<MCPServer> => {
    return http.post<MCPServer>(`/aicenter/v1/mcp/server/${id}`, data);
  },

  /**
   * 删除MCP服务
   */
  deleteServer: async (id: string): Promise<MCPServer> => {
    return http.post<MCPServer>(`/aicenter/v1/mcp/server/${id}/delete`);
  },

  /**
   * 导入MCP工具
   */
  importTools: async (serverId: string, tools: Partial<MCPTool>[]): Promise<MCPTool[]> => {
    return http.post<MCPTool[]>(`/aicenter/v1/mcp/server/${serverId}/import_tools`, tools);
  },

  /**
   * 获取MCP服务远程工具列表（能力列表）
   */
  getRemoteTools: async (serverId: string, page: number = 0, pageSize: number = 20, name?: string, description?: string): Promise<{ data: MCPTool[], total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (description) params.push(`description=${encodeURIComponent(description)}`);
    return http.get<{ data: MCPTool[], total: number }>(`/aicenter/v1/mcp/server/${serverId}/remote_tools?${params.join('&')}`);
  },

  /**
   * 解析Swagger并返回工具列表
   */
  parseSwagger: async (
    serverId: string, 
    swaggerUrl?: string, 
    swaggerJson?: string,
    baseUrl?: string,
    headers?: Record<string, string>
  ): Promise<{ data: MCPTool[], total: number }> => {
    return http.post<{ data: MCPTool[], total: number }>(`/aicenter/v1/mcp/server/${serverId}/parse_swagger`, {
      swagger_url: swaggerUrl,
      swagger_json: swaggerJson,
      base_url: baseUrl,
      headers: headers
    });
  },

  /**
   * 获取MCP工具列表（分页）
   */
  getTools: async (page: number = 0, pageSize: number = 10, server_id?: string, name?: string, description?: string, status?: string): Promise<{ data: MCPTool[], total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (server_id) params.push(`server_id=${server_id}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (description) params.push(`description=${encodeURIComponent(description)}`);
    if (status !== undefined && status !== '') params.push(`status=${status}`);
    return http.get<{ data: MCPTool[], total: number }>(`/aicenter/v1/mcp/tool?${params.join('&')}`);
  },

  /**
   * 获取单个MCP工具
   */
  getTool: async (id: string): Promise<MCPTool> => {
    return http.get<MCPTool>(`/aicenter/v1/mcp/tool/${id}`);
  },

  /**
   * 创建MCP工具
   */
  createTool: async (data: Partial<MCPTool>): Promise<MCPTool> => {
    return http.post<MCPTool>('/aicenter/v1/mcp/tool', data);
  },

  /**
   * 更新MCP工具
   */
  updateTool: async (id: string, data: Partial<MCPTool>): Promise<MCPTool> => {
    return http.post<MCPTool>(`/aicenter/v1/mcp/tool/${id}`, data);
  },

  /**
   * 删除MCP工具
   */
  deleteTool: async (id: string): Promise<MCPTool> => {
    return http.post<MCPTool>(`/aicenter/v1/mcp/tool/${id}/delete`);
  },

  /**
   * 批量删除MCP工具
   */
  batchDeleteTools: async (toolIds: string[]): Promise<{ deleted_count: number }> => {
    return http.post<{ deleted_count: number }>('/aicenter/v1/mcp/tools/batch_delete', toolIds);
  },

  /**
   * 测试MCP工具
   */
  testTool: async (toolId: string, params: Record<string, any>): Promise<any> => {
    return http.post<any>(`/aicenter/v1/mcp/tool/${toolId}/test`, params);
  },
};
