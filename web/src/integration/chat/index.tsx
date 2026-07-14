import React, { useMemo } from 'react';
import ChatWidget, { ChatWidgetConfig } from '../components/ChatWidget';
import '../styles/integration.css';

/**
 * iframe 聊天插件界面
 * 全页面布局，通过 URL search params 传入配置
 *
 * URL 参数:
 *   api_key (必须) - API 密钥
 *   theme - 边框颜色
 *   theme_mode - 主题模式 (light/dark)
 *   title - 标题
 *   input_placeholder - 输入框占位符
 *   max_input_length - 最大输入长度
 *   welcome_messages - 欢迎语 (JSON 数组字符串)
 *   dark - 是否暗色主题 (true/false)
 *   temporary - 临时会话模式，不保存到数据库 (true/false)
 *   gradient_end_color - 渐变色，值为"none"表示不使用渐变
 */
const IntegrationChatPage: React.FC = () => {
  const config = useMemo<ChatWidgetConfig>(() => {
    const params = new URLSearchParams(window.location.search);
    let welcomeMessages: string[] = [];
    try {
      const wm = params.get('welcome_messages');
      if (wm) welcomeMessages = JSON.parse(wm);
    } catch { /* ignore */ }

    return {
      apiKey: params.get('api_key') || '',
      theme: params.get('theme') || '#ffffff',
      themeMode: params.get('theme_mode') || 'light',
      title: params.get('title') || 'AI助手',
      inputPlaceholder: params.get('input_placeholder') || '请输入您的问题...',
      maxInputLength: parseInt(params.get('max_input_length') || '4000', 10),
      welcomeMessages,
      showHistory: true,
      temporary: params.get('temporary') === 'true',
      gradientEndColor: params.get('gradient_end_color') || 'none',
    };
  }, []);

  // Set theme from URL
  const params = new URLSearchParams(window.location.search);
  const isDark = params.get('dark') === 'true';

  return (
    <div className="integration-page" data-theme={isDark ? 'dark' : 'light'}>
      <ChatWidget config={config} />
    </div>
  );
};

export default IntegrationChatPage;
