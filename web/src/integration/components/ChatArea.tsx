import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PaperClipOutlined, CopyOutlined, EditOutlined, ReloadOutlined, CheckOutlined, BulbOutlined, DownOutlined, RightOutlined, LoadingOutlined } from '@ant-design/icons';
import { Tooltip, message } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import ChatMarkdown from '../../components/ChatMarkdown';
import { integrationChatService, IntegrationMessage, IntegrationQueryItem } from '../services/integrationChat';
import { usePanelDrag } from './PanelDragContext';
import { usePanelMinimize } from './PanelMinimizeContext';
import { getDefaultAvatar } from '../../utils/avatar';

interface ChatAreaProps {
  apiKey: string;
  chatId?: string;
  title?: string;
  theme?: string;
  themeMode?: string;
  colorTheme?: string;
  gradientEndColor?: string;
  inputPlaceholder?: string;
  maxInputLength?: number;
  welcomeMessages?: string[];
  userAvatar?: string;  // 用户头像
  botAvatar?: string;   // 机器人头像
  historyCollapsed: boolean;
  onToggleHistory: () => void;
  onChatIdChange: (chatId: string) => void;
  onMessageSent: () => void;
  temporary?: boolean;
}

interface ToolCallStep {
  tool_call_id: string;
  name: string;
  task_name?: string;
  status: 'start' | 'running' | 'success' | 'error';
  result?: any;
  message?: string;
  elapsed_ms?: number;
}

interface DisplayMessage {
  id: string;
  message_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  reasoning_content?: string;
  reasoning_time?: number;
  reasoning_end?: boolean;
  tool_calls?: ToolCallStep[];
  status?: 'start' | 'streaming' | 'done';
  step?: 'pre_process' | 'task_planning' | 'task_list' | 'model_answer' | 'task_execution' | 'result_summary';
  step_id?: string;
}

