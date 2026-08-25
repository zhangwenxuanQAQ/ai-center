import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Card, Breadcrumb, ConfigProvider, theme as antTheme, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn');
import { HomeOutlined, MessageOutlined, SettingOutlined, LogoutOutlined, RobotOutlined, BookOutlined, DatabaseOutlined, CommentOutlined, MoonOutlined, SunOutlined, MenuFoldOutlined, MenuUnfoldOutlined, HistoryOutlined, TeamOutlined, ToolOutlined, FileTextOutlined, CloudServerOutlined, DashboardOutlined, DesktopOutlined, ApartmentOutlined, ArrowLeftOutlined, PartitionOutlined } from '@ant-design/icons';
import { useState, useEffect, useMemo } from 'react';
import './styles/index.css';
import './styles/common.css';
import './styles/variables.css';
import './styles/themes/dark.css';
import './styles/themes/light.css';
import logo from './assets/logo.png';
import Home from './pages/home/home.tsx';
import Chatbot from './pages/chatbot/chatbot.tsx';
import ChatbotSetting from './pages/chatbot/chatbot_setting.tsx';
import MCP from './pages/mcp/mcp.tsx';
import MCPSetting from './pages/mcp/mcp_setting.tsx';
import Toolkit from './pages/toolkit/toolkit.tsx';
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
import OntologyObject from './pages/ontology/ontology_object.tsx';
import OntologyTask from './pages/ontology/ontology_task.tsx';
import NotFound from './pages/notfound/notfound.tsx';
import { getVersionConfig, getAvailableMenus, VersionInfo, isModuleEnabled, MenuItemConfig } from './services/versionConfig';

const { Header, Content, Sider } = Layout;

// 页面路由与模块的映射关系
const routeModuleMap: Record<string, string> = {
  '/chatbots': 'chatbot',
  '/chatbot/setting/:id': 'chatbot',
  '/mcps': 'mcp',
  '/mcp/setting/:id': 'mcp',
  '/toolkit': 'toolkit',
  '/knowledgebases': 'knowledgebase',
  '/knowledgebase/create': 'knowledgebase',
  '/knowledgebase/detail/:id': 'knowledgebase',
  '/llm_models': 'llm_model',
  '/llm_model/setting/:id': 'llm_model',
  '/prompts': 'prompt',
  '/prompt/setting/:id': 'prompt',
  '/users': 'user',
  '/chats': 'chat',
  '/datasources': 'datasource',
  '/system/monitor': 'system_monitor',
  '/agents': 'agent',
  '/agent/setting/:id': 'agent',
  '/ontology/objects': 'ontology',
  '/ontology/tasks': 'ontology',
};

// 路由组件映射
const routeComponents: Record<string, React.ComponentType> = {
  '/': Home,
  '/chatbots': Chatbot,
  '/chatbot/setting/:id': ChatbotSetting,
  '/mcps': MCP,
  '/mcp/setting/:id': MCPSetting,
  '/toolkit': Toolkit,
  '/knowledgebases': Knowledgebase,
  '/knowledgebase/create': KnowledgebaseCreate,
  '/knowledgebase/detail/:id': KnowledgebaseDetail,
  '/llm_models': LLMModel,
  '/llm_model/setting/:id': LLMModelSetting,
  '/prompts': Prompt,
  '/prompt/setting/:id': PromptSetting,
  '/users': User,
  '/chats': Chat,
  '/datasources': Datasource,
  '/system/monitor': SystemMonitor,
  '/agents': Agent,
  '/agent/setting/:id': AgentSetting,
  '/ontology/objects': OntologyObject,
  '/ontology/tasks': OntologyTask,
};

// 面包屑映射
const breadcrumbMap: Record<string, { title: string; path?: string }[]> = {
  '/': [{ title: '首页' }],
  '/chatbots': [{ title: '首页', path: '/' }, { title: '机器人' }],
  '/chatbot/setting/:id': [{ title: '首页', path: '/' }, { title: '机器人', path: '/chatbots' }, { title: '机器人配置' }],
  '/mcps': [{ title: '首页', path: '/' }, { title: 'MCP' }],
  '/mcp/setting/:id': [{ title: '首页', path: '/' }, { title: 'MCP', path: '/mcps' }, { title: 'MCP配置' }],
  '/toolkit': [{ title: '首页', path: '/' }, { title: '工具箱' }],
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
  '/ontology/objects': [{ title: '首页', path: '/' }, { title: '本体工作台', path: '/ontology/objects' }, { title: '本体对象' }],
  '/ontology/tasks': [{ title: '首页', path: '/' }, { title: '本体工作台', path: '/ontology/objects' }, { title: '数据抽取' }],
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
  versionInfo: VersionInfo | null;
  loading: boolean;
}

