import React, { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';

interface MDEditorThemeProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const MDEditorTheme: React.FC<MDEditorThemeProps> = ({
  value,
  onChange,
  height = 250,
  placeholder = '请输入内容...',
  disabled = false,
  style = {},
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // 获取初始主题
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'light' | 'dark');

    // 监听主题变化
    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'light' | 'dark');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  const isDark = theme === 'dark';

  return (
    <div className="md-editor-wrapper" data-color-mode={isDark ? 'dark' : 'light'}>
      <style>{`
        .md-editor-wrapper.dark textarea,
        .md-editor-wrapper[data-color-mode="dark"] textarea,
        .md-editor-wrapper.dark .w-md-editor-textarea,
        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-textarea,
        .md-editor-wrapper.dark .w-md-editor-textarea textarea,
        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-textarea textarea,
        .md-editor-wrapper.dark .w-md-editor-textarea pre,
        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-textarea pre,
        .md-editor-wrapper.dark .cm-editor .cm-line,
        .md-editor-wrapper[data-color-mode="dark"] .cm-editor .cm-line,
        .md-editor-wrapper.dark .cm-editor .cm-line span,
        .md-editor-wrapper[data-color-mode="dark"] .cm-editor .cm-line span,
        .md-editor-wrapper.dark .cm-editor .cm-content,
        .md-editor-wrapper[data-color-mode="dark"] .cm-editor .cm-content,
        .md-editor-wrapper.dark .cm-editor .cm-content > div,
        .md-editor-wrapper[data-color-mode="dark"] .cm-editor .cm-content > div {
          color: #ffffff !important;
          background-color: #1a1a1a !important;
        }
        
        .md-editor-wrapper.dark .w-md-editor-toolbar,
        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-toolbar {
          background-color: #1a1a1a !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        
        .md-editor-wrapper.dark .w-md-editor-toolbar button,
        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-toolbar button {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        ${disabled ? `
        .md-editor-wrapper .w-md-editor-toolbar button[title="全屏"],
        .md-editor-wrapper .w-md-editor-toolbar button[aria-label="全屏"],
        .md-editor-wrapper .w-md-editor-toolbar li:last-child {
          display: none !important;
        }
        ` : ''}
      `}</style>
      <div className={`md-editor-inner ${isDark ? 'dark' : ''}`}>
        <MDEditor
          value={value}
          onChange={(newValue) => onChange?.(newValue || '')}
          height={height}
          placeholder={placeholder}
          disabled={disabled}
          className="theme-md-editor"
          style={{
            width: '100%',
            ...style,
          }}
        />
      </div>
    </div>
  );
};

export default MDEditorTheme;