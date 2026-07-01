import { Layout, Menu, Button, Breadcrumb } from 'antd';
import { HomeOutlined, MessageOutlined, SettingOutlined, RobotOutlined, BookOutlined, DatabaseOutlined, CommentOutlined, MoonOutlined, SunOutlined, MenuFoldOutlined, MenuUnfoldOutlined, HistoryOutlined, TeamOutlined, ToolOutlined, FileTextOutlined, CloudServerOutlined, DashboardOutlined, DesktopOutlined, ApartmentOutlined, SearchOutlined, BellOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const { Header, Content, Sider } = Layout;

interface LayoutProps {
  children: React.ReactNode;
}

const breadcrumbMap: Record<string, { title: string; path?: string }[]> = {
  '/': [{ title: '首页' }],
  '/chatbots': [{ title: '首页', path: '/' }, { title: '机器人' }],
  '/chatbot/setting/:id': [{ title: '首页', path: '/' }, { title: '机器人', path: '/chatbots' }, { title: '机器人配置' }],
  '/mcps': [{ title: '首页', path: '/' }, { title: 'MCP' }],
  '/mcp/setting/:id': [{ title: '首页', path: '/' }, { title: 'MCP', path: '/mcps' }, { title: 'MCP配置' }],
  '/knowledgebases': [{ title: '首页', path: '/' }, { title: '知识库' }],
  '/knowledgebase/create': [{ title: '首页', path: '/' }, { title: '知识库', path: '/knowledgebases' }, { title: '创建知识库' }],
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

function AppLayout({ children }: LayoutProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme as 'light' | 'dark') || 'dark';
  });
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  const getBreadcrumbItems = () => {
    const path = location.pathname;
    
    const matchedKey = Object.keys(breadcrumbMap).find(key => {
      if (key.includes(':id')) {
        const regex = new RegExp(`^${key.replace(':id', '[^/]+')}$`);
        return regex.test(path);
      }
      return key === path;
    });

    return breadcrumbMap[matchedKey || '/'] || breadcrumbMap['/'];
  };

  const currentPath = location.pathname;

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }} className={theme === 'dark' ? 'dark-theme' : 'light-theme'}>
      {/* 左侧区域：Logo + 标题 + 菜单 */}
      <Sider 
        width={220} 
        collapsedWidth={60}
        className={theme === 'dark' ? 'dark-theme-sider' : 'light-theme-sider'}
        collapsed={collapsed}
        style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {/* Logo 和标题 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: theme === 'dark' ? 'rgb(30, 30, 30)' : '#ffffff', 
          height: 64, 
          padding: '0 16px',
          borderBottom: theme === 'dark' ? '1px solid #333' : '1px solid #e8e8e8'
        }}>
          <img 
            src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20AI%20logo%20with%20blue%20and%20green%20colors%2C%20simple%20and%20clean%2C%20technology%20theme%2C%20transparent%20background&image_size=square" 
            alt="AI Center Logo" 
            style={{ height: 36, marginRight: 12 }}
          />
          <h1 style={{ color: theme === 'dark' ? 'white' : '#000000', margin: 0, fontSize: '1.2em', fontWeight: 'normal', whiteSpace: 'nowrap' }}>
            AI Center</h1>
        </div>
        
        {/* 左侧菜单栏 */}
        <Menu
          mode="inline"
          style={{ flex: 1, borderRight: 0, textAlign: 'left' }}
          selectedKeys={[currentPath]}
          defaultOpenKeys={['sub1', 'sub2', 'sub3', 'sub4']}
        >
          <Menu.Item key="/" icon={<HomeOutlined />}>
            <Link to="/">首页</Link>
          </Menu.Item>
          <Menu.SubMenu key="sub1" title="聊天" icon={<TeamOutlined />}>
            <Menu.Item key="/chats" icon={<MessageOutlined />}>
              <Link to="/chats">聊天</Link>
            </Menu.Item>
          </Menu.SubMenu>
          <Menu.SubMenu key="sub2" title="配置" icon={<ToolOutlined />}>
            <Menu.Item key="/chatbots" icon={<RobotOutlined />}>
              <Link to="/chatbots">机器人</Link>
            </Menu.Item>
            <Menu.Item key="/knowledgebases" icon={<BookOutlined />}>
              <Link to="/knowledgebases">知识库</Link>
            </Menu.Item>
            <Menu.Item key="/agents" icon={<ApartmentOutlined />}>
              <Link to="/agents">智能体</Link>
            </Menu.Item>
            <Menu.Item key="/mcps" icon={<DatabaseOutlined />}>
              <Link to="/mcps">MCP</Link>
            </Menu.Item>
            <Menu.Item key="/prompts" icon={<CommentOutlined />}>
              <Link to="/prompts">提示词</Link>
            </Menu.Item>
            <Menu.Item key="/llm_models" icon={<SettingOutlined />}>
              <Link to="/llm_models">模型管理</Link>
            </Menu.Item>
            <Menu.Item key="/datasources" icon={<CloudServerOutlined />}>
              <Link to="/datasources">数据源</Link>
            </Menu.Item>
          </Menu.SubMenu>
          <Menu.SubMenu key="sub3" title="日志" icon={<FileTextOutlined />}>
            <Menu.Item key="/chats" icon={<HistoryOutlined />}>
              <Link to="/chats">问答日志</Link>
            </Menu.Item>
          </Menu.SubMenu>
          <Menu.SubMenu key="sub4" title="系统" icon={<DesktopOutlined />}>
            <Menu.Item key="/system/monitor" icon={<DashboardOutlined />}>
              <Link to="/system/monitor">监控</Link>
            </Menu.Item>
          </Menu.SubMenu>
        </Menu>
        
        {/* 折叠按钮 */}
        <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '12px', textAlign: 'center', background: theme === 'dark' ? 'rgb(30, 30, 30)' : '#ffffff', borderTop: theme === 'dark' ? '1px solid #333' : '1px solid #e8e8e8' }}>
          <Button 
            type="text" 
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
            onClick={toggleCollapsed}
            style={{ color: theme === 'dark' ? 'white' : '#000000' }}
          />
        </div>
      </Sider>
      
      {/* 右侧区域 */}
      <Layout style={{ padding: '0', overflow: 'hidden', height: '100%' }}>
        {/* 右侧顶部：面包屑 + 搜索 + 主题切换 + 通知 + 用户信息 */}
        <Header 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            background: theme === 'dark' ? '#1a1a1a' : '#ffffff', 
            height: 64, 
            padding: '0 24px',
            borderBottom: theme === 'dark' ? '1px solid #333' : '1px solid #e8e8e8',
            boxShadow: theme === 'dark' ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Breadcrumb style={{ color: theme === 'dark' ? '#ffffff' : '#000000', fontSize: 14 }}>
              {getBreadcrumbItems().map((item, index) => (
                <Breadcrumb.Item key={index}>
                  {item.path ? (
                    <Link to={item.path} style={{ color: theme === 'dark' ? '#999' : '#666' }}>
                      {item.title}
                    </Link>
                  ) : (
                    <span style={{ color: theme === 'dark' ? '#ffffff' : '#333', fontWeight: 500 }}>{item.title}</span>
                  )}
                </Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button 
              type="text" 
              icon={<SearchOutlined />} 
              onClick={() => {}}
              style={{ 
                color: theme === 'dark' ? '#999' : '#666',
                width: 36,
                height: 36,
                borderRadius: 8,
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f7fa'
              }}
            />
            
            <Button 
              type="text" 
              icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />} 
              onClick={toggleTheme}
              style={{ 
                color: theme === 'dark' ? '#999' : '#666',
                width: 36,
                height: 36,
                borderRadius: 8,
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f7fa'
              }}
            />
            
            <Button 
              type="text" 
              icon={<BellOutlined />} 
              onClick={() => {}}
              style={{ 
                color: theme === 'dark' ? '#999' : '#666',
                width: 36,
                height: 36,
                borderRadius: 8,
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f7fa',
                position: 'relative'
              }}
            >
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                background: '#ff4d4f',
                color: '#fff',
                fontSize: 10,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px'
              }}>3</span>
            </Button>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: '6px 12px',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f7fa',
              borderRadius: 20,
              cursor: 'pointer'
            }}>
              <img 
                src="https://trae-api-cn.mchost.guru/api/text_to_image?prompt=professional%20business%20avatar%20portrait&image_size=square" 
                alt="User Avatar"
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
              <span style={{ fontSize: 14, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333' }}>管理员</span>
            </div>
          </div>
        </Header>
        
        {/* 右侧内容区域 */}
        <Content
          style={{
            background: theme === 'dark' ? '#000000' : '#f5f5f5',
            padding: 16,
            margin: 0,
            height: 'calc(100% - 56px)',
            color: theme === 'dark' ? '#ffffff' : '#000000',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto'
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppLayout;