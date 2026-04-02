import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Dropdown, Menu, Modal, message, Empty, Spin } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, PushpinOutlined, CommentOutlined , MenuFoldOutlined, MenuUnfoldOutlined, MoreOutlined, MessageOutlined, EditOutlined, VerticalAlignTopOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { chatService, Conversation } from '../../services/chat';

interface ChatListProps {
  theme: 'light' | 'dark';
  collapsed: boolean;
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation | null) => void;
  onNewConversation: () => void;
  onToggleCollapse: () => void;
  refreshConversations?: boolean;
}

const ChatList: React.FC<ChatListProps> = ({
  theme,
  collapsed,
  selectedConversation,
  onSelectConversation,
  onNewConversation,
  onToggleCollapse,
  refreshConversations
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showBackTop, setShowBackTop] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renamingConversation, setRenamingConversation] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const userCreatedNew = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (refreshConversations) {
      fetchConversations();
      setShowNewConversation(false);
      userCreatedNew.current = false;
    }
  }, [refreshConversations]);

  useEffect(() => {
    if (!loading && conversations.length === 0 && !showNewConversation) {
      setShowNewConversation(true);
      onSelectConversation(null);
    } else if (!loading && conversations.length > 0 && showNewConversation && !userCreatedNew.current) {
      setShowNewConversation(false);
    }
  }, [conversations.length, showNewConversation, onSelectConversation, loading]);

  useEffect(() => {
    if (selectedConversation && selectedConversation.id && !userCreatedNew.current) {
      setShowNewConversation(false);
    }
  }, [selectedConversation]);

  const fetchConversations = async (page: number = 1, append: boolean = false) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const result = await chatService.getConversations(page, pageSize);
      
      if (append) {
        setConversations(prev => [...prev, ...result.items]);
      } else {
        setConversations(result.items);
      }
      
      setHasMore(result.items.length === pageSize);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchConversations(currentPage + 1, true);
    }
  }, [loadingMore, hasMore, currentPage]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    
    if (scrollTop > 300) {
      setShowBackTop(true);
    } else {
      setShowBackTop(false);
    }
    
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loadingMore) {
      loadMore();
    }
  }, [hasMore, loadingMore, loadMore]);

  const scrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const handleNewConversation = () => {
    userCreatedNew.current = true;
    setShowNewConversation(true);
    onNewConversation();
  };

  const handleDeleteConversation = async (conversation: Conversation) => {
    try {
      const success = await chatService.deleteConversation(conversation.id);
      if (success) {
        setConversations(conversations.filter(c => c.id !== conversation.id));
        if (selectedConversation?.id === conversation.id) {
          onSelectConversation(null);
        }
        message.success('对话已删除');
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      message.error('删除失败');
    }
  };

  const handlePinConversation = async (conversation: Conversation) => {
    try {
      const updatedConversation = await chatService.togglePinConversation(conversation.id);
      const updatedConversations = conversations.map(c => 
        c.id === conversation.id ? updatedConversation : c
      );
      setConversations(updatedConversations);
      message.success(updatedConversation.is_top ? '已置顶' : '已取消置顶');
    } catch (error) {
      console.error('Failed to pin conversation:', error);
      message.error('操作失败');
    }
  };

  const handleRenameConversation = (conversation: Conversation) => {
    setRenamingConversation(conversation);
    setNewTitle(conversation.title);
    setIsRenameModalVisible(true);
  };

  const handleRenameConfirm = async () => {
    if (!renamingConversation || !newTitle.trim()) {
      message.error('请输入对话名称');
      return;
    }
    
    try {
      const updatedConversation = await chatService.updateConversation(renamingConversation.id, newTitle.trim());
      const updatedConversations = conversations.map(c => 
        c.id === renamingConversation.id ? updatedConversation : c
      );
      setConversations(updatedConversations);
      message.success('对话名称已修改');
      setIsRenameModalVisible(false);
      setRenamingConversation(null);
      setNewTitle('');
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      message.error('修改失败');
    }
  };

  const getConversationMenu = (conversation: Conversation): MenuProps['items'] => [
    {
      key: 'pin',
      icon: <PushpinOutlined />,
      label: conversation.is_top ? '取消置顶' : '置顶对话',
      onClick: () => handlePinConversation(conversation),
    },
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '修改名称',
      onClick: () => handleRenameConversation(conversation),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除对话',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: '确认删除',
          content: '确定要删除这个对话吗？删除后无法恢复。',
          okText: '确认',
          cancelText: '取消',
          okButtonProps: { danger: true },
          onOk: () => handleDeleteConversation(conversation),
        });
      },
    },
  ];

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchText.toLowerCase())
  );

  const pinnedConversations = filteredConversations.filter(c => c.is_top);
  const unpinnedConversations = filteredConversations.filter(c => !c.is_top);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeGroup = (dateString: string): string => {
    const date = new Date(dateString);
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
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
    }
  };

  const groupConversationsByTime = (conversations: Conversation[]) => {
    const groups: { [key: string]: Conversation[] } = {};
    
    conversations.forEach(conversation => {
      const group = getTimeGroup(conversation.created_at);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(conversation);
    });
    
    const groupOrder = ['今天', '7天内', '30天内'];
    const orderedGroups: { [key: string]: Conversation[] } = {};
    
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

  const renderConversationItem = (conversation: Conversation) => (
    <div
      key={conversation.id}
      className={`conversation-item ${theme === 'dark' ? 'dark' : 'light'} ${
        selectedConversation?.id === conversation.id ? 'selected' : ''
      }`}
      onClick={() => onSelectConversation(conversation)}
    >
      <div className="conversation-icon">
        <MessageOutlined />
      </div>
      <div className="conversation-content">
        <div className="conversation-title">{conversation.title}</div>
        <div className="conversation-meta">
          <span className="conversation-date">{formatDate(conversation.created_at)}</span>
        </div>
      </div>
      <div className="conversation-actions" onClick={e => e.stopPropagation()}>
        <Dropdown menu={{ items: getConversationMenu(conversation) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined />} className="action-btn" />
        </Dropdown>
      </div>
    </div>
  );

  const renderNewConversationItem = () => (
    <div
      key="new"
      className={`conversation-item ${theme === 'dark' ? 'dark' : 'light'} ${selectedConversation === null ? 'selected' : ''}`}
      onClick={() => onSelectConversation(null)}
    >
      <div className="conversation-icon">
        <MessageOutlined />
      </div>
      <div className="conversation-content">
        <div className="conversation-title">新对话</div>
        <div className="conversation-meta">
          <span className="conversation-date">刚刚</span>
        </div>
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <div className={`chat-list-collapsed ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewConversation}
          className="new-chat-btn-collapsed"
        />
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          onClick={onToggleCollapse}
          className="toggle-btn-collapsed"
        />
      </div>
    );
  }

  return (
    <div className={`chat-list ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className="chat-list-header">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewConversation}
          className="new-chat-btn"
          id="new-conversation-button"
        >
          新建对话
        </Button>
        <Button
          type="text"
          icon={<SearchOutlined />}
          onClick={() => {
            setShowSearch(!showSearch);
            if (showSearch) {
              setSearchText('');
            }
          }}
          className="search-toggle-btn"
        />
        <Button
          type="text"
          icon={<MenuFoldOutlined />}
          onClick={onToggleCollapse}
          className="toggle-btn"
        />
      </div>
      
      {showSearch && (
        <div className="search-box">
          <Input
            placeholder="搜索对话"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            autoFocus
            className={`search-input ${theme === 'dark' ? 'dark' : 'light'}`}
          />
        </div>
      )}

      <div 
        className="conversation-list" 
        ref={listRef}
        onScroll={handleScroll}
      >
        {loading ? (
          <div className="loading-container">
            <Spin />
          </div>
        ) : (
          <>
            <div className="conversation-section">
              <div className="section-title" style={{ fontSize: '14px', fontWeight: 500 }}>
                <PushpinOutlined /> 置顶对话
              </div>
              {pinnedConversations.map(renderConversationItem)}
            </div>
            <div className="conversation-section">
              <div className="section-title" style={{ fontSize: '14px', fontWeight: 500 }}><CommentOutlined />全部对话</div>
              {Object.entries(groupConversationsByTime(unpinnedConversations)).map(([group, convs]) => (
                <div key={group} className="conversation-group">
                  <div className="group-title" style={{ textAlign: 'left', paddingLeft: '12px', fontSize: '12px' }}>{group}</div>
                  {group === '今天' && showNewConversation && renderNewConversationItem()}
                  {convs.map(renderConversationItem)}
                </div>
              ))}
            </div>
            {!showNewConversation && conversations.length === 0 && (
              <Empty description="暂无对话" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
            )}
            {loadingMore && (
              <div className="loading-more">
                <Spin size="small" />
                <span style={{ marginLeft: 8 }}>加载中...</span>
              </div>
            )}
          </>
        )}
      </div>

      {showBackTop && (
        <div className="back-top-button" onClick={scrollToTop}>
          <Button
            type="primary"
            icon={<VerticalAlignTopOutlined />}
            shape="circle"
            size="large"
          />
        </div>
      )}

      <Modal
        title="修改对话名称"
        open={isRenameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={() => {
          setIsRenameModalVisible(false);
          setRenamingConversation(null);
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

export default ChatList;
