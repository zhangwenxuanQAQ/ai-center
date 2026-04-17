/**
 * 数据源服务
 * 提供数据源相关的API调用
 */

import http from '../utils/request';

export interface DatasourceCategory {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  parent_id?: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  children?: DatasourceCategory[];
}

export interface Datasource {
  id: string;
  code: string;
  name: string;
  type: string;
  category_id?: string;
  config?: Record<string, any>;
  status: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DatasourceType {
  datasource_type: string;
  datasource_name: string;
  config_fields: any[];
  category?: string;
}

export const datasourceService = {
  /**
   * 获取数据源分类列表
   * @param parent_id - 父分类ID，为null时获取顶级分类
   */
  getCategories: async (parent_id?: string | null): Promise<DatasourceCategory[]> => {
    let params = [];
    if (parent_id !== undefined && parent_id !== null) {
      params.push(`parent_id=${parent_id}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<DatasourceCategory[]>(`/aicenter/v1/datasource_category${queryString}`);
  },

  /**
   * 获取分类树结构
   */
  getCategoryTree: async (): Promise<DatasourceCategory[]> => {
    return http.get<DatasourceCategory[]>('/aicenter/v1/datasource_category/tree');
  },

  /**
   * 创建分类
   * @param data - 分类数据
   */
  createCategory: async (data: Partial<DatasourceCategory>): Promise<DatasourceCategory> => {
    return http.post<DatasourceCategory>('/aicenter/v1/datasource_category', data);
  },

  /**
   * 更新分类
   * @param id - 分类ID
   * @param data - 分类数据
   */
  updateCategory: async (id: string, data: Partial<DatasourceCategory>): Promise<DatasourceCategory> => {
    return http.post<DatasourceCategory>(`/aicenter/v1/datasource_category/${id}`, data);
  },

  /**
   * 删除分类
   * @param id - 分类ID
   */
  deleteCategory: async (id: string): Promise<DatasourceCategory> => {
    return http.post<DatasourceCategory>(`/aicenter/v1/datasource_category/${id}/delete`);
  },

  /**
   * 更新分类排序
   * @param id - 分类ID
   * @param sort_order - 新的排序值
   */
  updateCategoryOrder: async (id: string, sort_order: number): Promise<DatasourceCategory> => {
    return http.post<DatasourceCategory>(`/aicenter/v1/datasource_category/${id}/order`, { sort_order });
  },

  /**
   * 获取支持的数据源类型列表
   */
  getDatasourceTypes: async (): Promise<DatasourceType[]> => {
    return http.get<DatasourceType[]>('/aicenter/v1/datasource/types');
  },

  /**
   * 获取数据源列表
   * @param categoryId - 分类ID（可选）
   * @param page - 页码，默认1
   * @param pageSize - 每页数量，默认12
   * @param name - 数据源名称（模糊查询）
   * @param code - 数据源编码（模糊查询）
   * @param datasourceType - 数据源类型
   */
  getDatasources: async (categoryId?: string, page: number = 1, pageSize: number = 12, name?: string, code?: string, datasourceType?: string): Promise<{ data: Datasource[], total: number }> => {
    let params = [];
    if (categoryId) params.push(`category_id=${categoryId}`);
    const skip = (page - 1) * pageSize;
    params.push(`skip=${skip}`);
    params.push(`limit=${pageSize}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (code) params.push(`code=${encodeURIComponent(code)}`);
    if (datasourceType) params.push(`datasource_type=${encodeURIComponent(datasourceType)}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<{ data: Datasource[], total: number }>(`/aicenter/v1/datasource${queryString}`);
  },

  /**
   * 获取单个数据源
   * @param id - 数据源ID
   */
  getDatasource: async (id: string): Promise<Datasource> => {
    return http.get<Datasource>(`/aicenter/v1/datasource/${id}`);
  },

  /**
   * 创建数据源
   * @param data - 数据源数据
   */
  createDatasource: async (data: Partial<Datasource>): Promise<Datasource> => {
    return http.post<Datasource>('/aicenter/v1/datasource', data);
  },

  /**
   * 更新数据源
   * @param id - 数据源ID
   * @param data - 数据源数据
   */
  updateDatasource: async (id: string, data: Partial<Datasource>): Promise<Datasource> => {
    return http.post<Datasource>(`/aicenter/v1/datasource/${id}`, data);
  },

  /**
   * 删除数据源
   * @param id - 数据源ID
   */
  deleteDatasource: async (id: string): Promise<Datasource> => {
    return http.post<Datasource>(`/aicenter/v1/datasource/${id}/delete`);
  },

  /**
   * 测试数据源连接
   * @param id - 数据源ID
   */
  testConnection: async (id: string, data?: any): Promise<any> => {
    if (id === 'test' && data) {
      return http.post<any>('/aicenter/v1/datasource/test_connection', data);
    }
    return http.post<any>(`/aicenter/v1/datasource/${id}/test_connection`);
  },

  /**
   * 执行数据源查询
   * @param id - 数据源ID
   * @param query - 查询语句
   * @param params - 查询参数
   */
  executeQuery: async (id: string, query: string, params?: any): Promise<any> => {
    return http.post<any>(`/aicenter/v1/datasource/${id}/query`, { query, params });
  },

  /**
   * 获取数据源Schema信息
   * @param id - 数据源ID
   */
  getSchema: async (id: string): Promise<any> => {
    return http.get<any>(`/aicenter/v1/datasource/${id}/schema`);
  },

  /**
   * 列出文件（仅适用于文件存储类型数据源）
   * @param id - 数据源ID
   * @param bucket - Bucket名称（可选）
   * @param prefix - 文件前缀/目录（可选）
   * @param maxKeys - 最大返回数量
   * @param searchKeyword - 搜索关键词（可选）
   */
  listFiles: async (id: string, bucket?: string, prefix?: string, maxKeys: number = 100, searchKeyword?: string): Promise<any> => {
    let params = [`max_keys=${maxKeys}`];
    if (bucket) params.push(`bucket=${encodeURIComponent(bucket)}`);
    if (prefix) params.push(`prefix=${encodeURIComponent(prefix)}`);
    if (searchKeyword) params.push(`search_keyword=${encodeURIComponent(searchKeyword)}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<any>(`/aicenter/v1/datasource/${id}/files${queryString}`);
  },

  /**
   * 下载文件（仅适用于文件存储类型数据源）
   * @param id - 数据源ID
   * @param bucket - Bucket名称（可选）
   * @param objectName - 对象名称/文件路径
   */
  downloadFile: async (id: string, bucket: string | undefined, objectName: string): Promise<any> => {
    return http.post<any>(`/aicenter/v1/datasource/${id}/files/download`, { bucket, object_name: objectName });
  },

  /**
   * 列出数据库表（仅适用于关系型数据库数据源）
   * @param id - 数据源ID
   * @param database - 数据库名称（可选）
   */
  listTables: async (id: string, database?: string): Promise<any> => {
    let params = [];
    if (database) params.push(`database=${encodeURIComponent(database)}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<any>(`/aicenter/v1/datasource/${id}/tables${queryString}`);
  },

  /**
   * 获取表的字段信息（仅适用于关系型数据库数据源）
   * @param id - 数据源ID
   * @param tableName - 表名称
   * @param database - 数据库名称（可选）
   */
  getTableColumns: async (id: string, tableName: string, database?: string): Promise<any> => {
    let params = [];
    if (database) params.push(`database=${encodeURIComponent(database)}`);
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<any>(`/aicenter/v1/datasource/${id}/tables/${encodeURIComponent(tableName)}/columns${queryString}`);
  },
};
