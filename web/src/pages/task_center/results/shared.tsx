/**
 * 任务结果抽屉共享组件与工具函数
 */

import React, { useState } from 'react';
import { Descriptions, Typography, Collapse } from 'antd';
import { TaskOutputField } from '../../../services/taskCenter';

const { Text } = Typography;

/** 固定标签列宽度 */
export const FIXED_LABEL_STYLE: React.CSSProperties = {
  width: '130px',
  minWidth: '130px',
  flexBasis: '130px',
};

/** 将 result_file 字段移到最后 */
export function sortOutputFields(fields: TaskOutputField[]): TaskOutputField[] {
  const normal = fields.filter(f => f.name !== 'result_file');
  const resultFile = fields.filter(f => f.name === 'result_file');
  return [...normal, ...resultFile];
}

/** 可展开收起的执行日志（默认收起） */
export const CollapsibleLog: React.FC<{
  execLog: string;
  theme: 'light' | 'dark';
}> = ({ execLog, theme }) => {
  const logPreStyle: React.CSSProperties = {
    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
    color: theme === 'dark' ? '#e0e0e0' : '#333333',
    padding: 8, borderRadius: 4, fontFamily: 'monospace',
    fontSize: 12, maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0,
  };

  if (!execLog) {
    return <Text type="secondary">暂无执行记录</Text>;
  }

  return (
    <Collapse
      ghost
      defaultActiveKey={[]}
      size="small"
      items={[{
        key: 'log',
        label: '点击展开/收起日志',
        children: <pre style={logPreStyle}>{execLog}</pre>,
      }]}
    />
  );
};

/** 构建执行日志 Descriptions.Item（可展开收起，默认收起） */
export function renderCollapsibleLogItem(
  key: string,
  execLog: string,
  theme: 'light' | 'dark',
) {
  return (
    <Descriptions.Item key={key} label="执行日志">
      <CollapsibleLog execLog={execLog} theme={theme} />
    </Descriptions.Item>
  );
}