interface SelectedFile {
  type: 'file_base64';
  content: string;
  mime_type: string;
  file_name: string;
  file_size?: number;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  apiKey,
  chatId,
  title = 'AI助手',
  theme = '#1677ff',
  themeMode = 'light',
  colorTheme = 'default_blue',
  gradientEndColor = 'none',
  inputPlaceholder = '请输入您的问题...',
  maxInputLength = 4000,
  welcomeMessages = [],
  userAvatar = '',
  botAvatar = '',
  historyCollapsed,
  onToggleHistory,
  onChatIdChange,
  onMessageSent,
  temporary = false,
}) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [deepThinking, setDeepThinking] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatId);
  const [randomWelcome, setRandomWelcome] = useState<string>('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [expandedToolCallResults, setExpandedToolCallResults] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messagesPadding, setMessagesPadding] = useState<number>(16);
  const [messagesPaddingTop, setMessagesPaddingTop] = useState<number>(24);

  // 检测是否在底部
  const isAtBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // 随机选择欢迎语
  useEffect(() => {
    if (welcomeMessages && welcomeMessages.length > 0) {
      const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
      setRandomWelcome(welcomeMessages[randomIndex]);
    } else {
      setRandomWelcome('你好，有什么可以帮助您的吗？');
    }
  }, [welcomeMessages]);

  // 动态计算消息区域左右padding
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const calculatePadding = () => {
      const width = container.clientWidth;
      const contentMaxWidth = 800;
      const horizontalPadding = Math.max(16, Math.floor((width - contentMaxWidth) / 2));
      const padding = Math.floor(horizontalPadding * 2 / 3);
      const paddingTop = Math.max(24, Math.floor(width * 0.03));
      setMessagesPadding(padding);
      setMessagesPaddingTop(paddingTop);
    };

    calculatePadding();

    const resizeObserver = new ResizeObserver(() => {
      calculatePadding();
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', calculatePadding);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculatePadding);
    };
  }, []);

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId && chatId !== currentChatId) {
      setCurrentChatId(chatId);
      loadMessages(chatId);
    }
  }, [chatId]);

  // 只有在底部时才自动滚动
  useEffect(() => {
    if (isAtBottom()) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  const loadMessages = async (id: string) => {
    try {
      const result = await integrationChatService.getMessages(apiKey, id);
      const displayMsgs: DisplayMessage[] = (result.items || []).map((m: IntegrationMessage) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        reasoning_content: m.reasoning_content,
        status: 'done',
      }));
      setMessages(displayMsgs);
      setTimeout(() => {
        scrollToBottomInstant();
      }, 100);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxInputLength) {
      setInputValue(val);
      // Auto-resize
      const ta = e.target;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  };

  // 文件上传处理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const base64Content = base64.split(',')[1]; // 移除 data:xxx;base64, 前缀

        const selectedFile: SelectedFile = {
          type: 'file_base64',
          content: base64Content,
          mime_type: file.type,
          file_name: file.name,
          file_size: file.size,
        };
        setSelectedFiles(prev => [...prev, selectedFile]);
      };
      reader.readAsDataURL(file);
    });

    // 清空input，允许重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 移除已选文件
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Send message
  const handleSend = async () => {
    const text = inputValue.trim();
    // 有文件或有文本时都可以发送
    if ((selectedFiles.length === 0 && !text) || loading) return;

    // Build query items
    const query: IntegrationQueryItem[] = [];

    // Add files first
    selectedFiles.forEach(file => {
      query.push({
        type: file.type,
        content: file.content,
        mime_type: file.mime_type,
        file_name: file.file_name,
        file_size: file.file_size,
      });
    });

    // Add text
    if (text) {
      query.push({ type: 'text', content: text });
    }

    const filesForDisplay = [...selectedFiles];

    // Build display content
    let displayContent = text;
    if (filesForDisplay.length > 0) {
      const fileNames = filesForDisplay.map(f => f.file_name).join(', ');
      displayContent = text ? `${text}\n\n[文件: ${fileNames}]` : `[文件: ${fileNames}]`;
    }

    // 清空输入框和文件（只有普通发送时清空）
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setSelectedFiles([]);

    sendMessageInternal(query, displayContent, filesForDisplay);
  };

  /**
   * 内部发送消息方法
   */
  const sendMessageInternal = async (
    query: IntegrationQueryItem[],
    displayContent: string,
    filesForDisplay: any[]
  ) => {
    const idTracker = { assistant: '', user: '' };

    // Add user message
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
      status: 'done',
      created_at: new Date().toISOString(),
    };
    idTracker.user = userMsg.id;

    // Add placeholder for assistant
    const assistantMsg: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      status: 'start',
      created_at: new Date().toISOString(),
      reasoning_content: '',
      reasoning_end: false,
      tool_calls: [],
    };
    idTracker.assistant = assistantMsg.id;

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    scrollToBottom();
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let newChatId = currentChatId;

    const processSSEMessageUpdate = (msg: DisplayMessage, data: any): DisplayMessage => {
      if (msg.role === 'user') {
        if (data.user_message_id && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
          idTracker.user = data.user_message_id;
          return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
        }
        return msg;
      }

      if (msg.role === 'assistant') {
        const dataStepId = data.step_id;
        const msgStepId = msg.step_id;

        const dataHasStepId = dataStepId !== undefined && dataStepId !== null && dataStepId !== '';
        const msgHasStepId = msgStepId !== undefined && msgStepId !== null && msgStepId !== '';

        if (dataHasStepId) {
          if (!msgHasStepId || dataStepId !== msgStepId) {
            return msg;
          }
        } else {
          if (msgHasStepId) {
            return msg;
          }
        }

        const updates: any = { ...msg };

        if (data.assistant_message_id) {
          updates.message_id = data.assistant_message_id;
        }

        const status = data.status || 'running';
        updates.status = status;

        if (data.step) {
          updates.step = data.step;
        }

        if (data.step_id) {
          updates.step_id = data.step_id;
        }

        if (!msg.reasoning_end) {
          if (data.reasoning_content) {
            updates.reasoning_content = (msg.reasoning_content || '') + data.reasoning_content;
          }
        }

        if (data.text) {
          updates.content = (msg.content || '') + data.text;
        }

        if (data.reasoning_end) {
          updates.reasoning_end = true;
        }

        if (data.tool_call) {
          const tc = data.tool_call;
          const existingCalls = updates.tool_calls || [];
          const existingIndex = existingCalls.findIndex((c: any) => c.tool_call_id === tc.tool_call_id);
          if (existingIndex >= 0) {
            existingCalls[existingIndex] = { ...existingCalls[existingIndex], ...tc };
          } else {
            existingCalls.push(tc);
          }
          updates.tool_calls = [...existingCalls];
        }

        if (data.reasoning_time != null) {
          updates.reasoning_time = data.reasoning_time;
        }

        updates.created_at = new Date().toISOString();
        return updates;
      }

      return msg;
    };

    try {
      await integrationChatService.sendMessageStream(
        apiKey,
        query,
        currentChatId,
        (data: any) => {
          if (data.chat_id && !newChatId) {
            newChatId = data.chat_id;
            setCurrentChatId(newChatId);
            onChatIdChange(newChatId);
          }

          const status = data.status || 'running';
          const stepId = data.step_id;

          if (status === 'error') {
            setMessages(prev => {
              let updated = [...prev];
              if (data.user_message_id) {
                updated = prev.map(msg => {
                  if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                    idTracker.user = data.user_message_id;
                    return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                  }
                  return msg;
                });
              }
              const existingMsg = updated.find(msg =>
                msg.role === 'assistant' &&
                (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)
              );
              if (existingMsg) {
                return updated.map(msg => {
                  if (msg.role === 'assistant' && (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)) {
                    return { ...msg, content: data.text || '抱歉，处理您的请求时出现错误。', status: 'error' as any, reasoning_content: undefined, reasoning_end: undefined };
                  }
                  return msg;
                });
              } else {
                const errorMsg: DisplayMessage = {
                  id: stepId || idTracker.assistant,
                  message_id: data.assistant_message_id,
                  role: 'assistant',
                  content: data.text || '抱歉，处理您的请求时出现错误。',
                  created_at: new Date().toISOString(),
                  status: 'error' as any,
                  step: data.step,
                  step_id: stepId,
                };
                return [...updated, errorMsg];
              }
            });
            return;
          }

          if (status === 'start' && stepId && data.step) {
            setMessages(prev => {
              let updated = [...prev];
              if (data.user_message_id) {
                updated = prev.map(msg => {
                  if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                    idTracker.user = data.user_message_id;
                    return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                  }
                  return msg;
                });
              }
              const existingStepMsg = updated.find(msg => msg.step_id === stepId && msg.role === 'assistant');
              if (existingStepMsg) {
                return updated.map(msg => {
                  if (msg.role === 'user') return processSSEMessageUpdate(msg, data);
                  if (msg.step_id === stepId) return processSSEMessageUpdate(msg, data);
                  return msg;
                });
              }
              const initialMsgIndex = updated.findIndex(msg => msg.role === 'assistant' && !msg.step_id && msg.status === 'start');
              if (initialMsgIndex >= 0) {
                return updated.map((msg, idx) => {
                  if (idx === initialMsgIndex) {
                    return {
                      ...msg,
                      // 不更新 id，保持原来的临时 id
                      message_id: data.assistant_message_id,
                      status: 'start',
                      step: data.step,
                      step_id: stepId,
                      tool_calls: data.tool_call ? [data.tool_call] : [],
                    };
                  }
                  return msg;
                });
              }
              const newStepMsg: DisplayMessage = {
                id: stepId,
                message_id: data.assistant_message_id,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
                status: 'start',
                step: data.step,
                step_id: stepId,
                reasoning_content: '',
                reasoning_end: false,
                tool_calls: data.tool_call ? [data.tool_call] : [],
              };
              return [...updated, newStepMsg];
            });
          } else {
            setMessages(prev => prev.map(msg => {
              if (msg.role === 'user') return processSSEMessageUpdate(msg, data);
              if (!stepId) return processSSEMessageUpdate(msg, data);
              if (msg.step_id === stepId) return processSSEMessageUpdate(msg, data);
              return msg;
            }));
          }
        },
        (err: any) => {
          console.error('Stream error:', err);
          const errorMessage = typeof err === 'string' ? err : err?.message || err?.error || '发生了未知错误';
          setMessages((prev) => prev.map(msg => {
            if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
              return { ...msg, content: msg.content || errorMessage, status: 'done' };
            }
            return msg;
          }));
          setLoading(false);
          abortControllerRef.current = null;
        },
        () => {
          setMessages((prev) => prev.map(msg => {
            if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
              return { ...msg, status: 'done' };
            }
            return msg;
          }));
          setLoading(false);
          abortControllerRef.current = null;
          onMessageSent();
        },
        controller.signal,
        temporary,
        deepThinking
      );
    } catch (err: any) {
      console.error('Send message error:', err);
      const errorMessage = typeof err === 'string' ? err : err?.message || err?.error || '发生了未知错误';
      setMessages((prev) => prev.map(msg => {
        if (msg.role === 'assistant' && msg.status && msg.status !== 'done') {
          return { ...msg, content: msg.content || errorMessage, status: 'done' };
        }
        return msg;
      }));
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Stop streaming
  const handleStop = () => {
    abortControllerRef.current?.abort();
    setLoading(false);
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === 'assistant') {
        updated[updated.length - 1] = { ...last, status: 'done' };
      }
      return updated;
    });
  };

  /**
   * 尝试解析内容是否为 widget_event JSON
   */
  const tryParseWidgetEvent = (content: string): { type: string; widgetId: string; widgetValue: any } | null => {
    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.type === 'widget_event' && parsed.widgetId !== undefined) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  /**
   * 格式化 widget_value 为用户友好的显示文本
   */
  const formatWidgetValueForDisplay = (widgetId: string, widgetValue: any): string => {
    if (widgetValue == null) return '';
    if (typeof widgetValue === 'string') return widgetValue;
    if (typeof widgetValue === 'number' || typeof widgetValue === 'boolean') return String(widgetValue);
    if (Array.isArray(widgetValue)) return widgetValue.join(', ');
    if (typeof widgetValue === 'object') return JSON.stringify(widgetValue, null, 2);
    return String(widgetValue);
  };

  /**
   * 将 widget 交互值保存到对应助手消息的 extra_content 中
   * 用于重新进入对话时恢复组件的选中状态
   */
  const saveWidgetValueToMessage = useCallback((widgetId: string, widgetValue: any) => {
    setMessages(prev => prev.map(msg => {
      if (msg.role === 'assistant' && msg.content && msg.content.includes(widgetId)) {
        const existingWidgetValues = (msg.extra_content as any)?.widgetValues || {};
        return {
          ...msg,
          extra_content: {
            ...msg.extra_content,
            widgetValues: {
              ...existingWidgetValues,
              [widgetId]: widgetValue
            }
          }
        };
      }
      return msg;
    }));
  }, []);

  /**
   * 处理 Markdown-UI 组件交互事件
   * 将组件事件数据作为新的用户消息发送给后端
   */
  const handleWidgetEvent = (event: any) => {
    // 先保存交互值到对应助手消息的 extra_content 中
    if (event.widgetId !== undefined) {
      saveWidgetValueToMessage(event.widgetId, event.widgetValue);
    }

    const eventData = {
      type: event.type || 'widget_event',
      widgetId: event.widgetId,
      widgetValue: event.widgetValue
    };
    const jsonContent = JSON.stringify(eventData, null, 2);
    const displayContent = formatWidgetValueForDisplay(event.widgetId, event.widgetValue);
    sendMessageInternal(
      [{ type: 'text', content: jsonContent }],
      displayContent,
      []
    );
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string, type: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        message.success(`${type}已复制`);
      }).catch(() => {
        fallbackCopyTextToClipboard(text, type);
      });
    } else {
      fallbackCopyTextToClipboard(text, type);
    }
  };

  const fallbackCopyTextToClipboard = (text: string, type: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        message.success(`${type}已复制`);
      } else {
        message.error('复制失败，请手动复制');
      }
    } catch (err) {
      message.error('复制失败，请手动复制');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  // 自动调整编辑输入框高度
  const autoResizeEditTextarea = useCallback(() => {
    if (editTextareaRef.current) {
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = `${Math.min(editTextareaRef.current.scrollHeight, 200)}px`;
    }
  }, []);

  // 编辑消息
  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
    setTimeout(() => {
      autoResizeEditTextarea();
      editTextareaRef.current?.focus();
    }, 0);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  // 保存编辑并发送
  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) return;

    // 找到这条消息的索引
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // 删除这条消息及其后面的所有消息
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);

    // 取消编辑状态
    setEditingMessageId(null);
    setEditingContent('');

    // 构建query，直接发送消息
    const query: IntegrationQueryItem[] = [{ type: 'text', content: editingContent }];
    sendMessageInternal(query, editingContent, []);
  };

  // 重新回答
  const handleRegenerate = async (groupIndex: number) => {
    if (loading) return;

    const groups = groupMessagesByAssistantId();
    if (groupIndex >= groups.length) return;

    let userMessage: DisplayMessage | null = null;
    let userMsgIndexInMessages = -1;

    for (let i = groupIndex - 1; i >= 0; i--) {
      const group = groups[i];
      if (!group.assistantId && group.messages.length > 0) {
        userMessage = group.messages[0];
        userMsgIndexInMessages = messages.findIndex(m => m.id === userMessage!.id);
        break;
      }
    }

    if (!userMessage || userMsgIndexInMessages === -1) return;

    const newMessages = messages.slice(0, userMsgIndexInMessages);
    setMessages(newMessages);

    const query: IntegrationQueryItem[] = [{ type: 'text', content: userMessage.content }];
    sendMessageInternal(query, userMessage.content, []);
  };

  // 切换思考过程展开/收起
  const toggleReasoning = (messageId: string) => {
    setExpandedReasoning(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // 切换工具调用展开/收起
  const toggleToolCall = (toolCallId: string) => {
    setExpandedToolCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  // 切换工具调用结果展开/收起
  const toggleToolCallResult = (toolCallId: string) => {
    setExpandedToolCallResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  const groupMessagesByAssistantId = () => {
    const groups: { assistantId: string; stableId: string; messages: DisplayMessage[] }[] = [];
    let currentGroup: { assistantId: string; stableId: string; messages: DisplayMessage[] } | null = null;
    let groupCounter = 0;

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        if (currentGroup) {
          groups.push(currentGroup);
          currentGroup = null;
        }
        groupCounter++;
        groups.push({ assistantId: '', stableId: `user-${groupCounter}`, messages: [msg] });
      } else if (msg.role === 'assistant') {
        const assistantId = msg.message_id || msg.id;
        if (currentGroup && currentGroup.assistantId === assistantId) {
          currentGroup.messages.push(msg);
        } else {
          if (currentGroup) {
            groups.push(currentGroup);
          }
          groupCounter++;
          currentGroup = { assistantId, stableId: `assistant-${groupCounter}`, messages: [msg] };
        }
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  };

  const renderAssistantMessageContent = (msg: DisplayMessage) => {
    return (
      <div className="int-step-container">
        <div className="int-md-editor-container">
          <>
            {(msg.status === 'start' || (!msg.reasoning_content && !msg.content && msg.status !== 'done' && msg.status !== 'stop')) && (
              <div className="int-message-reasoning">
                <div className="int-reasoning-header">
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>思考中...</span>
                </div>
              </div>
            )}

            {msg.status !== 'start' && msg.status !== 'done' && msg.status !== 'stop' && !msg.reasoning_end && msg.reasoning_content && (
              <div className="int-message-reasoning">
                <div className="int-reasoning-header">
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>正在思考中...</span>
                </div>
                {msg.reasoning_content && (
                  <div className="int-reasoning-text">
                    <ChatMarkdown source={msg.reasoning_content} />
                  </div>
                )}
              </div>
            )}

            {(msg.status === 'done' || msg.status === 'stop' || !msg.status) && msg.reasoning_content && msg.reasoning_end && (
              <div className="int-message-reasoning">
                <div className="int-reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  {expandedReasoning.has(msg.step_id || msg.id) ? (
                    <DownOutlined />
                  ) : (
                    <RightOutlined />
                  )}
                  <BulbOutlined />
                  <span>思考过程</span>
                  {msg.reasoning_time != null && (
                    <span className="int-reasoning-duration">
                      ({(msg.reasoning_time / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="int-reasoning-text">
                    <ChatMarkdown source={msg.reasoning_content} />
                  </div>
                )}
              </div>
            )}

            {msg.tool_calls && msg.tool_calls.length > 0 && (
              <div className="int-tool-calls-container">
                {msg.tool_calls.map((tc, tcIndex) => (
                  <div key={tc.tool_call_id || `tc-${tcIndex}`} className={`int-tool-call-card int-tool-call-${tc.status}`}>
                    <div className="int-tool-call-header" onClick={() => toggleToolCall(tc.tool_call_id || `tc-${tcIndex}`)}>
                      <div className="int-tool-call-header-left">
                        {tc.status === 'start' && <LoadingOutlined spin className="int-tool-call-icon-start" />}
                        {tc.status === 'running' && <LoadingOutlined spin className="int-tool-call-icon-running" />}
                        {tc.status === 'success' && <span className="int-tool-call-icon-success">✓</span>}
                        {tc.status === 'error' && <span className="int-tool-call-icon-error">✗</span>}
                        {expandedToolCalls.has(tc.tool_call_id || `tc-${tcIndex}`) ? (
                          <DownOutlined style={{ fontSize: 10 }} />
                        ) : (
                          <RightOutlined style={{ fontSize: 10 }} />
                        )}
                        {tc.task_name && <span className="int-tool-call-task-name">{tc.task_name}</span>}
                      </div>
                      <div className="int-tool-call-header-right">
                        {tc.elapsed_ms != null && tc.elapsed_ms > 0 && (
                          <span className="int-tool-call-elapsed">
                            {(tc.elapsed_ms / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                    {expandedToolCalls.has(tc.tool_call_id || `tc-${tcIndex}`) && (
                      <div className="int-tool-call-content">
                        {tc.message && (
                          <div className="int-tool-call-message">
                            <ChatMarkdown source={tc.message} />
                          </div>
                        )}
                        {tc.result && (
                          <>
                            {tc.message && <div className="int-tool-call-divider" />}
                            <div
                              className="int-tool-call-result-header"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleToolCallResult(tc.tool_call_id || `tc-${tcIndex}`);
                              }}
                            >
                              {expandedToolCallResults.has(tc.tool_call_id || `tc-${tcIndex}`) ? (
                                <DownOutlined style={{ fontSize: 10 }} />
                              ) : (
                                <RightOutlined style={{ fontSize: 10 }} />
                              )}
                              <span className="int-tool-call-result-title">工具结果</span>
                            </div>
                            {expandedToolCallResults.has(tc.tool_call_id || `tc-${tcIndex}`) && (
                              <div className="int-tool-call-result">
                                <ChatMarkdown
                                  source={typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {msg.content && (
              (() => {
                const widgetEvent = msg.role === 'user' ? tryParseWidgetEvent(msg.content) : null;
                const displaySource = widgetEvent
                  ? formatWidgetValueForDisplay(widgetEvent.widgetId, widgetEvent.widgetValue)
                  : msg.content;
                return <ChatMarkdown source={displaySource} onWidgetEvent={handleWidgetEvent} widgetValues={(msg.extra_content as any)?.widgetValues} />;
              })()
            )}
          </>
        </div>
      </div>
    );
  };

  const renderGroupedMessages = () => {
    const groups = groupMessagesByAssistantId();
    return groups.map((group, groupIndex) => {
      if (!group.assistantId) {
        const msg = group.messages[0];
        return renderUserMessage(msg, groupIndex);
      }

      const firstMsg = group.messages[0];
      const isRunning = group.messages.some(m => m.status && m.status !== 'done' && m.status !== 'stop');
      const hasContent = group.messages.some(m => m.content);

      return (
        <div key={group.stableId} className={`int-message assistant`}>
          <div className={`int-msg-avatar assistant`}>
            {botAvatar ? (
              <img src={botAvatar} alt="AI" />
            ) : (
              <img src={getDefaultAvatar()} alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div className="int-msg-content">
            {group.messages.map((msg, msgIndex) => (
              <div
                key={msgIndex}
                id={msg.step_id || undefined}
                className="int-step-wrapper"
              >
                {renderAssistantMessageContent(msg)}
              </div>
            ))}
            <div className="int-msg-footer">
              <span className="int-msg-time">
                {firstMsg.created_at ? new Date(firstMsg.created_at).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                }) : ''}
              </span>
              <div className="int-msg-actions">
                {isRunning ? (
                  <Tooltip title="正在生成中">
                    <button className="int-msg-action-btn" disabled>
                      <LoadingOutlined spin />
                    </button>
                  </Tooltip>
                ) : (
                  hasContent && (
                    <>
                      <Tooltip title="重新回答">
                        <button
                          className="int-msg-action-btn"
                          onClick={() => handleRegenerate(groupIndex)}
                          disabled={loading}
                        >
                          <ReloadOutlined />
                        </button>
                      </Tooltip>
                      <Tooltip title="复制回答">
                        <button
                          className="int-msg-action-btn"
                          onClick={() => {
                            const content = group.messages.map(m => m.content).filter(Boolean).join('\n');
                            copyToClipboard(content, '回答');
                          }}
                        >
                          <CopyOutlined />
                        </button>
                      </Tooltip>
                    </>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  const renderUserMessage = (msg: DisplayMessage, index: number) => {
    return (
      <div key={`user-${index}`} className={`int-message user`}>
        <div className={`int-msg-avatar user`}>
          {userAvatar ? (
            <img src={userAvatar} alt="用户" />
          ) : (
            <span style={{ fontSize: '20px' }}>👤</span>
          )}
        </div>
        <div className="int-msg-content">
          {editingMessageId === msg.id ? (
            <div className="int-msg-edit">
              <textarea
                ref={editTextareaRef}
                value={editingContent}
                onChange={(e) => {
                  setEditingContent(e.target.value);
                  autoResizeEditTextarea();
                }}
              />
            </div>
          ) : (
            <div className="int-md-editor-container">
              <ChatMarkdown source={msg.content} />
            </div>
          )}
          <div className="int-msg-footer">
            <span className="int-msg-time">
              {msg.created_at ? new Date(msg.created_at).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }) : ''}
            </span>
            <div className="int-msg-actions">
              {editingMessageId === msg.id ? (
                <div className="int-msg-edit-actions">
                  <button onClick={handleCancelEdit}>取消</button>
                  <button onClick={() => handleSaveEdit(msg.id)}>发送</button>
                </div>
              ) : (
                <>
                  <Tooltip title="编辑问题">
                    <button
                      className="int-msg-action-btn"
                      onClick={() => handleEditMessage(msg.id, msg.content)}
                    >
                      <EditOutlined />
                    </button>
                  </Tooltip>
                  <Tooltip title="复制问题">
                    <button
                      className="int-msg-action-btn"
                      onClick={() => copyToClipboard(msg.content, '问题')}
                    >
                      <CopyOutlined />
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const showWelcome = messages.length === 0 && !loading;

  // 面板拖拽处理（从 FloatingBall 通过 Context 传入）
  const panelDrag = usePanelDrag();
  const panelMinimize = usePanelMinimize();
  const minimized = panelMinimize?.isMinimized ?? false;

  return (
    <div className="int-chat-area" data-theme={themeMode} data-color-theme={colorTheme}>
      {/* Header（支持拖拽移动面板） */}
      <div
        className="int-chat-header"
        onMouseDown={panelDrag || undefined}
        style={{ cursor: panelDrag ? 'move' : undefined }}
      >
        <button className="int-toggle-history-btn" onClick={onToggleHistory} title={historyCollapsed ? '展开历史' : '收起历史'}>
          ☰
        </button>
        <div className="int-chat-header-title">{title}</div>
      </div>

      {/* 最小化时隐藏消息和输入区域 */}
      {!minimized && (
        <>
      {/* Messages or Welcome */}
      <div
        className="int-messages"
        ref={messagesContainerRef}
        style={{ paddingLeft: messagesPadding, paddingRight: messagesPadding, paddingTop: messagesPaddingTop }}
      >
        {showWelcome ? (
          <div className="int-welcome-area">
            <div className="int-welcome-icon">💬</div>
            <div className="int-welcome-text">{randomWelcome}</div>
            <div className="int-welcome-hint">输入消息开始对话</div>
          </div>
        ) : (
          renderGroupedMessages()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="int-input-area">
        {/* 已选择的文件显示 */}
        {selectedFiles.length > 0 && (
          <div className="int-selected-files">
            {selectedFiles.map((file, index) => (
              <div key={index} className="int-selected-file">
                <span className="int-file-icon">📄</span>
                <div className="int-file-info">
                  <span className="int-file-name">{file.file_name}</span>
                  <span className="int-file-size">{formatFileSize(file.file_size)}</span>
                </div>
                <button
                  className="int-file-remove"
                  onClick={() => handleRemoveFile(index)}
                  title="移除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="int-input-wrapper">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            rows={1}
            disabled={loading}
          />
          {/* 输入框底部工具栏 */}
          <div className="int-input-toolbar">
            <div className="int-input-tools-left">
              {/* 深度思考开关 */}
              <div
                className={`int-deep-thinking ${deepThinking ? 'active' : ''}`}
                onClick={() => setDeepThinking(!deepThinking)}
                title="深度思考"
              >
                <span className="int-deep-thinking-icon">💡</span>
                <span className="int-deep-thinking-label">深度思考</span>
                <span className={`int-deep-thinking-switch ${deepThinking ? 'on' : ''}`}></span>
              </div>
              {/* 文件上传按钮 */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                className="int-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="上传文件"
              >
                <PaperClipOutlined />
              </button>
            </div>
            {/* 发送/停止按钮 */}
            {loading ? (
              <button className="int-send-btn stop" onClick={handleStop} title="停止">
                ■
              </button>
            ) : (
              <button
                className="int-send-btn"
                onClick={handleSend}
                disabled={selectedFiles.length === 0 && !inputValue.trim()}
                title="发送"
              >
                ➤
              </button>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default ChatArea;