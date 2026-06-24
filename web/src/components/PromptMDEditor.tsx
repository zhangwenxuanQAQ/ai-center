import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import { Select, Spin, message } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { promptService, Prompt } from '../services/prompt';
import '@uiw/react-md-editor/markdown-editor.css';

interface PromptMDEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  preview?: 'edit' | 'live' | 'preview';
}

const PromptMDEditor: React.FC<PromptMDEditorProps> = ({
  value,
  onChange,
  height = 250,
  placeholder = '请输入内容...',
  disabled = false,
  style = {},
  preview = 'edit',
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState<boolean>(false);
  const [showPromptDropdown, setShowPromptDropdown] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [promptDetails, setPromptDetails] = useState<Map<string, Prompt>>(new Map());
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

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

  useEffect(() => {
    if (showPromptDropdown) {
      fetchPrompts();
    }
  }, [showPromptDropdown, searchKeyword]);

  useEffect(() => {
    loadPromptDetails();
  }, [value]);

  const loadPromptDetails = async () => {
    const currentValue = value || '';
    const regex = /\{\{prompt@([^}]+)\}\}/g;
    const promptIds: string[] = [];
    let match;

    while ((match = regex.exec(currentValue)) !== null) {
      promptIds.push(match[1]);
    }

    const newDetails = new Map<string, Prompt>();

    for (const promptId of promptIds) {
      if (!promptDetails.has(promptId)) {
        try {
          const promptDetail = await promptService.getPrompt(promptId);
          newDetails.set(promptId, promptDetail);
        } catch (error) {
          console.error(`Failed to load prompt ${promptId}:`, error);
        }
      }
    }

    if (newDetails.size > 0) {
      setPromptDetails(prev => new Map([...prev, ...newDetails]));
    }
  };

  const fetchPrompts = async () => {
    try {
      setLoadingPrompts(true);
      const result = await promptService.getPrompts(1, 50, undefined, searchKeyword, 'true');
      setPrompts(result.data || []);
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
      message.error('获取提示词列表失败');
    } finally {
      setLoadingPrompts(false);
    }
  };

  const getTextAreaElement = useCallback(() => {
    const textareas = document.querySelectorAll('textarea');
    for (const textarea of textareas) {
      if (textarea.closest('.md-editor-wrapper') || textarea.closest('.w-md-editor')) {
        return textarea as HTMLTextAreaElement;
      }
    }
    const editors = document.querySelectorAll('.cm-editor textarea, .cm-content textarea');
    for (const editor of editors) {
      if (editor.closest('.md-editor-wrapper') || editor.closest('.w-md-editor')) {
        return editor as HTMLTextAreaElement;
      }
    }
    return null;
  }, []);

  const calculateDropdownPosition = useCallback((textarea: HTMLTextAreaElement, cursorPos: number) => {
    const rect = textarea.getBoundingClientRect();
    const text = textarea.value.substring(0, cursorPos);
    const lines = text.split('\n');
    const currentLine = lines.length - 1;
    const currentLineText = lines[currentLine];
    
    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight || '20', 10);
    const paddingTop = parseInt(window.getComputedStyle(textarea).paddingTop || '0', 10);
    const paddingLeft = parseInt(window.getComputedStyle(textarea).paddingLeft || '0', 10);
    const fontSize = parseInt(window.getComputedStyle(textarea).fontSize || '14', 10);
    const charWidth = fontSize * 0.6;
    
    const top = rect.top + paddingTop + (currentLine * lineHeight) + lineHeight;
    const left = rect.left + paddingLeft + (currentLineText.length * charWidth);
    
    return {
      top: top,
      left: left
    };
  }, []);

  const handleEditorChange = (newValue: string | undefined) => {
    const currentValue = newValue || '';
    onChange?.(currentValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showPromptDropdown) {
      setShowPromptDropdown(false);
      return;
    }

    if (e.key === '/') {
      setTimeout(() => {
        const textarea = getTextAreaElement();
        if (textarea) {
          const cursorPos = textarea.selectionStart;
          const currentValue = value || '';
          const textBeforeCursor = currentValue.substring(0, cursorPos);
          const secondLastChar = textBeforeCursor.slice(-2, -1);

          if (secondLastChar !== '/') {
            const position = calculateDropdownPosition(textarea, cursorPos);
            setDropdownPosition(position);
            setCursorPosition(cursorPos);
            setShowPromptDropdown(true);
            setSearchKeyword('');
          }
        }
      }, 0);
    } else if (e.key === ' ' || e.key === 'Enter') {
      setShowPromptDropdown(false);
    }
  };

  const insertPromptReference = (promptId: string) => {
    const currentValue = value || '';
    const textarea = getTextAreaElement();

    if (!textarea) return;

    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;

    const beforeSlash = currentValue.substring(0, cursorPosition - 1);
    const afterCursor = currentValue.substring(cursorPosition);

    const promptReference = `{{prompt@${prompt.id}}}`;
    const newValue = beforeSlash + promptReference + afterCursor;

    onChange?.(newValue);
    setShowPromptDropdown(false);

    setPromptDetails(prev => {
      const newMap = new Map(prev);
      newMap.set(prompt.id, prompt);
      return newMap;
    });

    const newCursorPos = beforeSlash.length + promptReference.length;
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 100);
  };

  const handlePromptButtonClick = () => {
    const textarea = getTextAreaElement();

    if (!textarea) {
      setShowPromptDropdown(true);
      return;
    }

    const cursorPos = textarea.selectionStart || value?.length || 0;
    const position = calculateDropdownPosition(textarea, cursorPos);
    setDropdownPosition(position);
    setCursorPosition(cursorPos);
    setShowPromptDropdown(true);
    setSearchKeyword('');
  };

  const removePromptReference = (promptId: string) => {
    const currentValue = value || '';
    const regex = new RegExp(`\\{\\{prompt@${promptId}\\}\\}`, 'g');
    const newValue = currentValue.replace(regex, '');
    onChange?.(newValue);

    setPromptDetails(prev => {
      const newMap = new Map(prev);
      newMap.delete(promptId);
      return newMap;
    });
  };

  const getDisplayContent = useCallback(() => {
    if (!value) return '';

    const regex = /\{\{prompt@([^}]+)\}\}/g;
    let match;
    const matches: { id: string; name: string; start: number; end: number }[] = [];

    while ((match = regex.exec(value)) !== null) {
      const promptId = match[1];
      const prompt = promptDetails.get(promptId);
      matches.push({
        id: promptId,
        name: prompt?.name || promptId,
        start: match.index,
        end: match.index + match[0].length
      });
    }

    if (matches.length === 0) return value;

    let displayParts: { text: string; isPromptRef: boolean; promptId?: string; promptName?: string }[] = [];
    let lastEnd = 0;

    for (const m of matches) {
      if (m.start > lastEnd) {
        displayParts.push({ text: value.substring(lastEnd, m.start), isPromptRef: false });
      }
      displayParts.push({ text: m.name, isPromptRef: true, promptId: m.id, promptName: m.name });
      lastEnd = m.end;
    }

    if (lastEnd < value.length) {
      displayParts.push({ text: value.substring(lastEnd), isPromptRef: false });
    }

    return displayParts;
  }, [value, promptDetails]);

  const renderPromptDropdown = () => {
    const isDark = theme === 'dark';
    
    if (!showPromptDropdown) return null;

    const selectOptions = [
      {
        label: '提示词/',
        options: prompts.map(prompt => ({
          label: prompt.name,
          value: prompt.id,
          description: prompt.description
        }))
      }
    ];

    return (
      <div style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999,
        minWidth: 280
      }}>
        <Select
          showSearch
          placeholder="搜索提示词"
          value={undefined}
          open={true}
          size="small"
          style={{ width: 280 }}
          dropdownStyle={{ width: 280 }}
          filterOption={(input, option) => {
            const label = option?.label as string;
            return label?.toLowerCase().includes(input.toLowerCase()) || false;
          }}
          onChange={(value) => {
            insertPromptReference(value);
          }}
          onDropdownVisibleChange={(open) => {
            if (!open) {
              setShowPromptDropdown(false);
            }
          }}
          options={selectOptions}
          loading={loadingPrompts}
          notFoundContent={loadingPrompts ? <Spin size="small" /> : '暂无提示词'}
          getPopupContainer={() => document.body}
          className={isDark ? 'dark-select' : 'light-select'}
        />
      </div>
    );
  };

  const customToolbarCommand = {
    name: 'insert-prompt',
    keyCommand: 'insert-prompt',
    buttonProps: {
      'aria-label': '插入提示词引用',
      title: '插入提示词引用 (/)'
    },
    icon: <BookOutlined />,
    execute: () => {
      handlePromptButtonClick();
    },
  };

  const isDark = theme === 'dark';
  const displayContent = getDisplayContent();

  const renderPromptTag = (promptId: string, promptName: string) => {
    return (
      <span
        key={promptId}
        className="prompt-reference-tag"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          margin: '0 2px',
          backgroundColor: isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)',
          border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.4)' : 'rgba(102, 126, 234, 0.3)'}`,
          borderRadius: 4,
          color: '#667eea',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'default',
          verticalAlign: 'middle',
        }}
        title={`提示词: ${promptName}\n点击删除引用`}
        onClick={() => removePromptReference(promptId)}
      >
        <span>{promptName}</span>
        <span
          style={{
            marginLeft: 4,
            fontSize: 12,
            opacity: 0.7,
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            removePromptReference(promptId);
          }}
        >
          ×
        </span>
      </span>
    );
  };

  return (
    <div className="md-editor-wrapper" data-color-mode={isDark ? 'dark' : 'light'}>
      <style>{`
        .md-editor-wrapper[data-color-mode="dark"] textarea,
        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-textarea,
        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-textarea textarea,
        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-textarea pre,
        .md-editor-wrapper[data-color-mode="dark"] .cm-editor .cm-line,
        .md-editor-wrapper[data-color-mode="dark"] .cm-editor .cm-line span,
        .md-editor-wrapper[data-color-mode="dark"] .cm-editor .cm-content,
        .md-editor-wrapper[data-color-mode="dark"] .cm-editor .cm-content > div {
          color: #ffffff !important;
          background-color: #1a1a1a !important;
        }

        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-toolbar {
          background-color: #1a1a1a !important;
          border-color: rgba(255,255,255,0.1) !important;
        }

        .md-editor-wrapper[data-color-mode="dark"] .w-md-editor-toolbar button {
          color: rgba(255,255,255,0.7) !important;
        }

        .md-editor-wrapper .prompt-reference-tag:hover {
          background-color: rgba(102, 126, 234, 0.3) !important;
        }

        .dark-select .ant-select-selector {
          background-color: #1e1e1e !important;
          border-color: rgba(255,255,255,0.1) !important;
          color: #ffffff !important;
        }

        .dark-select .ant-select-dropdown {
          background-color: #1e1e1e !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
        }

        .dark-select .ant-select-item {
          color: #ffffff !important;
        }

        .dark-select .ant-select-item-option-active {
          background-color: rgba(255,255,255,0.08) !important;
        }

        .dark-select .ant-select-item-option-selected {
          background-color: rgba(102,126,234,0.2) !important;
        }

        .dark-select .ant-select-item-group {
          color: #cccccc !important;
          font-weight: 500 !important;
        }

        ${disabled ? `
        .md-editor-wrapper .w-md-editor-toolbar button[title="全屏"],
        .md-editor-wrapper .w-md-editor-toolbar button[aria-label="全屏"],
        .md-editor-wrapper .w-md-editor-toolbar li:last-child {
          display: none !important;
        }
        ` : ''}
      `}</style>

      <div className={`md-editor-inner ${isDark ? 'dark' : 'light'}`} onKeyDown={handleKeyDown}>
        <MDEditor
          value={value}
          onChange={handleEditorChange}
          height={height}
          placeholder={placeholder}
          disabled={disabled}
          preview={preview}
          commands={[...commands.getCommands(), customToolbarCommand]}
          className="theme-md-editor"
          style={{
            width: '100%',
            ...style,
          }}
        />
        {renderPromptDropdown()}
      </div>

      {Array.isArray(displayContent) && displayContent.some(d => d.isPromptRef) && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          borderRadius: 6,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f9f9f9',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}`,
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          <div style={{
            marginBottom: 6,
            color: isDark ? '#888888' : '#999999',
            fontSize: 12,
          }}>
            提示词引用（点击 × 删除）：
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {displayContent.filter(d => d.isPromptRef).map((d) => (
              d.isPromptRef && d.promptId && d.promptName && (
                renderPromptTag(d.promptId, d.promptName)
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptMDEditor;