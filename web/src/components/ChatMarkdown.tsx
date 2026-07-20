import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { DownOutlined, RightOutlined, CodeOutlined } from '@ant-design/icons';
import mermaid from 'mermaid';
import { MarkdownUI } from '@markdown-ui/react';
import '@markdown-ui/react/widgets.css';
import { Marked } from 'marked';
import { markedUiStreamingExtension } from '@markdown-ui/marked-ext';

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
 * Mermaid 图表渲染组件
 */
const MermaidChart: React.FC<{ chart: string; theme: 'light' | 'dark' }> = React.memo(({ chart, theme }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastChartRef = useRef<string>('');

  useEffect(() => {
    // 如果图表内容没有变化，不重新渲染
    if (lastChartRef.current === chart) {
      return;
    }

    // 清除之前的定时器
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // 检查 mermaid 代码是否完整（简单的完整性检查）
    const isComplete = (code: string): boolean => {
      // 检查是否有未闭合的括号或引号
      const openBraces = (code.match(/\[/g) || []).length;
      const closeBraces = (code.match(/\]/g) || []).length;
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      const openCurlyBraces = (code.match(/\{/g) || []).length;
      const closeCurlyBraces = (code.match(/\}/g) || []).length;

      // 如果括号不匹配，说明代码不完整
      if (openBraces !== closeBraces ||
          openParens !== closeParens ||
          openCurlyBraces !== closeCurlyBraces) {
        return false;
      }

      // 检查是否有明显的中断标志（如末尾是逗号后换行）
      const lines = code.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine.trim().endsWith(',') || lastLine.trim().endsWith('[')) {
        return false;
      }

      return true;
    };

    // 设置延迟渲染（防抖），等待流式传输完成
    renderTimeoutRef.current = setTimeout(async () => {
      try {
        // 检查代码完整性
        if (!isComplete(chart)) {
          // 代码不完整，不渲染，等待下一次更新
          setIsValid(false);
          return;
        }

        setIsValid(true);
        lastChartRef.current = chart;

        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
        });
        const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).slice(2)}`, chart);
        setSvg(svg);
        setError('');
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        // 只有在代码完整时才显示错误
        if (isComplete(chart)) {
          setError(`图表渲染失败: ${err instanceof Error ? err.message : '未知错误'}`);
        }
        setIsValid(false);
      }
    }, 500); // 500ms 延迟，等待流式传输稳定

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [chart, theme]);

  // 代码不完整时，不显示任何内容
  if (!isValid && !error) {
    return (
      <div className="mermaid-container" style={{ padding: '16px', color: '#999' }}>
        图表渲染中...
      </div>
    );
  }

  if (error) {
    return <div style={{ color: '#ff4d4f', padding: '12px' }}>{error}</div>;
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '16px',
        overflow: 'auto'
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

/**
 * Markdown-UI 组件渲染器
 * 使用 marked + markedUiExtension 解析 DSL 代码为 HTML，然后传递给 MarkdownUI 组件渲染
 */
const MarkdownUIWidget: React.FC<{ code: string }> = React.memo(({ code }) => {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');
  const lastCodeRef = useRef<string>('');
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 如果代码内容没有变化，不重新渲染
    if (lastCodeRef.current === code) {
      return;
    }

    // 清除之前的定时器
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // 设置延迟渲染（防抖），等待流式传输完成
    renderTimeoutRef.current = setTimeout(() => {
      try {
        // 使用 marked + markedUiStreamingExtension 解析 markdown-ui-widget 代码
        // markedUiStreamingExtension 是流式感知的扩展，能更好地处理不完整的输入
        const marked = new Marked();
        marked.use(markedUiStreamingExtension);

        // 解析代码块，生成 HTML
        const parsedHtml = marked.parse(code) as string;
        lastCodeRef.current = code;

        setHtml(parsedHtml);
        setError('');
      } catch (err) {
        console.error('Markdown-UI rendering error:', err);
        setError(`组件渲染失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    }, 300); // 300ms 延迟，等待流式传输稳定

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [code]);

  // 处理组件交互事件
  const handleWidgetEvent = useCallback((event: any) => {
    console.log('Widget event:', event.detail);
  }, []);

  if (error) {
    return <div style={{ color: '#ff4d4f', padding: '12px' }}>{error}</div>;
  }

  if (!html) {
    return (
      <div className="markdown-ui-container" style={{ padding: '16px', color: '#999' }}>
        组件渲染中...
      </div>
    );
  }

  return (
    <div className="markdown-ui-container">
      <MarkdownUI html={html} onWidgetEvent={handleWidgetEvent} />
    </div>
  );
});

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
 *
 * 使用 React.memo 优化：当 source 和 className 未变化时，避免因父组件状态更新
 * （如输入框输入）导致的重新渲染，从而防止 MermaidChart 等子组件被重新挂载。
 */
const ChatMarkdown: React.FC<ChatMarkdownProps> = React.memo(({ source, className }) => {
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

  // 使用 useMemo 缓存 components 对象，避免每次渲染都创建新对象
  // 这样 MDEditor.Markdown 不会因 components 引用变化而重新挂载子组件
  const components = useMemo(() => ({
    pre: ({ children, ...props }: any) => {
      // children should be the rendered code element
      const childArray = React.Children.toArray(children);
      const codeElement = childArray[0] as React.ReactElement<any>;

      if (codeElement && codeElement.props) {
        const codeClassName = codeElement.props.className || '';
        const match = /language-(\S+)/.exec(codeClassName);
        const lang = match ? match[1] : '';

        // 获取代码内容
        const codeText = extractText(codeElement.props.children);

        // 处理 mermaid 图表
        if (lang === 'mermaid') {
          return <MermaidChart chart={codeText} theme={theme} />;
        }

        // 处理 markdown-ui-widget 组件
        if (lang === 'markdown-ui-widget') {
          const fullCode = '```markdown-ui-widget\n' + codeText + '\n```';
          return <MarkdownUIWidget code={fullCode} />;
        }

        // 其他代码块使用可折叠样式
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
  }), [theme]);

  return (
    <div className={className} data-theme={theme} id={componentId}>
      <MDEditor.Markdown
        source={source}
        components={components}
      />
    </div>
  );
});

export default ChatMarkdown;
