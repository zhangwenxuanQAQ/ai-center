import React, { useState, useCallback, useEffect } from 'react';
import ChatHistory from './ChatHistory';
import ChatArea from './ChatArea';
import { IntegrationChat } from '../services/integrationChat';

export interface ChatWidgetConfig {
  apiKey: string;
  theme?: string;
  themeMode?: string;
  colorTheme?: string;
  title?: string;
  position?: string;
  inputPlaceholder?: string;
  maxInputLength?: number;
  welcomeMessages?: string[];
  showHistory?: boolean;
  temporary?: boolean;
  gradientEndColor?: string;
}

interface ChatWidgetProps {
  config: ChatWidgetConfig;
  compact?: boolean; // sidebar/compact mode
  onHistoryChange?: (isOpen: boolean) => void;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ config, compact = false, onHistoryChange }) => {
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [historyCollapsed, setHistoryCollapsed] = useState(compact);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 历史状态变化时通知父组件（FloatingBall 用于动态调整面板宽度）
  useEffect(() => {
    onHistoryChange?.(!historyCollapsed);
  }, [historyCollapsed, onHistoryChange]);

  const handleSelectChat = useCallback((chat: IntegrationChat) => {
    setActiveChatId(chat.id);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveChatId(undefined);
  }, []);

  const handleChatIdChange = useCallback((newChatId: string) => {
    setActiveChatId(newChatId);
  }, []);

  const handleMessageSent = useCallback(() => {
    // Refresh history to show new/updated conversation
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const displayTitle = config.title || 'AI助手';

  return (
    <div className={`int-widget-container${compact ? ' compact' : ''}`}>
      {config.showHistory !== false && compact && (
        <>
          {/* 遮罩层 - 点击关闭历史 */}
          {!historyCollapsed && (
            <div className="int-history-overlay" onClick={() => setHistoryCollapsed(true)} />
          )}
          <ChatHistory
            apiKey={config.apiKey}
            activeChatId={activeChatId}
            collapsed={historyCollapsed}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            refreshTrigger={refreshTrigger}
            theme={config.theme}
            themeMode={config.themeMode}
            colorTheme={config.colorTheme}
            gradientEndColor={config.gradientEndColor}
          />
        </>
      )}
      {config.showHistory !== false && !compact && (
        <ChatHistory
          apiKey={config.apiKey}
          activeChatId={activeChatId}
          collapsed={historyCollapsed}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          refreshTrigger={refreshTrigger}
          theme={config.theme}
          themeMode={config.themeMode}
          colorTheme={config.colorTheme}
          gradientEndColor={config.gradientEndColor}
        />
      )}
      <ChatArea
        apiKey={config.apiKey}
        chatId={activeChatId}
        title={displayTitle}
        theme={config.theme}
        themeMode={config.themeMode}
        colorTheme={config.colorTheme}
        gradientEndColor={config.gradientEndColor}
        inputPlaceholder={config.inputPlaceholder}
        maxInputLength={config.maxInputLength}
        welcomeMessages={config.welcomeMessages}
        historyCollapsed={historyCollapsed}
        onToggleHistory={() => setHistoryCollapsed(!historyCollapsed)}
        onChatIdChange={handleChatIdChange}
        onMessageSent={handleMessageSent}
        temporary={config.temporary}
      />
    </div>
  );
};

export default ChatWidget;
