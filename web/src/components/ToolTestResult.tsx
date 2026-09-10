import React, { useState } from 'react';
import { Button, Tooltip, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, CopyOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import Tag from 'antd/es/tag';
import JsonViewer from './JsonViewer';

export interface ToolTestResultData {
  /** 执行状态 */
  status: 'success' | 'error';
  /** 执行结果数据（成功时展示） */
  result?: any;
  /** 结果描述信息 */
  message?: string;
  /** 错误详情（失败时展示） */
  error?: string;
}

interface ToolTestResultProps {
  /** 执行结果数据，为null时不渲染 */
  testResult: ToolTestResultData | null;
  /** 明暗主题 */
  theme: 'light' | 'dark';
  /** 结果区最大高度（px），默认400 */
  maxHeight?: number;
}

// 复制到剪贴板工具函数
const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text).then(() => {
    message.success({ content: `${label}已复制到剪贴板`, key: 'copy' });
  }).catch(() => {
    message.error({ content: '复制失败', key: 'copy' });
  });
};

/**
 * 工具执行结果展示公共组件
 *
 * - 成功/失败使用不同样式（绿色/红色边框与背景）
 * - 头部仅显示一行摘要信息，详情（完整结果/错误堆栈）默认收起，点击头部可展开收起
 * - 支持复制完整结果
 */
const ToolTestResult: React.FC<ToolTestResultProps> = ({ testResult, theme, maxHeight = 400 }) => {
  const [expanded, setExpanded] = useState(false);
  if (!testResult) return null;

  const isSuccess = testResult.status === 'success';
  // 成功展示结果数据，失败展示错误详情
  const detailValue = isSuccess
    ? (typeof testResult.result === 'string' ? testResult.result : JSON.stringify(testResult.result, null, 2))
    : (testResult.error || testResult.message || '未知错误');
  // 头部摘要：失败时取错误信息第一行（完整堆栈放详情区），成功时优先显示message，无则显示结果预览
  const resultPreview = typeof detailValue === 'string' ? detailValue.replace(/\s+/g, ' ').trim() : '';
  const summaryText = isSuccess
    ? (testResult.message || resultPreview || '执行成功')
    : ((testResult.error || testResult.message || '未知错误').split('\n')[0]);

  // 成功/失败配色
  const successColor = theme === 'dark' ? '#52c41a' : '#389e0d';
  const errorColor = '#ff4d4f';
  const mainColor = isSuccess ? successColor : errorColor;
  const borderColor = isSuccess
    ? (theme === 'dark' ? 'rgba(82, 196, 26, 0.35)' : 'rgba(56, 158, 13, 0.35)')
    : (theme === 'dark' ? 'rgba(255, 77, 79, 0.4)' : 'rgba(255, 77, 79, 0.4)');
  const bgColor = isSuccess
    ? (theme === 'dark' ? 'rgba(82, 196, 26, 0.06)' : 'rgba(82, 196, 26, 0.04)')
    : (theme === 'dark' ? 'rgba(255, 77, 79, 0.08)' : 'rgba(255, 77, 79, 0.04)');

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fff',
      overflow: 'hidden',
    }}>
      {/* 头部：状态标签 + 一行摘要 + 展开收起/复制按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: bgColor,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(prev => !prev)}
      >
        {isSuccess
          ? <CheckCircleOutlined style={{ color: successColor, fontSize: 16 }} />
          : <CloseCircleOutlined style={{ color: errorColor, fontSize: 16 }} />}
        <Tag color={isSuccess ? 'success' : 'error'} style={{ margin: 0 }}>
          {isSuccess ? '执行成功' : '执行失败'}
        </Tag>
        <span
          style={{ flex: 1, fontSize: 12, color: mainColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}
          title={summaryText}
        >
          {summaryText}
        </span>
        <Tooltip title="复制结果">
          <Button
            size="small"
            type="text"
            icon={<CopyOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(detailValue, '结果');
            }}
            style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
          />
        </Tooltip>
        <span style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontSize: 12 }}>
          {expanded ? <DownOutlined /> : <RightOutlined />}
        </span>
      </div>

      {/* 详情区：展开时显示完整结果/错误堆栈 */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${borderColor}`,
          padding: 12,
          maxHeight,
          overflow: 'auto',
          textAlign: 'left',
        }}>
          {isSuccess ? (
            <JsonViewer data={testResult.result} theme={theme} />
          ) : (
            <pre style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              fontSize: 13,
              color: theme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
            }}>
              {detailValue}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolTestResult;
