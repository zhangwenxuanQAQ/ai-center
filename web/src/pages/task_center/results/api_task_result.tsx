/**
 * 接口调用任务结果抽屉
 * 结果字段来自后端TaskOutput结果类（task_output字段，[{name, title, value}]）
 */

import React from 'react';
import { Drawer, Descriptions, Tag, Typography } from 'antd';
import { TaskResult } from '../../../services/taskCenter';
import { statusColorMap } from '../constants';

const { Text, Link } = Typography;

interface ApiTaskResultProps {
  open: boolean;
  result: TaskResult | null;
  loading: boolean;
  theme: 'light' | 'dark';
  onClose: () => void;
}

const ApiTaskResult: React.FC<ApiTaskResultProps> = ({ open, result, loading, theme, onClose }) => {
  const task = result?.task;
  const log = result?.log || null;
  const source = result?.source_result || null;

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

  /** 渲染字段值（结果文件渲染为下载链接） */
  const renderFieldValue = (name: string, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <Text type="secondary">-</Text>;
    }
    if (name === 'status') {
      const isSuccess = value === 'success';
      return <Tag color={isSuccess ? 'success' : 'error'}>{value}</Tag>;
    }
    if (name === 'result_file') {
      if ((source as any)?.file_base64) {
        return <Link onClick={handleDownloadResult}>{value}</Link>;
      }
      return <Text>{value}</Text>;
    }
    if (typeof value === 'object') {
      return <Text style={{ fontSize: 12 }}>{JSON.stringify(value)}</Text>;
    }
    return <Text>{String(value)}</Text>;
  };

  /** 结果字段列表（来自任务输出结果类） */
  const outputFields = task?.task_output || log?.task_output || [];

  /** 执行日志内容（作为结果行显示在"执行时间"之后） */
  const execLog = log?.task_progress_message || task?.task_progress_message || '';

  const logPreStyle: React.CSSProperties = {
    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
    color: theme === 'dark' ? '#e0e0e0' : '#333333',
    padding: 8, borderRadius: 4, fontFamily: 'monospace',
    fontSize: 12, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0,
  };

  const renderLogItem = (key: string) => (
    <Descriptions.Item key={key} label="执行日志">
      {execLog ? (
        <pre style={logPreStyle}>{execLog}</pre>
      ) : (
        <Text type="secondary">暂无执行记录</Text>
      )}
    </Descriptions.Item>
  );

  /** 构建结果行：执行日志紧跟在"执行时间"之后（执行时间为空时追加在末尾） */
  const outputItems: React.ReactNode[] = [];
  let logItemInserted = false;
  outputFields
    .filter(f => f.value !== null && f.value !== undefined && f.value !== '')
    .forEach(f => {
      outputItems.push(
        <Descriptions.Item key={f.name} label={f.title}>
          {renderFieldValue(f.name, f.value)}
        </Descriptions.Item>,
      );
      if (f.name === 'executed_at' && !logItemInserted) {
        outputItems.push(renderLogItem('__exec_log__'));
        logItemInserted = true;
      }
    });
  if (!logItemInserted) {
    outputItems.push(renderLogItem('__exec_log__'));
  }

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
          {/* 结果字段（来自任务输出结果类，执行日志行紧跟"执行时间"） */}
          {outputFields.length > 0 ? (
            <Descriptions column={1} size="small" bordered>
              {outputItems}
            </Descriptions>
          ) : (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="任务状态">
                <Tag color={statusColorMap[task.task_status] || 'default'}>{task.task_status_label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{task.task_begin_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{task.task_end_at || '-'}</Descriptions.Item>
              {renderLogItem('__exec_log__')}
            </Descriptions>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
      )}
    </Drawer>
  );
};

export default ApiTaskResult;
