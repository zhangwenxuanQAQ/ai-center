/**
 * SKILL服务
 * 提供SKILL相关的API调用
 */

import http from '../utils/request';

export interface SkillCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
  children?: SkillCategory[];
}

export interface Skill {
  id: string;
  name: string;
  title?: string;
  description?: string;
  tags?: string[];
  avatar?: string;
  content?: string;
  metadata?: Record<string, string>;
  category_id?: string;
  category_name?: string;
  directory: string;
  status: boolean;
  skill_md_content?: string;
  created_at: string;
  updated_at?: string;
}

export interface SkillListResponse {
  data: Skill[];
  total: number;
  page: number;
  page_size: number;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  modified_at?: string;
  children?: FileNode[];
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
  is_text: boolean;
}

export const skillService = {
  // ==================== 分类 ====================
  getCategoryTree: async (): Promise<SkillCategory[]> => {
    return http.get<SkillCategory[]>('/aicenter/v1/skill_category/category/tree');
  },

  createCategory: async (data: Partial<SkillCategory>): Promise<SkillCategory> => {
    return http.post<SkillCategory>('/aicenter/v1/skill_category/category', data);
  },

  updateCategory: async (id: string, data: Partial<SkillCategory>): Promise<SkillCategory> => {
    return http.post<SkillCategory>(`/aicenter/v1/skill_category/category/${id}`, data);
  },

  deleteCategory: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/skill_category/category/${id}/delete`);
  },

  // ==================== SKILL ====================
  getSkills: async (
    page: number = 1,
    pageSize: number = 20,
    params?: { category_id?: string; keyword?: string; status?: boolean }
  ): Promise<SkillListResponse> => {
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('page_size', String(pageSize));
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.status !== undefined && params?.status !== null) query.set('status', String(params.status));
    return http.get<SkillListResponse>(`/aicenter/v1/skill?${query.toString()}`);
  },

  getSkill: async (id: string, withMd: boolean = true): Promise<Skill> => {
    return http.get<Skill>(`/aicenter/v1/skill/${id}?with_md=${withMd}`);
  },

  createSkill: async (data: Partial<Skill>): Promise<Skill> => {
    return http.post<Skill>('/aicenter/v1/skill', data);
  },

  updateSkill: async (id: string, data: Partial<Skill>): Promise<Skill> => {
    return http.post<Skill>(`/aicenter/v1/skill/${id}`, data);
  },

  deleteSkill: async (id: string): Promise<void> => {
    return http.post(`/aicenter/v1/skill/${id}/delete`);
  },

  // ==================== 上传 ====================
  prepareUpload: async (skillId?: string): Promise<{ directory: string }> => {
    const form = new FormData();
    if (skillId) form.append('skill_id', skillId);
    return http.postForm('/aicenter/v1/skill/upload/prepare', form);
  },

  uploadFile: async (directory: string, file: File, subPath?: string): Promise<void> => {
    const form = new FormData();
    form.append('directory', directory);
    if (subPath) form.append('sub_path', subPath);
    form.append('file', file);
    return http.postForm('/aicenter/v1/skill/upload/file', form);
  },

  uploadZip: async (directory: string, file: File, subPath?: string): Promise<{ extracted_count: number }> => {
    const form = new FormData();
    form.append('directory', directory);
    if (subPath) form.append('sub_path', subPath);
    form.append('file', file);
    return http.postForm('/aicenter/v1/skill/upload/zip', form);
  },

  createAndRegister: async (params: {
    name: string;
    code: string;
    directory: string;
    description?: string;
    category_id?: string;
    status?: boolean;
  }): Promise<Skill> => {
    const form = new FormData();
    form.append('name', params.name);
    form.append('code', params.code);
    form.append('directory', params.directory);
    if (params.description) form.append('description', params.description);
    if (params.category_id) form.append('category_id', params.category_id);
    if (params.status !== undefined) form.append('status', String(params.status));
    return http.postForm('/aicenter/v1/skill/create_and_register', form);
  },

  // ==================== 文件 ====================
  listFiles: async (skillId: string, subPath?: string): Promise<FileNode[]> => {
    const query = new URLSearchParams();
    if (subPath) query.set('sub_path', subPath);
    const qs = query.toString();
    return http.get<FileNode[]>(`/aicenter/v1/skill/${skillId}/files${qs ? '?' + qs : ''}`);
  },

  getFileContent: async (skillId: string, path: string): Promise<FileContent> => {
    return http.get<FileContent>(`/aicenter/v1/skill/${skillId}/file/content?path=${encodeURIComponent(path)}`);
  },

  writeFileContent: async (skillId: string, path: string, content: string): Promise<void> => {
    return http.post(`/aicenter/v1/skill/${skillId}/file/content?path=${encodeURIComponent(path)}`, { content });
  },

  deleteFileOrDir: async (skillId: string, path: string): Promise<void> => {
    return http.post(`/aicenter/v1/skill/${skillId}/file/delete`, { path });
  },

  createDirectory: async (skillId: string, parentPath: string, dirName: string): Promise<void> => {
    return http.post(`/aicenter/v1/skill/${skillId}/directory/create`, {
      parent_path: parentPath,
      dir_name: dirName,
    });
  },
};
