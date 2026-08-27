/**
 * 接口调用任务结果抽屉
 */

import React from 'react';
import { Drawer, Descriptions, Tag } from 'antd';
import { TaskResult } from '../../../services/taskCenter';
import { statusColorMap, taskTypeColorMap, formatDurationSeconds } from '../constants';

interface ApiTaskResultProps {
  open: boolean;
  result: TaskResult | null;
  loading: boolean;
  theme: 'light' | 'dark';
  onClose: () => void;
}

/** 代码块/日志展示样式 */
const preStyle = (theme: 'light' | 'dark'): React.CSSProperties => ({
  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
  color: theme === 'dark' ? '#e0e0e0' : '#333333',
  padding: 12, borderRadius: 6, fontFamily: 'monospace',
  fontSize: 12, maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap',
});

const ApiTaskResult: React.FC<ApiTaskResultProps> = ({ open, result, loading, theme, onClose }) => {
  const task = result?.task;
  const log = result?.log || null;

  return (
    <Drawer
      title="任务执行结果（接口调用）"
      width={700}
      open={open}
      onClose={onClose}
      getContainer={false}
      contentWrapperStyle={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.15)' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
      ) : task ? (
        <div>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
            {task.description && (
              <Descriptions.Item label="任务描述">{task.description}</Descriptions.Item>
            )}
            <Descriptions.Item label="任务类型">
              <Tag color={taskTypeColorMap[task.task_type] || 'default'}>{task.task_type_name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="任务状态">
              <Tag color={statusColorMap[task.task_status] || 'default'}>{task.task_status_label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="进度">{((task.task_progress || 0) * 100).toFixed(1)}%</Descriptions.Item>
            {log && (
              <>
                <Descriptions.Item label="执行时间">{log.created_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="开始时间">{log.task_begin_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="结束时间">{log.task_end_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="耗时">{formatDurationSeconds(log.task_duration)}</Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="请求信息">
              {task.task_configs?.method || 'GET'} {task.task_configs?.path ? `${task.task_configs?.url || ''}${task.task_configs.path}` : (task.task_configs?.url || '-')}
            </Descriptions.Item>
            {task.task_configs?.server_name && (
              <Descriptions.Item label="API服务">{task.task_configs.server_name}</Descriptions.Item>
            )}
            {task.task_configs?.timeout && (
              <Descriptions.Item label="超时时间">{task.task_configs.timeout}秒</Descriptions.Item>
            )}
          </Descriptions>

          <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>响应结果</div>
          <pre style={preStyle(theme)}>
            {task.task_progress_message || log?.task_progress_message || '暂无执行记录'}
          </pre>

          <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>任务配置</div>
          <pre style={preStyle(theme)}>
            {JSON.stringify(task.task_configs || {}, null, 2)}
          </pre>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
      )}
    </Drawer>
  );
};

export default ApiTaskResult;
