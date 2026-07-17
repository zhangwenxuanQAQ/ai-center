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
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
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

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId && chatId !== currentChatId) {
      setCurrentChatId(chatId);
      loadMessages(chatId);
    }
  }, [chatId]);

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
      scrollToBottom();
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

    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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

    // Clear selected files
    const filesForDisplay = [...selectedFiles];
    setSelectedFiles([]);

    // Build display content
    let displayContent = text;
    if (filesForDisplay.length > 0) {
      const fileNames = filesForDisplay.map(f => f.file_name).join(', ');
      displayContent = text ? `${text}\n\n[文件: ${fileNames}]` : `[文件: ${fileNames}]`;
    }

    // Add user message
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
      status: 'done',
      created_at: new Date().toISOString(),
    };

    // Add placeholder for assistant
    const assistantMsg: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      status: 'start',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    scrollToBottom();
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accContent = '';
    let accReasoning = '';
    let newChatId = currentChatId;

    try {
      await integrationChatService.sendMessageStream(
        apiKey,
        query,
        currentChatId,
        (data: any) => {
          // Track chat_id from response
          if (data.chat_id && !newChatId) {
            newChatId = data.chat_id;
            setCurrentChatId(newChatId);
            onChatIdChange(newChatId);
          }

          if (data.content) {
            accContent += data.content;
          }
          if (data.reasoning_content) {
            accReasoning += data.reasoning_content;
          }

          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: accContent,
                reasoning_content: accReasoning,
                status: data.status === 'done' ? 'done' : 'streaming',
              };
            }
            return updated;
          });
          scrollToBottom();
        },
        (err: any) => {
          console.error('Stream error:', err);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content || '抱歉，发生了错误，请重试。',
                status: 'done',
              };
            }
            return updated;
          });
          setLoading(false);
          abortControllerRef.current = null;
        },
        () => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, status: 'done' };
            }
            return updated;
          });
          setLoading(false);
          abortControllerRef.current = null;
          onMessageSent();
        },
        controller.signal,
        temporary,
        deepThinking  // 传递深度思考参数
      );
    } catch (err) {
      console.error('Send message error:', err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = {
            ...last,
            content: last.content || '抱歉，发生了错误，请重试。',
            status: 'done',
          };
        }
        return updated;
      });
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

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string, type: string, messageId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(`${type}已复制`);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 编辑消息
  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  // 保存编辑
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

    // 重新发送这条消息
    setInputValue(editingContent);
    // 延迟执行发送，确保状态更新
    setTimeout(() => {
      handleSend();
    }, 100);
  };

  // 重新回答
  const handleRegenerate = async (messageIndex: number) => {
    if (loading) return;

    // 找到对应的用户消息（在机器人消息之前）
    let userMessageIndex = messageIndex;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessageIndex = i;
        break;
      }
    }

    // 删除用户消息及其后面的所有消息
    const newMessages = messages.slice(0, userMessageIndex);
    setMessages(newMessages);

    // 获取用户消息内容
    const userMessage = messages[userMessageIndex];

    // 重新发送
    setInputValue(userMessage.content);
    setTimeout(() => {
      handleSend();
    }, 100);
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
      <div className="int-messages">
        {showWelcome ? (
          <div className="int-welcome-area">
            <div className="int-welcome-icon">💬</div>
            <div className="int-welcome-text">{randomWelcome}</div>
            <div className="int-welcome-hint">输入消息开始对话</div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id} className={`int-message ${msg.role}`}>
              <div className={`int-msg-avatar ${msg.role}`}>
                {msg.role === 'user' ? (
                  userAvatar ? (
                    <img src={userAvatar} alt="用户" />
                  ) : (
                    <span style={{ fontSize: '18px' }}>👤</span>
                  )
                ) : (
                  botAvatar ? (
                    <img src={botAvatar} alt="AI" />
                  ) : (
                    <img src={getDefaultAvatar()} alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )
                )}
              </div>
              <div className="int-msg-bubble">
                {editingMessageId === msg.id ? (
                  // 编辑模式
                  <div className="int-msg-edit">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={3}
                    />
                    <div className="int-msg-edit-actions">
                      <button onClick={handleCancelEdit}>取消</button>
                      <button onClick={() => handleSaveEdit(msg.id)}>保存</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.role === 'assistant' ? (
                      <>
                        {/* 思考过程 - 流式中显示 */}
                        {msg.status === 'streaming' && msg.reasoning_content && !msg.reasoning_end && (
                          <div className="int-message-reasoning">
                            <div className="int-reasoning-header">
                              <LoadingOutlined spin />
                              <BulbOutlined />
                              <span>分析问题中...</span>
                            </div>
                            <div className="int-reasoning-text">
                              <ChatMarkdown source={msg.reasoning_content} />
                            </div>
                          </div>
                        )}

                        {/* 思考过程 - 完成后折叠显示 */}
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

                        {/* 工具调用 */}
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
                                    {/* 工具调用消息 */}
                                    {tc.message && (
                                      <div className="int-tool-call-message">
                                        <ChatMarkdown source={tc.message} />
                                      </div>
                                    )}
                                    {/* 工具调用结果 */}
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

                        {/* 消息内容 */}
                        {msg.content ? (
                          <ChatMarkdown source={msg.content} />
                        ) : msg.status === 'start' ? (
                          <div className="int-loading">
                            <div className="int-loading-dot" />
                            <div className="int-loading-dot" />
                            <div className="int-loading-dot" />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                    {/* 消息底部：时间 + 操作按钮 */}
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
                        {msg.role === 'user' && !editingMessageId && (
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
                                onClick={() => copyToClipboard(msg.content, '问题', msg.id)}
                              >
                                {copiedMessageId === msg.id ? <CheckOutlined /> : <CopyOutlined />}
                              </button>
                            </Tooltip>
                          </>
                        )}
                        {msg.role === 'assistant' && msg.content && (
                          <>
                            <Tooltip title="重新回答">
                              <button
                                className="int-msg-action-btn"
                                onClick={() => handleRegenerate(index)}
                                disabled={loading}
                              >
                                <ReloadOutlined />
                              </button>
                            </Tooltip>
                            <Tooltip title="复制回答">
                              <button
                                className="int-msg-action-btn"
                                onClick={() => copyToClipboard(msg.content, '回答', msg.id)}
                              >
                                {copiedMessageId === msg.id ? <CheckOutlined /> : <CopyOutlined />}
                              </button>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
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