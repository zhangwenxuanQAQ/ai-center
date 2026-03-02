import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import './App.css';
import Home from './pages/home/home.tsx';
import Chatbot from './pages/chatbot/chatbot.tsx';
import MCP from './pages/mcp/mcp.tsx';
import Knowledge from './pages/knowledge/knowledge.tsx';
import LLMModel from './pages/llm_model/llm_model.tsx';
import Prompt from './pages/prompt/prompt.tsx';
import User from './pages/user/user.tsx';
import Chat from './pages/chat/chat.tsx';

const { Header, Content, Sider } = Layout;

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center' }}>
          <div className="logo" />
          <h1 style={{ color: 'white', margin: 0 }}>AI Center</h1>
        </Header>
        <Layout>
          <Sider width={200} style={{ background: '#f0f2f5' }}>
            <Menu
              mode="inline"
              style={{ height: '100%', borderRight: 0 }}
              defaultSelectedKeys={['1']}
            >
              <Menu.Item key="1">
                <Link to="/">首页</Link>
              </Menu.Item>
              <Menu.Item key="2">
                <Link to="/chatbots">机器人管理</Link>
              </Menu.Item>
              <Menu.Item key="3">
                <Link to="/mcps">MCP管理</Link>
              </Menu.Item>
              <Menu.Item key="4">
                <Link to="/knowledges">知识库管理</Link>
              </Menu.Item>
              <Menu.Item key="5">
                <Link to="/llm_models">模型管理</Link>
              </Menu.Item>
              <Menu.Item key="6">
                <Link to="/prompts">提示词管理</Link>
              </Menu.Item>
              <Menu.Item key="7">
                <Link to="/users">用户管理</Link>
              </Menu.Item>
              <Menu.Item key="8">
                <Link to="/chats">聊天记录</Link>
              </Menu.Item>
            </Menu>
          </Sider>
          <Layout style={{ padding: '0 24px 24px' }}>
            <Content
              style={{
                background: 'white',
                padding: 24,
                margin: 0,
                minHeight: 280,
              }}
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/chatbots" element={<Chatbot />} />
                <Route path="/mcps" element={<MCP />} />
                <Route path="/knowledges" element={<Knowledge />} />
                <Route path="/llm_models" element={<LLMModel />} />
                <Route path="/prompts" element={<Prompt />} />
                <Route path="/users" element={<User />} />
                <Route path="/chats" element={<Chat />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;