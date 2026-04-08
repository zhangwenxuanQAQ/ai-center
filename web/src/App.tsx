import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Button, Card, ConfigProvider, theme as antTheme } from 'antd';
import { HomeOutlined, MessageOutlined, SettingOutlined, LogoutOutlined, RobotOutlined, BookOutlined, DatabaseOutlined, CommentOutlined, MoonOutlined, SunOutlined, MenuFoldOutlined, MenuUnfoldOutlined, HistoryOutlined, TeamOutlined, ToolOutlined, FileTextOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import './styles/index.css';
import './styles/common.css';
import './styles/themes/dark.css';
import './styles/themes/light.css';
import Home from './pages/home/home.tsx';
import Chatbot from './pages/chatbot/chatbot.tsx';
import ChatbotSetting from './pages/chatbot/chatbot_setting.tsx';
import MCP from './pages/mcp/mcp.tsx';
import MCPSetting from './pages/mcp/mcp_setting.tsx';
import Knowledgebase from './pages/knowledgebase/knowledgebase.tsx';
import LLMModel from './pages/llm_model/llm_model.tsx';
import LLMModelSetting from './pages/llm_model/llm_model_setting.tsx';
import Prompt from './pages/prompt/prompt.tsx';
import PromptSetting from './pages/prompt/prompt_setting.tsx';
import User from './pages/user/user.tsx';
import Chat from './pages/chat/chat.tsx';

const { Header, Content, Sider } = Layout;

function App() {
  // 从localStorage获取主题，如果没有则使用默认值'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme as 'light' | 'dark') || 'dark';
  });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    // 将主题保存到localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#667eea',
          borderRadius: 8,
        },
      }}
      cssVar={true}
      hashed={false}
    >
    <Router>
      <Layout style={{ height: '100vh', overflow: 'hidden' }} className={theme === 'dark' ? 'dark-theme' : 'light-theme'}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme === 'dark' ? 'rgb(30, 30, 30)' : '#ffffff', height: 64, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img 
              src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20AI%20logo%20with%20blue%20and%20green%20colors%2C%20simple%20and%20clean%2C%20technology%20theme%2C%20transparent%20background&image_size=square" 
              alt="AI Center Logo" 
              style={{ height: 40, marginRight: 16 }}
            />
            <h1 style={{ color: theme === 'dark' ? 'white' : '#000000', margin: 0, fontSize: '1.5em', fontWeight: 'normal' }}>AI Center</h1>
          </div>
          <Button 
            type="text" 
            icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />} 
            onClick={toggleTheme}
            style={{ color: theme === 'dark' ? 'white' : '#000000' }}
          />
        </Header>
        <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
          <Sider 
            width={250} 
            collapsedWidth={80} 
            className={theme === 'dark' ? 'dark-theme-sider' : 'light-theme-sider'}
            collapsed={collapsed}
            style={{ overflow: 'hidden', height: '100%' }}
          >
            <Menu
              mode="inline"
              style={{ height: 'calc(100% - 48px)', borderRight: 0, textAlign: 'left' }}
              defaultSelectedKeys={['1']}
              defaultOpenKeys={['sub1', 'sub2', 'sub3']}
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
                <Menu.Item key="5" icon={<DatabaseOutlined />}>
                  <Link to="/mcps">MCP</Link>
                </Menu.Item>
                <Menu.Item key="6" icon={<CommentOutlined />}>
                  <Link to="/prompts">提示词</Link>
                </Menu.Item>
                <Menu.Item key="7" icon={<SettingOutlined />}>
                  <Link to="/llm_models">模型库</Link>
                </Menu.Item>
              </Menu.SubMenu>
              <Menu.SubMenu key="sub3" title="日志" icon={<FileTextOutlined />}>
                <Menu.Item key="8" icon={<HistoryOutlined />}>
                  <Link to="/chats">问答日志</Link>
                </Menu.Item>
              </Menu.SubMenu>
            </Menu>
            <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '12px', textAlign: 'center' }}>
              <Button 
                type="text" 
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
                onClick={toggleCollapsed}
                style={{ color: theme === 'dark' ? 'white' : '#000000' }}
              />
            </div>
          </Sider>
          <Layout style={{ padding: '0', overflow: 'hidden', height: '100%' }}>
            <Content
              style={{
                background: theme === 'dark' ? '#000000' : '#f5f5f5',
                padding: 16,
                margin: 0,
                height: '100%',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <Card 
                style={{ 
                  background: theme === 'dark' ? '#000000' : '#ffffff',
                  borderColor: theme === 'dark' ? '#333333' : '#e8e8e8',
                  flex: 1,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                bodyStyle={{ 
                  background: theme === 'dark' ? '#000000' : '#ffffff',
                  color: theme === 'dark' ? '#ffffff' : '#000000',
                  height: '100%',
                  overflow: 'hidden',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0
                }}
              >
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/chatbots" element={<Chatbot />} />
                  <Route path="/chatbot/setting/:id" element={<ChatbotSetting />} />
                  <Route path="/mcps" element={<MCP />} />
                  <Route path="/mcp/setting/:id" element={<MCPSetting />} />
                  <Route path="/knowledgebases" element={<Knowledgebase />} />
                  <Route path="/llm_models" element={<LLMModel />} />
                  <Route path="/llm_model/setting/:id" element={<LLMModelSetting />} />
                  <Route path="/prompts" element={<Prompt />} />
                  <Route path="/prompt/setting/:id" element={<PromptSetting />} />
                  <Route path="/users" element={<User />} />
                  <Route path="/chats" element={<Chat />} />
                </Routes>
              </Card>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Router>
    </ConfigProvider>
  );
}

export default App;