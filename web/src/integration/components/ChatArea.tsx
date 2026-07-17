import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PaperClipOutlined } from '@ant-design/icons';
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

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
  status?: 'start' | 'streaming' | 'done';
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
    };

    // Add placeholder for assistant
    const assistantMsg: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      status: 'start',
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
          messages.map((msg) => (
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
                {msg.role === 'assistant' ? (
                  msg.content ? (
                    <ChatMarkdown source={msg.content} />
                  ) : msg.status === 'start' ? (
                    <div className="int-loading">
                      <div className="int-loading-dot" />
                      <div className="int-loading-dot" />
                      <div className="int-loading-dot" />
                    </div>
                  ) : null
                ) : (
                  <span>{msg.content}</span>
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