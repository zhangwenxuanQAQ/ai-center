import React, { useState, useEffect } from 'react';
import { Input, Button, Dropdown, Menu, Modal, Select, message, Popconfirm, Empty, Spin } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, PushpinOutlined, FolderOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MoreOutlined, MessageOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  group_id?: string;
  group_name?: string;
}

interface ConversationGroup {
  id: string;
  name: string;
}

interface ChatListProps {
  theme: 'light' | 'dark';
  collapsed: boolean;
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation | null) => void;
  onNewConversation: () => void;
  onToggleCollapse: () => void;
}

const ChatList: React.FC<ChatListProps> = ({
  theme,
  collapsed,
  selectedConversation,
  onSelectConversation,
  onNewConversation,
  onToggleCollapse
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<ConversationGroup[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [movingConversation, setMovingConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    fetchConversations();
    fetchGroups();
  }, []);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const mockConversations: Conversation[] = [
        { id: '1', title: '如何使用React Hooks', created_at: '2024-01-15 10:30:00', updated_at: '2024-01-15 12:00:00', is_pinned: true, group_id: '1', group_name: '技术讨论' },
        { id: '2', title: 'Python数据分析入门', created_at: '2024-01-14 09:00:00', updated_at: '2024-01-14 11:30:00', is_pinned: false, group_id: '1', group_name: '技术讨论' },
        { id: '3', title: '机器学习基础概念', created_at: '2024-01-13 14:20:00', updated_at: '2024-01-13 16:45:00', is_pinned: true },
        { id: '4', title: '深度学习框架对比', created_at: '2024-01-12 11:00:00', updated_at: '2024-01-12 13:30:00', is_pinned: false, group_id: '2', group_name: '学习笔记' },
        { id: '5', title: '自然语言处理应用', created_at: '2024-01-11 16:00:00', updated_at: '2024-01-11 18:00:00', is_pinned: false },
        { id: '6', title: '计算机视觉项目实战', created_at: '2024-01-10 10:00:00', updated_at: '2024-01-10 12:00:00', is_pinned: false },
      ];
      setConversations(mockConversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const mockGroups: ConversationGroup[] = [
        { id: '1', name: '技术讨论' },
        { id: '2', name: '学习笔记' },
        { id: '3', name: '项目相关' },
      ];
      setGroups(mockGroups);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const handleDeleteConversation = async (conversation: Conversation) => {
    try {
      setConversations(conversations.filter(c => c.id !== conversation.id));
      if (selectedConversation?.id === conversation.id) {
        onSelectConversation(null);
      }
      message.success('对话已删除');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      message.error('删除失败');
    }
  };

  const handlePinConversation = async (conversation: Conversation) => {
    try {
      const updatedConversations = conversations.map(c => 
        c.id === conversation.id ? { ...c, is_pinned: !c.is_pinned } : c
      );
      setConversations(updatedConversations);
      message.success(conversation.is_pinned ? '已取消置顶' : '已置顶');
    } catch (error) {
      console.error('Failed to pin conversation:', error);
      message.error('操作失败');
    }
  };

  const handleMoveToGroup = (conversation: Conversation) => {
    setMovingConversation(conversation);
    setSelectedGroupId(conversation.group_id);
    setIsMoveModalVisible(true);
  };

  const handleMoveConfirm = async () => {
    if (!movingConversation) return;
    
    try {
      const group = groups.find(g => g.id === selectedGroupId);
      const updatedConversations = conversations.map(c => 
        c.id === movingConversation.id ? { 
          ...c, 
          group_id: selectedGroupId, 
          group_name: group?.name 
        } : c
      );
      setConversations(updatedConversations);
      message.success('已移动到分组');
      setIsMoveModalVisible(false);
      setMovingConversation(null);
    } catch (error) {
      console.error('Failed to move conversation:', error);
      message.error('移动失败');
    }
  };

  const getConversationMenu = (conversation: Conversation): MenuProps['items'] => [
    {
      key: 'pin',
      icon: <PushpinOutlined />,
      label: conversation.is_pinned ? '取消置顶' : '置顶对话',
      onClick: () => handlePinConversation(conversation),
    },
    {
      key: 'move',
      icon: <FolderOutlined />,
      label: '移动到分组',
      onClick: () => handleMoveToGroup(conversation),
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

  const pinnedConversations = filteredConversations.filter(c => c.is_pinned);
  const unpinnedConversations = filteredConversations.filter(c => !c.is_pinned);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
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
          <span className="conversation-date">{formatDate(conversation.updated_at)}</span>
          {conversation.group_name && (
            <span className="conversation-group">{conversation.group_name}</span>
          )}
        </div>
      </div>
      <div className="conversation-actions" onClick={e => e.stopPropagation()}>
        <Dropdown menu={{ items: getConversationMenu(conversation) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined />} className="action-btn" />
        </Dropdown>
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <div className={`chat-list-collapsed ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onNewConversation}
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
          onClick={onNewConversation}
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

      <div className="conversation-list">
        {loading ? (
          <div className="loading-container">
            <Spin />
          </div>
        ) : filteredConversations.length === 0 ? (
          <Empty description="暂无对话" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
        ) : (
          <>
            {pinnedConversations.length > 0 && (
              <div className="conversation-section">
                <div className="section-title">
                  <PushpinOutlined /> 置顶对话
                </div>
                {pinnedConversations.map(renderConversationItem)}
              </div>
            )}
            {unpinnedConversations.length > 0 && (
              <div className="conversation-section">
                {pinnedConversations.length > 0 && (
                  <div className="section-title">全部对话</div>
                )}
                {unpinnedConversations.map(renderConversationItem)}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        title="移动到分组"
        open={isMoveModalVisible}
        onOk={handleMoveConfirm}
        onCancel={() => {
          setIsMoveModalVisible(false);
          setMovingConversation(null);
        }}
        okText="确认"
        cancelText="取消"
        className={`chat-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择分组"
          value={selectedGroupId}
          onChange={setSelectedGroupId}
          allowClear
        >
          {groups.map(group => (
            <Select.Option key={group.id} value={group.id}>
              {group.name}
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
};

export default ChatList;
