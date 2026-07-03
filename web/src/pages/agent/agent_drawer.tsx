import React, { useState, useEffect } from 'react';
import { Drawer, Tabs, Form, Input, Divider, Empty, Spin, Timeline, Select, InputNumber, Switch, Tooltip } from 'antd';
import { PlayCircleOutlined, FileTextOutlined, ClockCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { getComponentIcon, getDefaultComponentIcon } from '../../utils/component_icon';
import { agentService, AgentComponent } from '../../services/agent';

const { TextArea } = Input;
const { TabPane } = Tabs;

interface ComponentParamField {
  key: string;
  label: string;
  type: string;
  description?: string;
  defaultValue?: any;
}

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
  const [component, setComponent] = useState<AgentComponent | null>(null);

  React.useEffect(() => {
    if (container) {
      setDrawerContainer(container);
    }
  }, [container]);

  React.useEffect(() => {
    if (selectedNode && visible) {
      const fetchComponent = async () => {
        try {
          const componentLabel = selectedNode.data?.label;
          if (componentLabel) {
            const data = await agentService.getComponentByName(componentLabel);
            setComponent(data);
            
            // 提取默认值：优先从 component_param_field 获取，其次从 default_params 获取
            const defaultValues: Record<string, any> = {};
            const paramFields = data?.component_param_field || {};
            const defaultParams = data?.default_params || {};
            
            // 先从 component_param_field 获取默认值
            Object.values(paramFields).forEach((field: any) => {
              if (field.defaultValue !== undefined) {
                defaultValues[field.key] = field.defaultValue;
              }
            });
            
            // 再从 default_params 补充（未在 component_param_field 中定义的字段）
            Object.entries(defaultParams).forEach(([key, value]) => {
              if (!(key in defaultValues) && value !== undefined) {
                defaultValues[key] = value;
              }
            });
            // 合并已有表单数据和默认值
            form.setFieldsValue({
              form: {
                ...defaultValues,
                ...selectedNode.data?.form,
              },
            });
          }
        } catch (error) {
          console.error('Failed to fetch component:', error);
        }
      };
      fetchComponent();
    }
  }, [selectedNode, visible, form]);

  const renderFieldControl = (field: ComponentParamField) => {
    const { type, description, defaultValue } = field;
    
    switch (type) {
      case 'text':
        return <Input placeholder={description} />;
      case 'textarea':
        return <TextArea rows={3} placeholder={description} />;
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={description} />;
      case 'boolean':
        return <Switch defaultChecked={defaultValue === true} />;
      case 'select':
        return <Select placeholder={description} style={{ width: '100%' }} />;
      case 'select-multiple':
        return <Select mode="multiple" placeholder={description} style={{ width: '100%' }} />;
      case 'password':
        return <Input.Password placeholder={description} />;
      case 'code-editor':
        return <TextArea rows={10} placeholder={description} style={{ fontFamily: 'monospace' }} />;
      case 'custom':
        return <TextArea rows={5} placeholder={description || '自定义配置'} />;
      default:
        return <Input placeholder={description} />;
    }
  };

  const renderFieldLabel = (field: ComponentParamField) => {
    const { label, description } = field;
    
    if (description) {
      return (
        <span>
          {label}{' '}
          <Tooltip title={description}>
            <QuestionCircleOutlined style={{ color: '#999', fontSize: '12px', marginLeft: '4px' }} />
          </Tooltip>
        </span>
      );
    }
    
    return label;
  };

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
    const paramFields = component?.component_param_field || {};
    
    return (
      <Form form={form} layout="vertical">
        {Object.keys(paramFields).length > 0 ? (
          Object.entries(paramFields).map(([fieldName, field]: [string, any]) => (
            <Form.Item
              key={fieldName}
              name={['form', field.key]}
              label={renderFieldLabel(field)}
              valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
            >
              {renderFieldControl(field)}
            </Form.Item>
          ))
        ) : (
          <Empty description="该节点没有配置项" />
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
    const displayDescription = nodeDescription || component?.description || '';
    
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
