import React, { useMemo } from 'react';
import ChatWidget, { ChatWidgetConfig } from '../components/ChatWidget';
import FloatingBall from '../components/FloatingBall';
import '../styles/integration.css';

/**
 * 预览页面
 * 通过 URL params 传入配置参数，渲染聊天界面
 * 预览模式下所有对话均为临时的，不保存到数据库
 *
 * URL 参数:
 *   api_key (必须) - API 密钥
 *   type - 预览类型 (sidebar/iframe)，默认 sidebar
 *   theme - 主题颜色
 *   theme_mode - 主题模式 (light/dark)
 *   gradient_end_color - 渐变色
 *   title - 标题
 *   position - 悬浮球位置
 *   width - 面板宽度
 *   height - 面板高度
 *   input_placeholder - 输入框占位符
 *   max_input_length - 最大输入长度
 *   welcome_messages - 欢迎语 (JSON 数组字符串)
 */
const IntegrationPreviewPage: React.FC = () => {
  const config = useMemo(() => {
    const params = new URLSearchParams(window.location.search);

    let welcomeMessages: string[] = [];
    try {
      const wm = params.get('welcome_messages');
      if (wm) welcomeMessages = JSON.parse(wm);
    } catch { /* ignore */ }

    return {
      type: params.get('type') || 'sidebar',
      apiKey: params.get('api_key') || '',
      theme: params.get('theme') || '#1677ff',
      themeMode: params.get('theme_mode') || 'light',
      gradientEndColor: params.get('gradient_end_color') || 'none',
      title: params.get('title') || 'AI助手',
      position: params.get('position') || 'bottom-right',
      width: parseInt(params.get('width') || '400', 10),
      height: parseInt(params.get('height') || '600', 10),
      inputPlaceholder: params.get('input_placeholder') || '请输入您的问题...',
      maxInputLength: parseInt(params.get('max_input_length') || '4000', 10),
      welcomeMessages,
      size: parseInt(params.get('size') || '52', 10),
      animation: params.get('animation') || 'bounce',
    };
  }, []);

  if (!config.apiKey) {
    return (
      <div className="integration-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#ff4d4f' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <div>缺少 API 密钥参数 (api_key)</div>
        </div>
      </div>
    );
  }

  // ChatWidget 配置 - 始终设置 temporary=true，预览不保存对话
  const widgetConfig: ChatWidgetConfig = {
    apiKey: config.apiKey,
    theme: config.theme,
    themeMode: config.themeMode,
    title: config.title,
    inputPlaceholder: config.inputPlaceholder,
    maxInputLength: config.maxInputLength,
    welcomeMessages: config.welcomeMessages,
    showHistory: true,
    temporary: true,
    gradientEndColor: config.gradientEndColor,
  };

  // 悬浮球配置
  const sidebarConfig = {
    position: config.position,
    theme: config.theme,
    themeMode: config.themeMode,
    size: config.size,
    animation: config.animation,
    gradientEndColor: config.gradientEndColor,
    width: config.width,
    height: config.height,
    resizable: true,
    maximizable: true,
  };

  if (config.type === 'iframe') {
    return (
      <div className="integration-page">
        <ChatWidget config={widgetConfig} />
      </div>
    );
  }

  // 默认 sidebar 模式
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
};

export default IntegrationPreviewPage;
