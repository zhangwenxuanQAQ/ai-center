# AI Center UI 设计规范

## 1. 设计原则

### 1.1 整体风格
- **深色模式**：现代科技感，深色背景配合蓝色主题色，适合长时间使用
- **浅色模式**：清新简洁，白色背景配合蓝色主题色，适合日常办公

### 1.2 设计理念
- **一致性**：同一功能在不同页面保持相同的交互和视觉风格
- **层次感**：通过颜色深浅、间距、阴影区分不同层级
- **可用性**：确保所有元素在两种模式下都具有良好的对比度和可读性

---

## 2. 颜色系统

### 2.1 深色模式颜色

| 颜色名称 | 色值 | 用途 |
| :--- | :--- | :--- |
| **主背景色** | `#0f0f1a` | 页面最底层背景 |
| **卡片背景色** | `#1a1a2e` | 卡片、容器背景 |
| **边框颜色** | `rgba(255, 255, 255, 0.08)` | 分割线、边框 |
| **主文字色** | `#e0e0e0` | 主要文字内容 |
| **次要文字色** | `#a0a0b0` | 次要文字、标签 |
| **辅助文字色** | `#8f959e` | 提示文字、占位符 |
| **主题色** | `#5a6fd6` | 按钮、选中状态、链接 |
| **主题色hover** | `#4a5fc6` | 按钮hover状态 |
| **成功色** | `#2ea44f` | 成功状态、可用状态 |
| **失败色** | `#ff6666` | 失败状态、删除按钮 |
| **警告色** | `#f59e0b` | 警告提示 |

### 2.2 浅色模式颜色

| 颜色名称 | 色值 | 用途 |
| :--- | :--- | :--- |
| **主背景色** | `#f5f7fa` | 页面最底层背景 |
| **卡片背景色** | `#ffffff` | 卡片、容器背景 |
| **边框颜色** | `#e8eaed` | 分割线、边框 |
| **主文字色** | `#333333` | 主要文字内容 |
| **次要文字色** | `#666666` | 次要文字、标签 |
| **辅助文字色** | `#999999` | 提示文字、占位符 |
| **主题色** | `#5a6fd6` | 按钮、选中状态、链接 |
| **主题色hover** | `#4a5fc6` | 按钮hover状态 |
| **成功色** | `#2ea44f` | 成功状态、可用状态 |
| **失败色** | `#ff6666` | 失败状态、删除按钮 |
| **警告色** | `#f59e0b` | 警告提示 |

### 2.3 CSS变量定义

```css
:root {
  /* 深色模式变量 */
  --dark-bg-primary: #0f0f1a;
  --dark-bg-card: #1a1a2e;
  --dark-border: rgba(255, 255, 255, 0.08);
  --dark-text-primary: #e0e0e0;
  --dark-text-secondary: #a0a0b0;
  --dark-text-muted: #8f959e;
  
  /* 浅色模式变量 */
  --light-bg-primary: #f5f7fa;
  --light-bg-card: #ffffff;
  --light-border: #e8eaed;
  --light-text-primary: #333333;
  --light-text-secondary: #666666;
  --light-text-muted: #999999;
  
  /* 通用变量 */
  --primary-color: #5a6fd6;
  --primary-hover: #4a5fc6;
  --success-color: #2ea44f;
  --danger-color: #ff6666;
  --warning-color: #f59e0b;
}
```

---

## 3. 字体系统

### 3.1 字体栈

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### 3.2 字体大小

| 用途 | 大小 | 行高 | 字重 |
| :--- | :--- | :--- | :--- |
| 页面标题 | 20px | 1.4 | 600 |
| 卡片标题 | 17px | 1.4 | 600 |
| 分类名称 | 15px | 1.4 | 600 |
| 正文文字 | 14px | 1.5 | 400 |
| 标签文字 | 13px | 1.4 | 400 |
| 辅助文字 | 12px | 1.4 | 400 |
| 小号文字 | 11px | 1.3 | 400 |

---

## 4. 间距系统

### 4.1 基础间距

| 间距名称 | 大小 | 用途 |
| :--- | :--- | :--- |
| xs | 4px | 元素内部小间距 |
| sm | 8px | 元素内部间距 |
| md | 12px | 组件内部间距 |
| lg | 16px | 组件间间距 |
| xl | 24px | 页面区块间距 |
| 2xl | 32px | 大区块间距 |

