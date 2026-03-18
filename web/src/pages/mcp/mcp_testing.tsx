import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Modal, message, Spin, Space, Collapse, Typography } from 'antd';
import { MCPTool } from '../../services/mcp';

const { TextArea } = Input;
const { Panel } = Collapse;
const { Text, Code } = Typography;

interface MCPTestingProps {
  tool: MCPTool;
  visible: boolean;
  onCancel: () => void;
  onTest: (tool: MCPTool, params: Record<string, any>) => Promise<any>;
}

const MCPTesting: React.FC<MCPTestingProps> = ({ tool, visible, onCancel, onTest }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string>('');
  const [params, setParams] = useState<Record<string, any>>({});

  useEffect(() => {
    if (visible && tool) {
      // 重置状态
      setTesting(false);
      setTestResult(null);
      setTestError('');
      setParams({});
      
      // 尝试从tool.config中解析参数结构
      try {
        if (tool.config) {
          const config = typeof tool.config === 'string' ? JSON.parse(tool.config) : tool.config;
          if (config.inputSchema && config.inputSchema.properties) {
            // 构建默认参数
            const defaultParams: Record<string, any> = {};
            Object.entries(config.inputSchema.properties).forEach(([key, prop]: any) => {
              if (prop.type === 'string') {
                defaultParams[key] = '';
              } else if (prop.type === 'number') {
                defaultParams[key] = 0;
              } else if (prop.type === 'boolean') {
                defaultParams[key] = false;
              } else if (prop.type === 'array') {
                defaultParams[key] = [];
              } else if (prop.type === 'object') {
                defaultParams[key] = {};
              }
            });
            setParams(defaultParams);
            form.setFieldsValue(defaultParams);
          }
        }
      } catch (error) {
        console.error('Failed to parse tool config:', error);
      }
    }
  }, [visible, tool, form]);

  const handleTest = async () => {
    try {
      let values = {};
      if (hasParameters()) {
        values = await form.validateFields();
      }
      setTesting(true);
      setTestResult(null);
      setTestError('');
      
      const result = await onTest(tool, values);
      setTestResult(result);
      message.success('测试成功');
    } catch (error: any) {
      setTestError(error.message || '测试失败');
      message.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  const hasParameters = () => {
    try {
      if (tool.config) {
        const config = typeof tool.config === 'string' ? JSON.parse(tool.config) : tool.config;
        if (config.inputSchema && config.inputSchema.properties) {
          return Object.keys(config.inputSchema.properties).length > 0;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const renderParameterFields = () => {
    try {
      if (tool.config) {
        const config = typeof tool.config === 'string' ? JSON.parse(tool.config) : tool.config;
        if (config.inputSchema && config.inputSchema.properties) {
          const fields = Object.entries(config.inputSchema.properties).map(([key, prop]: any) => {
            const title = prop.title || key;
            const description = prop.description || '';
            
            if (prop.type === 'string') {
              return (
                <Form.Item
                  key={key}
                  name={key}
                  label={
                    <Space>
                      <span>{title}</span>
                      {description && <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>}
                    </Space>
                  }
                  rules={prop.required ? [{ required: true, message: `请输入${title}` }] : []}
                >
                  <Input placeholder={`请输入${title}`} />
                </Form.Item>
              );
            } else if (prop.type === 'number') {
              return (
                <Form.Item
                  key={key}
                  name={key}
                  label={
                    <Space>
                      <span>{title}</span>
                      {description && <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>}
                    </Space>
                  }
                  rules={prop.required ? [{ required: true, message: `请输入${title}` }] : []}
                >
                  <Input type="number" placeholder={`请输入${title}`} />
                </Form.Item>
              );
            } else if (prop.type === 'boolean') {
              return (
                <Form.Item
                  key={key}
                  name={key}
                  label={
                    <Space>
                      <span>{title}</span>
                      {description && <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>}
                    </Space>
                  }
                  valuePropName="checked"
                >
                  <Input type="checkbox" />
                </Form.Item>
              );
            } else if (prop.type === 'array') {
              return (
                <Form.Item
                  key={key}
                  name={key}
                  label={
                    <Space>
                      <span>{title}</span>
                      {description && <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>}
                    </Space>
                  }
                  rules={prop.required ? [{ required: true, message: `请输入${title}` }] : []}
                >
                  <TextArea rows={3} placeholder={`请输入${title}，多个值用逗号分隔`} />
                </Form.Item>
              );
            } else if (prop.type === 'object') {
              return (
                <Form.Item
                  key={key}
                  name={key}
                  label={
                    <Space>
                      <span>{title}</span>
                      {description && <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>}
                    </Space>
                  }
                  rules={prop.required ? [{ required: true, message: `请输入${title}` }] : []}
                >
                  <TextArea rows={3} placeholder={`请输入${title}（JSON格式）`} />
                </Form.Item>
              );
            }
            return null;
          }).filter(Boolean);
          return <div>{fields}</div>;
        }
      }
      return (
        <Form.Item label="参数">
          <TextArea rows={8} placeholder="请输入工具参数（JSON格式）" />
        </Form.Item>
      );
    } catch (error) {
      return (
        <Form.Item label="参数">
          <TextArea rows={8} placeholder="请输入工具参数（JSON格式）" />
        </Form.Item>
      );
    }
  };

  return (
    <Modal
      title={`测试工具 - ${tool.title || tool.name}`}
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="test" type="primary" onClick={handleTest} loading={testing}>
          测试
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="工具信息">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <Text strong>工具名称：</Text>
              <Text>{tool.name}</Text>
            </div>
            <div>
              <Text strong>工具标题：</Text>
              <Text>{tool.title || '-'}</Text>
            </div>
            <div>
              <Text strong>工具描述：</Text>
              <Text>{tool.description || '-'}</Text>
            </div>
          </div>
        </Form.Item>
        
        {hasParameters() && (
          <Form.Item label="参数配置">
            {renderParameterFields()}
          </Form.Item>
        )}
      </Form>
      
      <div style={{ marginTop: 24 }}>
        <h4 style={{ marginBottom: 12 }}>测试结果</h4>
        {testError ? (
          <div style={{ 
            padding: 12, 
            borderRadius: 4, 
            background: document.body.getAttribute('data-theme') === 'dark' ? '#3a1a1a' : '#fff2f0', 
            border: document.body.getAttribute('data-theme') === 'dark' ? '1px solid #ff4d4f' : '1px solid #ffccc7', 
            color: document.body.getAttribute('data-theme') === 'dark' ? '#ff8a80' : '#cf1322' 
          }}>
            <Text type="danger">{testError}</Text>
          </div>
        ) : testResult ? (
          <Collapse defaultActiveKey={['result']}>
            <Panel header="结果" key="result">
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                background: document.body.getAttribute('data-theme') === 'dark' ? '#2c2c2c' : '#f5f5f5', 
                color: document.body.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333',
                padding: '12px', 
                borderRadius: '4px', 
                margin: 0, 
                fontFamily: 'monospace' 
              }}>
                <code>{JSON.stringify(testResult, null, 2)}</code>
              </pre>
            </Panel>
          </Collapse>
        ) : (
          <div style={{ 
            padding: 12, 
            borderRadius: 4, 
            background: document.body.getAttribute('data-theme') === 'dark' ? '#1a3a1a' : '#f6ffed', 
            border: document.body.getAttribute('data-theme') === 'dark' ? '1px solid #52c41a' : '1px solid #b7eb8f', 
            color: document.body.getAttribute('data-theme') === 'dark' ? '#95de64' : '#389e0d' 
          }}>
            <Text type="success">{hasParameters() ? '请输入参数并点击测试按钮' : '点击测试按钮开始测试'}</Text>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MCPTesting;