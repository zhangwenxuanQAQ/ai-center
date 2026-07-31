import React, { useMemo } from 'react';
import { Tag } from 'antd';

interface PromptInfo {
  id: string;
  name: string;
}

interface PromptContentRendererProps {
  content: string;
  prompts?: PromptInfo[];
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * 提示词内容渲染器
 * 将内容中的 {{prompt@prompt_id}} 占位符渲染为提示词标签
 */
const PromptContentRenderer: React.FC<PromptContentRendererProps> = ({
  content,
  prompts = [],
  theme = 'light',
  className = ''
}) => {
  const isDark = theme === 'dark';

  // 构建提示词ID到名称的映射
  const promptMap = useMemo(() => {
    const map = new Map<string, string>();
    prompts.forEach(p => {
      map.set(p.id, p.name);
    });
    return map;
  }, [prompts]);

  // 解析并渲染内容
  const renderedContent = useMemo(() => {
    if (!content) return null;

    const parts: React.ReactNode[] = [];
    let key = 0;
    let lastIndex = 0;

    // 匹配 {{prompt@prompt_id}} 格式的占位符
    const pattern = /\{\{prompt@([^}]+)\}\}/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      // 添加占位符之前的文本
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${key++}`}>{content.slice(lastIndex, match.index)}</span>
        );
      }

      const promptId = match[1];
      const promptName = promptMap.get(promptId) || promptId;

      // 添加提示词标签
      parts.push(
        <Tag
          key={`prompt-${key++}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '1px 8px',
            margin: '0 2px',
            backgroundColor: isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)',
            border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.4)' : 'rgba(102, 126, 234, 0.3)'}`,
            borderRadius: 4,
            color: '#667eea',
            fontSize: 13,
            fontWeight: 500,
            verticalAlign: 'middle',
            lineHeight: '1.5',
          }}
        >
          {promptName}
        </Tag>
      );

      lastIndex = match.index + match[0].length;
    }

    // 添加最后剩余的文本
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${key++}`}>{content.slice(lastIndex)}</span>
      );
    }

    return parts.length > 0 ? parts : content;
  }, [content, promptMap, isDark]);

  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {renderedContent}
    </span>
  );
};

export default PromptContentRenderer;