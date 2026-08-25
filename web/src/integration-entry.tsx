import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn');
import IntegrationChatPage from './integration/chat/index.tsx';
import IntegrationSidebarPage from './integration/sidebar/index.tsx';
import IntegrationPreviewPage from './integration/preview/index.tsx';

/* 集成页面专用基础样式 - 不引入主应用的 index.css / common.css / variables.css */
const style = document.createElement('style');
style.textContent = `
  html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
  #root { height: 100%; width: 100%; overflow: hidden; }
  *, *::before, *::after { box-sizing: border-box; }
`;
document.head.appendChild(style);

/**
 * 集成页面独立入口
 * 不加载主应用的全局 admin 样式（index.css, common.css, variables.css, themes/）
 * 仅加载 integration.css，确保嵌入到外部 HTML 时样式与预览一致
 */
function IntegrationApp() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#5a6fd6',
          borderRadius: 8,
        },
      }}
      cssVar={true}
      hashed={false}
    >
      <Router>
        <Routes>
          <Route path="/integration/chat" element={<IntegrationChatPage />} />
          <Route path="/integration/sidebar" element={<IntegrationSidebarPage />} />
          <Route path="/integration/preview" element={<IntegrationPreviewPage />} />
          <Route path="/integration/preview/:token" element={<IntegrationPreviewPage />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<IntegrationApp />);
