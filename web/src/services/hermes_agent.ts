/**
 * Hermes 智能体服务
 * 提供基于 hermes CLI 的智能体管理 API 调用
 */

import http from '../utils/request';
import { API_BASE_URL } from '../utils/request';

export interface HermesAgent {
  name: string;
  is_default: boolean;
  is_active?: boolean;
  description?: string;
  model?: string;
  /** 头像文件名（avatar.png 等），空表示未设置 */
  avatar?: string;
  path?: string;
  soul?: string;
  memory?: string;
  user_profile?: string;
  created_at?: string;
  updated_at?: string;
  skill_count?: number;
  tool_count?: number;
}

export interface HermesModelConfig {
  model: string;
  api_key?: string;
  url?: string;
  raw?: Record<string, unknown>;
}

export interface HermesSkill {
  name: string;
  /** 技能目录名（skills/<category>/<dir_name>） */
  dir_name?: string;
  category?: string;
  description?: string;
  source?: string;
  trust?: string;
  status?: string;
}

/** 技能目录树节点 */
export interface HermesSkillTreeNode {
  name: string;
  /** 技能内相对路径（posix 风格） */
  path: string;
  is_dir: boolean;
  children: HermesSkillTreeNode[];
}

/** 技能目录树（含默认展示的 SKILL.md 路径） */
export interface HermesSkillTree {
  tree: HermesSkillTreeNode;
  skill_md: string;
}

export interface HermesTool {
  name: string;
  description?: string;
  enabled: boolean;
  /** 子工具/能力描述（如 "web_search, web_extract"） */
  sub_tools?: string;
}

