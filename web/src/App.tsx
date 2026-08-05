import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Card, Breadcrumb, ConfigProvider, theme as antTheme } from 'antd';
import { HomeOutlined, MessageOutlined, SettingOutlined, LogoutOutlined, RobotOutlined, BookOutlined, DatabaseOutlined, CommentOutlined, MoonOutlined, SunOutlined, MenuFoldOutlined, MenuUnfoldOutlined, HistoryOutlined, TeamOutlined, ToolOutlined, FileTextOutlined, CloudServerOutlined, DashboardOutlined, DesktopOutlined, ApartmentOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import './styles/index.css';
import './styles/common.css';
import './styles/variables.css';
import './styles/themes/dark.css';
import './styles/themes/light.css';
import Home from './pages/home/home.tsx';
import Chatbot from './pages/chatbot/chatbot.tsx';
import ChatbotSetting from './pages/chatbot/chatbot_setting.tsx';
import MCP from './pages/mcp/mcp.tsx';
import MCPSetting from './pages/mcp/mcp_setting.tsx';
import Knowledgebase from './pages/knowledgebase/knowledgebase.tsx';
import KnowledgebaseCreate from './pages/knowledgebase/knowledgebase_create.tsx';
import KnowledgebaseDetail from './pages/knowledgebase/knowledgebase_detail.tsx';
import LLMModel from './pages/llm_model/llm_model.tsx';
import LLMModelSetting from './pages/llm_model/llm_model_setting.tsx';
import Prompt from './pages/prompt/prompt.tsx';
import PromptSetting from './pages/prompt/prompt_setting.tsx';
import User from './pages/user/user.tsx';
import Chat from './pages/chat/chat.tsx';
import Datasource from './pages/datasource/datasource.tsx';
import SystemMonitor from './pages/system/monitor/monitor.tsx';
import Agent from './pages/agent/agent.tsx';
import AgentSetting from './pages/agent/agent_setting.tsx';
import IntegrationChatPage from './integration/chat/index.tsx';
import IntegrationSidebarPage from './integration/sidebar/index.tsx';
import IntegrationPreviewPage from './integration/preview/index.tsx';

const { Header, Content, Sider } = Layout;

const breadcrumbMap: Record<string, { title: string; path?: string }[]> = {
  '/': [{ title: '首页' }],
  '/chatbots': [{ title: '首页', path: '/' }, { title: '机器人' }],
  '/chatbot/setting/:id': [{ title: '首页', path: '/' }, { title: '机器人', path: '/chatbots' }, { title: '机器人配置' }],
  '/mcps': [{ title: '首页', path: '/' }, { title: 'MCP' }],
  '/mcp/setting/:id': [{ title: '首页', path: '/' }, { title: 'MCP', path: '/mcps' }, { title: 'MCP配置' }],
  '/knowledgebases': [{ title: '首页', path: '/' }, { title: '知识库' }],
  '/knowledgebase/create': [{ title: '首页', path: '/' }, { title: '知识库', path: '/knowledgebases' }, { title: '新增知识库' }],
  '/knowledgebase/detail/:id': [{ title: '首页', path: '/' }, { title: '知识库', path: '/knowledgebases' }, { title: '知识库详情' }],
  '/llm_models': [{ title: '首页', path: '/' }, { title: '模型管理' }],
  '/llm_model/setting/:id': [{ title: '首页', path: '/' }, { title: '模型管理', path: '/llm_models' }, { title: '模型配置' }],
  '/prompts': [{ title: '首页', path: '/' }, { title: '提示词' }],
  '/prompt/setting/:id': [{ title: '首页', path: '/' }, { title: '提示词', path: '/prompts' }, { title: '提示词配置' }],
  '/users': [{ title: '首页', path: '/' }, { title: '用户' }],
  '/chats': [{ title: '首页', path: '/' }, { title: '聊天' }],
  '/datasources': [{ title: '首页', path: '/' }, { title: '数据源' }],
  '/system/monitor': [{ title: '首页', path: '/' }, { title: '系统监控' }],
  '/agents': [{ title: '首页', path: '/' }, { title: '智能体' }],
  '/agent/setting/:id': [{ title: '首页', path: '/' }, { title: '智能体', path: '/agents' }, { title: '智能体配置' }],
};

const getBreadcrumbItems = (path: string) => {
  const matchedKey = Object.keys(breadcrumbMap).find(key => {
    if (key.includes(':id')) {
      const regex = new RegExp(`^${key.replace(':id', '[^/]+')}$`);
      return regex.test(path);
    }
    return key === path;
  });
  return breadcrumbMap[matchedKey || '/'] || breadcrumbMap['/'];
};

interface AppContentProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

function AppContent({ theme, toggleTheme }: AppContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // 集成页面路由 - 不使用主布局
  if (location.pathname.startsWith('/integration/')) {
    return (
      <Routes>
        <Route path="/integration/chat" element={<IntegrationChatPage />} />
        <Route path="/integration/sidebar" element={<IntegrationSidebarPage />} />
        <Route path="/integration/preview" element={<IntegrationPreviewPage />} />
        <Route path="/integration/preview/:token" element={<IntegrationPreviewPage />} />
      </Routes>
    );
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }} className={theme === 'dark' ? 'dark-theme' : 'light-theme'}>
     
      <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        <Sider 
          width={220} 
          collapsedWidth={60} 
          className={theme === 'dark' ? 'dark-theme-sider' : 'light-theme-sider'}
          collapsed={collapsed}
          style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
        >
           <div style={{ display: 'flex', alignItems: 'center', gap: 12,height:69,paddingLeft:24,borderBottom:'1px solid', borderBottomColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#e8eaed' }}>  
            <img 
            src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20AI%20logo%20with%20blue%20and%20green%20colors%2C%20simple%20and%20clean%2C%20technology%20theme%2C%20transparent%20background&image_size=square" 
            alt="AI Center Logo" 
            style={{ height: 36 }}
          />
          <h1 style={{ color: theme === 'dark' ? '#e0e0e0' : '#333333', margin: 0, fontSize: '1.2em', fontWeight: 'normal' }}>AI Center</h1>
          </div>
          <Menu
            mode="inline"
            style={{ flex: 1, borderRight: 0, textAlign: 'left' }}
            defaultSelectedKeys={['1']}
            defaultOpenKeys={['sub1', 'sub2', 'sub3', 'sub4']}
          >
            <Menu.Item key="1" icon={<HomeOutlined />}>
              <Link to="/">首页</Link>
            </Menu.Item>
            <Menu.SubMenu key="sub1" title="聊天" icon={<TeamOutlined />}>
              <Menu.Item key="2" icon={<MessageOutlined />}>
                <Link to="/chats">聊天</Link>
              </Menu.Item>
            </Menu.SubMenu>
            <Menu.SubMenu key="sub2" title="配置" icon={<ToolOutlined />}>
              <Menu.Item key="3" icon={<RobotOutlined />}>
                <Link to="/chatbots">机器人</Link>
              </Menu.Item>
              <Menu.Item key="4" icon={<BookOutlined />}>
                <Link to="/knowledgebases">知识库</Link>
              </Menu.Item>
              <Menu.Item key="agent" icon={<ApartmentOutlined />}>
                <Link to="/agents">智能体</Link>
              </Menu.Item>
              <Menu.Item key="5" icon={<DatabaseOutlined />}>
                <Link to="/mcps">MCP</Link>
              </Menu.Item>
              <Menu.Item key="6" icon={<CommentOutlined />}>
                <Link to="/prompts">提示词</Link>
              </Menu.Item>
              <Menu.Item key="7" icon={<SettingOutlined />}>
                <Link to="/llm_models">模型管理</Link>
              </Menu.Item>
              <Menu.Item key="8" icon={<CloudServerOutlined />}>
                <Link to="/datasources">数据源</Link>
              </Menu.Item>
            </Menu.SubMenu>
            <Menu.SubMenu key="sub3" title="日志" icon={<FileTextOutlined />}>
              <Menu.Item key="9" icon={<HistoryOutlined />}>
                <Link to="/chats">问答日志</Link>
              </Menu.Item>
            </Menu.SubMenu>
            <Menu.SubMenu key="sub4" title="系统" icon={<DesktopOutlined />}>
              <Menu.Item key="10" icon={<DashboardOutlined />}>
                <Link to="/system/monitor">监控</Link>
              </Menu.Item>
            </Menu.SubMenu>
          </Menu>
          <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '12px', textAlign: 'center', background: theme === 'dark' ? '#1a1a2e' : '#ffffff', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e8eaed' }}>
            <Button 
              type="text" 
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
              onClick={toggleCollapsed}
              style={{ color: theme === 'dark' ? '#a0a0b0' : '#666666' }}
            />
          </div>
        </Sider>
        <Layout style={{ padding: '0', overflow: 'hidden', height: '100%', background: theme === 'dark' ? 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)' : '#f5f7fa', }}>
           <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme === 'dark' ? '#1a1a2e' : '#ffffff', height: 69, flexShrink: 0, borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e8e8e8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        
          {/* <div style={{ width: 1, height: 24, background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#e8eaed' }} /> */}
          <Breadcrumb style={{ color: theme === 'dark' ? '#e0e0e0' : '#333333', fontSize: 14 }}>
            {getBreadcrumbItems(location.pathname).map((item, index) => (
              <Breadcrumb.Item key={index}>
                {item.path ? (
                  <Link to={item.path} style={{ color: theme === 'dark' ? '#a0a0b0' : '#666666' }}>
                    {item.title}
                  </Link>
                ) : (
                  <span style={{ color: theme === 'dark' ? '#e0e0e0' : '#333333', fontWeight: 500 }}>{item.title}</span>
                )}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ 
              color: theme === 'dark' ? '#a0a0b0' : '#666666',
              marginLeft: 10,
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13
            }}
            className="header-back-btn"
          >
            返回
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 24 }}>
          <Button 
            type="text" 
            icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />} 
            onClick={toggleTheme}
            style={{ 
              color: theme === 'dark' ? '#a0a0b0' : '#666',
              width: 36,
              height: 36,
              borderRadius: 8,
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f7fa'
            }}
          />
        </div>
      </Header>
          <Content
            style={{
             
              padding: 16,
              margin: 16,
              height: '100%',
              color: theme === 'dark' ? '#e0e0e0' : '#333333',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div 
              style={{height:'100%'}}
              // style={{ 
              //   background: 'transparent',
              //   borderColor: 'transparent',
              //   borderRadius: 0,
              //   flex: 1,
              //   overflow: 'hidden',
              //   display: 'flex',
              //   flexDirection: 'column',
              //   height: '100%'
              // }}
              // bodyStyle={{ 
              //   background: 'transparent',
              //   color: theme === 'dark' ? '#e0e0e0' : '#333333',
              //   height: '100%',
              //   overflow: 'hidden',
              //   flex: 1,
              //   display: 'flex',
              //   flexDirection: 'column',
              //   padding: 0
              // }}
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/chatbots" element={<Chatbot />} />
                <Route path="/chatbot/setting/:id" element={<ChatbotSetting />} />
                <Route path="/mcps" element={<MCP />} />
                <Route path="/mcp/setting/:id" element={<MCPSetting />} />
                <Route path="/knowledgebases" element={<Knowledgebase />} />
                <Route path="/knowledgebase/create" element={<KnowledgebaseCreate />} />
                <Route path="/knowledgebase/detail/:id" element={<KnowledgebaseDetail />} />
                <Route path="/llm_models" element={<LLMModel />} />
                <Route path="/llm_model/setting/:id" element={<LLMModelSetting />} />
                <Route path="/prompts" element={<Prompt />} />
                <Route path="/prompt/setting/:id" element={<PromptSetting />} />
                <Route path="/users" element={<User />} />
                <Route path="/chats" element={<Chat />} />
                <Route path="/datasources" element={<Datasource />} />
                <Route path="/system/monitor" element={<SystemMonitor />} />
                <Route path="/agents" element={<Agent />} />
                <Route path="/agent/setting/:id" element={<AgentSetting />} />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#5a6fd6',
          colorPrimaryHover: '#6b7fe6',
          colorPrimaryActive: '#4a5fc6',
          borderRadius: 8,
        },
      }}
      cssVar={true}
      hashed={false}
    >
    <Router>
      <AppContent theme={theme} toggleTheme={toggleTheme} />
    </Router>
    </ConfigProvider>
  );
}

export default App;