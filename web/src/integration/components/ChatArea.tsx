import React, { useState, useRef, useEffect, useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor';
import ChatMarkdown from '../../components/ChatMarkdown';
import { integrationChatService, IntegrationMessage, IntegrationQueryItem } from '../services/integrationChat';

interface ChatAreaProps {
  apiKey: string;
  chatId?: string;
  title?: string;
  theme?: string;
  themeMode?: string;
  gradientEndColor?: string;
  inputPlaceholder?: string;
  maxInputLength?: number;
  welcomeMessages?: string[];
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

const ChatArea: React.FC<ChatAreaProps> = ({
  apiKey,
  chatId,
  title = 'AI助手',
  theme = '#ffffff',
  themeMode = 'light',
  gradientEndColor = 'none',
  inputPlaceholder = '请输入您的问题...',
  maxInputLength = 4000,
  welcomeMessages = [],
  historyCollapsed,
  onToggleHistory,
  onChatIdChange,
  onMessageSent,
  temporary = false,
}) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

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

  // Send message
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Add user message
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
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

    const query: IntegrationQueryItem[] = [{ type: 'text', content: text }];
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
        temporary
      );
    } catch (err) {
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

  // 计算头部背景样式（使用径向渐变，圆心扩散）
  const headerBackground = gradientEndColor && gradientEndColor !== 'none'
    ? `radial-gradient(circle at center, ${theme} 0%, ${gradientEndColor} 100%)`
    : theme;

  // 计算发送按钮背景样式
  const sendBtnBackground = gradientEndColor && gradientEndColor !== 'none'
    ? `radial-gradient(circle at center, ${theme} 0%, ${gradientEndColor} 100%)`
    : theme;

  // 计算停止按钮背景样式（使用渐变色或默认红色）
  const stopBtnBackground = gradientEndColor && gradientEndColor !== 'none'
    ? `radial-gradient(circle at center, ${theme} 0%, ${gradientEndColor} 100%)`
    : '#ff4d4f';

  return (
    <div className="int-chat-area" data-theme={themeMode}>
      {/* Header */}
      <div className="int-chat-header" style={{ background: headerBackground }}>
        <button className="int-toggle-history-btn" onClick={onToggleHistory} title={historyCollapsed ? '展开历史' : '收起历史'}>
          ☰
        </button>
        <div className="int-chat-header-title">{title}</div>
      </div>

      {/* Messages or Welcome */}
      <div className="int-messages">
        {showWelcome ? (
          <div className="int-welcome-area">
            <div className="int-welcome-title">{title}</div>
            {welcomeMessages.length > 0 && (
              <div className="int-welcome-msgs">
                {welcomeMessages.map((msg, idx) => (
                  <div key={idx} className="int-welcome-msg">{msg}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`int-message ${msg.role}`}>
              <div className={`int-msg-avatar ${msg.role}`}>
                {msg.role === 'user' ? 'U' : 'AI'}
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
          {loading ? (
            <button className="int-send-btn stop" onClick={handleStop} title="停止" style={{ background: stopBtnBackground }}>
              ■
            </button>
          ) : (
            <button
              className="int-send-btn"
              onClick={handleSend}
              disabled={!inputValue.trim()}
              style={{ background: sendBtnBackground }}
              title="发送"
            >
              ➤
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