export const hermesAgentService = {
  /**
   * 获取智能体列表（支持名称与描述过滤）
   */
  getAgents: async (name?: string, description?: string): Promise<HermesAgent[]> => {
    const params = new URLSearchParams();
    if (name) params.append('name', name);
    if (description) params.append('description', description);
    const queryString = params.toString() ? '?' + params.toString() : '';
    return http.get<HermesAgent[]>(
      '/aicenter/v1/agent/hermes/agents' + queryString
    ) || [];
  },

  /**
   * 获取单个智能体详情
   */
  getAgent: async (name: string): Promise<HermesAgent> => {
    return http.get<HermesAgent>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}`
    );
  },

  /**
   * 创建智能体（默认从 default 克隆）
   */
  createAgent: async (data: { name: string; description?: string; clone_from?: string }): Promise<HermesAgent> => {
    return http.post<HermesAgent>(
      '/aicenter/v1/agent/hermes/agents',
      data
    );
  },

  /**
   * 更新智能体（重命名/描述）
   */
  updateAgent: async (name: string, data: { new_name?: string; description?: string }): Promise<HermesAgent> => {
    return http.post<HermesAgent>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}`,
      data
    );
  },

  /**
   * 删除智能体
   */
  deleteAgent: async (name: string): Promise<{ name: string; deleted: boolean }> => {
    return http.post<{ name: string; deleted: boolean }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/delete`
    );
  },

  /**
   * 获取智能体头像 URL（直连后端文件接口）
   */
  getAvatarUrl: (name: string): string => {
    return `${API_BASE_URL}/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/avatar`;
  },

  /**
   * 上传智能体头像（multipart/form-data）
   */
  uploadAvatar: async (name: string, file: File): Promise<{ name: string; avatar: string; size: number }> => {
    const form = new FormData();
    form.append('file', file);
    return http.postForm<{ name: string; avatar: string; size: number }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/avatar`,
      form
    );
  },

  /**
   * 删除智能体头像
   */
  deleteAvatar: async (name: string): Promise<{ name: string; avatar: string }> => {
    return http.post<{ name: string; avatar: string }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/avatar/delete`
    );
  },

  /**
   * 读取智能体文件内容（soul / memory / user）
   */
  readFile: async (name: string, fileType: string): Promise<{ content: string }> => {
    return http.get<{ content: string }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/files/${fileType}`
    );
  },

  /**
   * 保存智能体文件内容（soul / memory / user）
   */
  writeFile: async (name: string, fileType: string, content: string): Promise<{ name: string; file_type: string; size: number }> => {
    return http.post<{ name: string; file_type: string; size: number }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/files/${fileType}`,
      { content }
    );
  },

  /**
   * 获取智能体技能列表
   */
  getSkills: async (name: string): Promise<HermesSkill[]> => {
    return http.get<HermesSkill[]>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/skills`
    ) || [];
  },

  /**
   * 获取技能文件目录树（含默认展示的 SKILL.md 路径）
   */
  getSkillTree: async (name: string, category: string, skill: string): Promise<HermesSkillTree> => {
    return http.get<HermesSkillTree>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/skills/${encodeURIComponent(category)}/${encodeURIComponent(skill)}/tree`
    );
  },

  /**
   * 读取技能内文件内容
   */
  readSkillFile: async (name: string, category: string, skill: string, path: string): Promise<{ path: string; content: string; size: number; updated_at?: string }> => {
    const qs = `?path=${encodeURIComponent(path)}`;
    return http.get<{ path: string; content: string; size: number; updated_at?: string }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/skills/${encodeURIComponent(category)}/${encodeURIComponent(skill)}/file${qs}`
    );
  },

  /**
   * 保存技能内文件内容
   */
  writeSkillFile: async (name: string, category: string, skill: string, path: string, content: string): Promise<{ path: string; size: number }> => {
    const qs = `?path=${encodeURIComponent(path)}`;
    return http.post<{ path: string; size: number }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/skills/${encodeURIComponent(category)}/${encodeURIComponent(skill)}/file${qs}`,
      { content }
    );
  },

  /**
   * 在技能目录内新建文件夹
   */
  createSkillDir: async (name: string, category: string, skill: string, path: string): Promise<{ path: string; created: boolean }> => {
    return http.post<{ path: string; created: boolean }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/skills/${encodeURIComponent(category)}/${encodeURIComponent(skill)}/mkdir`,
      { path }
    );
  },

  /**
   * 上传文件到技能目录（支持多文件，按相对路径保留文件夹结构）
   */
  uploadSkillFiles: async (name: string, category: string, skill: string, dir: string, files: File[]): Promise<{ saved: string[]; count: number }> => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, (f as any).webkitRelativePath || f.name));
    const qs = dir ? `?path=${encodeURIComponent(dir)}` : '';
    return http.postForm<{ saved: string[]; count: number }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/skills/${encodeURIComponent(category)}/${encodeURIComponent(skill)}/upload${qs}`,
      form
    );
  },

  /**
   * 删除技能内文件或目录（根目录与 SKILL.md 除外）
   */
  deleteSkillNode: async (name: string, category: string, skill: string, path: string): Promise<{ path: string; deleted: boolean }> => {
    return http.post<{ path: string; deleted: boolean }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/skills/${encodeURIComponent(category)}/${encodeURIComponent(skill)}/delete`,
      { path }
    );
  },

  /**
   * 重命名技能内文件或目录（根目录与 SKILL.md 除外）
   */
  renameSkillNode: async (name: string, category: string, skill: string, path: string, newName: string): Promise<{ path: string; new_path: string; renamed: boolean }> => {
    return http.post<{ path: string; new_path: string; renamed: boolean }>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/skills/${encodeURIComponent(category)}/${encodeURIComponent(skill)}/rename`,
      { path, new_name: newName }
    );
  },

  /**
   * 获取智能体工具集列表
   */
  getTools: async (name: string): Promise<HermesTool[]> => {
    return http.get<HermesTool[]>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/tools`
    ) || [];
  },

  /**
   * 获取智能体模型配置
   */
  getModelConfig: async (name: string): Promise<HermesModelConfig> => {
    return http.get<HermesModelConfig>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/model-config`
    );
  },

  /**
   * 更新智能体模型配置（手动填写或从模型库引用）
   */
  updateModelConfig: async (name: string, data: { model?: string; api_key?: string; url?: string }): Promise<HermesModelConfig> => {
    return http.post<HermesModelConfig>(
      `/aicenter/v1/agent/hermes/agents/${encodeURIComponent(name)}/model-config`,
      data
    );
  },
};
