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
    <div className={`md-editor-container ${isDark ? 'dark' : 'light'}`} data-color-mode={isDark ? 'dark' : 'light'}>
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
  );
};

export default MDEditorTheme;