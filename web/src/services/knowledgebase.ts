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
  document_config?: string | Record<string, any>;
  created_at: string;
  updated_at?: string;
  children?: KnowledgebaseDocumentCategory[];
}

export interface KnowledgebaseDocument {
  id: string;
  kb_id: string;
  category_id?: string;
  title?: string;
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
  task_progress_message?: string;
  metadatas?: string | Record<string, any>;
  document_config?: string | Record<string, any>;
  content?: string;
  created_at: string;
  updated_at?: string;
  updated_by?: string;
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
   * 新增知识库
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
   * 获取单个知识库文档分类
   */
  getDocumentCategory: async (kbId: string, categoryId: string): Promise<KnowledgebaseDocumentCategory> => {
    return http.get<KnowledgebaseDocumentCategory>(
      `/aicenter/v1/knowledgebase/${kbId}/document_category/${categoryId}`
    );
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
   * 更新文档元数据
   */
  updateDocumentMetadata: async (kbId: string, documentId: string, metadatas: Record<string, any>): Promise<any> => {
    return http.post<any>(
      `/aicenter/v1/knowledgebase/${kbId}/document/${documentId}/update_metadata`,
      { metadatas }
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
   * 获取文档常量配置（切片方法、来源类型、切片配置、运行状态）
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
    running_status: Record<string, string>;
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
    status?: boolean,
    title?: string,
    documentConfig?: Record<string, unknown>
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
    if (title) {
      formData.append('title', title);
    }
    if (documentConfig) {
      formData.append('document_config', JSON.stringify(documentConfig));
    }
    return http.post(
      `/aicenter/v1/knowledgebase/${kbId}/document/upload`,
      formData
    );
  },

  /**
   * 下载文档(支持大文件)
   */
  downloadDocument: async (kbId: string, documentId: string): Promise<void> => {
    try {
      console.log('开始下载文档:', { kbId, documentId });

      const response = await fetch(`/aicenter/v1/knowledgebase/${kbId}/document/${documentId}/download`, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
        timeout: 300000,
      });

      console.log('响应状态:', response.status, response.statusText);
      console.log('响应头:', {
        'Content-Type': response.headers.get('Content-Type'),
        'Content-Length': response.headers.get('Content-Length'),
        'Content-Disposition': response.headers.get('Content-Disposition'),
        'Transfer-Encoding': response.headers.get('Transfer-Encoding'),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('下载失败,响应内容:', errorText);
        throw new Error(`下载失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const contentLength = response.headers.get('Content-Length');
      const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
      console.log('文件大小:', fileSize, 'bytes (', (fileSize / 1024 / 1024).toFixed(2), 'MB)');

      if (fileSize > 50 * 1024 * 1024) {
        console.warn('文件较大(>50MB),使用流式下载');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const contentType = response.headers.get('Content-Type');

      let fileName = 'document';
      if (contentDisposition) {
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
        if (utf8Match) {
          fileName = decodeURIComponent(utf8Match[1]);
        } else {
          const traditionalMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (traditionalMatch) {
            fileName = traditionalMatch[1];
          } else {
            const simpleMatch = contentDisposition.match(/filename=([^;]+)/);
            if (simpleMatch) {
              fileName = simpleMatch[1].replace(/^['"]|['"]$/g, '');
            }
          }
        }
      }

      if (!fileName.includes('.')) {
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
        }
      }

      console.log('最终文件名:', fileName);

      if (!response.body) {
        console.error('响应体为空');
        throw new Error('响应体为空');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        chunks.push(value);
        receivedLength += value.length;
        
        console.log(`已接收: ${receivedLength} / ${fileSize} bytes (${((receivedLength / fileSize) * 100).toFixed(1)}%)`);
      }

      const blob = new Blob(chunks, { type: contentType });
      console.log('Blob大小:', blob.size, 'bytes');

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('下载完成,清理资源');
      }, 100);

    } catch (error) {
      console.error('下载文档失败 - 详细错误信息:', error);
      console.error('错误类型:', error?.constructor?.name);
      console.error('错误消息:', error?.message);
      console.error('错误堆栈:', error?.stack);

      if (error instanceof TypeError) {
        console.error('这可能是网络错误或CORS问题');
      } else if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          console.error('可能原因: 网络连接问题、服务器无响应、CORS限制或请求被中止');
        } else if (error.message.includes('out of memory') || error.message.includes('内存不足')) {
          console.error('可能原因: 文件太大,浏览器内存不足');
        }
      }

      throw error;
    }
  },

  /**
   * 执行文档切片任务
   */
  runDocumentTask: async (kbId: string, documentId: string): Promise<void> => {
    return http.post(`/aicenter/v1/knowledgebase/${kbId}/document/${documentId}/run`);
  },

  /**
   * 停止文档切片任务
   */
  stopDocumentTask: async (kbId: string, documentId: string): Promise<void> => {
    return http.post(`/aicenter/v1/knowledgebase/${kbId}/document/${documentId}/stop`);
  },

  /**
   * 获取文档任务状态
   */
  getDocumentTaskStatus: async (kbId: string, documentId: string): Promise<{ status: string; progress: number; message?: string }> => {
    return http.get(`/aicenter/v1/knowledgebase/${kbId}/document/${documentId}/task_status`);
  },

  /**
   * 批量执行文档切片任务
   */
  batchRunDocumentTasks: async (kbId: string, documentIds: string[]): Promise<{success: string[], failed: string[], skipped: string[]}> => {
    return http.post(`/aicenter/v1/knowledgebase/${kbId}/document/batch_run`, documentIds);
  },

  /**
   * 批量停止文档切片任务
   */
  batchStopDocumentTasks: async (kbId: string, documentIds: string[]): Promise<{success: string[], failed: string[], skipped: string[]}> => {
    return http.post(`/aicenter/v1/knowledgebase/${kbId}/document/batch_stop`, documentIds);
  },

  /**
   * 获取任务执行器状态
   */
  getTaskExecutorStatus: async (kbId: string): Promise<{ is_running: boolean; active_tasks: number; queue_size: number }> => {
    return http.get(`/aicenter/v1/knowledgebase/${kbId}/task_executor_status`);
  },

  getAvailableChunkMethods: async (
    fileType?: string,
    fileName?: string,
    sourceType?: string
  ): Promise<{
    available_methods: Array<{ key: string; label: string; is_default: boolean }>;
    default_method: string;
  }> => {
    const params = [];
    if (fileType) {
      params.push(`file_type=${fileType}`);
    }
    if (fileName) {
      params.push(`filename=${encodeURIComponent(fileName)}`);
    }
    if (sourceType) {
      params.push(`source_type=${sourceType}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get(`/aicenter/v1/knowledgebase/chunk_methods/available${queryString}`);
  },

  getChunks: async (
    kbId: string,
    page: number = 1,
    pageSize: number = 10,
    docId?: string,
    available?: number,
    keyword?: string
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> => {
    const params = [`page=${page}`, `page_size=${pageSize}`];
    if (docId) {
      params.push(`doc_id=${docId}`);
    }
    if (available !== undefined && available !== null) {
      params.push(`available=${available}`);
    }
    if (keyword) {
      params.push(`keyword=${encodeURIComponent(keyword)}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return http.get(`/aicenter/v1/knowledgebase/${kbId}/chunks${queryString}`) || {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0
    };
  },

  toggleChunkAvailable: async (
    kbId: string,
    chunkId: string,
    available_int: number
  ): Promise<boolean> => {
    return http.post(
      `/aicenter/v1/knowledgebase/${kbId}/chunk/${chunkId}/toggle_available`,
      { available_int }
    );
  },

  createChunk: async (
    kbId: string,
    docId: string,
    content: string,
    keywords?: string[],
    available_int: number = 1
  ): Promise<any> => {
    return http.post(
      `/aicenter/v1/knowledgebase/${kbId}/chunk`,
      {
        doc_id: docId,
        content,
        keywords,
        available_int,
      }
    );
  },

  updateChunk: async (
    kbId: string,
    chunkId: string,
    content?: string,
    keywords?: string[],
    available_int?: number
  ): Promise<any> => {
    const data: any = {};
    if (content !== undefined) data.content = content;
    if (keywords !== undefined) data.keywords = keywords;
    if (available_int !== undefined) data.available_int = available_int;
    
    return http.post(
      `/aicenter/v1/knowledgebase/${kbId}/chunk/${chunkId}/update`,
      data
    );
  },

  deleteChunk: async (
    kbId: string,
    chunkId: string
  ): Promise<boolean> => {
    return http.post(
      `/aicenter/v1/knowledgebase/${kbId}/chunk/${chunkId}/delete`
    );
  },

  retrieve: async (
    kbIds: string[],
    question: string,
    config: Record<string, any> = {}
  ): Promise<{
    total: number;
    chunks: Array<{
      chunk_id: string;
      content_with_weight: string;
      content_ltks: string;
      doc_id: string;
      docnm_kwd: string;
      kb_id: string;
      important_kwd: string[];
      image_id: string;
      similarity: number;
      vector_similarity: number;
      term_similarity: number;
    }>;
  }> => {
    return http.post(
      `/aicenter/v1/knowledgebase/retrieval`,
      {
        kb_ids: kbIds,
        question,
        page: config.page || 1,
        page_size: config.page_size || 10,
        top_k: config.top_k || 1024,
        vector_similarity_threshold: config.vector_similarity,
        keyword_similarity_threshold: config.keyword_similarity,
        vector_similarity_weight: config.vector_similarity_weight,
        sort_by: config.sort_by,
        metadatas: config.metadatas,
      }
    ) || { total: 0, chunks: [] };
  },

  getRetrievalConfigs: async (): Promise<Array<{
    key: string;
    label: string;
    type: string;
    min?: number;
    max?: number;
    step?: number;
    default: any;
    options?: Array<{ value: string; label: string }>;
  }>> => {
    return http.get('/aicenter/v1/knowledgebase/retrieval_configs') || [];
  },

  /**
   * 从文件进行智能提取
   */
  intelligentExtractFromFile: async (
    files: File[],
    modelId: string,
    prompt: string,
    categoryId?: string
  ): Promise<{
    content: string;
    extracted_info: {
      title?: string;
      tags?: string[];
      custom_fields?: Record<string, any>;
      content?: string;
    };
  }> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('model_id', modelId);
    formData.append('prompt', prompt);
    formData.append('category_id', categoryId || '');
    
    return http.post('/aicenter/v1/knowledgebase/document/intelligent_extract', formData);
  },

  /**
   * 从文本进行智能提取
   */
  intelligentExtractFromText: async (
    modelId: string,
    prompt: string,
    textContent: string,
    categoryId?: string
  ): Promise<{
    content: string;
    extracted_info: {
      title?: string;
      tags?: string[];
      custom_fields?: Record<string, any>;
      content?: string;
    };
  }> => {
    const formData = new FormData();
    formData.append('model_id', modelId);
    formData.append('prompt', prompt);
    formData.append('text_content', textContent);
    formData.append('category_id', categoryId || '');
    
    return http.post('/aicenter/v1/knowledgebase/document/intelligent_extract', formData);
  },

  /**
   * 从文件进行智能提取（流式返回）
   */
  intelligentExtractFromFileStream: async (
    files: File[],
    modelId: string,
    prompt: string,
    categoryId?: string,
    knowledgeId?: string,
    deepThinking?: boolean,
    onProgress?: (data: { reasoning_content: string; text: string; extract_id?: string }) => void,
    signal?: AbortSignal
  ): Promise<{
    title?: string;
    tags?: string[];
    custom_fields?: Record<string, any>;
    content?: string;
    chapters?: any[];
  }> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('model_id', modelId);
    formData.append('prompt', prompt);
    formData.append('category_id', categoryId || '');
    if (knowledgeId) {
      formData.append('knowledge_id', knowledgeId);
    }
    formData.append('deep_thinking', deepThinking ? 'true' : 'false');

    const response = await fetch('/aicenter/v1/knowledgebase/document/intelligent_extract_stream', {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      throw new Error('智能提取失败');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let fullReasoningContent = '';
    let fullText = '';
    let extractedData: {
      title?: string;
      tags?: string[];
      custom_fields?: Record<string, any>;
      content?: string;
      chapters?: any[];
    } = {};
    let buffer = '';

    let extractId: string | undefined;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      while (buffer.includes('\n\n')) {
        const delimiterIndex = buffer.indexOf('\n\n');
        const message = buffer.substring(0, delimiterIndex);
        buffer = buffer.substring(delimiterIndex + 2);

        const lines = message.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.extract_id) {
                extractId = parsed.extract_id;
              }
              
              if (parsed.error) {
                fullText += `\n\n[错误] ${parsed.error}`;
                if (onProgress) {
                  onProgress({
                    reasoning_content: fullReasoningContent,
                    text: fullText,
                    extract_id: extractId,
                  });
                }
                throw new Error(parsed.error);
              }

              if (parsed.extracted_data) {
                extractedData = parsed.extracted_data;
              }

              if (parsed.reasoning_content) {
                fullReasoningContent += parsed.reasoning_content;
              }
              if (parsed.text) {
                fullText += parsed.text;
              }

              // 如果有extract_id，即使内容为空也要触发回调，确保前端能保存extract_id
              if (onProgress && extractId) {
                onProgress({
                  reasoning_content: fullReasoningContent,
                  text: fullText,
                  extract_id: extractId,
                });
              } else if (onProgress && (parsed.reasoning_content || parsed.text)) {
                // 没有extract_id时，只有内容变化才触发回调
                onProgress({
                  reasoning_content: fullReasoningContent,
                  text: fullText,
                  extract_id: extractId,
                });
              }
            } catch (e) {
              console.error('解析流数据失败:', e);
              console.error('原始数据:', data);
            }
          }
        }
      }
    }

    if (extractedData && Object.keys(extractedData).length > 0) {
      return extractedData;
    }

    const jsonMatch = fullText.match(/```json\s*(.*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('解析JSON失败:', e);
      }
    }

    try {
      return JSON.parse(fullText);
    } catch (e) {
      console.error('解析结果失败:', e);
      return {
        title: '',
        tags: [],
        custom_fields: {},
        content: fullText,
      };
    }
  },

  /**
   * 从文本进行智能提取（流式返回）
   */
  intelligentExtractFromTextStream: async (
    modelId: string,
    prompt: string,
    textContent: string,
    categoryId?: string,
    knowledgeId?: string,
    deepThinking?: boolean,
    onProgress?: (data: { reasoning_content: string; text: string; extract_id?: string }) => void,
    signal?: AbortSignal
  ): Promise<{
    title?: string;
    tags?: string[];
    custom_fields?: Record<string, any>;
    content?: string;
    chapters?: any[];
  }> => {
    const formData = new FormData();
    formData.append('model_id', modelId);
    formData.append('prompt', prompt);
    formData.append('text_content', textContent);
    formData.append('category_id', categoryId || '');
    if (knowledgeId) {
      formData.append('knowledge_id', knowledgeId);
    }
    formData.append('deep_thinking', deepThinking ? 'true' : 'false');

    const response = await fetch('/aicenter/v1/knowledgebase/document/intelligent_extract_stream', {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      throw new Error('智能提取失败');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let fullReasoningContent = '';
    let fullText = '';
    let extractedData: {
      title?: string;
      tags?: string[];
      custom_fields?: Record<string, any>;
      content?: string;
      chapters?: any[];
    } = {};
    let buffer = '';

    let extractId: string | undefined;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      while (buffer.includes('\n\n')) {
        const delimiterIndex = buffer.indexOf('\n\n');
        const message = buffer.substring(0, delimiterIndex);
        buffer = buffer.substring(delimiterIndex + 2);

        const lines = message.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.extract_id) {
                extractId = parsed.extract_id;
              }
              
              if (parsed.error) {
                fullText += `\n\n[错误] ${parsed.error}`;
                if (onProgress) {
                  onProgress({
                    reasoning_content: fullReasoningContent,
                    text: fullText,
                    extract_id: extractId,
                  });
                }
                throw new Error(parsed.error);
              }

              if (parsed.extracted_data) {
                extractedData = parsed.extracted_data;
              }

              if (parsed.reasoning_content) {
                fullReasoningContent += parsed.reasoning_content;
              }
              if (parsed.text) {
                fullText += parsed.text;
              }

              // 如果有extract_id，即使内容为空也要触发回调，确保前端能保存extract_id
              if (onProgress && extractId) {
                onProgress({
                  reasoning_content: fullReasoningContent,
                  text: fullText,
                  extract_id: extractId,
                });
              } else if (onProgress && (parsed.reasoning_content || parsed.text)) {
                // 没有extract_id时，只有内容变化才触发回调
                onProgress({
                  reasoning_content: fullReasoningContent,
                  text: fullText,
                  extract_id: extractId,
                });
              }
            } catch (e) {
              console.error('解析流数据失败:', e);
              console.error('原始数据:', data);
            }
          }
        }
      }
    }

    if (extractedData && Object.keys(extractedData).length > 0) {
      return extractedData;
    }

    const jsonMatch = fullText.match(/```json\s*(.*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('解析JSON失败:', e);
      }
    }

    try {
      return JSON.parse(fullText);
    } catch (e) {
      console.error('解析结果失败:', e);
      return {
        title: '',
        tags: [],
        custom_fields: {},
        content: fullText,
      };
    }
  },

  /**
   * 查询智能提取状态
   */
  getIntelligentExtractStatus: async (extractId: string): Promise<any> => {
    const response = await http.get(`/aicenter/v1/knowledgebase/document/intelligent_extract_status/${extractId}`);
    return response;
  },

  /**
   * 根据知识ID查询智能提取状态
   * @param knowledgeId 知识ID
   * @returns 提取状态数据
   */
  getIntelligentExtractStatusByKnowledgeId: async (knowledgeId: string): Promise<any> => {
    const response = await http.get(`/aicenter/v1/knowledgebase/document/intelligent_extract_status_by_knowledge/${knowledgeId}`);
    return response;
  },

  /**
   * 中断智能提取并删除缓存
   * @param knowledgeId 知识ID
   * @returns 操作结果
   */
  interruptIntelligentExtract: async (knowledgeId: string): Promise<any> => {
    const response = await http.delete(`/aicenter/v1/knowledgebase/document/intelligent_extract/${knowledgeId}`);
    return response;
  },
};
