import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Input, message } from 'antd';
import { EditOutlined, DeleteOutlined, MoreOutlined } from '@ant-design/icons';
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
  colorTheme?: string;
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
  colorTheme = 'default_blue',
  gradientEndColor = 'none',
}) => {
  const [chats, setChats] = useState<IntegrationChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renamingChat, setRenamingChat] = useState<IntegrationChat | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchChats = async (keyword?: string) => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const result = await integrationChatService.getChats(apiKey, keyword);
      setChats(result.items || []);
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchVisible) {
      fetchChats();
    }
  }, [apiKey, refreshTrigger]);

  // 搜索框显示时自动聚焦
  useEffect(() => {
    if (searchVisible && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchVisible]);

  const handleSearch = useCallback(() => {
    setIsSearching(true);
    fetchChats(searchKeyword).finally(() => {
      setIsSearching(false);
    });
  }, [searchKeyword, apiKey]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 重命名对话
  const handleRenameChat = (chat: IntegrationChat) => {
    setRenamingChat(chat);
    setNewTitle(chat.title);
    setIsRenameModalVisible(true);
  };

  // 确认重命名
  const handleRenameConfirm = async () => {
    if (!renamingChat || !newTitle.trim()) {
      message.error('请输入对话名称');
      return;
    }

    try {
      const updatedChat = await integrationChatService.updateChatTitle(apiKey, renamingChat.id, newTitle.trim());
      const updatedChats = chats.map(c =>
        c.id === renamingChat.id ? updatedChat : c
      );
      setChats(updatedChats);
      message.success('对话名称已修改');
      setIsRenameModalVisible(false);
      setRenamingChat(null);
      setNewTitle('');
    } catch (error) {
      console.error('Failed to rename chat:', error);
      message.error('修改失败');
    }
  };

  // 删除对话
  const handleDeleteChat = (chat: IntegrationChat) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个对话吗？删除后无法恢复。',
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await integrationChatService.deleteChat(apiKey, chat.id);
          setChats(chats.filter(c => c.id !== chat.id));
          if (activeChatId === chat.id) {
            // 清空当前选中的对话
          }
          message.success('对话已删除');
        } catch (error) {
          console.error('Failed to delete chat:', error);
          message.error('删除失败');
        }
      },
    });
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hour}:${minute}`;
  };

  const getTimeGroup = (dateString: string): string => {
    if (!dateString) return '更早';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '更早';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (diff < 0 || days < 0) {
      return '今天';
    }

    if (days === 0) {
      return '今天';
    } else if (days <= 7) {
      return '7天内';
    } else if (days <= 30) {
      return '30天内';
    } else {
      return '更早';
    }
  };

  const groupChatsByTime = (chatList: IntegrationChat[]): { [key: string]: IntegrationChat[] } => {
    const groups: { [key: string]: IntegrationChat[] } = {};

    chatList.forEach(chat => {
      const group = getTimeGroup(chat.created_at || '');
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(chat);
    });

    const groupOrder = ['今天', '7天内', '30天内', '更早'];
    const orderedGroups: { [key: string]: IntegrationChat[] } = {};

    groupOrder.forEach(group => {
      if (groups[group]) {
        orderedGroups[group] = groups[group];
      }
    });

    Object.keys(groups).forEach(group => {
      if (!groupOrder.includes(group)) {
        orderedGroups[group] = groups[group];
      }
    });

    return orderedGroups;
  };

  const sortedChats = [...chats].sort((a, b) => {
    const dateA = new Date(a.created_at || '').getTime();
    const dateB = new Date(b.created_at || '').getTime();
    return dateB - dateA;
  });

  const groupedChats = groupChatsByTime(sortedChats);

  return (
    <div className={`int-history-sidebar${collapsed ? ' collapsed' : ''}`} data-theme={themeMode} data-color-theme={colorTheme}>
      {/* 收起后显示的新增图标按钮 - 在header下方 */}
      {collapsed && (
        <div className="int-collapsed-new-chat-wrapper">
          <button className="int-collapsed-new-chat" onClick={onNewChat} title="新对话">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      )}
      {/* 展开时显示完整内容 */}
      {!collapsed && (
        <>
          <div className="int-history-header">
            <h3>对话历史</h3>
            <button
              className="int-history-search-btn"
              onClick={() => setSearchVisible(!searchVisible)}
              title="搜索"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </div>
          {/* 搜索框 */}
          {searchVisible && (
            <div className="int-history-search-wrapper">
              <div className="int-history-search-input-wrapper">
                <svg className="int-history-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="int-history-search-input"
                  placeholder="搜索对话..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
            </div>
          )}
          <button className="int-new-chat-btn" onClick={onNewChat}>
            <span>+</span> 新对话
          </button>
          <div className="int-history-list" ref={listRef}>
            {loading && chats.length === 0 ? (
              <div className="int-loading">
                <div className="int-loading-dot" />
                <div className="int-loading-dot" />
                <div className="int-loading-dot" />
              </div>
            ) : chats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--int-text-tertiary)', fontSize: '13px' }}>
                {searchKeyword ? '未找到匹配的对话' : '暂无对话记录'}
              </div>
            ) : (
              Object.entries(groupedChats).map(([group, chatList]) => (
                <div key={group} className="int-history-group">
                  <div className="int-history-group-title">{group}</div>
                  {chatList.map((chat) => (
                    <div
                      key={chat.id}
                      className={`int-history-item ${chat.id === activeChatId ? 'active' : ''}`}
                      onClick={() => onSelectChat(chat)}
                    >
                      <div className="int-history-item-content">
                        <div className="int-history-item-title">{chat.title}</div>
                        <div className="int-history-item-time">{formatDate(chat.created_at || '')}</div>
                      </div>
                      <div className="int-history-item-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="int-history-action-btn"
                          onClick={() => handleRenameChat(chat)}
                          title="修改名称"
                        >
                          <EditOutlined />
                        </button>
                        <button
                          className="int-history-action-btn delete"
                          onClick={() => handleDeleteChat(chat)}
                          title="删除对话"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 重命名对话框 */}
      <Modal
        title="修改对话名称"
        open={isRenameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={() => {
          setIsRenameModalVisible(false);
          setRenamingChat(null);
          setNewTitle('');
        }}
        okText="确认"
        cancelText="取消"
      >
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="请输入新的对话名称"
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default ChatHistory;
