/**
 * 文档切片任务结果抽屉（展示知识库文档切片统计）
 */

import React from 'react';
import { Drawer, Descriptions, Tag } from 'antd';
import { TaskResult } from '../../../services/taskCenter';
import { statusColorMap, taskTypeColorMap, formatDurationSeconds } from '../constants';

interface DocChunkResultProps {
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

const DocChunkResult: React.FC<DocChunkResultProps> = ({ open, result, loading, theme, onClose }) => {
  const task = result?.task;
  const log = result?.log || null;
  const stats = result?.doc_stats || null;

  return (
    <Drawer
      title="任务执行结果（文档切片）"
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
            <Descriptions.Item label="任务类型">
              <Tag color={taskTypeColorMap[task.task_type] || 'default'}>{task.task_type_name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="任务状态">
              <Tag color={statusColorMap[task.task_status] || 'default'}>{task.task_status_label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="进度">{((task.task_progress || 0) * 100).toFixed(1)}%</Descriptions.Item>
            {stats && (
              <>
                <Descriptions.Item label="文档运行状态">
                  <Tag color={statusColorMap[stats.running_status] || 'default'}>{stats.running_status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="文件名">{stats.file_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="切片方法">{stats.chunk_method || '-'}</Descriptions.Item>
                <Descriptions.Item label="切片数量">{stats.chunk_num ?? 0}</Descriptions.Item>
                <Descriptions.Item label="Token数量">{stats.token_num ?? 0}</Descriptions.Item>
              </>
            )}
            {log && (
              <>
                <Descriptions.Item label="执行时间">{log.created_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="开始时间">{log.task_begin_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="结束时间">{log.task_end_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="耗时">{formatDurationSeconds(log.task_duration)}</Descriptions.Item>
              </>
            )}
          </Descriptions>

          <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>执行日志</div>
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

export default DocChunkResult;
