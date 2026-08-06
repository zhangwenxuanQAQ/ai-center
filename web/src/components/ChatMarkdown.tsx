import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { DownOutlined, RightOutlined, CodeOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import mermaid from 'mermaid';
import { MarkdownUI } from '@markdown-ui/react';
import '@markdown-ui/react/widgets.css';
import { Marked } from 'marked';
import { markedUiStreamingExtension } from '@markdown-ui/marked-ext';
import { parseDSL, Widget } from '@markdown-ui/mdui-lang';

interface WidgetEvent {
  type: string;
  widgetId: string;
  widgetValue: any;
}

interface ChatMarkdownProps {
  source: string;
  className?: string;
  onWidgetEvent?: (event: WidgetEvent) => void;
  widgetValues?: Record<string, any>;
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
 * 获取当前主题：优先从 body 获取，回退到 .integration-page 元素
 */
function getCurrentTheme(): 'light' | 'dark' {
  const bodyTheme = document.body.getAttribute('data-theme');
  if (bodyTheme === 'light' || bodyTheme === 'dark') return bodyTheme;
  // 插件页面：从 .integration-page 元素获取主题
  const integrationPage = document.querySelector('.integration-page');
  if (integrationPage) {
    const pageTheme = integrationPage.getAttribute('data-theme');
    if (pageTheme === 'light' || pageTheme === 'dark') return pageTheme;
  }
  return 'dark';
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
      const renderId = `mermaid-${Math.random().toString(36).slice(2)}`;
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
          suppressErrors: true,
        });
        const { svg } = await mermaid.render(renderId, chart);

        // 检查是否渲染出错误 SVG（mermaid 有时不抛异常而是返回包含错误信息的 SVG）
        if (svg && (svg.includes('errorContainer') || svg.includes('Syntax error'))) {
          throw new Error('图表语法错误');
        }

        setSvg(svg);
        setError('');
      } catch (err) {
        // 清理 mermaid 注入到 DOM 中的错误元素
        const errorEl = document.getElementById(`d${renderId}`);
        if (errorEl) errorEl.remove();

        // 回退显示原始 mermaid 代码
        setError(chart);
        setIsValid(true);
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
    return (
      <div className="mermaid-container" style={{ padding: '12px' }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
          图表渲染失败，原始代码：
        </div>
        <pre style={{
          margin: 0,
          padding: '12px',
          background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f5f5',
          borderRadius: '6px',
          fontSize: '12px',
          lineHeight: '1.5',
          overflow: 'auto',
          color: theme === 'dark' ? '#e0e0e0' : '#333',
        }}>
          <code>{error}</code>
        </pre>
      </div>
    );
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
 * 将值格式化为 DSL 字符串
 */
function formatDslValue(value: any): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.map(v => formatDslValue(v)).join(' ');
    return `[${items}]`;
  }
  if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '\\"')}"`;
  return String(value);
}

/**
 * 单字段 Widget 转 DSL（不含换行，用于 form 内部字段）
 */
function singleWidgetToDsl(widget: Widget): string {
  const type = widget.type;
  const id = widget.id || '';

  switch (type) {
    case 'text-input': {
      const w = widget as any;
      const parts: string[] = [type, id];
      if (w.label !== undefined) parts.push(formatDslValue(w.label));
      if (w.placeholder !== undefined) parts.push(formatDslValue(w.placeholder));
      if (w.default !== undefined) parts.push(formatDslValue(w.default));
      return parts.join(' ');
    }
    case 'button-group':
    case 'select': {
      const w = widget as any;
      const parts: string[] = [type, id];
      if (w.label !== undefined) parts.push(formatDslValue(w.label));
      if (w.choices) parts.push(formatDslValue(w.choices));
      if (w.default !== undefined) parts.push(formatDslValue(w.default));
      return parts.join(' ');
    }
    case 'select-multi': {
      const w = widget as any;
      const parts: string[] = [type, id];
      if (w.label !== undefined) parts.push(formatDslValue(w.label));
      if (w.choices) parts.push(formatDslValue(w.choices));
      if (w.default !== undefined) parts.push(formatDslValue(w.default));
      return parts.join(' ');
    }
    case 'slider': {
      const w = widget as any;
      const parts: string[] = [type, id];
      if (w.label !== undefined) parts.push(formatDslValue(w.label));
      if (w.min !== undefined) parts.push(String(w.min));
      if (w.max !== undefined) parts.push(String(w.max));
      if (w.step !== undefined) parts.push(String(w.step));
      if (w.default !== undefined) parts.push(String(w.default));
      return parts.join(' ');
    }
    default:
      return '';
  }
}

