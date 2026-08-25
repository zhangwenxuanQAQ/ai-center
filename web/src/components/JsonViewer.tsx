import React, { useState } from 'react';
import { Tooltip, message } from 'antd';
import { CopyOutlined, MinusSquareOutlined, PlusSquareOutlined } from '@ant-design/icons';

// 复制到剪贴板工具函数
const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // 兼容非安全上下文
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (e) {
      reject(e);
    }
    document.body.removeChild(textarea);
  });
};

// JSON值渲染器 - 递归渲染，支持展开收起和复制
const JsonValueRenderer: React.FC<{
  value: any;
  keyName?: string;
  isLast?: boolean;
  level?: number;
  theme: 'dark' | 'light';
}> = ({ value, keyName, isLast = true, level = 0, theme }) => {
  const [expanded, setExpanded] = useState(level < 1);
  const [hovered, setHovered] = useState(false);
  const isDark = theme === 'dark';

  // 获取值的可复制字符串
  const getValueString = (val: any): string => {
    if (val === null) return 'null';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  // 复制按钮
  const CopyIcon: React.FC<{ val: any }> = ({ val }) => (
    <Tooltip title="复制" mouseEnterDelay={0.5}>
      <CopyOutlined
        style={{ marginLeft: 4, fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', cursor: 'pointer', opacity: hovered ? 1 : 0 }}
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(getValueString(val)).then(() => message.success('已复制'));
        }}
      />
    </Tooltip>
  );

  const renderKey = (k: string) => (
    <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>"{k}"</span>
  );

  const renderPrimitive = (val: any): React.ReactNode => {
    if (val === null) return <span style={{ color: '#cf1322' }}>null</span>;
    if (typeof val === 'boolean') return <span style={{ color: '#722ed1' }}>{String(val)}</span>;
    if (typeof val === 'number') return <span style={{ color: '#d46b08' }}>{val}</span>;
    if (typeof val === 'string') return <span style={{ color: '#389e0d' }}>"{String(val)}"</span>;
    return <span>{String(val)}</span>;
  };

  // 键名部分
  const keyPart = keyName ? (
    <>
      {renderKey(keyName)}
      <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>: </span>
    </>
  ) : null;

  // null / 基本类型直接渲染
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', paddingLeft: level * 20, fontSize: 13, lineHeight: '22px', fontFamily: 'monospace' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {keyPart}
        {renderPrimitive(value)}
        <CopyIcon val={value} />
        {!isLast && <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>,</span>}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const items = isArray ? value : Object.entries(value);
  const itemCount = isArray ? value.length : Object.keys(value).length;
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  // 空数组/对象直接显示
  if (itemCount === 0) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', paddingLeft: level * 20, fontSize: 13, lineHeight: '22px', fontFamily: 'monospace' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {keyPart}
        <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>{openBracket}{closeBracket}</span>
        <CopyIcon val={value} />
        {!isLast && <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>,</span>}
      </div>
    );
  }

  // 折叠时显示概要
  if (!expanded) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', paddingLeft: level * 20, fontSize: 13, lineHeight: '22px', fontFamily: 'monospace', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 2, color: isDark ? '#8c8c8c' : '#8c8c8c' }}>
          <PlusSquareOutlined />
        </span>
        {keyPart}
        <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>{openBracket}</span>
        <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c', fontStyle: 'italic', margin: '0 4px' }}>
          {isArray ? `... ${itemCount} items` : `... ${itemCount} keys`}
        </span>
        <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>{closeBracket}</span>
        <CopyIcon val={value} />
        {!isLast && <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>,</span>}
      </div>
    );
  }

  // 展开时显示子项
  return (
    <div style={{ fontSize: 13, fontFamily: 'monospace' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', paddingLeft: level * 20, lineHeight: '22px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 2, color: isDark ? '#8c8c8c' : '#8c8c8c' }}>
          <MinusSquareOutlined />
        </span>
        {keyPart}
        <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>{openBracket}</span>
        <CopyIcon val={value} />
      </div>
      {items.map((item: any, idx: number) => {
        const k = isArray ? idx : item[0];
        const v = isArray ? item : item[1];
        const last = idx === itemCount - 1;
        return (
          <JsonValueRenderer
            key={String(k)}
            keyName={isArray ? undefined : String(k)}
            value={v}
            isLast={last}
            level={level + 1}
            theme={theme}
          />
        );
      })}
      <div style={{ display: 'flex', paddingLeft: level * 20, lineHeight: '22px' }}>
        <span style={{ width: 16 }}></span>
        <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>{closeBracket}</span>
        {!isLast && <span style={{ color: isDark ? '#8c8c8c' : '#8c8c8c' }}>,</span>}
      </div>
    </div>
  );
};

export interface JsonViewerProps {
  /** 要展示的数据，支持对象、数组、JSON字符串、基本类型 */
  data: any;
  /** 主题 */
  theme?: 'dark' | 'light';
  /** 最大高度（px），超出滚动 */
  maxHeight?: number;
}

/**
 * JSON美化展示组件
 * - 支持字段展开/收起
 * - 鼠标悬浮显示复制按钮，可复制单个字段
 * - 语法高亮：键名灰色、字符串绿色、数字橙色、布尔紫色、null红色
 */
const JsonViewer: React.FC<JsonViewerProps> = ({ data, theme = 'light', maxHeight = 400 }) => {
  if (data === null || data === undefined) {
    return <span style={{ color: '#cf1322', fontFamily: 'monospace' }}>null</span>;
  }

  // 字符串尝试解析
  let value = data;
  if (typeof data === 'string') {
    try {
      value = JSON.parse(data);
    } catch {
      return <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13 }}>{data}</pre>;
    }
  }

  return (
    <div style={{ fontFamily: 'monospace' }}>
      <JsonValueRenderer value={value} theme={theme} level={0} isLast={true} />
    </div>
  );
};

export default JsonViewer;
