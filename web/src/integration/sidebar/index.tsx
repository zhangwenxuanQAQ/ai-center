import React, { useMemo } from 'react';
import ChatWidget, { ChatWidgetConfig } from '../components/ChatWidget';
import FloatingBall from '../components/FloatingBall';
import '../styles/integration.css';

/**
 * 悬浮球侧边栏聊天界面
 * 通过 URL search params 传入配置
 *
 * URL 参数:
 *   api_key (必须) - API 密钥
 *   theme - 边框颜色
 *   theme_mode - 主题模式 (light/dark)
 *   title - 标题
 *   panel_title - 面板标题
 *   position - 悬浮球位置 (top-left/top-right/bottom-left/bottom-right)
 *   size - 悬浮球大小
 *   animation - 动画效果 (bounce/fade/scale/none)
 *   width - 面板宽度
 *   height - 面板高度
 *   input_placeholder - 输入框占位符
 *   max_input_length - 最大输入长度
 *   welcome_messages - 欢迎语 (JSON 数组字符串)
 *   dark - 是否暗色主题
 *   temporary - 临时会话模式，不保存到数据库 (true/false)
 */
const IntegrationSidebarPage: React.FC = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  const config = useMemo<ChatWidgetConfig>(() => {
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
      panelTitle: params.get('panel_title') || '',
      position: params.get('position') || 'bottom-right',
      inputPlaceholder: params.get('input_placeholder') || '请输入您的问题...',
      maxInputLength: parseInt(params.get('max_input_length') || '4000', 10),
      welcomeMessages,
      showHistory: true,
      temporary: params.get('temporary') === 'true',
      gradientEndColor: params.get('gradient_end_color') || 'none',
    };
  }, [params]);

  const sidebarConfig = useMemo(() => ({
    position: params.get('position') || 'bottom-right',
    theme: params.get('theme') || '#1677ff',
    size: parseInt(params.get('size') || '52', 10),
    animation: params.get('animation') || 'bounce',
    width: parseInt(params.get('width') || '400', 10),
    height: parseInt(params.get('height') || '600', 10),
    gradientEnabled: params.get('gradient_enabled') === 'true',
    gradientEndColor: params.get('gradient_end_color') || '',
  }), [params]);

  const isDark = params.get('dark') === 'true';

  if (!config.apiKey) {
    return (
      <div className="integration-page" data-theme={isDark ? 'dark' : 'light'}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
          缺少 API 密钥参数 (api_key)
        </div>
      </div>
    );
  }

  return (
    <div className="integration-page" data-theme={isDark ? 'dark' : 'light'} style={{ background: 'transparent' }}>
      <FloatingBall
        position={sidebarConfig.position}
        theme={sidebarConfig.theme}
        size={sidebarConfig.size}
        animation={sidebarConfig.animation}
        width={sidebarConfig.width}
        height={sidebarConfig.height}
        gradientEnabled={sidebarConfig.gradientEnabled}
        gradientEndColor={sidebarConfig.gradientEndColor}
      >
        <ChatWidget config={config} compact />
      </FloatingBall>
    </div>
  );
};

export default IntegrationSidebarPage;
