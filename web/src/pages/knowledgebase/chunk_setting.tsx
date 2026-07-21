import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, Tag, message, Spin, Select, InputNumber, DatePicker, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import { knowledgebaseService } from '../../services/knowledgebase';
import dayjs from 'dayjs';
import zhCN from 'antd/es/date-picker/locale/zh_CN';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface MetadataFieldType {
  key: string;
  label: string;
  es_type: string;
  type: string;
}

interface MetadataItem {
  field_name: string;
  field_label: string;
  field_type: string;
  field_value: any;
}

interface ChunkSettingProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (chunk?: any) => void;
  knowledgebaseId: string;
  documentId: string;
  chunk?: any;
  mode: 'create' | 'edit';
}

const ChunkSetting: React.FC<ChunkSettingProps> = ({
  visible,
  onCancel,
  onSuccess,
  knowledgebaseId,
  documentId,
  chunk,
  mode,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [metadataItems, setMetadataItems] = useState<MetadataItem[]>([]);
  const [fieldTypes, setFieldTypes] = useState<MetadataFieldType[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.document.body) return;

    const currentTheme = window.document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'dark' | 'light');

    const observer = new MutationObserver(() => {
      if (!window.document.body) return;
      const newTheme = window.document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'dark' | 'light');
    });

    observer.observe(window.document.body, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  const fetchFieldTypes = async () => {
    try {
      const data = await knowledgebaseService.getDocumentConstants();
      setFieldTypes(data.metadata_field_types || []);
    } catch (error) {
      console.error('Failed to fetch field types:', error);
    }
  };

  const inferFieldType = (value: any): string => {
    if (value === null || value === undefined) return 'text';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'float';
    }
    if (typeof value === 'string') {
      if (dayjs(value).isValid()) return 'date';
      return 'text';
    }
    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        return Number.isInteger(value[0]) ? 'integer_range' : 'float_range';
      }
      return 'array';
    }
    if (typeof value === 'object') return 'object';
    return 'text';
  };

  const loadDocumentMetadataSchema = async () => {
    if (!knowledgebaseId || !documentId) return;
    setMetadataLoading(true);
    try {
      const doc = await knowledgebaseService.getDocument(knowledgebaseId, documentId);
      const items: MetadataItem[] = [];
      const addedFields = new Set<string>();

      let chunkMetadatas: Record<string, any> = {};
      if (mode === 'edit' && chunk?.metadatas) {
        chunkMetadatas = typeof chunk.metadatas === 'string'
          ? JSON.parse(chunk.metadatas)
          : chunk.metadatas;
      }

      let docMetadatas: Record<string, any> = {};
      if (doc?.metadatas) {
        docMetadatas = typeof doc.metadatas === 'string'
          ? JSON.parse(doc.metadatas)
          : doc.metadatas;
      }

      let schema: Record<string, any> = {};
      if (chunkMetadatas && chunkMetadatas._schema) {
        schema = chunkMetadatas._schema;
      } else if (docMetadatas && docMetadatas._schema) {
        schema = docMetadatas._schema;
      }

      for (const [key, fieldSchema] of Object.entries(schema)) {
        const fs = fieldSchema as any;
        const chunkValue = chunkMetadatas && chunkMetadatas[key] !== undefined
          ? chunkMetadatas[key]
          : (docMetadatas[key] !== undefined ? docMetadatas[key] : getDefaultValue(fs.type || 'text'));
        items.push({
          field_name: key,
          field_label: fs.label || key,
          field_type: fs.type || 'text',
          field_value: chunkValue,
        });
        addedFields.add(key);
      }

      for (const [key, value] of Object.entries(chunkMetadatas)) {
        if (key === '_schema' || addedFields.has(key)) continue;
        const inferredType = inferFieldType(value);
        items.push({
          field_name: key,
          field_label: key,
          field_type: inferredType,
          field_value: value,
        });
        addedFields.add(key);
      }

      setMetadataItems(items);
    } catch (error) {
      console.error('Failed to load document metadata:', error);
    } finally {
      setMetadataLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchFieldTypes();
      if (mode === 'edit' && chunk) {
        setContent(chunk.content_with_weight || '');
        setKeywords(chunk.important_kwd || []);
        form.setFieldsValue({
          available_int: chunk.available_int === 1,
        });
      } else {
        setContent('');
        setKeywords([]);
        form.setFieldsValue({
          available_int: true,
        });
      }
      loadDocumentMetadataSchema();
    }
  }, [visible, mode, chunk, form, knowledgebaseId, documentId]);

  const getDefaultValue = (fieldType: string): any => {
    switch (fieldType) {
      case 'boolean': return false;
      case 'long': case 'integer': return 0;
      case 'float': case 'double': return 0.0;
      case 'date': return null;
      case 'object': return '{}';
      case 'array': return '[]';
      case 'integer_range': case 'long_range': return [0, 0];
      case 'float_range': return [0.0, 0.0];
      case 'date_range': return null;
      default: return '';
    }
  };

  const handleMetadataChange = (index: number, value: any) => {
    const newItems = [...metadataItems];
    newItems[index] = { ...newItems[index], field_value: value };
    setMetadataItems(newItems);
  };

  const renderValueInput = (item: MetadataItem, index: number) => {
    const inputHeight = 32;
    const valueStyle = {
      background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
      color: theme === 'dark' ? '#fff' : '#000',
      height: inputHeight,
    };

    switch (item.field_type) {
      case 'boolean':
        return (
          <Select
            value={item.field_value}
            onChange={(v) => handleMetadataChange(index, v)}
            style={{ width: '100%', height: inputHeight }}
          >
            <Option value={true}>true</Option>
            <Option value={false}>false</Option>
          </Select>
        );
      case 'long':
      case 'integer':
        return (
          <InputNumber
            value={item.field_value}
            onChange={(v) => handleMetadataChange(index, v)}
            style={{ width: '100%', height: inputHeight }}
            precision={0}
          />
        );
      case 'float':
      case 'double':
        return (
          <InputNumber
            value={item.field_value}
            onChange={(v) => handleMetadataChange(index, v)}
            style={{ width: '100%', height: inputHeight }}
            step={0.01}
          />
        );
      case 'date':
        return (
          <DatePicker
            value={item.field_value ? dayjs(item.field_value) : null}
            onChange={(_, dateString) => handleMetadataChange(index, dateString)}
            style={{ width: '100%', height: inputHeight }}
            showTime
            locale={zhCN}
          />
        );
      case 'integer_range':
      case 'long_range':
        return (
          <Space style={{ width: '100%' }}>
            <InputNumber
              value={Array.isArray(item.field_value) ? item.field_value[0] : 0}
              onChange={(v) => handleMetadataChange(index, [v || 0, Array.isArray(item.field_value) ? item.field_value[1] : 0])}
              precision={0}
              placeholder="最小值"
              style={{ height: inputHeight, flex: 1 }}
            />
            <span style={{ color: theme === 'dark' ? '#aaa' : '#999', alignSelf: 'center' }}>~</span>
            <InputNumber
              value={Array.isArray(item.field_value) ? item.field_value[1] : 0}
              onChange={(v) => handleMetadataChange(index, [Array.isArray(item.field_value) ? item.field_value[0] : 0, v || 0])}
              precision={0}
              placeholder="最大值"
              style={{ height: inputHeight, flex: 1 }}
            />
          </Space>
        );
      case 'float_range':
        return (
          <Space style={{ width: '100%' }}>
            <InputNumber
              value={Array.isArray(item.field_value) ? item.field_value[0] : 0}
              onChange={(v) => handleMetadataChange(index, [v || 0, Array.isArray(item.field_value) ? item.field_value[1] : 0])}
              step={0.01}
              placeholder="最小值"
              style={{ height: inputHeight, flex: 1 }}
            />
            <span style={{ color: theme === 'dark' ? '#aaa' : '#999', alignSelf: 'center' }}>~</span>
            <InputNumber
              value={Array.isArray(item.field_value) ? item.field_value[1] : 0}
              onChange={(v) => handleMetadataChange(index, [Array.isArray(item.field_value) ? item.field_value[0] : 0, v || 0])}
              step={0.01}
              placeholder="最大值"
              style={{ height: inputHeight, flex: 1 }}
            />
          </Space>
        );
      case 'date_range':
        return (
          <RangePicker
            value={item.field_value ? [dayjs(item.field_value[0]), dayjs(item.field_value[1])] : null}
            onChange={(_, dateStrings) => handleMetadataChange(index, dateStrings)}
            style={{ width: '100%', height: inputHeight }}
            showTime
            locale={zhCN}
          />
        );
      case 'object':
        return (
          <Input
            value={typeof item.field_value === 'string' ? item.field_value : JSON.stringify(item.field_value)}
            onChange={(e) => handleMetadataChange(index, e.target.value)}
            placeholder='{"key": "value"}'
            style={valueStyle}
          />
        );
      case 'array':
        return (
          <Input
            value={typeof item.field_value === 'string' ? item.field_value : JSON.stringify(item.field_value)}
            onChange={(e) => handleMetadataChange(index, e.target.value)}
            placeholder='["item1", "item2"]'
            style={valueStyle}
          />
        );
      default:
        return (
          <Input
            value={item.field_value}
            onChange={(e) => handleMetadataChange(index, e.target.value)}
            placeholder="请输入值"
            style={valueStyle}
          />
        );
    }
  };

  const buildMetadatasForSave = (): Record<string, any> | undefined => {
    if (metadataItems.length === 0) return undefined;

    const metadatas: Record<string, any> = {};
    for (const item of metadataItems) {
      let value = item.field_value;
      if (item.field_type === 'object' || item.field_type === 'array') {
        try {
          value = typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          message.error(`字段 "${item.field_label}" 的值格式不正确`);
          return undefined;
        }
      }
      metadatas[item.field_name] = value;
    }
    return metadatas;
  };

  const handleOk = async () => {
    if (!content || !content.trim()) {
      message.error('切片内容不能为空');
      return;
    }

    const metadatas = buildMetadatasForSave();
    if (metadatas === undefined && metadataItems.length > 0) {
      return;
    }

    setLoading(true);
    try {
      const values = await form.validateFields();
      const available_int = values.available_int ? 1 : 0;

      if (mode === 'create') {
        const result = await knowledgebaseService.createChunk(
          knowledgebaseId,
          documentId,
          content,
          keywords.length > 0 ? keywords : undefined,
          available_int,
          metadatas
        );
        message.success('切片创建成功');
        onSuccess(result);
      } else {
        const result = await knowledgebaseService.updateChunk(
          knowledgebaseId,
          chunk._id,
          content,
          keywords.length > 0 ? keywords : undefined,
          available_int,
          metadatas
        );
        message.success('切片更新成功');
        onSuccess(result);
      }

      handleCancel();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setContent('');
    setKeywords([]);
    setInputVisible(false);
    setInputValue('');
    setMetadataItems([]);
    onCancel();
  };

  const handleCloseTag = (removedTag: string) => {
    setKeywords(keywords.filter(tag => tag !== removedTag));
  };

  const showInput = () => {
    setInputVisible(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputConfirm = () => {
    if (inputValue && !keywords.includes(inputValue)) {
      setKeywords([...keywords, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  return (
    <Modal
      title={mode === 'create' ? '新增切片' : '编辑切片'}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
      confirmLoading={loading}
      okText="确定"
      cancelText="取消"
      bodyStyle={{
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ available_int: true }}
      >
        <Form.Item label="切片内容" required>
          <div
            style={{
              border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : '#d9d9d9'}`,
              borderRadius: 4,
              overflow: 'hidden'
            }}
          >
            <MDEditor
              value={content}
              onChange={(value) => setContent(value || '')}
              height={300}
              preview="edit"
              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
              style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
              }}
            />
          </div>
        </Form.Item>

        <Form.Item label="关键词">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {keywords.map((tag) => (
              <Tag
                key={tag}
                closable
                onClose={() => handleCloseTag(tag)}
                style={{
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#fafafa',
                  border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#d9d9d9'}`,
                  color: theme === 'dark' ? '#fff' : '#333',
                }}
              >
                {tag}
              </Tag>
            ))}
            {inputVisible && (
              <Input
                type="text"
                size="small"
                style={{ width: 100 }}
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputConfirm}
                onPressEnter={handleInputConfirm}
                autoFocus
              />
            )}
            {!inputVisible && (
              <Tag
                onClick={showInput}
                style={{
                  background: 'transparent',
                  border: `1px dashed ${theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#d9d9d9'}`,
                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : '#666',
                  cursor: 'pointer',
                }}
              >
                <PlusOutlined /> 添加关键词
              </Tag>
            )}
          </div>
        </Form.Item>

        {metadataItems.length > 0 && (
          <Form.Item label="元数据">
            <Spin spinning={metadataLoading}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {metadataItems.map((item, index) => (
                  <div key={item.field_name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 120, color: theme === 'dark' ? '#aaa' : '#666', fontSize: 14 }}>
                      {item.field_label}
                    </div>
                    <div style={{ flex: 1 }}>
                      {renderValueInput(item, index)}
                    </div>
                  </div>
                ))}
              </div>
            </Spin>
          </Form.Item>
        )}

        <Form.Item
          name="available_int"
          label="是否启用"
          valuePropName="checked"
        >
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChunkSetting;
