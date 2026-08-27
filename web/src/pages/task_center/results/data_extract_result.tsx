/**
 * 数据抽取任务结果抽屉（展示本体工作台任务结果）
 */

import React from 'react';
import { Drawer, Descriptions, Tag, Typography } from 'antd';
import { TaskResult, DataExtractSourceResult } from '../../../services/taskCenter';
import { statusColorMap, taskTypeColorMap, formatDurationSeconds } from '../constants';

const { Text, Link } = Typography;

interface DataExtractResultProps {
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

const DataExtractResult: React.FC<DataExtractResultProps> = ({ open, result, loading, theme, onClose }) => {
  const task = result?.task;
  const log = result?.log || null;
  const source: DataExtractSourceResult | null = result?.source_result || null;

  // 下载结果文件（base64转Blob）
  const handleDownloadResult = () => {
    const fileBase64 = (source as any)?.file_base64;
    if (fileBase64) {
      const byteChars = atob(fileBase64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArr = new Uint8Array(byteNums);
      const blob = new Blob([byteArr]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = source?.file_name || 'result';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Drawer
      title="任务执行结果（数据抽取）"
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
            {source && (
              <>
                <Descriptions.Item label="抽取状态">
                  <Tag color={statusColorMap[source.status] || 'default'}>{source.status_label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="开始时间">{source.task_begin_at || task.task_begin_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="结束时间">{source.task_end_at || task.task_end_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="耗时">{formatDurationSeconds(source.task_duration ?? task.task_duration)}</Descriptions.Item>
                {(source as any).executed_at && (
                  <Descriptions.Item label="执行时间">{(source as any).executed_at}</Descriptions.Item>
                )}
                <Descriptions.Item label="数据行数">{(source as any).row_count ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="文件格式">{(source as any).format || source.export_format || '-'}</Descriptions.Item>
                {(source as any).expire_at && (
                  <Descriptions.Item label="链接过期时间">
                    <Text type="warning">{(source as any).expire_at}</Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="结果文件">
                  {source.has_result && (source as any).file_base64 ? (
                    <Link onClick={handleDownloadResult}>{source.file_name || '结果文件'}</Link>
                  ) : (
                    <Text type="secondary">{source.message || '暂无结果'}</Text>
                  )}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>

          {/* 抽取执行日志 */}
          <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>执行日志</div>
          <pre style={preStyle(theme)}>
            {source?.task_progress_message || task.task_progress_message || log?.task_progress_message || '暂无执行记录'}
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

export default DataExtractResult;
