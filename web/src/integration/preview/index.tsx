import React, { useEffect, useState, useMemo } from 'react';
import ChatWidget, { ChatWidgetConfig } from '../components/ChatWidget';
import FloatingBall from '../components/FloatingBall';
import '../styles/integration.css';

/**
 * 预览页面
 * 通过token从后端获取配置参数，渲染聊天界面
 */
const IntegrationPreviewPage: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从URL路径获取token
  const token = useMemo(() => {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`/aicenter/v1/integration/preview/${token}`);
        const result = await response.json();
        
        if (result.code === 0 && result.data) {
          setConfig(result.data);
        } else {
          setError(result.message || '获取配置失败');
        }
      } catch (err) {
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchConfig();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="integration-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="int-loading">
            <div className="int-loading-dot" />
            <div className="int-loading-dot" />
            <div className="int-loading-dot" />
          </div>
          <div style={{ marginTop: '12px', color: '#666' }}>加载中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="integration-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#ff4d4f' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="integration-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <div>配置不存在或已过期</div>
        </div>
      </div>
    );
  }

  const previewType = config.type || 'sidebar';

  // 构建ChatWidget配置
  const widgetConfig: ChatWidgetConfig = {
    apiKey: config.api_key || '',
    theme: config.theme || '#ffffff',
    themeMode: config.theme_mode || 'light',
    title: config.title || 'AI助手',
    inputPlaceholder: config.input_placeholder || '请输入您的问题...',
    maxInputLength: parseInt(config.max_input_length || '4000', 10),
    welcomeMessages: config.welcome_messages || [],
    showHistory: true,
    temporary: true,
    gradientEndColor: config.gradient_end_color || 'none',
  };

  // 构建悬浮球配置
  const sidebarConfig = {
    position: config.position || 'bottom-right',
    theme: config.theme || '#ffffff',
    themeMode: config.theme_mode || 'light',
    size: parseInt(config.size || '52', 10),
    animation: config.animation || 'bounce',
    gradientEndColor: config.gradient_end_color || 'none',
    width: parseInt(config.width || '400', 10),
    height: parseInt(config.height || '600', 10),
    resizable: config.resizable !== false,
    maximizable: config.maximizable !== false,
  };

  if (previewType === 'sidebar') {
    return (
      <div className="integration-page">
        <FloatingBall
          position={sidebarConfig.position}
          theme={sidebarConfig.theme}
          themeMode={sidebarConfig.themeMode}
          size={sidebarConfig.size}
          animation={sidebarConfig.animation}
          width={sidebarConfig.width}
          height={sidebarConfig.height}
          gradientEndColor={sidebarConfig.gradientEndColor}
          resizable={sidebarConfig.resizable}
          maximizable={sidebarConfig.maximizable}
        >
          <ChatWidget config={widgetConfig} compact />
        </FloatingBall>
      </div>
    );
  } else {
    // iframe预览
    return (
      <div className="integration-page">
        <ChatWidget config={widgetConfig} />
      </div>
    );
  }
};

export default IntegrationPreviewPage;