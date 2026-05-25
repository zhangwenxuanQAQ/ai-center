import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Button, message, Spin, Popconfirm } from 'antd';
import { SaveOutlined, PlayCircleOutlined, DeleteOutlined, CloudUploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Node, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AgentComponents from './agent_components';
import AgentDrawer from './agent_drawer';
import AgentCanvas from './agent_canvas';
import './agent.less';

const { Sider, Content } = Layout;

interface AgentInstance {
  id: string;
  name: string;
  code: string;
  description?: string;
  category_id?: string;
  avatar?: string;
  dsl?: any;
  version?: number;
  status?: boolean;
  is_template?: boolean;
  created_at: string;
  updated_at?: string;
}

interface AgentCanvasRef {
  getNodes: () => Node[];
  getEdges: () => Node[];
}

const AgentSetting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<AgentInstance | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [initialEdges, setInitialEdges] = useState<any[]>([]);
  
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [runResults, setRunResults] = useState<any[]>([]);

  const canvasRef = useRef<AgentCanvasRef>(null);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'light' | 'dark');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (id) {
      fetchAgent();
    } else {
      initializeDefaultCanvas();
    }
  }, [id]);

  const fetchAgent = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/aicenter/v1/agent/instances/${id}`);
      const result = await response.json();
      if (result.code === 200) {
        setAgent(result.data);
        if (result.data.dsl) {
          const dsl = result.data.dsl;
          if (dsl.graph) {
            setInitialNodes(dsl.graph.nodes || []);
            setInitialEdges(dsl.graph.edges || []);
          }
        } else {
          initializeDefaultCanvas();
        }
      }
    } catch (error) {
      console.error('Failed to fetch agent:', error);
      message.error('获取智能体信息失败');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultCanvas = () => {
    const defaultNodes: Node[] = [
      {
        id: 'begin',
        type: 'beginNode',
        position: { x: 100, y: 200 },
        data: { label: 'Begin', name: '开始', form: { prologue: 'Hi there!' } }
      },
      {
        id: 'answer',
        type: 'answerNode',
        position: { x: 400, y: 200 },
        data: { label: 'Answer', name: '回答', form: {} }
      }
    ];
    
    const defaultEdges = [
      {
        id: 'begin-answer',
        source: 'begin',
        target: 'answer',
        type: 'default'
      }
    ];
    
    setInitialNodes(defaultNodes);
    setInitialEdges(defaultEdges);
  };

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setIsDrawerVisible(true);
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeData: any) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-data', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleSave = async () => {
    try {
      const nodes = canvasRef.current?.getNodes() || [];
      const edges = canvasRef.current?.getEdges() || [];
      
      const dsl = {
        graph: {
          nodes,
          edges
        },
        components: {},
        history: [],
        messages: [],
        path: [],
        answer: []
      };

      const url = id 
        ? `/aicenter/v1/agent/instances/${id}`
        : '/aicenter/v1/agent/instances';
      
      const method = id ? 'POST' : 'POST';
      
      const body = id ? { dsl } : { 
        name: agent?.name || '新智能体',
        code: agent?.code || `agent_${Date.now()}`,
        description: agent?.description || '',
        dsl 
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      if (result.code === 200 || result.code === 201) {
        message.success('保存成功');
        if (!id && result.data?.id) {
          navigate(`/agent/setting/${result.data.id}`);
        }
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
      message.error('保存失败');
    }
  };

  const handleRun = async () => {
    message.info('运行功能开发中...');
  };

  const handlePublish = async () => {
    try {
      const response = await fetch(`/aicenter/v1/agent/instances/${id}/publish`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.code === 200) {
        message.success('发布成功');
        fetchAgent();
      } else {
        message.error(result.message || '发布失败');
      }
    } catch (error) {
      console.error('Failed to publish agent:', error);
      message.error('发布失败');
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/aicenter/v1/agent/instances/${id}/delete`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.code === 200) {
        message.success('删除成功');
        navigate('/agents');
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
      message.error('删除失败');
    }
  };

  const handleDrawerClose = () => {
    setIsDrawerVisible(false);
    setSelectedNode(null);
  };

  const handleFormSubmit = (values: any) => {
    if (selectedNode) {
      message.info('节点配置更新功能开发中...');
    }
    handleDrawerClose();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={`agent-setting ${theme}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="agent-setting-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e8e8e8'}`,
        background: theme === 'dark' ? '#1a1a2e' : '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/agents')}
            className="back-btn"
            style={{
              borderRadius: '8px',
              color: theme === 'dark' ? '#fff' : '#000'
            }}
          >
            返回
          </Button>
          <div className="agent-setting-title" style={{ fontSize: '18px', fontWeight: 600, color: theme === 'dark' ? '#fff' : '#000' }}>
            {agent?.name || '智能体配置'}
            {agent?.version && <span style={{ marginLeft: 8, fontSize: '14px', color: '#999' }}>v{agent.version}</span>}
          </div>
        </div>

        <div className="agent-setting-actions">
          <Button icon={<PlayCircleOutlined />} onClick={handleRun} className="action-btn">
            运行
          </Button>
          {id && (
            <Button icon={<CloudUploadOutlined />} onClick={handlePublish} className="action-btn">
              发布
            </Button>
          )}
          <Button icon={<SaveOutlined />} onClick={handleSave} className="action-btn">
            保存
          </Button>
          {id && (
            <Popconfirm
              title="确定要删除这个智能体吗？"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button icon={<DeleteOutlined />} className="action-btn delete-btn">
                删除
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>

      <div className="agent-setting-content" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sider width={240} style={{ 
          background: theme === 'dark' ? '#1a1a1a' : '#fff', 
          borderRight: `1px solid ${theme === 'dark' ? '#333' : '#e8e8e8'}` 
        }}>
          <AgentComponents onDragStart={onDragStart} />
        </Sider>

        <Content style={{ flex: 1, position: 'relative' }}>
          <AgentCanvas
            ref={canvasRef}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            colorMode={theme}
            onNodeClick={onNodeClick}
          />
        </Content>
      </div>

      <AgentDrawer
        visible={isDrawerVisible}
        onClose={handleDrawerClose}
        selectedNode={selectedNode}
        onFormSubmit={handleFormSubmit}
        runResults={runResults}
      />
    </div>
  );
};

export default () => (
  <ReactFlowProvider>
    <AgentSetting />
  </ReactFlowProvider>
);