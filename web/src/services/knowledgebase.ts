/**
 * 知识库服务
 * 提供知识库相关的API调用
 */

import http from '../utils/request';

export interface Knowledgebase {
  id: string;
  name: string;
  code: string;
  description: string;
  avatar?: string;
  category_id?: string;
  embedding_model_id?: string;
  rerank_model_id?: string;
  text_model_id?: string;
  doc_num: number;
  token_num: number;
  chunk_num: number;
  retrieval_config?: Record<string, unknown>;
  status: boolean;
  created_at: string;
  updated_at?: string;
}

export interface KnowledgebaseCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
  children?: KnowledgebaseCategory[];
}

export interface KnowledgebaseDocumentCategory {
  id: string;
  kb_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  children?: KnowledgebaseDocumentCategory[];
}

export interface KnowledgebaseDocument {
  id: string;
  kb_id: string;
  category_id?: string;
  tags?: string[];
  chunk_method: string;
  chunk_config?: Record<string, unknown>;
  token_num: number;
  chunk_num: number;
  file_type?: string;
  file_name?: string;
  location?: string;
  file_size: number;
  source_type?: string;
  source_config?: Record<string, unknown> | string;
  thumbnail?: string;
  running_status: string;
  status: boolean;
  task_progress: number;
  task_begin_at?: string;
  task_end_at?: string;
  task_duration: number;
  created_at: string;
  updated_at?: string;
}

