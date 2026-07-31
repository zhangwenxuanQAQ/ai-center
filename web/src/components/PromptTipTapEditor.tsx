import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Strike from '@tiptap/extension-strike';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Markdown } from 'tiptap-markdown';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { 
  BookOutlined, 
  BoldOutlined, 
  ItalicOutlined, 
  UnderlineOutlined, 
  StrikethroughOutlined,
  LinkOutlined,
  HighlightOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  CodeOutlined,
  FileTextOutlined,
  UndoOutlined,
  RedoOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { Spin, message, Modal, Input } from 'antd';
import { promptService, Prompt } from '../services/prompt';
import 'tippy.js/dist/tippy.css';

interface PromptTipTapEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export interface PromptTipTapEditorRef {
  insertPromptReference: () => void;
}

const PromptTagComponent = forwardRef<HTMLSpanElement, { id: string; label: string; onDelete: () => void }>(
  ({ id, label, onDelete }, ref) => {
    const [theme, setTheme] = useState<string>('dark');

    useEffect(() => {
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(currentTheme);
      const observer = new MutationObserver(() => {
        setTheme(document.body.getAttribute('data-theme') || 'dark');
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
      return () => observer.disconnect();
    }, []);

    const isDark = theme === 'dark';

    return (
      <span
        ref={ref}
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
          fontSize: 14,
          fontWeight: 500,
          verticalAlign: 'middle',
          lineHeight: '1.5',
        }}
      >
        {label}
        <span
          contentEditable={false}
          onClick={onDelete}
          style={{
            cursor: 'pointer',
            fontSize: 14,
            opacity: 0.7,
            marginLeft: 2,
            lineHeight: 1,
          }}
        >
          ×
        </span>
      </span>
    );
  }
);

PromptTagComponent.displayName = 'PromptTagComponent';

const PromptTipTapEditor = forwardRef<PromptTipTapEditorRef, PromptTipTapEditorProps>(
  ({ value, onChange, height = 250, placeholder = '请输入内容...', disabled = false, style = {} }, ref) => {
    const [theme, setTheme] = useState<string>('dark');
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [promptCategories, setPromptCategories] = useState<Map<string, string>>(new Map());
    const [loadingPrompts, setLoadingPrompts] = useState<boolean>(false);

    useEffect(() => {
      const currentTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(currentTheme);
      const observer = new MutationObserver(() => {
        setTheme(document.body.getAttribute('data-theme') || 'dark');
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
      return () => observer.disconnect();
    }, []);

    const fetchPrompts = useCallback(async (query: string) => {
      try {
        setLoadingPrompts(true);
        const [promptResult, categoryResult] = await Promise.all([
          promptService.getPrompts(1, 50, undefined, query, 'true'),
          promptService.getCategories(0, 100)
        ]);
        const categories = new Map<string, string>();
        categoryResult.forEach(cat => {
          categories.set(cat.id, cat.name);
        });
        setPromptCategories(categories);
        setPrompts(promptResult.data || []);
        return promptResult.data.map((p: Prompt) => ({
          id: p.id,
          label: p.name,
          description: p.description,
          group: p.category_id ? categories.get(p.category_id) || '未分类' : '未分类'
        }));
      } catch (error) {
        console.error('Failed to fetch prompts:', error);
        return [];
      } finally {
        setLoadingPrompts(false);
      }
    }, []);
    
    const serializeNode = (node: any): string => {
      if (node.type && node.type.name === 'mention') {
        return `{{prompt@${node.attrs.id}}}`;
      }
      
      if (node.type && node.type.name === 'text') {
        return node.text || '';
      }
      
      if (node.type && node.type.name === 'heading') {
        const level = node.attrs?.level || 1;
        const hashes = '#'.repeat(level);
        let content = '';
        if (node.content) {
          node.content.forEach((child: any) => {
            content += serializeNode(child);
          });
        }
        return `${hashes} ${content}\n`;
      }
      
      if (node.type && node.type.name === 'paragraph') {
        let content = '';
        if (node.content) {
          node.content.forEach((child: any) => {
            content += serializeNode(child);
          });
        }
        return `${content}\n`;
      }
      
      if (node.type && node.type.name === 'bulletList') {
        let content = '';
        if (node.content) {
          node.content.forEach((child: any) => {
            content += serializeNode(child);
          });
        }
        return content;
      }
      
      if (node.type && node.type.name === 'orderedList') {
        let content = '';
        let index = 1;
        if (node.content) {
          node.content.forEach((child: any) => {
            content += `${index}. ${serializeNode(child).trim()}\n`;
            index++;
          });
        }
        return content;
      }
      
      if (node.type && node.type.name === 'listItem') {
        let content = '';
        if (node.content) {
          node.content.forEach((child: any) => {
            content += serializeNode(child);
          });
        }
        return `- ${content.trim()}\n`;
      }
      
      if (node.type && node.type.name === 'codeBlock') {
        let content = '';
        if (node.content) {
          node.content.forEach((child: any) => {
            content += serializeNode(child);
          });
        }
        return `\`\`\`\n${content}\`\`\`\n`;
      }
      
      if (node.type && node.type.name === 'blockquote') {
        let content = '';
        if (node.content) {
          node.content.forEach((child: any) => {
            content += serializeNode(child);
          });
        }
        return `> ${content.trim()}\n`;
      }
      
      if (node.type && node.type.name === 'hardBreak') {
        return '\n';
      }
      
      if (node.marks) {
        let content = '';
        if (node.content) {
          node.content.forEach((child: any) => {
            content += serializeNode(child);
          });
        }
        
        node.marks.forEach((mark: any) => {
          if (mark.type && mark.type.name === 'bold') {
            content = `**${content}**`;
          } else if (mark.type && mark.type.name === 'italic') {
            content = `*${content}*`;
          } else if (mark.type && mark.type.name === 'strike') {
            content = `~~${content}~~`;
          } else if (mark.type && mark.type.name === 'code') {
            content = `\`${content}\``;
          } else if (mark.type && mark.type.name === 'link') {
            content = `[${content}](${mark.attrs?.href || ''})`;
          }
        });
        
        return content;
      }
      
      if (node.content) {
        let content = '';
        node.content.forEach((child: any) => {
          content += serializeNode(child);
        });
        return content;
      }
      
      return '';
    };

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder,
        }),
        Markdown.configure({
          html: true,
          transformPastedText: true,
          transformCopiedText: true,
          renderMarkdown: {
            mention: ({ node }) => {
              return `{{prompt@${node.attrs.id}}}`;
            },
          },
        }),
        Link.configure({
          openOnClick: false,
        }),
        Highlight.configure({}),
        Strike.configure({}),
        Underline.configure({}),
        Subscript.configure({}),
        Superscript.configure({}),
        Mention.configure({
          HTMLAttributes: { class: 'prompt-mention' },
          render: ({ node, HTMLAttributes, editor }) => {
            const label = node.attrs.label || node.attrs.id;
            const dom = document.createElement('span');
            dom.className = 'prompt-mention';
            
            // 创建标签文本
            const labelText = document.createElement('span');
            labelText.className = 'mention-label';
            labelText.textContent = label;
            dom.appendChild(labelText);
            
            // 创建删除按钮
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'mention-delete';
            deleteBtn.textContent = '×';
            deleteBtn.contentEditable = 'false';
            deleteBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const pos = node.pos;
              const nodeSize = node.nodeSize;
              
              // 先删除 Mention 节点
              editor.chain()
                .focus()
                .deleteRange({ from: pos, to: pos + nodeSize })
                .run();
              
              // 检查并清理残留的 @ 字符
              setTimeout(() => {
                const currentPos = editor.state.selection.from;
                
                // 检查光标位置的字符
                if (currentPos > 0) {
                  const textBefore = editor.state.doc.textBetween(currentPos - 1, currentPos, '\n');
                  if (textBefore === '@') {
                    editor.chain().focus().deleteRange({ from: currentPos - 1, to: currentPos }).run();
                  }
                }
                
                // 检查光标后面的字符
                const textAfter = editor.state.doc.textBetween(currentPos, Math.min(currentPos + 1, editor.state.doc.content.size), '\n');
                if (textAfter === '@') {
                  editor.chain().focus().deleteRange({ from: currentPos, to: currentPos + 1 }).run();
                }
              }, 10);
            };
            dom.appendChild(deleteBtn);
            
            return { dom };
          },
          renderText: ({ node }) => {
            // 将 Mention 节点转换为 {{prompt@prompt_id}} 格式
            return `{{prompt@${node.attrs.id}}}`;
          },
          renderHTML: ({ node }) => {
            const label = node.attrs.label || node.attrs.id;
            return [
              'span',
              {
                class: 'prompt-mention',
                'data-type': 'mention',
                'data-id': node.attrs.id,
                'data-label': label,
              },
              label,
            ];
          },
          suggestion: {
            char: '/',
            allowSpaces: false,
            startOfParagraph: false,
            allowedPrefixes: null,
            allow: ({ editor, state, range, isActive }) => {
              // 检查光标前面的字符是否为 /
              const pos = state.selection.from;
              const textBeforeCursor = state.doc.textBetween(
                Math.max(0, pos - 1),
                pos,
                '\n'
              );
              return textBeforeCursor === '/';
            },
            items: async ({ query }) => {
              const results = await fetchPrompts(query);
              return results.map((p: any) => ({ id: p.id, label: p.label, description: p.description }));
            },
            render: () => {
              let component: ReactRenderer | null = null;
              let popup: TippyInstance[] | null = null;

              return {
                onStart: (props) => {
                  // 检查光标前面的字符是否为 /
                  const pos = props.editor.state.selection.from;
                  const textBeforeCursor = props.editor.state.doc.textBetween(
                    Math.max(0, pos - 1),
                    pos,
                    '\n'
                  );
                  if (textBeforeCursor !== '/') {
                    return;
                  }

                  component = new ReactRenderer(PromptSuggestionList, {
                    props,
                    editor: props.editor,
                  });

                  const isDark = document.body.getAttribute('data-theme') === 'dark';
                  const getRect = () => {
                    if (props.clientRect) {
                      return props.clientRect();
                    }
                    const coords = props.editor.view.coordsAtPos(pos);
                    return new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
                  };
                  popup = tippy('body', {
                    getReferenceClientRect: getRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                    theme: isDark ? 'dark' : 'light',
                    arrow: false,
                  });
                },
                onUpdate(props) {
                  component?.updateProps(props);
                  // 检查光标前面的字符是否为 /
                  const pos = props.editor.state.selection.from;
                  const textBeforeCursor = props.editor.state.doc.textBetween(
                    Math.max(0, pos - 1),
                    pos,
                    '\n'
                  );
                  if (textBeforeCursor !== '/') {
                    popup?.[0]?.hide();
                    return;
                  }
                  const getRect = () => {
                    if (props.clientRect) {
                      return props.clientRect();
                    }
                    const coords = props.editor.view.coordsAtPos(pos);
                    return new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
                  };
                  popup?.[0]?.setProps({
                    getReferenceClientRect: getRect,
                  });
                },
                onKeyDown(props) {
                  if (props.event.key === 'Escape') {
                    popup?.[0]?.hide();
                    return true;
                  }
                  return (component?.ref as any)?.onKeyDown?.(props) || false;
                },
                onExit() {
                  popup?.[0]?.destroy();
                  component?.destroy();
                },
              };
            },
          },
        }),
      ],
      content: value || '',
      editable: !disabled,
      onUpdate: ({ editor }) => {
        const doc = editor.state.doc;
        let processedContent = '';
        
        doc.content.forEach((node: any) => {
          processedContent += serializeNode(node);
        });
        
        onChange?.(processedContent);
      },
      editorProps: {
        attributes: {
          class: 'prompt-tiptap-editor',
        },
      },
    });

    useEffect(() => {
      if (editor && value !== undefined) {
        const currentMarkdown = editor.storage.markdown.getMarkdown();
        if (currentMarkdown !== value) {
          let contentToSet = value || '';
          
          const promptPlaceholderRegex = /\{\{prompt@([^}]+)\}\}/g;
          const matches = contentToSet.match(promptPlaceholderRegex);
          
          if (matches) {
            contentToSet = contentToSet.replace(promptPlaceholderRegex, (match, promptId) => {
              const prompt = prompts.find(p => p.id === promptId);
              const label = prompt?.name || promptId;
              return `<span data-type="mention" data-id="${promptId}" data-label="${label}">${label}</span>`;
            });
          }
          
          editor.commands.setContent(contentToSet, false);
        }
      }
    }, [editor]);
    
    useEffect(() => {
      if (editor && prompts.length > 0 && value && value.includes('{{prompt@')) {
        const currentMarkdown = editor.storage.markdown.getMarkdown();
        if (currentMarkdown !== value) {
          let contentToSet = value;
          const promptPlaceholderRegex = /\{\{prompt@([^}]+)\}\}/g;
          
          contentToSet = contentToSet.replace(promptPlaceholderRegex, (match, promptId) => {
            const prompt = prompts.find(p => p.id === promptId);
            const label = prompt?.name || promptId;
            return `<span data-type="mention" data-id="${promptId}" data-label="${label}">${label}</span>`;
          });
          
          editor.commands.setContent(contentToSet, false);
        }
      }
    }, [editor, prompts]);

    useImperativeHandle(ref, () => ({
      insertPromptReference: () => {
        if (editor) {
          editor.chain().focus().insertContent('/').run();
        }
      },
    }));

    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const handleToolbarAction = (action: string) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      switch (action) {
        case 'bold': chain.toggleBold().run(); break;
        case 'italic': chain.toggleItalic().run(); break;
        case 'underline': chain.toggleUnderline().run(); break;
        case 'strike': chain.toggleStrike().run(); break;
        case 'highlight': chain.toggleHighlight().run(); break;
        case 'subscript': chain.toggleSubscript().run(); break;
        case 'superscript': chain.toggleSuperscript().run(); break;
        case 'heading1': chain.toggleHeading({ level: 1 }).run(); break;
        case 'heading2': chain.toggleHeading({ level: 2 }).run(); break;
        case 'heading3': chain.toggleHeading({ level: 3 }).run(); break;
        case 'bulletList': chain.toggleBulletList().run(); break;
        case 'orderedList': chain.toggleOrderedList().run(); break;
        case 'codeBlock': chain.toggleCodeBlock().run(); break;
        case 'blockquote': chain.toggleBlockquote().run(); break;
        case 'link': setShowLinkModal(true); break;
        case 'undo': chain.undo().run(); break;
        case 'redo': chain.redo().run(); break;
        case 'clearFormat': chain.unsetAllMarks().clearNodes().run(); break;
        case 'prompt':
          chain.insertContent('/').run();
          break;
      }
    };

    const handleLinkConfirm = () => {
      if (linkUrl && editor) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        setShowLinkModal(false);
        setLinkUrl('');
      }
    };

    const isDark = theme === 'dark';

    const isActive = (action: string) => {
      if (!editor) return false;
      switch (action) {
        case 'bold': return editor.isActive('bold');
        case 'italic': return editor.isActive('italic');
        case 'underline': return editor.isActive('underline');
        case 'strike': return editor.isActive('strike');
        case 'highlight': return editor.isActive('highlight');
        case 'subscript': return editor.isActive('subscript');
        case 'superscript': return editor.isActive('superscript');
        case 'heading1': return editor.isActive('heading', { level: 1 });
        case 'heading2': return editor.isActive('heading', { level: 2 });
        case 'heading3': return editor.isActive('heading', { level: 3 });
        case 'bulletList': return editor.isActive('bulletList');
        case 'orderedList': return editor.isActive('orderedList');
        case 'codeBlock': return editor.isActive('codeBlock');
        case 'blockquote': return editor.isActive('blockquote');
        case 'link': return editor.isActive('link');
        default: return false;
      }
    };

    const toolbarBtnStyle = (action: string): React.CSSProperties => ({
      background: isActive(action)
        ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)')
        : 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: 4,
      color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
      fontSize: 14,
      fontWeight: isActive(action) ? 600 : 400,
      lineHeight: 1,
      transition: 'all 0.15s',
    });

    return (
      <div
        className="prompt-tiptap-wrapper"
        data-color-mode={isDark ? 'dark' : 'light'}
        style={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#d9d9d9'}`,
          borderRadius: 8,
          overflow: 'hidden',
          ...style,
        }}
      >
        <style>{`
          .prompt-tiptap-wrapper[data-color-mode="dark"] .prompt-tiptap-toolbar {
            background-color: #1a1a1a;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }
          .prompt-tiptap-wrapper[data-color-mode="light"] .prompt-tiptap-toolbar {
            background-color: #fafafa;
            border-bottom: 1px solid #e8e8e8;
          }
          .prompt-tiptap-wrapper .prompt-tiptap-toolbar button:hover {
            background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'} !important;
          }
          .prompt-tiptap-wrapper[data-color-mode="dark"] .tiptap {
            color: #ffffff;
            background-color: #1a1a1a;
          }
          .prompt-tiptap-wrapper[data-color-mode="light"] .tiptap {
            color: #000000;
            background-color: #ffffff;
          }
          .prompt-tiptap-wrapper .tiptap {
            outline: none;
            padding: 12px 16px;
            min-height: ${height - 40}px;
            max-height: ${height}px;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.6;
            text-align: left;
          }
          .prompt-tiptap-wrapper .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: ${isDark ? '#555' : '#aaa'};
            pointer-events: none;
            height: 0;
          }
          .prompt-tiptap-wrapper .tiptap h1 { font-size: 1.6em; font-weight: 700; margin: 0.5em 0; }
          .prompt-tiptap-wrapper .tiptap h2 { font-size: 1.4em; font-weight: 600; margin: 0.5em 0; }
          .prompt-tiptap-wrapper .tiptap h3 { font-size: 1.2em; font-weight: 600; margin: 0.5em 0; }
          .prompt-tiptap-wrapper .tiptap ul { padding-left: 1.5em; list-style-type: disc; }
          .prompt-tiptap-wrapper .tiptap ol { padding-left: 1.5em; list-style-type: decimal; }
          .prompt-tiptap-wrapper .tiptap blockquote {
            border-left: 3px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#d9d9d9'};
            padding-left: 1em;
            margin-left: 0;
            color: ${isDark ? '#aaa' : '#666'};
          }
          .prompt-tiptap-wrapper .tiptap pre {
            background: ${isDark ? '#0d0d0d' : '#f5f5f5'};
            border-radius: 4px;
            padding: 0.75em 1em;
            font-family: monospace;
            font-size: 0.9em;
          }
          .prompt-tiptap-wrapper .tiptap code {
            background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
            border-radius: 3px;
            padding: 0.15em 0.3em;
            font-size: 0.9em;
          }
          .prompt-tiptap-wrapper .tiptap a {
            color: #667eea;
            text-decoration: underline;
          }
          .prompt-tiptap-wrapper .tiptap a:hover {
            color: #7c8eea;
          }
          .prompt-tiptap-wrapper .tiptap mark {
            background-color: #fef08a;
            color: #000;
            padding: 0.1em 0.2em;
            border-radius: 2px;
          }
          .prompt-tiptap-wrapper[data-color-mode="dark"] .tiptap mark {
            background-color: #fbbf24;
            color: #000;
          }
          .prompt-tiptap-wrapper .tiptap s {
            text-decoration: line-through;
            color: ${isDark ? '#888' : '#999'};
          }
          .prompt-tiptap-wrapper .tiptap u {
            text-decoration: underline;
          }
          .prompt-tiptap-wrapper .tiptap sub {
            font-size: 0.8em;
            vertical-align: sub;
          }
          .prompt-tiptap-wrapper .tiptap sup {
            font-size: 0.8em;
            vertical-align: super;
          }
          .prompt-tiptap-wrapper .tiptap .prompt-mention {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 1px 8px;
            margin: 0 2px;
            background-color: ${isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)'};
            border: 1px solid ${isDark ? 'rgba(102, 126, 234, 0.4)' : 'rgba(102, 126, 234, 0.3)'};
            border-radius: 4px;
            color: #667eea;
            font-size: 14px;
            font-weight: 500;
            vertical-align: middle;
            line-height: 1.5;
          }
          .prompt-tiptap-wrapper .tiptap .prompt-mention .mention-label {
            color: #667eea;
            font-weight: 500;
          }
          .prompt-tiptap-wrapper .tiptap .prompt-mention .mention-delete {
            cursor: pointer;
            font-size: 14px;
            opacity: 0.7;
            margin-left: 4px;
            color: ${isDark ? '#aaa' : '#999'};
            user-select: none;
          }
          .prompt-tiptap-wrapper .tiptap .prompt-mention .mention-delete:hover {
            opacity: 1;
            color: ${isDark ? '#fff' : '#333'};
          }
          /* 隐藏 Mention 节点内部的 @ 字符 */
          .prompt-tiptap-wrapper .tiptap .prompt-mention::before,
          .prompt-tiptap-wrapper .tiptap .prompt-mention::after {
            content: none !important;
            display: none !important;
          }
          .tippy-box[data-theme~='dark'] .prompt-suggestion-list {
            background: #1e1e1e;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            padding: 4px;
            min-width: 240px;
            max-width: 300px;
            max-height: 240px;
            overflow-y: auto;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          }
          .tippy-box[data-theme~='light'] .prompt-suggestion-list {
            background: #ffffff;
            border: 1px solid #d9d9d9;
            border-radius: 6px;
            padding: 4px;
            min-width: 240px;
            max-width: 300px;
            max-height: 240px;
            overflow-y: auto;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          }
          .tippy-box[data-theme~='dark'],
          .tippy-box[data-theme~='dark'] .tippy-content {
            background-color: #1e1e1e;
            border: none;
            padding: 0;
          }
          .tippy-box[data-theme~='light'],
          .tippy-box[data-theme~='light'] .tippy-content {
            background-color: #ffffff;
            border: none;
            padding: 0;
          }
          .tippy-box[data-theme~='dark'] .tippy-arrow {
            color: #1e1e1e;
          }
          .tippy-box[data-theme~='dark'] .tippy-arrow::before {
            background-color: #1e1e1e;
            border-color: rgba(255,255,255,0.1);
          }
          .tippy-box[data-theme~='light'] .tippy-arrow {
            color: #ffffff;
          }
          .tippy-box[data-theme~='light'] .tippy-arrow::before {
            background-color: #ffffff;
            border-color: #d9d9d9;
          }
          .tippy-box[data-theme~='dark'] .prompt-suggestion-list .suggestion-group {
            padding: 6px 10px 4px;
            font-size: 11px;
            font-weight: 500;
            color: #aaa;
          }
          .tippy-box[data-theme~='light'] .prompt-suggestion-list .suggestion-group {
            padding: 6px 10px 4px;
            font-size: 11px;
            font-weight: 500;
            color: #888;
          }
          .tippy-box[data-theme~='dark'] .prompt-suggestion-list .suggestion-item {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            text-align: left;
            background: transparent;
            border: none;
            padding: 6px 10px;
            cursor: pointer;
            font-size: 13px;
            color: #fff;
            border-radius: 4px;
            transition: background 0.15s;
          }
          .tippy-box[data-theme~='light'] .prompt-suggestion-list .suggestion-item {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            text-align: left;
            background: transparent;
            border: none;
            padding: 6px 10px;
            cursor: pointer;
            font-size: 13px;
            color: #333;
            border-radius: 4px;
            transition: background 0.15s;
          }
          .tippy-box[data-theme~='dark'] .prompt-suggestion-list .suggestion-item:hover,
          .tippy-box[data-theme~='dark'] .prompt-suggestion-list .suggestion-item.is-selected {
            background: rgba(255,255,255,0.08);
          }
          .tippy-box[data-theme~='light'] .prompt-suggestion-list .suggestion-item:hover,
          .tippy-box[data-theme~='light'] .prompt-suggestion-list .suggestion-item.is-selected {
            background: #e6f7ff;
          }
          .tippy-box[data-theme~='dark'] .prompt-suggestion-list .suggestion-item .item-label {
            font-weight: 500;
            color: #ffffff;
            font-size: 13px;
            flex-shrink: 0;
            white-space: nowrap;
          }
          .tippy-box[data-theme~='light'] .prompt-suggestion-list .suggestion-item .item-label {
            font-weight: 500;
            color: #1f2937;
            font-size: 13px;
            flex-shrink: 0;
            white-space: nowrap;
          }
          .tippy-box .prompt-suggestion-list .suggestion-item.is-selected .item-label {
            color: #667eea;
          }
          .tippy-box[data-theme~='dark'] .prompt-suggestion-list .suggestion-item .item-desc {
            font-size: 12px;
            color: #888;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .tippy-box[data-theme~='light'] .prompt-suggestion-list .suggestion-item .item-desc {
            font-size: 12px;
            color: #999;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        `}</style>

        <div className="prompt-tiptap-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', flexWrap: 'wrap' }}>
          <button style={toolbarBtnStyle('undo')} onClick={() => handleToolbarAction('undo')} title="撤销">
            <UndoOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('redo')} onClick={() => handleToolbarAction('redo')} title="重做">
            <RedoOutlined style={{ fontSize: 14 }} />
          </button>
          <span style={{ width: 1, height: 16, background: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0', margin: '0 4px' }} />
          
          <button style={toolbarBtnStyle('heading1')} onClick={() => handleToolbarAction('heading1')} title="标题1">H1</button>
          <button style={toolbarBtnStyle('heading2')} onClick={() => handleToolbarAction('heading2')} title="标题2">H2</button>
          <button style={toolbarBtnStyle('heading3')} onClick={() => handleToolbarAction('heading3')} title="标题3">H3</button>
          <span style={{ width: 1, height: 16, background: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0', margin: '0 4px' }} />
          
          <button style={toolbarBtnStyle('bold')} onClick={() => handleToolbarAction('bold')} title="加粗">
            <BoldOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('italic')} onClick={() => handleToolbarAction('italic')} title="斜体">
            <ItalicOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('underline')} onClick={() => handleToolbarAction('underline')} title="下划线">
            <UnderlineOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('strike')} onClick={() => handleToolbarAction('strike')} title="删除线">
            <StrikethroughOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('highlight')} onClick={() => handleToolbarAction('highlight')} title="高亮">
            <HighlightOutlined style={{ fontSize: 14 }} />
          </button>
          <span style={{ width: 1, height: 16, background: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0', margin: '0 4px' }} />
          
          <button style={toolbarBtnStyle('bulletList')} onClick={() => handleToolbarAction('bulletList')} title="无序列表">
            <UnorderedListOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('orderedList')} onClick={() => handleToolbarAction('orderedList')} title="有序列表">
            <OrderedListOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('blockquote')} onClick={() => handleToolbarAction('blockquote')} title="引用">
            <FileTextOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('codeBlock')} onClick={() => handleToolbarAction('codeBlock')} title="代码块">
            <CodeOutlined style={{ fontSize: 14 }} />
          </button>
          <button style={toolbarBtnStyle('link')} onClick={() => handleToolbarAction('link')} title="链接">
            <LinkOutlined style={{ fontSize: 14 }} />
          </button>
          <span style={{ width: 1, height: 16, background: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0', margin: '0 4px' }} />
          
          <button style={toolbarBtnStyle('clearFormat')} onClick={() => handleToolbarAction('clearFormat')} title="清除格式">
            <DeleteOutlined style={{ fontSize: 14 }} />
          </button>
          <span style={{ width: 1, height: 16, background: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0', margin: '0 4px' }} />
          
          <button style={toolbarBtnStyle('prompt')} onClick={() => handleToolbarAction('prompt')} title="插入提示词引用 (/)">
            <BookOutlined style={{ fontSize: 14 }} />
          </button>
        </div>

        <EditorContent editor={editor} />

        <Modal
          title="插入链接"
          open={showLinkModal}
          onCancel={() => { setShowLinkModal(false); setLinkUrl(''); }}
          onOk={handleLinkConfirm}
          okText="确定"
          cancelText="取消"
        >
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="请输入链接地址"
            style={{ width: '100%' }}
          />
        </Modal>
      </div>
    );
  }
);

PromptTipTapEditor.displayName = 'PromptTipTapEditor';

interface SuggestionItem {
  id: string;
  label: string;
  description?: string;
  group?: string;
}

interface PromptSuggestionListProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
}

