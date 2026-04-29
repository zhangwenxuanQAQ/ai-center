import React, { useState, useEffect } from 'react';
import { Modal, Select, Form, message, Spin } from 'antd';
import { knowledgebaseService, KnowledgebaseDocument } from '../../services/knowledgebase';

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
  onSuccess: () => void;
  document: KnowledgebaseDocument;
  knowledgebaseId: string;
}

const ChunkMethodModal: React.FC<ChunkMethodModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  document,
  knowledgebaseId,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [constants, setConstants] = useState<DocumentConstants | null>(null);
  const [availableMethods, setAvailableMethods] = useState<Array<{ key: string; label: string; is_default: boolean }>>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>(document.chunk_method);
  const [chunkConfig, setChunkConfig] = useState<Record<string, unknown>>(
    document.chunk_config || {}
  );

  useEffect(() => {
    if (visible) {
      initModal();
    }
  }, [visible]);

  useEffect(() => {
    if (selectedMethod && constants) {
      initDefaultChunkConfig(selectedMethod);
    }
  }, [selectedMethod, constants]);

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
      setSelectedMethod(document.chunk_method);
      setChunkConfig(document.chunk_config || {});

      form.resetFields();
      form.setFieldsValue({
        chunk_method: document.chunk_method,
        ...(document.chunk_config || {}),
      });
    } catch (error) {
      console.error('Failed to init chunk method modal:', error);
      message.error('初始化失败');
    } finally {
      setInitLoading(false);
    }
  };

  const initDefaultChunkConfig = (method: string) => {
    if (!constants) return;
    const fields = constants.chunk_configs[method] || [];
    const defaultConfig: Record<string, unknown> = {};
    fields.forEach(field => {
      if (chunkConfig[field.key] !== undefined) {
        defaultConfig[field.key] = chunkConfig[field.key];
      } else {
        defaultConfig[field.key] = field.default;
      }
      if (field.sub_configs) {
        Object.values(field.sub_configs).forEach(subFields => {
          subFields.forEach(subField => {
            if (chunkConfig[subField.key] !== undefined) {
              defaultConfig[subField.key] = chunkConfig[subField.key];
            } else {
              defaultConfig[subField.key] = subField.default;
            }
          });
        });
      }
    });
    setChunkConfig(defaultConfig);
  };

  const handleMethodChange = (value: string) => {
    setSelectedMethod(value);
    form.setFieldValue('chunk_method', value);
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setChunkConfig(prev => ({ ...prev, [key]: value }));
    form.setFieldValue(key, value);
  };

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);

      await knowledgebaseService.updateDocument(
        knowledgebaseId,
        document.id,
        {
          chunk_method: selectedMethod,
          chunk_config: chunkConfig,
        }
      );

      message.success('修改成功');
      onSuccess();
    } catch (error) {
      console.error('Failed to update chunk method:', error);
      message.error('修改失败');
    } finally {
      setLoading(false);
    }
  };

  const renderChunkConfig = () => {
    if (!constants || !selectedMethod) return null;
    const fields = constants.chunk_configs[selectedMethod] || [];
    if (fields.length === 0) {
      return null;
    }

    return fields.map(field => {
      const label = (
        <span>
          {field.label}
          {field.required && <span style={{ color: '#ff4d4f' }}> *</span>}
        </span>
      );

      switch (field.field_type) {
        case 'string':
          return (
            <Form.Item key={field.key} label={label} name={field.key} rules={field.required ? [{ required: true, message: '请输入' }] : []}>
              <Select
                options={field.options}
                placeholder={`请选择${field.label}`}
                onChange={(value) => handleConfigChange(field.key, value)}
                style={{ width: '100%' }}
              />
            </Form.Item>
          );
        case 'number':
          return (
            <Form.Item key={field.key} label={label} name={field.key} rules={field.required ? [{ required: true, message: '请输入' }] : []}>
              <Select
                options={field.options}
                placeholder={`请选择${field.label}`}
                onChange={(value) => handleConfigChange(field.key, value)}
                style={{ width: '100%' }}
              />
            </Form.Item>
          );
        case 'boolean':
          return (
            <Form.Item key={field.key} label={label} name={field.key} valuePropName="checked" rules={field.required ? [{ required: true, message: '请选择' }] : []}>
              <Select
                options={field.options}
                placeholder={`请选择${field.label}`}
                onChange={(value) => handleConfigChange(field.key, value)}
                style={{ width: '100%' }}
              />
            </Form.Item>
          );
        default:
          return null;
      }
    });
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
        <Form form={form} layout="vertical" initialValues={{ chunk_method: document.chunk_method, ...(document.chunk_config || {}) }}>
          <Form.Item
            label="切片方法"
            name="chunk_method"
            rules={[{ required: true, message: '请选择切片方法' }]}
          >
            <Select
              placeholder="请选择切片方法"
              value={selectedMethod}
              onChange={handleMethodChange}
              options={availableMethods.map(method => ({
                value: method.key,
                label: method.label,
              }))}
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
