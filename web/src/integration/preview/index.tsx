import React, { useState, useEffect } from 'react';
import ChatWidget, { ChatWidgetConfig } from '../components/ChatWidget';
import FloatingBall from '../components/FloatingBall';
import '../styles/integration.css';
import { Spin } from 'antd';

/**
 * 预览页面
 * 通过 token 从后端获取配置参数，渲染聊天界面
 * 预览模式下所有对话均为临时的，不保存到数据库
 *
 * URL 格式: /integration/preview/{token}
 * token: 由后端生成，包含配置信息，有效期10分钟
 */
const IntegrationPreviewPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [config, setConfig] = useState<{
    type: string;
    apiKey: string;
    colorTheme: string;
    themeMode: string;
    title: string;
    inputPlaceholder: string;
    maxInputLength: number;
    welcomeMessages: string[];
    position: string;
    width: number;
    height: number;
    size: number;
    animation: string;
  } | null>(null);

  useEffect(() => {
    // 从 URL 路径中提取 token
    const pathParts = window.location.pathname.split('/');
    const token = pathParts[pathParts.length - 1];

    if (!token || token === 'preview') {
      setError('缺少预览token');
      setLoading(false);
      return;
    }

    // 从后端获取配置
    const fetchConfig = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || ''}/aicenter/api/v1/integration/preview/${token}`
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
          type: data.type || 'sidebar',
          apiKey: data.api_key || '',
          colorTheme: commonConfig.color_theme || 'default_blue',
          themeMode: commonConfig.theme_mode || 'light',
          title: sidebarConfig.title || 'AI助手',
          inputPlaceholder: chatConfig.input_placeholder || '请输入您的问题...',
          maxInputLength: chatConfig.max_input_length || 4000,
          welcomeMessages: chatConfig.welcome_messages || [],
          position: sidebarConfig.position || 'bottom-right',
          width: sidebarConfig.width || 400,
          height: sidebarConfig.height || 600,
          size: sidebarConfig.size || 52,
          animation: sidebarConfig.animation || 'bounce',
        });
      } catch (err) {
        console.error('获取预览配置失败:', err);
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
          <div>{error || '配置不存在或已过期'}</div>
        </div>
      </div>
    );
  }

  if (!config.apiKey) {
    return (
      <div className="integration-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#ff4d4f' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <div>缺少 API 密钥参数</div>
        </div>
      </div>
    );
  }

  // ChatWidget 配置 - 始终设置 temporary=true，预览不保存对话
  const widgetConfig: ChatWidgetConfig = {
    apiKey: config.apiKey,
    theme: '',
    themeMode: config.themeMode,
    colorTheme: config.colorTheme,
    title: config.title,
    inputPlaceholder: config.inputPlaceholder,
    maxInputLength: config.maxInputLength,
    welcomeMessages: config.welcomeMessages,
    showHistory: true,
    temporary: true,
  };

  // 悬浮球配置
  const sidebarConfig = {
    position: config.position,
    themeMode: config.themeMode,
    colorTheme: config.colorTheme,
    size: config.size,
    animation: config.animation,
    width: config.width,
    height: config.height,
    resizable: true,
    maximizable: true,
  };

  if (config.type === 'iframe') {
    return (
      <div className="integration-page" data-theme={config.themeMode} data-color-theme={config.colorTheme}>
        <ChatWidget config={widgetConfig} />
      </div>
    );
  }

  // 默认 sidebar 模式
  return (
    <div className="integration-page" data-theme={config.themeMode} data-color-theme={config.colorTheme}>
      <FloatingBall
        position={sidebarConfig.position}
        themeMode={sidebarConfig.themeMode}
        colorTheme={sidebarConfig.colorTheme}
        size={sidebarConfig.size}
        animation={sidebarConfig.animation}
        width={sidebarConfig.width}
        height={sidebarConfig.height}
        resizable={sidebarConfig.resizable}
        maximizable={sidebarConfig.maximizable}
      >
        <ChatWidget config={widgetConfig} compact />
      </FloatingBall>
    </div>
  );
};

export default IntegrationPreviewPage;
