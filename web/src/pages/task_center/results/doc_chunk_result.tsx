/**
 * 文档切片任务结果抽屉（展示知识库文档切片统计）
 * 结果字段来自后端TaskOutput结果类（task_output字段，[{name, title, value}]）
 */

import React from 'react';
import { Drawer, Descriptions, Tag, Typography } from 'antd';
import { TaskResult, TaskOutputField } from '../../../services/taskCenter';
import { statusColorMap, taskTypeColorMap } from '../constants';

const { Text } = Typography;

interface DocChunkResultProps {
  open: boolean;
  result: TaskResult | null;
  loading: boolean;
  theme: 'light' | 'dark';
  onClose: () => void;
}

const DocChunkResult: React.FC<DocChunkResultProps> = ({ open, result, loading, theme, onClose }) => {
  const task = result?.task;
  const log = result?.log || null;

  /** 渲染字段值 */
  const renderFieldValue = (name: string, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <Text type="secondary">-</Text>;
    }
    if (name === 'status') {
      const isSuccess = value === 'success';
      return <Tag color={isSuccess ? 'success' : 'error'}>{value}</Tag>;
    }
    if (typeof value === 'object') {
      return <Text style={{ fontSize: 12 }}>{JSON.stringify(value)}</Text>;
    }
    return <Text>{String(value)}</Text>;
  };

  /** 结果字段列表（来自任务输出结果类） */
  const outputFields: TaskOutputField[] = task?.task_output || log?.task_output || [];

  /** 执行日志内容（作为结果行显示在"执行时间"之后） */
  const execLog = task?.task_progress_message || log?.task_progress_message || '';

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
            {outputItems.length > 0 ? (
              outputItems
            ) : (
              <React.Fragment>
                <Descriptions.Item label="开始时间">{task.task_begin_at || '-'}</Descriptions.Item>
                <Descriptions.Item label="结束时间">{task.task_end_at || '-'}</Descriptions.Item>
                {renderLogItem('__exec_log__')}
              </React.Fragment>
            )}
          </Descriptions>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
      )}
    </Drawer>
  );
};

export default DocChunkResult;
