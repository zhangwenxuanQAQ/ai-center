/**
 * 接口调用任务结果抽屉
 * 结果字段来自后端TaskOutput结果类（task_output字段，[{name, title, value}]）
 */

import React from 'react';
import { Drawer, Descriptions, Tag, Typography, message } from 'antd';
import { TaskResult, taskCenterService } from '../../../services/taskCenter';
import { statusColorMap } from '../constants';
import { FIXED_LABEL_STYLE, sortOutputFields, renderCollapsibleLogItem } from './shared';

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

  const handleDownloadResult = async () => {
    if (!task) return;
    try {
      const blob = await taskCenterService.downloadTaskResult(task.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = source?.file_name || 'result';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败，文件可能已过期');
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

  /** 结果字段列表（来自任务输出结果类，result_file 移到最后） */
  const outputFields = sortOutputFields(
    (task?.task_output || log?.task_output || []).filter(
      f => f.value !== null && f.value !== undefined && f.value !== ''
    )
  );

  /** 执行日志内容（作为结果行显示在"执行时间"之后） */
  const execLog = log?.task_progress_message || task?.task_progress_message || '';

  /** 构建结果行：执行日志紧跟在"执行时间"之后（执行时间为空时追加在末尾） */
  const outputItems: React.ReactNode[] = [];
  let logItemInserted = false;
  outputFields.forEach(f => {
    outputItems.push(
      <Descriptions.Item key={f.name} label={f.title}>
        {renderFieldValue(f.name, f.value)}
      </Descriptions.Item>,
    );
    if (f.name === 'executed_at' && !logItemInserted) {
      outputItems.push(renderCollapsibleLogItem('__exec_log__', execLog, theme));
      logItemInserted = true;
    }
  });
  if (!logItemInserted) {
    outputItems.push(renderCollapsibleLogItem('__exec_log__', execLog, theme));
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
            <Descriptions column={1} size="small" bordered labelStyle={FIXED_LABEL_STYLE}>
              {outputItems}
            </Descriptions>
          ) : (
            <Descriptions column={1} size="small" bordered labelStyle={FIXED_LABEL_STYLE}>
              <Descriptions.Item label="任务状态">
                <Tag color={statusColorMap[task.task_status] || 'default'}>{task.task_status_label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{task.task_begin_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{task.task_end_at || '-'}</Descriptions.Item>
              {renderCollapsibleLogItem('__exec_log__', execLog, theme)}
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
