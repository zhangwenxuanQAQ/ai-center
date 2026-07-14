import React, { useEffect, useState } from 'react';
import { integrationChatService, IntegrationChat } from '../services/integrationChat';

interface ChatHistoryProps {
  apiKey: string;
  activeChatId?: string;
  collapsed: boolean;
  onSelectChat: (chat: IntegrationChat) => void;
  onNewChat: () => void;
  refreshTrigger?: number;
  theme?: string;
  themeMode?: string;
  gradientEndColor?: string;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  apiKey,
  activeChatId,
  collapsed,
  onSelectChat,
  onNewChat,
  refreshTrigger,
  theme = '#1677ff',
  themeMode = 'light',
  gradientEndColor = 'none',
}) => {
  const [chats, setChats] = useState<IntegrationChat[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChats = async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const result = await integrationChatService.getChats(apiKey);
      setChats(result.items || []);
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [apiKey, refreshTrigger]);

  if (collapsed) return null;

  // 计算头部背景样式（使用径向渐变，圆心扩散）
  const headerBackground = gradientEndColor && gradientEndColor !== 'none'
    ? `radial-gradient(circle at center, ${theme} 0%, ${gradientEndColor} 100%)`
    : theme;

  return (
    <div className="int-history-sidebar" data-theme={themeMode}>
      <div className="int-history-header" style={{ background: headerBackground }}>
        <h3>对话历史</h3>
      </div>
      <button className="int-new-chat-btn" onClick={onNewChat}>
        <span>+</span> 新对话
      </button>
      <div className="int-history-list">
        {loading && chats.length === 0 ? (
          <div className="int-loading">
            <div className="int-loading-dot" />
            <div className="int-loading-dot" />
            <div className="int-loading-dot" />
          </div>
        ) : chats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--int-text-tertiary)', fontSize: '13px' }}>
            暂无对话记录
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`int-history-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="int-history-item-title">{chat.title}</div>
              <div className="int-history-item-time">{chat.created_at}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