### 4.2 常用布局间距

- 侧边栏宽度：200px
- 页面内边距：24px
- 卡片内边距：24px
- 卡片间距：24px
- 按钮内边距：8px 16px

---

## 5. 组件规范

### 5.1 按钮

#### 5.1.1 主要按钮

```css
.btn-primary {
  background: var(--primary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}
```

#### 5.1.2 次要按钮

```css
.btn-secondary {
  background: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(90, 111, 214, 0.1);
}
```

#### 5.1.3 危险按钮

```css
.btn-danger {
  background: rgba(255, 102, 102, 0.15);
  color: var(--danger-color);
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: rgba(255, 102, 102, 0.25);
}
```

### 5.2 卡片

#### 5.2.1 基础卡片

```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}
```

#### 5.2.2 卡片内部结构

```html
<div class="card">
  <div class="card-header">
    <div class="card-icon">...</div>
    <div class="card-info">
      <h3 class="card-title">标题</h3>
      <span class="card-category">分类</span>
    </div>
    <div class="card-status">
      <span class="status-badge">状态</span>
    </div>
  </div>
  <div class="card-tags">
    <span class="tag">标签1</span>
    <span class="tag">标签2</span>
  </div>
  <div class="card-meta">
    <span class="meta-item">辅助信息</span>
  </div>
  <div class="card-actions">
    <button class="action-btn">操作</button>
  </div>
</div>
```

### 5.3 输入框

#### 5.3.1 基础输入框

```css
.input {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.input::placeholder {
  color: var(--text-muted);
}
```

### 5.4 标签

#### 5.4.1 基础标签

```css
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
}
```

### 5.5 状态徽章

#### 5.5.1 状态徽章

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.enabled {
  background: rgba(46, 164, 79, 0.15);
  color: var(--success-color);
}

.status-badge.disabled {
  background: rgba(255, 102, 102, 0.15);
  color: var(--danger-color);
}

.status-badge.available {
  background: rgba(90, 111, 214, 0.08);
  color: var(--primary-color);
}

.status-badge.unavailable {
  background: rgba(187, 187, 187, 0.08);
  color: #bbbbbb;
}
```

### 5.6 侧边栏菜单

#### 5.6.1 菜单样式

```css
.sidebar {
  width: 200px;
  display: flex;
  flex-direction: column;
}

/* 深色模式 */
body.dark-mode .sidebar {
  background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%);
  color: #a0a0b0;
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.3);
}

/* 浅色模式 */
body.light-mode .sidebar {
  background: #fff;
  color: #666;
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.05);
}

.menu-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
  position: relative;
}

.menu-item:hover {
  background: rgba(90, 111, 214, 0.1);
}

.menu-item.active {
  background: rgba(90, 111, 214, 0.2);
  color: #fff;
}

.menu-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: linear-gradient(180deg, #5a6fd6, #7c8fe8);
  border-radius: 0 2px 2px 0;
}
```

### 5.7 顶部导航栏

```css
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
}

/* 深色模式 */
body.dark-mode .header {
  background: #1a1a2e;
}

