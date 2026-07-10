import React, { useState, useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { DownOutlined, RightOutlined, CodeOutlined } from '@ant-design/icons';

interface ChatMarkdownProps {
  source: string;
  className?: string;
}

/**
 * Extract text content from React children (which may be array of strings/elements)
 */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children.map(extractText).join('');
  }
  if (React.isValidElement(children)) {
    return extractText((children.props as any).children);
  }
  return '';
}

/**
 * Collapsible code block component with title header.
 * All fenced code blocks are rendered as collapsible, with the language tag
 * (or "代码" if none) shown as the title.
 */
const CollapsibleCodeBlock: React.FC<{ title: string; content: React.ReactNode }> = ({ title, content }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'light' | 'dark');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`collapsible-code-block ${theme === 'dark' ? 'dark' : 'light'} ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div
        className="collapsible-code-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="collapsible-code-header-left">
          {collapsed ? <RightOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
          <CodeOutlined style={{ fontSize: 12 }} />
          <span className="collapsible-code-title">{title}</span>
        </div>
        <span className="collapsible-code-toggle">{collapsed ? '展开' : '收起'}</span>
      </div>
      {!collapsed && (
        <div className="collapsible-code-content">
          <pre className="collapsible-code-pre">{content}</pre>
        </div>
      )}
    </div>
  );
};

/**
 * Chat Markdown renderer - wraps MDEditor.Markdown with custom code block rendering.
 * ALL fenced code blocks are rendered as collapsible blocks with the language tag
 * displayed as the title in the header.
 */
const ChatMarkdown: React.FC<ChatMarkdownProps> = ({ source, className }) => {
  const componentId = useRef(`chat-md-${Math.random().toString(36).slice(2, 9)}`).current;
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'light' | 'dark');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const components = {
    pre: ({ children, ...props }: any) => {
      // children should be the rendered code element
      const childArray = React.Children.toArray(children);
      const codeElement = childArray[0] as React.ReactElement<any>;

      if (codeElement && codeElement.props) {
        const codeClassName = codeElement.props.className || '';
        const match = /language-(\S+)/.exec(codeClassName);
        const lang = match ? match[1] : '';

        // Use the language as the title, or default to "代码"
        const title = lang || '代码';
        const codeChildren = codeElement.props.children;

        return (
          <CollapsibleCodeBlock
            title={title}
            content={codeChildren}
          />
        );
      }

      // Fallback for unexpected structure
      return <pre {...props}>{children}</pre>;
    }
  };

  return (
    <div className={className} data-theme={theme} id={componentId}>
      <MDEditor.Markdown
        source={source}
        components={components}
      />
    </div>
  );
};

export default ChatMarkdown;
