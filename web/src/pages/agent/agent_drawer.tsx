import React, { useState, useEffect } from 'react';
import { Drawer, Tabs, Form, Input, Divider, Empty, Spin, Timeline } from 'antd';
import { PlayCircleOutlined, FileTextOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getComponentIcon, getDefaultComponentIcon } from '../../utils/component_icon';
import { agentService, AgentComponent } from '../../services/agent';

const { TextArea } = Input;
const { TabPane } = Tabs;

interface AgentDrawerProps {
  visible: boolean;
  onClose: () => void;
  selectedNode: any;
  onFormSubmit: (values: any) => void;
  runResults?: RunResult[];
  container?: HTMLElement | null;
}

interface RunResult {
  timestamp: string;
  type: 'input' | 'output' | 'log' | 'error';
  content: string;
}

const AgentDrawer: React.FC<AgentDrawerProps> = ({
  visible,
  onClose,
  selectedNode,
  onFormSubmit,
  runResults = [],
  container,
}) => {
  const [form] = Form.useForm();
  const [drawerContainer, setDrawerContainer] = React.useState<HTMLElement | null>(null);
  const [components, setComponents] = useState<AgentComponent[]>([]);

  React.useEffect(() => {
    if (container) {
      setDrawerContainer(container);
    }
  }, [container]);

  React.useEffect(() => {
    if (selectedNode && visible) {
      form.setFieldsValue({
        name: selectedNode.data?.name || '',
        description: selectedNode.data?.description || '',
        ...selectedNode.data?.form,
      });
    }
  }, [selectedNode, visible, form]);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const data = await agentService.getComponents();
        setComponents(data);
      } catch (error) {
        console.error('Failed to fetch components:', error);
      }
    };
    fetchComponents();
  }, []);

  const renderRunResults = () => {
    if (runResults.length === 0) {
      return (
        <Empty 
          description="暂无运行结果" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <Timeline>
        {runResults.map((result, index) => (
          <Timeline.Item
            key={index}
            color={result.type === 'error' ? 'red' : result.type === 'output' ? 'green' : 'blue'}
            dot={
              result.type === 'input' ? <PlayCircleOutlined /> :
              result.type === 'output' ? <FileTextOutlined /> :
              <ClockCircleOutlined />
            }
          >
            <div style={{ marginBottom: '4px' }}>
              <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                {result.type}
              </span>
              <span style={{ marginLeft: '8px', color: '#999', fontSize: '12px' }}>
                {result.timestamp}
              </span>
            </div>
            <div style={{ 
              padding: '8px', 
              background: '#f5f5f5', 
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {result.content}
            </div>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  const renderNodeConfig = () => {
    const nodeType = selectedNode?.type || selectedNode?.data?.label;
    
    return (
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="节点名称" rules={[{ required: true }]}>
          <Input placeholder="请输入节点名称" />
        </Form.Item>
        <Form.Item name="description" label="节点描述">
          <TextArea rows={3} placeholder="请输入节点描述" />
        </Form.Item>
        
        <Divider>节点配置</Divider>
        
        {nodeType === 'Begin' && (
          <Form.Item name={['form', 'prologue']} label="欢迎语">
            <TextArea rows={3} placeholder="请输入欢迎语" />
          </Form.Item>
        )}
        
        {nodeType === 'Generate' && (
          <>
            <Form.Item name={['form', 'llm_id']} label="LLM模型">
              <Input placeholder="请选择LLM模型" />
            </Form.Item>
            <Form.Item name={['form', 'prompt']} label="提示词">
              <TextArea rows={6} placeholder="请输入提示词" />
            </Form.Item>
            <Form.Item name={['form', 'temperature']} label="Temperature">
              <Input type="number" step="0.1" placeholder="0.0 - 2.0" />
            </Form.Item>
          </>
        )}
        
        {nodeType === 'Retrieval' && (
          <>
            <Form.Item name={['form', 'kb_ids']} label="知识库">
              <Input placeholder="请选择知识库" />
            </Form.Item>
            <Form.Item name={['form', 'top_n']} label="返回数量">
              <Input type="number" placeholder="Top N" />
            </Form.Item>
          </>
        )}
      </Form>
    );
  };

  const renderDrawerTitle = () => {
    if (!selectedNode) {
      return <span>节点配置</span>;
    }
    
    const nodeLabel = selectedNode.data?.label || selectedNode.type || 'Node';
    const rawName = selectedNode.data?.name || nodeLabel;
    const displayName = rawName === 'begin' ? '开始' : rawName;
    
    const nodeDescription = selectedNode.data?.description || '';
    const componentInfo = components.find(
      c => c.component_name === nodeLabel || c.component_title === nodeLabel
    );
    const displayDescription = nodeDescription || componentInfo?.description || '';
    
    const iconSrc = getComponentIcon(nodeLabel);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={iconSrc}
            alt={displayName}
            style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 4 }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== getDefaultComponentIcon()) {
                target.src = getDefaultComponentIcon();
              }
            }}
          />
          <span style={{ fontSize: '15px', fontWeight: 600 }}>{displayName}</span>
        </div>
        {displayDescription && (
          <div style={{ fontSize: '12px', color: '#8c8c8c', lineHeight: 1.4, textAlign: 'left' }}>
            {displayDescription}
          </div>
        )}
      </div>
    );
  };

  return (
    <Drawer
      title={renderDrawerTitle()}
      placement="right"
      width={500}
      open={visible}
      onClose={onClose}
      mask={false}
      getContainer={false}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        overflow: 'hidden'
      }}
      styles={{
        wrapper: {
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        },
        body: {
          borderRadius: '12px',
          padding: '12px'
        },
        header: {
          position: 'relative',
          paddingRight: '40px'
        }
      }}
    >
      <Tabs defaultActiveKey="1">
        <TabPane tab="节点配置" key="1">
          {selectedNode ? renderNodeConfig() : <Empty description="请选择节点" />}
        </TabPane>
        <TabPane tab="运行结果" key="2">
          {renderRunResults()}
        </TabPane>
      </Tabs>
    </Drawer>
  );
};

export default AgentDrawer;
