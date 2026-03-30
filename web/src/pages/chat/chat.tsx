import React, { useState, useEffect, useRef } from 'react';
import { Layout } from 'antd';
import ChatList from './chat_list';
import ChatConversation from './chat_conversation';
import '../../styles/common.css';
import './chat.less';
import { Conversation } from '../services/chat';

const { Sider, Content } = Layout;

const Chat: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [collapsed, setCollapsed] = useState(false);
  const [siderWidth, setSiderWidth] = useState(280);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [refreshConversations, setRefreshConversations] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'light' | 'dark');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      
      if (newWidth >= 60 && newWidth <= 500) {
        setSiderWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleSelectConversation = (conversation: Conversation | null) => {
    setSelectedConversation(conversation);
  };

  const handleNewConversation = () => {
    setSelectedConversation(null);
  };

  const handleConversationCreated = (newConversation?: Conversation) => {
    // 如果传入了新创建的对话，设置为选中状态
    if (newConversation) {
      setSelectedConversation(newConversation);
    }
    // 通知ChatList组件刷新对话列表
    setRefreshConversations(prev => !prev);
  };

  const handleToggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div 
      ref={containerRef}
      className={`chat-page-container ${theme === 'dark' ? 'dark' : 'light'}`}
    >
      <Layout className="chat-layout">
        <Sider 
          width={collapsed ? 60 : siderWidth}
          collapsed={collapsed}
          className={`chat-sider ${theme === 'dark' ? 'dark' : 'light'} ${collapsed ? 'collapsed' : ''}`}
          collapsedWidth={60}
        >
          <ChatList
            theme={theme}
            collapsed={collapsed}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onToggleCollapse={handleToggleCollapse}
            refreshConversations={refreshConversations}
          />
        </Sider>
        
        {!collapsed && (
          <div 
            className={`resize-handle ${theme === 'dark' ? 'dark' : 'light'} ${isDragging ? 'dragging' : ''}`}
            onMouseDown={handleMouseDown}
          />
        )}
        
        <Content className={`chat-content ${theme === 'dark' ? 'dark' : 'light'}`}>
          <ChatConversation
            theme={theme}
            conversation={selectedConversation}
            onConversationCreated={handleConversationCreated}
          />
        </Content>
      </Layout>
    </div>
  );
};

export default Chat;
