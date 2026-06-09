import React from 'react';
import { Table, Input, Select, Switch, Button } from 'antd';
import { PlusOutlined, UpOutlined, DownOutlined, DeleteOutlined } from '@ant-design/icons';

export interface SimpleTableRow {
  id: string;
  field_name: string;
  field_code: string;
  field_type: string;
  field_dict: string;
  description: string;
  is_required: boolean;
}

interface FieldTypeOption {
  key: string;
  label: string;
}

interface SimpleEditableTableProps {
  value: SimpleTableRow[];
  onChange: (rows: SimpleTableRow[]) => void;
  fieldTypes?: FieldTypeOption[];
  disabled?: boolean;
}

const SimpleEditableTable: React.FC<SimpleEditableTableProps> = ({ value = [], onChange, fieldTypes, disabled = false }) => {
  const handleAddRow = () => {
    const newRow: SimpleTableRow = {
      id: `row_${Date.now()}`,
      field_name: '',
      field_code: '',
      field_type: 'text',
      field_dict: '',
      description: '',
      is_required: false,
    };
    onChange([...value, newRow]);
  };

  const handleUpdateRow = (id: string, field: keyof SimpleTableRow, fieldValue: any) => {
    onChange(value.map(row =>
      row.id === id ? { ...row, [field]: fieldValue } : row
    ));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newRows = [...value];
    [newRows[index], newRows[index - 1]] = [newRows[index - 1], newRows[index]];
    onChange(newRows);
  };

  const handleMoveDown = (index: number) => {
    if (index === value.length - 1) return;
    const newRows = [...value];
    [newRows[index], newRows[index + 1]] = [newRows[index + 1], newRows[index]];
    onChange(newRows);
  };

  const handleDeleteRow = (id: string) => {
    onChange(value.filter(row => row.id !== id));
  };

  const columns = [
    {
      title: '字段中文名',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => handleUpdateRow(record.id, 'field_name', e.target.value)}
          placeholder="请输入字段中文名"
          disabled={disabled}
        />
      ),
    },
    {
      title: '字段编码',
      dataIndex: 'field_code',
      key: 'field_code',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => {
            let value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
            if (value.length > 0 && /^[0-9]/.test(value[0])) {
              value = value.substring(1);
            }
            handleUpdateRow(record.id, 'field_code', value);
          }}
          placeholder="字母或下划线开头"
          disabled={disabled}
        />
      ),
    },
    {
      title: '属性类型',
      dataIndex: 'field_type',
      key: 'field_type',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Select
          size="small"
          value={text}
          onChange={(value) => handleUpdateRow(record.id, 'field_type', value)}
          style={{ width: '100%' }}
          disabled={disabled}
        >
          {(fieldTypes || []).map(option => (
            <Select.Option key={option.key} value={option.key}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: '值域字典',
      dataIndex: 'field_dict',
      key: 'field_dict',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => handleUpdateRow(record.id, 'field_dict', e.target.value)}
          placeholder="请输入值域字典"
          disabled={disabled}
        />
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => handleUpdateRow(record.id, 'description', e.target.value)}
          placeholder="请输入说明"
          disabled={disabled}
        />
      ),
    },
    {
      title: '是否必填',
      dataIndex: 'is_required',
      key: 'is_required',
      width: 80,
      render: (checked: boolean, record: SimpleTableRow) => (
        <Switch
          checked={checked}
          onChange={(value) => handleUpdateRow(record.id, 'is_required', value)}
          disabled={disabled}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: SimpleTableRow, index: number) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button
            size="small"
            icon={<UpOutlined />}
            onClick={() => handleMoveUp(index)}
            disabled={index === 0 || disabled}
          />
          <Button
            size="small"
            icon={<DownOutlined />}
            onClick={() => handleMoveDown(index)}
            disabled={index === value.length - 1 || disabled}
          />
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteRow(record.id)}
            disabled={disabled}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddRow}
          disabled={disabled}
        >
          添加行
        </Button>
      </div>
      <Table
        dataSource={value}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
        bordered
      />
    </div>
  );
};

export default SimpleEditableTable;