/**
 * 将 Widget JSON 对象转换回 DSL 字符串（支持 form 嵌套字段）
 */
function widgetToDsl(widget: Widget): string {
  if (widget.type === 'form') {
    const w = widget as any;
    const lines: string[] = [];
    const header: string[] = ['form', w.id || ''];
    if (w.submitLabel !== undefined) header.push(formatDslValue(w.submitLabel));
    lines.push(header.join(' '));
    if (w.fields && Array.isArray(w.fields)) {
      for (const field of w.fields) {
        const fieldDsl = singleWidgetToDsl(field);
        if (fieldDsl) {
          lines.push(`  ${fieldDsl}`);
        }
      }
    }
    return lines.join('\n');
  }
  return singleWidgetToDsl(widget);
}

/**
 * 递归更新 widget 及其子字段的默认值
 * form 组件的 widgetValues 是嵌套结构：{ formId: { fieldId: value, ... } }
 */
function updateWidgetDefaults(widget: Widget, widgetValues: Record<string, any>): Widget {
  const w = widget as any;

  if (w.id && widgetValues[w.id] !== undefined) {
    if (w.type === 'form') {
      const formValues = widgetValues[w.id];
      if (w.fields && Array.isArray(w.fields) && typeof formValues === 'object' && formValues !== null) {
        w.fields = w.fields.map((field: Widget) => updateWidgetDefaults(field, formValues));
      }
    } else if (['text-input', 'select', 'select-multi', 'button-group', 'slider'].includes(w.type)) {
      w.default = widgetValues[w.id];
    }
  }

  return w;
}

/**
 * 预处理 Markdown-UI DSL 代码，根据 widgetValues 覆盖组件的默认值
 * 使用官方 @markdown-ui/mdui-lang 解析 DSL 保证准确性
 * 按整个 markdown-ui-widget 代码块处理，而非逐行
 */
function applyWidgetValuesToDsl(code: string, widgetValues: Record<string, any>): string {
  if (!widgetValues || Object.keys(widgetValues).length === 0) return code;

  const dslRegex = /```markdown-ui-widget\n([\s\S]*?)\n```/g;
  let match;
  let result = code;

  while ((match = dslRegex.exec(code)) !== null) {
    const originalDSL = match[1];
    const parseResult = parseDSL(originalDSL);
    if (parseResult.success && parseResult.widget) {
      const updatedWidget = updateWidgetDefaults(parseResult.widget, widgetValues);
      const newDSL = widgetToDsl(updatedWidget);
      if (newDSL) {
        result = result.replace(originalDSL, newDSL);
      }
    }
  }

  return result;
}

/**
 * Markdown-UI 组件渲染器
 * 使用 marked + markedUiExtension 解析 DSL 代码为 HTML，然后传递给 MarkdownUI 组件渲染
 */
