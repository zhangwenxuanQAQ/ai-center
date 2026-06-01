import React, { useState, useEffect } from 'react';
import { Modal, Select, Form, message, Spin, Slider, InputNumber, Switch, Input, Tooltip } from 'antd';
import { knowledgebaseService, KnowledgebaseDocument } from '../../services/knowledgebase';

const getTheme = () => {
  return document.body.getAttribute('data-theme') || 'dark';
};

interface ChunkConfigFieldDef {
  key: string;
  label: string;
  field_type: string;
  default: unknown;
  description: string;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
  min_value?: number;
  max_value?: number;
  step?: number;
  sub_configs?: Record<string, ChunkConfigFieldDef[]>;
}

interface DocumentConstants {
  chunk_methods: Array<{ key: string; label: string }>;
  chunk_configs: Record<string, ChunkConfigFieldDef[]>;
}

interface ChunkMethodModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (updatedDoc?: KnowledgebaseDocument) => void;
  document: KnowledgebaseDocument;
  knowledgebaseId: string;
  category?: any; // 新增：目录信息，用于回显默认配置
} 

const ChunkMethodModal: React.FC<ChunkMethodModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  document,
  knowledgebaseId,
  category,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [constants, setConstants] = useState<DocumentConstants | null>(null);
  const [availableMethods, setAvailableMethods] = useState<Array<{ key: string; label: string; is_default: boolean }>>([]);
  
  // 优先级回显逻辑：优先使用文档的切片配置，若无则使用目录的切片配置
  const getDefaultChunkMethod = () => {
    // 如果文档有切片方法，使用文档的
    if (document.chunk_method) {
      return document.chunk_method;
    }
    // 否则使用目录的切片方法
    if (category?.chunk_method) {
      return category.chunk_method;
    }
    return '';
  };
  
  const getDefaultChunkConfig = () => {
    // 如果文档有切片配置，使用文档的
    if (document.chunk_config && Object.keys(document.chunk_config).length > 0) {
      return document.chunk_config;
    }
    // 否则使用目录的切片配置
    if (category?.chunk_config) {
      return category.chunk_config;
    }
    return {};
  };
  
  const [selectedMethod, setSelectedMethod] = useState<string>(getDefaultChunkMethod());
  const [chunkConfig, setChunkConfig] = useState<Record<string, unknown>>(getDefaultChunkConfig());
  const [theme, setTheme] = useState<string>(getTheme());

  useEffect(() => {
    if (visible) {
      initModal();
      setTheme(getTheme());
    }
  }, [visible, category]);

  useEffect(() => {
    if (!document.body) return;
    
    const observer = new MutationObserver(() => {
      setTheme(getTheme());
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const initModal = async () => {
    setInitLoading(true);
    try {
      const [constantsData, methodsData] = await Promise.all([
        knowledgebaseService.getDocumentConstants(),
        knowledgebaseService.getAvailableChunkMethods(
          document.file_type || 'other',
          document.file_name
        ),
      ]);

      setConstants(constantsData);
      setAvailableMethods(methodsData.available_methods);
      
      // 优先级回显逻辑：优先使用文档的切片配置，若无则使用目录的切片配置
      const defaultMethod = getDefaultChunkMethod();
      const defaultConfig = getDefaultChunkConfig();
      
      // 合并默认配置和文档/目录配置，确保所有字段都有值
      const methodConfig = initDefaultChunkConfig(defaultMethod);
      const mergedConfig = { ...methodConfig, ...defaultConfig };
      
      setSelectedMethod(defaultMethod);
      setChunkConfig(mergedConfig);

      form.resetFields();
      form.setFieldsValue({
        chunk_method: defaultMethod,
      });
    } catch (error) {
      console.error('Failed to init chunk method modal:', error);
      message.error('初始化失败');
    } finally {
      setInitLoading(false);
    }
  };

  const initDefaultChunkConfig = (method: string) => {
    if (!constants) return {};
    const fields = constants.chunk_configs[method] || [];
    const defaultConfig: Record<string, unknown> = {};
    fields.forEach(field => {
      defaultConfig[field.key] = field.default;
      if (field.sub_configs) {
        Object.values(field.sub_configs).forEach(subFields => {
          subFields.forEach(subField => {
            defaultConfig[subField.key] = subField.default;
          });
        });
      }
    });
    return defaultConfig;
  };

  const handleMethodChange = (value: string) => {
    setSelectedMethod(value);
    const defaultConfig = initDefaultChunkConfig(value);
    setChunkConfig(defaultConfig);
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setChunkConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);

      const updatedDoc = await knowledgebaseService.updateDocument(
        knowledgebaseId,
        document.id,
        {
          chunk_method: selectedMethod,
          chunk_config: chunkConfig,
        }
      );

      message.success('修改成功');
      onSuccess(updatedDoc);
    } catch (error) {
      console.error('Failed to update chunk method:', error);
      message.error('修改失败');
    } finally {
      setLoading(false);
    }
  };

  const renderConfigField = (field: ChunkConfigFieldDef) => {
    const value = chunkConfig[field.key] ?? field.default;

    switch (field.field_type) {
      case 'slider':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Slider
              min={field.min_value}
              max={field.max_value}
              step={field.step || 1}
              value={value as number}
              onChange={v => handleConfigChange(field.key, v)}
              style={{ flex: 1 }}
            />
            <InputNumber
              min={field.min_value}
              max={field.max_value}
              step={field.step || 1}
              value={value as number}
              onChange={v => handleConfigChange(field.key, v)}
              style={{ width: 80 }}
            />
          </div>
        );
      case 'number':
        return (
          <InputNumber
            min={field.min_value}
            max={field.max_value}
            step={field.step || 1}
            value={value as number}
            onChange={v => handleConfigChange(field.key, v)}
            style={{ width: '100%' }}
          />
        );
      case 'select':
        return (
          <Select
            value={value as string}
            onChange={v => handleConfigChange(field.key, v)}
            style={{ width: '100%' }}
          >
            {field.options?.map(opt => (
              <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
            ))}
          </Select>
        );
      case 'switch':
        return (
          <Switch
            checked={value as boolean}
            onChange={v => handleConfigChange(field.key, v)}
            checkedChildren="是"
            unCheckedChildren="否"
          />
        );
      case 'input':
      default:
        return (
          <Input
            value={value as string}
            onChange={e => handleConfigChange(field.key, e.target.value)}
            placeholder={field.description || `请输入${field.label}`}
          />
        );
    }
  };

  const renderChunkConfig = () => {
    if (!constants || !selectedMethod) return null;
    const fields = constants.chunk_configs[selectedMethod] || [];
    if (fields.length === 0) {
      return null;
    }

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333' }}>
          切片配置
        </div>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
        }}>
          {fields.map(field => (
            <div key={field.key} style={{ marginBottom: 16 }}>
              <div style={{
                marginBottom: 4,
                fontSize: 13,
                color: theme === 'dark' ? '#ccc' : '#666',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                {field.label}
                {field.description && (
                  <Tooltip title={field.description}>
                    <span style={{ color: theme === 'dark' ? '#666' : '#999', fontSize: 12, cursor: 'help' }}>[?]</span>
                  </Tooltip>
                )}
              </div>
              <div style={{ width: '100%' }}>
                {renderConfigField(field)}
              </div>
              {field.sub_configs && field.field_type === 'select' && (
                <div style={{ marginTop: 12, marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` }}>
                  {field.sub_configs[chunkConfig[field.key] as string]?.map(subField => (
                    <div key={subField.key} style={{ marginBottom: 12 }}>
                      <div style={{
                        marginBottom: 4,
                        fontSize: 13,
                        color: theme === 'dark' ? '#ccc' : '#666',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {subField.label}
                        {subField.description && (
                          <Tooltip title={subField.description}>
                            <span style={{ color: theme === 'dark' ? '#666' : '#999', fontSize: 12, cursor: 'help' }}>[?]</span>
                          </Tooltip>
                        )}
                      </div>
                      <div style={{ width: '100%' }}>
                        {renderConfigField(subField)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Modal
      title="修改切片方法"
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      width={600}
      okText="确定"
      cancelText="取消"
    >
      {initLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item
            label="切片方法"
            name="chunk_method"
            rules={[{ required: true, message: '请选择切片方法' }]}
            initialValue={document.chunk_method}
          >
            <Select
              placeholder="请选择切片方法"
              value={selectedMethod}
              onChange={handleMethodChange}
              options={constants?.chunk_methods?.map(method => ({
                value: method.key,
                label: method.label,
              })) || []}
              style={{ width: '100%' }}
            />
          </Form.Item>

          {renderChunkConfig()}
        </Form>
      )}
    </Modal>
  );
};

export default ChunkMethodModal;
