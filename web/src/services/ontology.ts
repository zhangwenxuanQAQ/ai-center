/**
 * 本体工作台服务
 * 提供本体对象和数据抽取任务相关的API调用
 */

import http from '../utils/request';
import { API_BASE_URL } from '../utils/request';

export interface OntologyForeignKey {
  referenced_table: string;
  referenced_column: string;
}

export interface OntologyColumn {
  column_name: string;
  column_name_cn: string;
  column_description: string;
  data_type: string;
  is_primary_key: boolean;
  is_nullable: boolean;
  foreign_key: OntologyForeignKey | null;
}

export interface OntologyContent {
  table_name: string;
  title?: string;
  description?: string;
  columns: OntologyColumn[];
}

export interface OntologyObject {
  id: string;
  datasource_id: string;
  name: string;
  title: string;
  description: string;
  content: OntologyContent;
  created_at: string;
  updated_at: string;
}

export interface OntologyObjectBatchItem {
  name: string;
  title?: string;
  description?: string;
  content?: OntologyContent;
}

export interface OntologyTask {
  id: string;
  name: string;
  datasource_id: string;
  datasource_name?: string;
  configs: {
    ontology_object_id?: string;
    custom_sql?: string;
    export_format?: string;
    [key: string]: any;
  };
  status: string;
  status_label: string;
  task_progress: number;
  task_progress_message: string;
  task_begin_at: string;
  task_end_at: string;
  task_duration: number;
  created_at: string;
  updated_at: string;
}

export interface ExportFormat {
  value: string;
  label: string;
  sample: string;
}

export interface TaskResult {
  status: string;
  status_label: string;
  has_result: boolean;
  file_name?: string;
  format?: string;
  file_base64?: string;
  row_count?: number;
  executed_at?: string;
  expire_at?: string;
  message?: string;
  task_progress?: number;
  task_progress_message?: string;
  task_begin_at?: string;
  task_end_at?: string;
  task_duration?: number;
}

