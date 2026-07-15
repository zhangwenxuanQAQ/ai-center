import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, Input, InputNumber, DatePicker, Space, message, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { KnowledgebaseDocument } from '../../services/knowledgebase';
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
  related_header?: string; // 关联表头
}

interface MetadataModalProps {
  visible: boolean;
  document: KnowledgebaseDocument | null;
  knowledgebaseId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

const MetadataModal: React.FC<MetadataModalProps> = ({ visible, document, knowledgebaseId, onCancel, onSuccess }) => {
  const [theme, setTheme] = useState<string>('dark');
  const [loading, setLoading] = useState(false);
  const [metadataItems, setMetadataItems] = useState<MetadataItem[]>([]);
  const [fieldTypes, setFieldTypes] = useState<MetadataFieldType[]>([]);

  useEffect(() => {
    const currentTheme = window.document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'dark' | 'light');
    const observer = new MutationObserver(() => {
      const newTheme = window.document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'dark' | 'light');
    });
    observer.observe(window.document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visible) {
      fetchFieldTypes();
      loadMetadata();
    }
  }, [visible, document]);

  const fetchFieldTypes = async () => {
    try {
      const data = await knowledgebaseService.getDocumentConstants();
      setFieldTypes(data.metadata_field_types || []);
    } catch (error) {
      console.error('Failed to fetch field types:', error);
    }
  };

  const loadMetadata = () => {
    if (document?.metadatas) {
      const metadatas = typeof document.metadatas === 'string'
        ? JSON.parse(document.metadatas)
        : document.metadatas;
      if (typeof metadatas === 'object' && metadatas !== null) {
        const items: MetadataItem[] = [];
        const schema = metadatas._schema || {};
        for (const [key, value] of Object.entries(metadatas)) {
          if (key === '_schema') continue;
          const fieldSchema = schema[key] || {};
          items.push({
            field_name: key,
            field_label: fieldSchema.label || '',
            field_type: fieldSchema.type || 'text',
            field_value: value,
            related_header: fieldSchema.related_header || '',
          });
        }
        setMetadataItems(items);
      } else {
        setMetadataItems([]);
      }
    } else {
      setMetadataItems([]);
    }
  };

  const handleAddItem = () => {
    setMetadataItems([...metadataItems, { field_name: '', field_label: '', field_type: 'text', field_value: '', related_header: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setMetadataItems(metadataItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof MetadataItem, value: any) => {
    const newItems = [...metadataItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'field_type') {
      newItems[index].field_value = getDefaultValue(value);
    }
    setMetadataItems(newItems);
  };

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

  const getControlType = (fieldType: string): string => {
    const ft = fieldTypes.find(f => f.key === fieldType);
    return ft?.type || 'input';
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
            onChange={(v) => handleItemChange(index, 'field_value', v)}
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
            onChange={(v) => handleItemChange(index, 'field_value', v)}
            style={{ width: '100%', height: inputHeight }}
            precision={0}
          />
        );
      case 'float':
      case 'double':
        return (
          <InputNumber
            value={item.field_value}
            onChange={(v) => handleItemChange(index, 'field_value', v)}
            style={{ width: '100%', height: inputHeight }}
            step={0.01}
          />
        );
      case 'date':
        return (
          <DatePicker
            value={item.field_value ? dayjs(item.field_value) : null}
            onChange={(_, dateString) => handleItemChange(index, 'field_value', dateString)}
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
              onChange={(v) => handleItemChange(index, 'field_value', [v || 0, Array.isArray(item.field_value) ? item.field_value[1] : 0])}
              precision={0}
              placeholder="最小值"
              style={{ height: inputHeight, flex: 1 }}
            />
            <span style={{ color: theme === 'dark' ? '#aaa' : '#999', alignSelf: 'center' }}>~</span>
            <InputNumber
              value={Array.isArray(item.field_value) ? item.field_value[1] : 0}
              onChange={(v) => handleItemChange(index, 'field_value', [Array.isArray(item.field_value) ? item.field_value[0] : 0, v || 0])}
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
              onChange={(v) => handleItemChange(index, 'field_value', [v || 0, Array.isArray(item.field_value) ? item.field_value[1] : 0])}
              step={0.01}
              placeholder="最小值"
              style={{ height: inputHeight, flex: 1 }}
            />
            <span style={{ color: theme === 'dark' ? '#aaa' : '#999', alignSelf: 'center' }}>~</span>
            <InputNumber
              value={Array.isArray(item.field_value) ? item.field_value[1] : 0}
              onChange={(v) => handleItemChange(index, 'field_value', [Array.isArray(item.field_value) ? item.field_value[0] : 0, v || 0])}
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
            onChange={(_, dateStrings) => handleItemChange(index, 'field_value', dateStrings)}
            style={{ width: '100%', height: inputHeight }}
            showTime
            locale={zhCN}
          />
        );
      case 'object':
        return (
          <Input
            value={typeof item.field_value === 'string' ? item.field_value : JSON.stringify(item.field_value)}
            onChange={(e) => handleItemChange(index, 'field_value', e.target.value)}
            placeholder='{"key": "value"}'
            style={valueStyle}
          />
        );
      case 'array':
        return (
          <Input
            value={typeof item.field_value === 'string' ? item.field_value : JSON.stringify(item.field_value)}
            onChange={(e) => handleItemChange(index, 'field_value', e.target.value)}
            placeholder='["item1", "item2"]'
            style={valueStyle}
          />
        );
      default:
        return (
          <Input
            value={item.field_value}
            onChange={(e) => handleItemChange(index, 'field_value', e.target.value)}
            placeholder="请输入值"
            style={valueStyle}
          />
        );
    }
  };

  const handleSave = async () => {
    const fieldNames = metadataItems.map(item => item.field_name).filter(name => name);
    const uniqueNames = new Set(fieldNames);
    if (uniqueNames.size !== fieldNames.length) {
      message.error('字段名称不能重复');
      return;
    }

    const hasEmptyName = metadataItems.some(item => !item.field_name.trim());
    if (hasEmptyName) {
      message.error('字段名称不能为空');
      return;
    }

    const metadatas: Record<string, any> = {};
    const schema: Record<string, { type: string; label: string; related_header?: string }> = {};

    for (const item of metadataItems) {
      let value = item.field_value;
      if (item.field_type === 'object' || item.field_type === 'array') {
        try {
          value = JSON.parse(value);
        } catch {
          message.error(`字段 "${item.field_name}" 的值格式不正确`);
          return;
        }
      }
      metadatas[item.field_name] = value;
      schema[item.field_name] = {
        type: item.field_type,
        label: item.field_label,
        related_header: item.related_header || '',
      };
    }
    metadatas._schema = schema;

    setLoading(true);
    try {
      await knowledgebaseService.updateDocumentMetadata(knowledgebaseId, document!.id, metadatas);
      message.success('元数据更新成功');
      onSuccess();
    } catch (error) {
      console.error('Failed to update metadata:', error);
      message.error('元数据更新失败');
    } finally {
      setLoading(false);
    }
  };

  const inputHeight = 32;
  const inputStyle = {
    background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
    color: theme === 'dark' ? '#fff' : '#000',
    height: inputHeight,
  };

  return (
    <Modal
      title="设置元数据"
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={loading} onClick={handleSave}>
          保存
        </Button>,
      ]}
      className={theme === 'dark' ? 'dark' : 'light'}
      bodyStyle={{ padding: '16px', overflowX: 'hidden' }}
    >
      <div style={{ maxHeight: 450, overflowY: 'auto', paddingRight: '8px' }}>
        {metadataItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: theme === 'dark' ? '#aaa' : '#999' }}>
            暂无元数据，点击下方按钮添加
          </div>
        ) : (
          <div>
            <Row gutter={8} style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#aaa' : '#666' }}>
              <Col span={3}><div style={{ height: inputHeight, display: 'flex', alignItems: 'center' }}>字段名称</div></Col>
              <Col span={3}><div style={{ height: inputHeight, display: 'flex', alignItems: 'center' }}>字段中文名</div></Col>
              <Col span={3}><div style={{ height: inputHeight, display: 'flex', alignItems: 'center' }}>字段类型</div></Col>
              <Col span={3}><div style={{ height: inputHeight, display: 'flex', alignItems: 'center' }}>关联表头</div></Col>
              <Col span={10}><div style={{ height: inputHeight, display: 'flex', alignItems: 'center' }}>字段值</div></Col>
              <Col span={2}></Col>
            </Row>
            {metadataItems.map((item, index) => (
              <Row key={index} gutter={8} style={{ marginBottom: 8 }}>
                <Col span={3}>
                  <Input
                    value={item.field_name}
                    onChange={(e) => handleItemChange(index, 'field_name', e.target.value)}
                    placeholder="字段名称"
                    style={inputStyle}
                  />
                </Col>
                <Col span={3}>
                  <Input
                    value={item.field_label}
                    onChange={(e) => handleItemChange(index, 'field_label', e.target.value)}
                    placeholder="字段中文名"
                    style={inputStyle}
                  />
                </Col>
                <Col span={3}>
                  <Select
                    value={item.field_type}
                    onChange={(v) => handleItemChange(index, 'field_type', v)}
                    style={{ width: '100%', height: inputHeight }}
                  >
                    {fieldTypes.map(ft => (
                      <Option key={ft.key} value={ft.key}>{ft.label}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={3}>
                  <Input
                    value={item.related_header}
                    onChange={(e) => handleItemChange(index, 'related_header', e.target.value)}
                    placeholder="表头名称"
                    style={inputStyle}
                    disabled={document?.chunk_method !== 'table'}
                  />
                </Col>
                <Col span={10}>
                  <div style={{ height: inputHeight }}>
                    {renderValueInput(item, index)}
                  </div>
                </Col>
                <Col span={2}>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveItem(index)}
                    style={{
                      color: '#ff4d4f',
                      height: inputHeight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  />
                </Col>
              </Row>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e8e8e8' }}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem} block>
          添加元数据
        </Button>
      </div>
    </Modal>
  );
};

export default MetadataModal;
