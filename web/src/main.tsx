import React from 'react'
import ReactDOM from 'react-dom/client'

const isIntegration = window.location.pathname.startsWith('/integration/')

if (isIntegration) {
  // 集成页面：使用独立入口，不加载主应用全局 admin 样式
  import('./integration-entry.tsx')
} else {
  // 主应用：加载完整的管理界面
  import('./App.tsx').then(({ default: App }) => {
    import('./index.css')
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  })
}