class PromptSuggestionList extends React.Component<PromptSuggestionListProps> {
  state = { selectedIndex: 0 };

  componentDidUpdate(oldProps: PromptSuggestionListProps) {
    if (this.props.items !== oldProps.items) {
      this.setState({ selectedIndex: 0 });
    }
  }

  onKeyDown = (props: { event: KeyboardEvent }) => {
    if (props.event.key === 'ArrowUp') {
      this.setState((prev: { selectedIndex: number }) => ({
        selectedIndex: (prev.selectedIndex + this.props.items.length - 1) % this.props.items.length,
      }));
      return true;
    }
    if (props.event.key === 'ArrowDown') {
      this.setState((prev: { selectedIndex: number }) => ({
        selectedIndex: (prev.selectedIndex + 1) % this.props.items.length,
      }));
      return true;
    }
    if (props.event.key === 'Enter') {
      this.selectItem(this.state.selectedIndex);
      return true;
    }
    return false;
  };

  selectItem = (index: number) => {
    const item = this.props.items[index];
    if (item) {
      this.props.command(item);
    }
  };

  render() {
    const theme = document.body.getAttribute('data-theme') || 'dark';
    const isDark = theme === 'dark';

    return (
      <div className="prompt-suggestion-list">
        <div className="suggestion-group">提示词/</div>
        {this.props.items.length === 0 ? (
          <div style={{ padding: 12, textAlign: 'center', color: isDark ? '#888' : '#999', fontSize: 12 }}>
            暂无提示词
          </div>
        ) : (
          this.props.items.map((item, index) => (
            <button
              key={item.id}
              className={`suggestion-item ${index === this.state.selectedIndex ? 'is-selected' : ''}`}
              onClick={() => this.selectItem(index)}
            >
              <div className="item-label">{item.label}</div>
              {item.description && (
                <div className="item-desc">{item.description}</div>
              )}
            </button>
          ))
        )}
      </div>
    );
  }
}

export default PromptTipTapEditor;
