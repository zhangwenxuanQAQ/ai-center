import React, { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { EditorView } from '@codemirror/view';
import { Button, Tooltip, message } from 'antd';
import { FormatPainterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { codeScriptService } from '../services/code_script';

// CodeMirror 扩展配置（Python语法高亮/自动换行）
const CODE_EDITOR_EXTENSIONS = [python(), EditorView.lineWrapping];

interface CodeEditorProps {
  /** 编辑器内容 */
  value: string;
  /** 内容变化回调 */
  onChange: (value: string) => void;
  /** 编辑器高度 */
  height?: string;
  /** 明暗主题 */
  theme: 'light' | 'dark';
  /** 是否显示格式化按钮，默认显示 */
  showFormatButton?: boolean;
  /** 是否显示校验代码按钮，默认不显示 */
  showValidateButton?: boolean;
}

/**
 * Python 代码编辑器公共组件
 *
 * 基于 CodeMirror 封装，统一明暗主题、边框样式与格式化/校验能力。
 * 格式化调用后端 black 接口（按PEP8规范美化），校验同新增脚本页面的"校验代码"。
 */
const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  height = '300px',
  theme,
  showFormatButton = true,
  showValidateButton = false,
}) => {
  const [formatting, setFormatting] = useState(false);
  const [validating, setValidating] = useState(false);

  // 格式美化代码（后端black规范格式化）
  const handleFormat = async () => {
    if (!value || !value.trim()) {
      message.warning({ content: '代码内容为空', key: 'format' });
      return;
    }
    setFormatting(true);
    try {
      const result = await codeScriptService.formatScript(value);
      onChange(result.content);
      message.success({ content: '格式化完成', key: 'format' });
    } catch (error: any) {
      message.error({ content: `格式化失败: ${error.message}`, key: 'format', duration: 5 });
    } finally {
      setFormatting(false);
    }
  };

  // 校验代码（语法/main函数/安全检查）
  const handleValidate = async () => {
    if (!value || !value.trim()) {
      message.warning({ content: '代码内容为空', key: 'validate' });
      return;
    }
    setValidating(true);
    try {
      const result = await codeScriptService.validateScript(value);
      if (result.valid) {
        message.success({ content: '代码校验通过', key: 'validate' });
      } else {
        message.error({ content: `校验失败: ${result.error}`, key: 'validate', duration: 5 });
      }
    } catch (error: any) {
      message.error({ content: `校验失败: ${error.message}`, key: 'validate' });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div style={{ border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : '#d9d9d9'}`, borderRadius: 8, overflow: 'hidden', textAlign: 'left' }}>
      {(showFormatButton || showValidateButton) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '4px 8px',
            borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f0f0'}`,
            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
          }}
        >
          {showValidateButton && (
            <Tooltip title="校验代码（语法/main函数/安全检查）">
              <Button size="small" type="text" icon={<CheckCircleOutlined />} loading={validating} onClick={handleValidate}>
                校验代码
              </Button>
            </Tooltip>
          )}
          {showFormatButton && (
            <Tooltip title="格式美化代码">
              <Button size="small" type="text" icon={<FormatPainterOutlined />} loading={formatting} onClick={handleFormat}>
                格式化
              </Button>
            </Tooltip>
          )}
        </div>
      )}
      <CodeMirror
        value={value}
        height={height}
        theme={theme}
        extensions={CODE_EDITOR_EXTENSIONS}
        onChange={(v) => onChange(v)}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
        }}
      />
    </div>
  );
};

export default CodeEditor;
