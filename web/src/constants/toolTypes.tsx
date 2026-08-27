import React from 'react';
import { ApiOutlined, ThunderboltOutlined, CodeOutlined, ToolOutlined } from '@ant-design/icons';

/**
 * 工具类型展示相关常量
 * 工具类型的取值与显示名称统一来自后端接口 /aicenter/v1/toolkit/tool_types，
 * 前端仅保留图标、配色等纯展示层映射，避免与后端常量类不一致。
 */

// 工具类型选项（用于Tab切换等）
export interface ToolTypeOption {
  key: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

// 工具类型 -> 图标（纯前端展示）
export const TOOL_TYPE_ICON: Record<string, React.ReactNode> = {
  mcp: <ApiOutlined />,
  api: <ThunderboltOutlined />,
  code_script: <CodeOutlined />,
  builtin_tool: <ToolOutlined />,
  skill: <ToolOutlined />,
};

// 工具类型 -> 颜色（纯前端展示）
export const TOOL_TYPE_COLOR: Record<string, string> = {
  mcp: '#5a6fd6',
  api: '#52c41a',
  code_script: '#fa8c16',
  builtin_tool: '#eb2f96',
  skill: '#13c2c2',
};

/**
 * 获取工具类型图标，未知类型回退到通用工具图标
 */
export function getToolTypeIcon(type: string): React.ReactNode {
  return TOOL_TYPE_ICON[type] || <ToolOutlined />;
}

/**
 * 获取工具类型颜色，未知类型回退到默认色
 */
export function getToolTypeColor(type: string): string {
  return TOOL_TYPE_COLOR[type] || '#8c8c8c';
}

/**
 * 根据后端返回的工具类型字典({key: name})构建Tab选项列表，
 * 图标与配色由前端展示层映射补充。
 */
export function buildToolTypeOptions(toolTypes: Record<string, string>): ToolTypeOption[] {
  return Object.entries(toolTypes || {}).map(([key, name]) => ({
    key,
    name,
    icon: getToolTypeIcon(key),
    color: getToolTypeColor(key),
  }));
}