export const ontologyService = {
  // ==================== 本体对象 ====================

  /** 获取本体对象列表 */
  getObjects: async (datasourceId?: string, page: number = 1, pageSize: number = 20, sortBy: string = 'name', sortOrder: string = 'asc', name?: string): Promise<{ data: OntologyObject[]; total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`, `sort_by=${sortBy}`, `sort_order=${sortOrder}`];
    if (datasourceId) params.push(`datasource_id=${datasourceId}`);
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    return http.get(`/aicenter/v1/ontology/object/list?${params.join('&')}`);
  },

  /** 获取单个本体对象 */
  getObject: async (id: string): Promise<OntologyObject> => {
    return http.get(`/aicenter/v1/ontology/object/${id}`);
  },

  /** 批量创建本体对象 */
  batchCreateObjects: async (datasourceId: string, objects: OntologyObjectBatchItem[]): Promise<OntologyObject[]> => {
    return http.post('/aicenter/v1/ontology/object/batch', { datasource_id: datasourceId, objects });
  },

  /** 更新本体对象 */
  updateObject: async (id: string, data: { title?: string; description?: string; content?: OntologyContent }): Promise<OntologyObject> => {
    return http.post(`/aicenter/v1/ontology/object/${id}`, data);
  },

  /** 删除本体对象 */
  deleteObject: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/ontology/object/${id}/delete`);
  },

  /** 批量删除本体对象 */
  batchDeleteObjects: async (objectIds: string[]): Promise<void> => {
    return http.post('/aicenter/v1/ontology/object/batch_delete', { object_ids: objectIds });
  },

  /** 批量导出本体对象元数据 */
  batchExportObjects: async (objectIds: string[], exportFormat: string): Promise<{ content: string; format: string }> => {
    return http.post('/aicenter/v1/ontology/object/batch_export', { object_ids: objectIds, export_format: exportFormat });
  },

  /** 同步本体对象字段 */
  syncObject: async (id: string): Promise<OntologyObject> => {
    return http.post(`/aicenter/v1/ontology/object/${id}/sync`);
  },

  /** 查询本体对象数据 */
  queryObjectData: async (id: string, limit: number = 10, customSql?: string): Promise<{ columns: string[]; rows: any[]; total: number }> => {
    let params = [`limit=${limit}`];
    if (customSql) params.push(`custom_sql=${encodeURIComponent(customSql)}`);
    return http.get(`/aicenter/v1/ontology/object/${id}/query?${params.join('&')}`);
  },

  /** 导出本体对象元数据 */
  exportObjectMetadata: async (id: string, format: string): Promise<{ content: string; format: string }> => {
    return http.get(`/aicenter/v1/ontology/object/${id}/export?export_format=${format}`);
  },

  // ==================== 导出格式 ====================

  /** 获取导出格式列表 */
  getExportFormats: async (): Promise<{ formats: ExportFormat[] }> => {
    return http.get('/aicenter/v1/ontology/export_formats');
  },

  // ==================== 数据抽取任务 ====================

  /** 获取任务列表 */
  getTasks: async (name?: string, page: number = 1, pageSize: number = 20, datasourceId?: string, taskStatus?: string): Promise<{ data: OntologyTask[]; total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (datasourceId) params.push(`datasource_id=${datasourceId}`);
    if (taskStatus) params.push(`task_status=${taskStatus}`);
    return http.get(`/aicenter/v1/ontology/task/list?${params.join('&')}`);
  },

  /** 获取单个任务 */
  getTask: async (id: string): Promise<OntologyTask> => {
    return http.get(`/aicenter/v1/ontology/task/${id}`);
  },

  /** 创建任务 */
  createTask: async (data: {
    name: string;
    datasource_id: string;
    configs: Record<string, any>;
  }): Promise<OntologyTask> => {
    return http.post('/aicenter/v1/ontology/task', data);
  },

  /** 更新任务 */
  updateTask: async (id: string, data: {
    name?: string;
    datasource_id?: string;
    configs?: Record<string, any>;
  }): Promise<OntologyTask> => {
    return http.post(`/aicenter/v1/ontology/task/${id}`, data);
  },

  /** SSE任务事件流地址（状态实时推送） */
  getTaskEventsUrl: (): string => {
    return `${API_BASE_URL}/aicenter/v1/ontology/task/events`;
  },

  /** SSE流式获取任务进度 */
  getTaskStreamUrl: (id: string): string => {
    return `${API_BASE_URL}/aicenter/v1/ontology/task/${id}/stream`;
  },

  /** 启动任务 */
  startTask: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/ontology/task/${id}/start`);
  },

  /** 重新执行任务 */
  rerunTask: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/ontology/task/${id}/rerun`);
  },

  /** 停止任务 */
  stopTask: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/ontology/task/${id}/stop`);
  },

  /** 获取任务结果 */
  getTaskResult: async (id: string): Promise<TaskResult> => {
    return http.get(`/aicenter/v1/ontology/task/${id}/result`);
  },

  /** 下载本体任务结果文件（通过任务中心统一下载接口，支持本体任务ID或任务中心任务ID） */
  downloadTaskResult: async (taskId: string): Promise<{ blob: Blob; fileName: string }> => {
    const response = await fetch(`${API_BASE_URL}/aicenter/v1/task_center/task/${taskId}/download`);
    if (!response.ok) {
      let errMsg = `下载失败 (HTTP ${response.status})`;
      try {
        const body = await response.json();
        if (body?.message) errMsg = body.message;
      } catch {}
      throw new Error(errMsg);
    }
    const blob = await response.blob();
    // 从Content-Disposition解析后端文件名（含扩展名），作为下载文件名
    let fileName = '';
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match?.[1]) {
      try { fileName = decodeURIComponent(match[1]); } catch { fileName = match[1]; }
    }
    return { blob, fileName };
  },

  /** 获取本体任务结果文件下载URL（直链下载，浏览器不弹出保存对话框） */
  getTaskDownloadUrl: (ontologyTaskId: string): string => {
    return `${API_BASE_URL}/aicenter/v1/task_center/task/${ontologyTaskId}/download`;
  },

  /** 批量删除任务 */
  batchDeleteTasks: async (taskIds: string[]): Promise<void> => {
    return http.post('/aicenter/v1/ontology/task/batch_delete', { task_ids: taskIds });
  },

  /** 批量执行任务（跳过运行中/等待执行的任务，加入队列） */
  batchExecuteTasks: async (taskIds: string[]): Promise<{ success: string[]; skipped: { task_id: string; message: string }[]; failed: { task_id: string; message: string }[] }> => {
    return http.post('/aicenter/v1/ontology/task/batch_execute', { task_ids: taskIds });
  },

  /** 删除单个任务 */
  deleteTask: async (id: string): Promise<void> => {
    return http.del(`/aicenter/v1/ontology/task/${id}`);
  },
};