function AppContent({ theme, toggleTheme, versionInfo, loading }: AppContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // 根据版本配置获取可用菜单
  const availableMenus = useMemo(() => {
    return getAvailableMenus(versionInfo);
  }, [versionInfo]);

  // 渲染菜单项
  const renderMenuItems = (menus: MenuItemConfig[]): React.ReactNode[] => {
    return menus.map(menu => {
      if (menu.children && menu.children.length > 0) {
        const SubMenuIcon = getIconComponent(menu.icon);
        return (
          <Menu.SubMenu key={menu.key} title={menu.label} icon={SubMenuIcon ? <SubMenuIcon /> : undefined}>
            {renderMenuItems(menu.children)}
          </Menu.SubMenu>
        );
      } else {
        const IconComponent = getIconComponent(menu.icon);
        return (
          <Menu.Item key={menu.key} icon={IconComponent ? <IconComponent /> : undefined}>
            {menu.path ? <Link to={menu.path}>{menu.label}</Link> : menu.label}
          </Menu.Item>
        );
      }
    });
  };

  // 获取图标组件
  function getIconComponent(iconName?: string): React.ComponentType | null {
    const iconMap: Record<string, React.ComponentType> = {
      'HomeOutlined': HomeOutlined,
      'MessageOutlined': MessageOutlined,
      'RobotOutlined': RobotOutlined,
      'BookOutlined': BookOutlined,
      'ApartmentOutlined': ApartmentOutlined,
      'DatabaseOutlined': DatabaseOutlined,
      'CommentOutlined': CommentOutlined,
      'SettingOutlined': SettingOutlined,
      'CloudServerOutlined': CloudServerOutlined,
      'FileTextOutlined': FileTextOutlined,
      'DesktopOutlined': DesktopOutlined,
      'DashboardOutlined': DashboardOutlined,
      'HistoryOutlined': HistoryOutlined,
      'TeamOutlined': TeamOutlined,
      'PartitionOutlined': PartitionOutlined,
      'ToolOutlined': ToolOutlined,
    };
    return iconName ? (iconMap[iconName] || null) : null;
  }

  // 检查路由是否启用
  const isRouteAvailable = (path: string): boolean => {
    if (!versionInfo) return true;
    if (path === '/' || path === '') return true;
    const moduleName = routeModuleMap[path];
    if (!moduleName) return true;
    return isModuleEnabled(moduleName, versionInfo);
  };

  // 集成页面路由 - 不使用主布局
  if (location.pathname.startsWith('/integration/')) {
    // 检查integration模块是否启用
    if (versionInfo && !isModuleEnabled('integration', versionInfo)) {
      return <NotFound />;
    }
    return (
      <Routes>
        <Route path="/integration/chat" element={<IntegrationChatPage />} />
        <Route path="/integration/sidebar" element={<IntegrationSidebarPage />} />
        <Route path="/integration/preview" element={<IntegrationPreviewPage />} />
        <Route path="/integration/preview/:token" element={<IntegrationPreviewPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <Layout style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </Layout>
    );
  }

  // 动态路由渲染
  const renderRoutes = () => {
    const routes: React.ReactNode[] = [];
    
    // 首页始终可用
    routes.push(<Route key="home" path="/" element={<Home />} />);

    // 根据启用的模块注册路由
    Object.entries(routeComponents).forEach(([path, Component]) => {
      if (path === '/') return; // 首页已处理
      if (isRouteAvailable(path)) {
        routes.push(<Route key={path} path={path} element={<Component />} />);
      }
    });

    // 404 通配符路由
    routes.push(<Route key="notfound" path="*" element={<NotFound />} />);

    return routes;
  };

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }} className={theme === 'dark' ? 'dark-theme' : 'light-theme'}>
     
      <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        <Sider 
          width={220} 
          collapsedWidth={60} 
          className={theme === 'dark' ? 'dark-theme-sider' : 'light-theme-sider'}
          collapsed={collapsed}
          style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
           <div style={{ display: 'flex', alignItems: 'center', gap: 12,height:69,paddingLeft:24,borderBottom:'1px solid', borderBottomColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#e8eaed' }}>
            <img
            src={logo}
            alt="AI Center Logo"
            style={{ height: 36, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          />
          </div>
          <Menu
            mode="inline"
            className="hide-scrollbar"
            style={{ flex: 1, borderRight: 0, textAlign: 'left', overflowY: 'auto', minHeight: 0 }}
            defaultSelectedKeys={['1']}
            defaultOpenKeys={availableMenus.map(m => m.key)}
          >
            {renderMenuItems(availableMenus)}
          </Menu>
          <div style={{ flexShrink: 0, padding: '12px', textAlign: 'center', background: theme === 'dark' ? '#1a1a2e' : '#ffffff', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e8eaed' }}>
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
            <div style={{height:'100%'}}>
              <Routes>
                {renderRoutes()}
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

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 加载版本配置
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const config = await getVersionConfig();
        setVersionInfo(config);
      } catch (e) {
        console.warn('[VERSION] 加载版本配置失败，使用默认配置');
      } finally {
        setLoading(false);
      }
    };
    loadVersion();
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ConfigProvider
      locale={zhCN}
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
        <AppContent theme={theme} toggleTheme={toggleTheme} versionInfo={versionInfo} loading={loading} />
      </Router>
    </ConfigProvider>
  );
}

export default App;