export const knowledgebaseService = {
  /**
   * 获取知识库分类树
   */
  getCategoryTree: async (): Promise<KnowledgebaseCategory[]> => {
    return http.get<KnowledgebaseCategory[]>(
      '/aicenter/v1/knowledgebase/category/tree'
    ) || [];
  },

  /**
   * 创建分类
   */
  createCategory: async (data: Partial<KnowledgebaseCategory>): Promise<KnowledgebaseCategory> => {
    return http.post<KnowledgebaseCategory>(
      '/aicenter/v1/knowledgebase/category',
      data
    );
  },

  /**
   * 更新分类
   */
  updateCategory: async (id: string, data: Partial<KnowledgebaseCategory>): Promise<KnowledgebaseCategory> => {
    return http.post<KnowledgebaseCategory>(
      `/aicenter/v1/knowledgebase/category/${id}`,
      data
    );
  },

  /**
   * 删除分类
   */
  deleteCategory: async (id: string): Promise<KnowledgebaseCategory> => {
    return http.post<KnowledgebaseCategory>(
      `/aicenter/v1/knowledgebase/category/${id}/delete`
    );
  },

  /**
   * 获取知识库列表（分页）
   */
  getKnowledgebases: async (page: number = 1, pageSize: number = 100, categoryId?: string | null, name?: string, code?: string, status?: string): Promise<{ data: Knowledgebase[]; total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (categoryId) {
      params.push(`category_id=${categoryId}`);
    }
    if (name) {
      params.push(`name=${encodeURIComponent(name)}`);
    }
    if (code) {
      params.push(`code=${encodeURIComponent(code)}`);
    }
    if (status !== undefined) {
      params.push(`status=${status}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<{ data: Knowledgebase[]; total: number }>(
      `/aicenter/v1/knowledgebase${queryString}`
    ) || { data: [], total: 0 };
  },

  /**
   * 获取单个知识库
   */
  getKnowledgebase: async (id: string): Promise<Knowledgebase> => {
    return http.get<Knowledgebase>(
      `/aicenter/v1/knowledgebase/${id}`
    );
  },

  /**
   * 检查编码是否唯一
   */
  checkCodeUnique: async (code: string): Promise<boolean> => {
    try {
      return http.get<boolean>(
        `/aicenter/v1/knowledgebase/check_code?code=${code}`
      );
    } catch (error) {
      console.error('Failed to check code uniqueness:', error);
      return true;
    }
  },

  /**
   * 创建知识库
   */
  createKnowledgebase: async (data: Partial<Knowledgebase>): Promise<Knowledgebase> => {
    return http.post<Knowledgebase>(
      '/aicenter/v1/knowledgebase',
      data
    );
  },

  /**
   * 更新知识库
   */
  updateKnowledgebase: async (id: string, data: Partial<Knowledgebase>): Promise<Knowledgebase> => {
    return http.post<Knowledgebase>(
      `/aicenter/v1/knowledgebase/${id}`,
      data
    );
  },

  /**
   * 删除知识库
   */
  deleteKnowledgebase: async (id: string): Promise<Knowledgebase> => {
    return http.post<Knowledgebase>(
      `/aicenter/v1/knowledgebase/${id}/delete`
    );
  },

  /**
   * 获取知识库文档分类树
   */
  getDocumentCategoryTree: async (kbId: string): Promise<KnowledgebaseDocumentCategory[]> => {
    return http.get<KnowledgebaseDocumentCategory[]>(
      `/aicenter/v1/knowledgebase/${kbId}/document_category/tree`
    ) || [];
  },

  /**
   * 创建文档分类
   */
  createDocumentCategory: async (kbId: string, data: Partial<KnowledgebaseDocumentCategory>): Promise<KnowledgebaseDocumentCategory> => {
    return http.post<KnowledgebaseDocumentCategory>(
      `/aicenter/v1/knowledgebase/${kbId}/document_category`,
      data
    );
  },

  /**
   * 更新文档分类
   */
  updateDocumentCategory: async (kbId: string, categoryId: string, data: Partial<KnowledgebaseDocumentCategory>): Promise<KnowledgebaseDocumentCategory> => {
    return http.post<KnowledgebaseDocumentCategory>(
      `/aicenter/v1/knowledgebase/${kbId}/document_category/${categoryId}`,
      data
    );
  },

  /**
   * 删除文档分类
   */
  deleteDocumentCategory: async (kbId: string, categoryId: string): Promise<KnowledgebaseDocumentCategory> => {
    return http.post<KnowledgebaseDocumentCategory>(
      `/aicenter/v1/knowledgebase/${kbId}/document_category/${categoryId}/delete`
    );
  },

  /**
   * 获取知识库文档列表（分页）
   */
  getDocuments: async (
    kbId: string,
    page: number = 1,
    pageSize: number = 20,
    categoryId?: string,
    name?: string,
    chunkMethod?: string[],
    runningStatus?: string[],
    status?: string
  ): Promise<{ data: KnowledgebaseDocument[]; total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (categoryId) {
      params.push(`category_id=${categoryId}`);
    }
    if (name) {
      params.push(`name=${encodeURIComponent(name)}`);
    }
    if (chunkMethod && chunkMethod.length > 0) {
      chunkMethod.forEach(method => {
        params.push(`chunk_method=${method}`);
      });
    }
    if (runningStatus && runningStatus.length > 0) {
      runningStatus.forEach(status => {
        params.push(`running_status=${status}`);
      });
    }
    if (status !== undefined) {
      params.push(`status=${status}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get<{ data: KnowledgebaseDocument[]; total: number }>(
      `/aicenter/v1/knowledgebase/${kbId}/document${queryString}`
    ) || { data: [], total: 0 };
  },

  /**
   * 获取单个文档
   */
  getDocument: async (kbId: string, documentId: string): Promise<KnowledgebaseDocument> => {
    return http.get<KnowledgebaseDocument>(
      `/aicenter/v1/knowledgebase/${kbId}/document/${documentId}`
    );
  },

  /**
   * 创建文档
   */
  createDocument: async (kbId: string, data: Partial<KnowledgebaseDocument>): Promise<KnowledgebaseDocument> => {
    return http.post<KnowledgebaseDocument>(
      `/aicenter/v1/knowledgebase/${kbId}/document`,
      data
    );
  },

  /**
   * 更新文档
   */
  updateDocument: async (kbId: string, documentId: string, data: Partial<KnowledgebaseDocument>): Promise<KnowledgebaseDocument> => {
    return http.post<KnowledgebaseDocument>(
      `/aicenter/v1/knowledgebase/${kbId}/document/${documentId}`,
      data
    );
  },

  /**
   * 删除文档
   */
  deleteDocument: async (kbId: string, documentId: string): Promise<KnowledgebaseDocument> => {
    return http.post<KnowledgebaseDocument>(
      `/aicenter/v1/knowledgebase/${kbId}/document/${documentId}/delete`
    );
  },

  /**
   * 批量删除文档
   */
  batchDeleteDocuments: async (kbId: string, documentIds: string[]): Promise<{ deleted_count: number }> => {
    return http.post<{ deleted_count: number }>(
      `/aicenter/v1/knowledgebase/${kbId}/document/batch_delete`,
      documentIds
    );
  },

  /**
   * 获取文档常量配置（切片方法、来源类型、切片配置）
   */
  getDocumentConstants: async (): Promise<{
    chunk_methods: Array<{ key: string; label: string }>;
    source_types: Array<{ key: string; label: string }>;
    chunk_configs: Record<string, Array<{
      key: string;
      label: string;
      field_type: string;
      default: unknown;
      description: string;
      required: boolean;
      options?: Array<{ label: string; value: string }>;
      min_value?: number;
      max_value?: number;
      step?: number;
    }>>;
  }> => {
    return http.get('/aicenter/v1/knowledgebase/document_constants');
  },

  /**
   * 上传文档
   */
  uploadDocuments: async (
    kbId: string,
    files: File[],
    sourceType: string = 'local_document',
    categoryId?: string,
    chunkMethod?: string,
    chunkConfig?: Record<string, unknown>,
    tags?: string[],
    status?: boolean
  ): Promise<{ errors: string[]; documents: KnowledgebaseDocument[] }> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('source_type', sourceType);
    if (categoryId) {
      formData.append('category_id', categoryId);
    }
    if (chunkMethod) {
      formData.append('chunk_method', chunkMethod);
    }
    if (chunkConfig) {
      formData.append('chunk_config', JSON.stringify(chunkConfig));
    }
    if (tags) {
      formData.append('tags', JSON.stringify(tags));
    }
    if (status !== undefined) {
      formData.append('status', String(status));
    }
    return http.post(
      `/aicenter/v1/knowledgebase/${kbId}/document/upload`,
      formData
    );
  },

  /**
   * 下载文档
   */
  downloadDocument: async (kbId: string, documentId: string): Promise<void> => {
    try {
      const response = await fetch(`/aicenter/v1/knowledgebase/${kbId}/document/${documentId}/download`);
      if (!response.ok) {
        throw new Error('下载失败');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // 从响应头中获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      const contentType = response.headers.get('Content-Type');
      
      console.log('Content-Disposition:', contentDisposition);
      console.log('Content-Type:', contentType);
      
      let fileName = 'document';
      if (contentDisposition) {
        // 尝试多种格式的 Content-Disposition
        // 格式1: filename*=UTF-8''filename.ext
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
        if (utf8Match) {
          fileName = decodeURIComponent(utf8Match[1]);
          console.log('Matched UTF-8 format:', fileName);
        } 
        // 格式2: filename="filename.ext"
        else {
          const traditionalMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (traditionalMatch) {
            fileName = traditionalMatch[1];
            console.log('Matched traditional format:', fileName);
          } 
          // 格式3: filename=filename.ext
          else {
            const simpleMatch = contentDisposition.match(/filename=([^;]+)/);
            if (simpleMatch) {
              fileName = simpleMatch[1].replace(/^['"]|['"]$/g, '');
              console.log('Matched simple format:', fileName);
            }
          }
        }
      }
      
      // 确保文件名有扩展名
      if (!fileName.includes('.')) {
        // 尝试从 Content-Type 中推断扩展名
        const extensionMap: Record<string, string> = {
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
          'application/msword': '.doc',
          'application/pdf': '.pdf',
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'text/plain': '.txt',
          'application/json': '.json',
          'application/vnd.ms-excel': '.xls',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
        };
        if (contentType && extensionMap[contentType]) {
          fileName += extensionMap[contentType];
          console.log('Added extension from Content-Type:', fileName);
        }
      }
      
      console.log('Final filename:', fileName);
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载文档失败:', error);
      throw error;
    }
  },
};