const MarkdownUIWidget: React.FC<{ code: string; onWidgetEvent?: (event: WidgetEvent) => void; widgetValues?: Record<string, any> }> = React.memo(({ code, onWidgetEvent, widgetValues }) => {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');
  const lastCodeRef = useRef<string>('');
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const processedCode = applyWidgetValuesToDsl(code, widgetValues || {});
    // 如果代码内容和值都没有变化，不重新渲染
    if (lastCodeRef.current === processedCode) {
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
        const parsedHtml = marked.parse(processedCode) as string;
        lastCodeRef.current = processedCode;

        setHtml(parsedHtml);
        setError('');
      } catch (err) {
        console.error('Markdown-UI rendering error:', err);
        setError(`组件渲染失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    }, 100); // 缩短延迟时间，提高响应速度

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [code, widgetValues]);

  // 处理组件交互事件
  const handleWidgetEvent = useCallback((event: any) => {
    console.log('Widget event:', event.detail);
    if (onWidgetEvent) {
      onWidgetEvent({
        type: 'widget_event',
        widgetId: event.detail?.widgetId || event.detail?.id || '',
        widgetValue: event.detail?.widgetValue ?? event.detail?.value ?? event.detail
      });
    }
  }, [onWidgetEvent]);

  if (error) {
    return <div style={{ color: '#ff4d4f', padding: '12px' }}>{error}</div>;
  }

  // 只有当从未渲染过（html为空且lastCodeRef也为空）时才显示加载状态
  // 这样可以避免在重新解析时闪烁"组件渲染中"
  if (!html && !lastCodeRef.current) {
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
  const [copied, setCopied] = useState(false);
  const codeTextRef = useRef('');

  useEffect(() => {
    setTheme(getCurrentTheme());

    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    const integrationPage = document.querySelector('.integration-page');
    if (integrationPage) {
      observer.observe(integrationPage, { attributes: true, attributeFilter: ['data-theme'] });
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    codeTextRef.current = extractText(content);
  }, [content]);

  const handleCopy = useCallback(() => {
    const text = codeTextRef.current;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }, []);

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-99999px';
    textArea.style.top = '-99999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    } finally {
      document.body.removeChild(textArea);
    }
  };

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
        <div className="collapsible-code-header-right">
          <button
            className="code-copy-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            title="复制代码"
          >
            {copied ? <CheckOutlined /> : <CopyOutlined />}
          </button>
          <span className="collapsible-code-toggle">{collapsed ? '展开' : '收起'}</span>
        </div>
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
const ChatMarkdown: React.FC<ChatMarkdownProps> = React.memo(({ source, className, onWidgetEvent, widgetValues }) => {
  const componentId = useRef(`chat-md-${Math.random().toString(36).slice(2, 9)}`).current;
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // 使用 ref 存储 onWidgetEvent 和 widgetValues，避免它们变化时重新创建 components
  // 这样可以防止 MarkdownUIWidget 组件因 props 变化而被重新挂载
  const onWidgetEventRef = useRef(onWidgetEvent);
  const widgetValuesRef = useRef(widgetValues);

  // 同步更新 ref
  useEffect(() => {
    onWidgetEventRef.current = onWidgetEvent;
  }, [onWidgetEvent]);

  useEffect(() => {
    widgetValuesRef.current = widgetValues;
  }, [widgetValues]);

  useEffect(() => {
    setTheme(getCurrentTheme());

    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    const integrationPage = document.querySelector('.integration-page');
    if (integrationPage) {
      observer.observe(integrationPage, { attributes: true, attributeFilter: ['data-theme'] });
    }
    return () => observer.disconnect();
  }, []);

  // 使用 useMemo 缓存 components 对象，只依赖 theme
  // onWidgetEvent 和 widgetValues 通过 ref 传递，避免重新创建 components
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
          // 通过 ref 传递值，避免 props 变化导致组件重新挂载
          return (
            <MarkdownUIWidget
              code={fullCode}
              onWidgetEvent={(event) => onWidgetEventRef.current?.(event)}
              widgetValues={widgetValuesRef.current}
            />
          );
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
  }), [theme]); // 只依赖 theme，移除 onWidgetEvent 和 widgetValues

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
