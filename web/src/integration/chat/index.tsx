import React, { useState, useEffect } from 'react';
import ChatWidget, { ChatWidgetConfig } from '../components/ChatWidget';
import '../styles/integration.css';
import { Spin } from 'antd';

/**
 * iframe 聊天插件界面
 * 通过 api_key 从后端获取完整配置
 *
 * URL 参数:
 *   api_key (必须) - API 密钥
 *   temporary - 临时会话模式，不保存到数据库 (true/false)
 */
const IntegrationChatPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [config, setConfig] = useState<ChatWidgetConfig | null>(null);

  useEffect(() => {
    // 从 URL 参数获取 api_key
    const params = new URLSearchParams(window.location.search);
    const apiKey = params.get('api_key') || '';
    const temporary = params.get('temporary') === 'true';

    if (!apiKey) {
      setError('缺少 API 密钥参数');
      setLoading(false);
      return;
    }

    // 从后端获取配置
    const fetchConfig = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || ''}/aicenter/api/v1/integration/config/${apiKey}`
        );
        const result = await response.json();

        if (result.code !== 200) {
          setError(result.message || '获取配置失败');
          setLoading(false);
          return;
        }

        const data = result.data;
        const chatConfig = data.chat_config || {};
        const interfaceConfig = data.interface_config || {};
        const commonConfig = interfaceConfig.common_config || {};
        const sidebarConfig = interfaceConfig.sidebar || {};

        setConfig({
          apiKey,
          theme: '',
          themeMode: commonConfig.theme_mode || 'light',
          colorTheme: commonConfig.color_theme || 'default_blue',
          title: sidebarConfig.title || 'AI助手',
          inputPlaceholder: chatConfig.input_placeholder || '请输入您的问题...',
          maxInputLength: chatConfig.max_input_length || 4000,
          welcomeMessages: chatConfig.welcome_messages || [],
          showHistory: true,
          temporary,
        });
      } catch (err) {
        console.error('获取插件配置失败:', err);
        setError('网络错误，请重试');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="integration-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="integration-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#ff4d4f' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <div>{error || '配置不存在'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="integration-page" data-theme={config.themeMode} data-color-theme={config.colorTheme}>
      <ChatWidget config={config} />
    </div>
  );
};

export default IntegrationChatPage;
