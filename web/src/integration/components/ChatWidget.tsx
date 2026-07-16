import React, { useState, useCallback } from 'react';
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
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ config, compact = false }) => {
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [historyCollapsed, setHistoryCollapsed] = useState(compact);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
    <div className="int-widget-container">
      {config.showHistory !== false && (
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