/* 浅色模式 */
body.light-mode .header {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
```

### 5.8 弹窗

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 480px;
  max-width: 90%;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}
```

### 5.9 分页

```css
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-top: 1px solid var(--border);
}

.page-btn {
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(.disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.page-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## 6. 图标规范

### 6.1 图标库

使用 Font Awesome 6.4.0：

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

### 6.2 图标颜色

- 普通状态：继承父元素颜色
- hover状态：主题色 `#5a6fd6`
- 禁用状态：灰色 `#666`

### 6.3 图标大小

| 用途 | 大小 |
| :--- | :--- |
| 侧边栏菜单图标 | 16px |
| 卡片图标 | 52px（外框） |
| 按钮图标 | 14px |
| 状态图标 | 12px |
| 辅助图标 | 12px |

---

## 7. 交互规范

### 7.1 悬停效果

- **卡片**：`transform: translateY(-3px)` + 阴影加深
- **按钮**：颜色加深 + `transform: translateY(-1px)`
- **菜单项**：背景变化
- **标签**：轻微缩放

### 7.2 过渡动画

所有交互元素使用 `transition: all 0.2s` 或 `transition: all 0.3s`

### 7.3 加载状态

- 按钮：禁用状态 + 加载图标
- 列表：骨架屏占位

### 7.4 提示反馈

- 操作成功：绿色提示
- 操作失败：红色提示
- 警告信息：黄色提示

---

## 8. 主题切换规范

### 8.1 切换逻辑

```javascript
function toggleTheme() {
  const body = document.body;
  const icon = document.querySelector('#theme-toggle i');
  
  if (body.classList.contains('dark-mode')) {
    body.classList.remove('dark-mode');
    body.classList.add('light-mode');
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
    localStorage.setItem('theme', 'light');
  } else {
    body.classList.remove('light-mode');
    body.classList.add('dark-mode');
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
    localStorage.setItem('theme', 'dark');
  }
}
```

### 8.2 主题存储

使用 `localStorage` 存储用户主题偏好：
- Key: `theme`
- Value: `dark` 或 `light`

### 8.3 初始化

```javascript
const savedTheme = localStorage.getItem('theme') || 'dark';
document.body.classList.add(savedTheme + '-mode');
```

---

## 9. 响应式设计

### 9.1 断点定义

| 断点名称 | 屏幕宽度 | 布局变化 |
| :--- | :--- | :--- |
| 移动端 | < 768px | 侧边栏折叠为图标模式 |
| 平板端 | 768px - 1024px | 侧边栏宽度调整 |
| 桌面端 | > 1024px | 完整布局 |

### 9.2 布局适配

- 侧边栏：在小屏幕下可折叠
- 卡片：自动调整列数
- 表格：横向滚动

---

## 10. 深色模式样式覆盖规则

### 10.1 通用规则

所有需要适配深色模式的元素，使用以下选择器格式：

```css
body.dark-mode .element-name {
  /* 深色模式样式 */
}

body.light-mode .element-name {
  /* 浅色模式样式（可选，仅当与默认样式不同时） */
}
```

### 10.2 覆盖优先级

1. 背景色：深色背景替换浅色背景
2. 文字色：浅色文字替换深色文字
3. 边框色：降低透明度或使用浅色边框
4. 阴影：去除或降低阴影强度

---

## 附录：设计稿参考

### 页面结构

```
┌─────────────────────────────────────────────────────┐
│  Header (80px)                                      │
│  ┌──────────────┬──────────────────────────────────┐│
│  │ Breadcrumb   │  Search | Theme | Notification   ││
│  └──────────────┴──────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────────────────────────────┐│
│  │ Sidebar  │  │  Main Content                    ││
│  │ (200px)  │  │                                  ││
│  │          │  │  Page Header                     ││
│  │  Menu    │  │  ┌──────────────────────────────┐││
│  │  Items   │  │  │ Title           Add Button   │││
│  │          │  │  └──────────────────────────────┘││
│  └──────────┘  │                                  ││
│                │  Content Area                    ││
│                │  ┌─────────┐  ┌─────────┐        ││
│                │  │ Card 1  │  │ Card 2  │        ││
│                │  │         │  │         │        ││
│                │  └─────────┘  └─────────┘        ││
│                │                                  ││
│                └──────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 数据源管理页面结构

```
┌─────────────────────────────────────────────────────┐
│  Header                                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────────────┐  ┌────────────────────────────┐│
│  │ 分类树         │  │ 分类信息栏                  ││
│  │ Sidebar        │  │ ┌─────────────────────────┐││
│  │ (260px)        │  │ │ 分类名称                 │││
│  │                │  │ │ 描述 | 操作时间          │││
│  │ ┌─────────────┐│  │ └─────────────────────────┘││
│  │ │ 全部        ││  └────────────────────────────┘│
│  │ │ 业务数据库  ││                                │
│  │ │ ├─生产环境  ││  ┌────────────────────────────┐│
│  │ │ │ └─MySQL  ││  │ 数据源列表                 ││
│  │ │ └─测试环境  ││  │ ┌──────────┐ ┌──────────┐  ││
│  │ │ 数据仓库    ││  │ │ Oracle   │ │ MySQL    │  ││
│  │ │ API数据源   ││  │ │ 卡片     │ │ 卡片     │  ││
│  │ │ 文件数据源  ││  │ └──────────┘ └──────────┘  ││
│  │ └─────────────┘│  │                            ││
│  └────────────────┘  └────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

**文档版本**: v1.0  
**创建日期**: 2026-06-16  
**适用项目**: AI Center

---

*本规范基于当前原型设计，如有调整请以最新设计稿为准。*