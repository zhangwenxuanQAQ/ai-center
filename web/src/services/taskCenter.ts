/**
 * 任务中心服务
 * 提供任务信息和任务日志相关的API调用
 */

import http from '../utils/request';
import { API_BASE_URL } from '../utils/request';

/** 任务类型配置字段定义（来自后端常量类） */
export interface TaskTypeConfigField {
  key: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'select';
  required: boolean;
  description: string;
  options?: { value: string; label: string }[];
}

/** 任务类型信息 */
export interface TaskTypeInfo {
  name: string;
  config_fields: TaskTypeConfigField[];
}

/** 任务输出字段（来自后端TaskOutput结果类） */
export interface TaskOutputField {
  name: string;
  title: string;
  value: any;
}

export interface TaskInfo {
  id: string;
  name: string;
  description: string;
  task_status: string;
  task_status_label: string;
  task_type: string;
  task_type_name: string;
  task_configs: Record<string, any>;
  task_progress: number;
  task_progress_message: string;
  task_begin_at: string;
  task_end_at: string;
  task_duration: number;
  task_output: TaskOutputField[] | null;
  source_type: string;
  source_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskLog {
  id: string;
  task_id: string;
  name: string;
  task_status: string;
  task_status_label: string;
  task_type: string;
  task_type_name: string;
  task_configs: Record<string, any>;
  task_progress: number;
  task_progress_message: string;
  task_begin_at: string;
  task_end_at: string;
  task_duration: number;
  task_output: TaskOutputField[] | null;
  created_at: string;
  updated_at: string;
}

/** 数据抽取任务的源任务结果（本体工作台） */
export interface DataExtractSourceResult {
  status: string;
  status_label: string;
  has_result: boolean;
  message?: string;
  task_progress?: number;
  task_progress_message?: string;
  task_begin_at?: string;
  task_end_at?: string;
  task_duration?: number;
  export_format?: string;
  export_contents?: string[];
  file_name?: string;
  file_base64?: string;
  format?: string;
  row_count?: number;
  executed_at?: string;
  expire_at?: string;
  result_data?: any;
  data?: any[];
  total?: number;
}

/** 文档切片任务的统计信息（知识库文档） */
export interface DocChunkStats {
  title: string;
  file_name: string;
  chunk_method: string;
  chunk_num: number;
  token_num: number;
  running_status: string;
}

export interface TaskResult {
  task: TaskInfo;
  log: TaskLog | null;
  source_result?: DataExtractSourceResult | null;
  doc_stats?: DocChunkStats | null;
}

export const taskCenterService = {
  // ==================== 字典 ====================

  /** 获取任务类型列表（含各类型所需配置字段定义） */
  getTaskTypes: async (): Promise<Record<string, TaskTypeInfo>> => {
    return http.get('/aicenter/v1/task_center/task_types');
  },

  /** 获取任务状态列表 */
  getTaskStatuses: async (): Promise<Record<string, string>> => {
    return http.get('/aicenter/v1/task_center/task_statuses');
  },

  // ==================== 任务信息 ====================

  /** 获取任务列表（支持名称、任务类型、状态过滤） */
  getTasks: async (name?: string, taskType?: string, taskStatus?: string,
                   page: number = 1, pageSize: number = 20): Promise<{ data: TaskInfo[]; total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (taskType) params.push(`task_type=${taskType}`);
    if (taskStatus) params.push(`task_status=${taskStatus}`);
    return http.get(`/aicenter/v1/task_center/task/list?${params.join('&')}`);
  },

  /** 获取单个任务 */
  getTask: async (id: string): Promise<TaskInfo> => {
    return http.get(`/aicenter/v1/task_center/task/${id}`);
  },

  /** 创建任务 */
  createTask: async (data: {
    name: string;
    description?: string;
    task_type: string;
    task_configs?: Record<string, any>;
  }): Promise<TaskInfo> => {
    return http.post('/aicenter/v1/task_center/task', data);
  },

  /** 更新任务 */
  updateTask: async (id: string, data: {
    name?: string;
    description?: string;
    task_configs?: Record<string, any>;
  }): Promise<TaskInfo> => {
    return http.post(`/aicenter/v1/task_center/task/${id}`, data);
  },

  /** 删除任务 */
  deleteTask: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/task_center/task/${id}/delete`);
  },

  /** 开始任务 */
  startTask: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/task_center/task/${id}/start`);
  },

  /** 重新执行任务 */
  rerunTask: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/task_center/task/${id}/rerun`);
  },

  /** 停止任务 */
  stopTask: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/task_center/task/${id}/stop`);
  },

  /** 获取任务执行结果 */
  getTaskResult: async (id: string): Promise<TaskResult> => {
    return http.get(`/aicenter/v1/task_center/task/${id}/result`);
  },

  /** 下载任务结果文件（返回二进制Blob，不走统一JSON封装） */
  downloadTaskResult: async (id: string): Promise<{ blob: Blob; fileName: string }> => {
    const response = await fetch(`${API_BASE_URL}/aicenter/v1/task_center/task/${id}/download`);
    if (!response.ok) {
      // 后端返回JSON错误信息（文件过期等）
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

  /** 获取任务结果文件下载URL（用于直接点击下载，浏览器不弹出保存对话框） */
  getTaskDownloadUrl: (id: string): string => {
    return `${API_BASE_URL}/aicenter/v1/task_center/task/${id}/download`;
  },

  /** 获取任务执行历史日志 */
  getTaskHistoryLogs: async (id: string, page: number = 1,
                             pageSize: number = 20): Promise<{ data: TaskLog[]; total: number }> => {
    return http.get(`/aicenter/v1/task_center/task/${id}/logs?page=${page}&page_size=${pageSize}`);
  },

  // ==================== 任务日志 ====================

  /** 获取任务日志列表（支持名称、任务类型、状态过滤） */
  getTaskLogs: async (name?: string, taskType?: string, taskStatus?: string,
                      page: number = 1, pageSize: number = 20): Promise<{ data: TaskLog[]; total: number }> => {
    let params = [`page=${page}`, `page_size=${pageSize}`];
    if (name) params.push(`name=${encodeURIComponent(name)}`);
    if (taskType) params.push(`task_type=${taskType}`);
    if (taskStatus) params.push(`task_status=${taskStatus}`);
    return http.get(`/aicenter/v1/task_center/log/list?${params.join('&')}`);
  },

  /** 获取单个任务日志详情 */
  getTaskLog: async (id: string): Promise<TaskLog> => {
    return http.get(`/aicenter/v1/task_center/log/${id}`);
  },

  // ==================== SSE ====================

  /** SSE任务事件流地址（状态实时推送） */
  getTaskEventsUrl: (): string => {
    return `${API_BASE_URL}/aicenter/v1/task_center/task/events`;
  },
};
