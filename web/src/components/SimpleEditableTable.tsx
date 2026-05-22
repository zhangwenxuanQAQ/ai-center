import React from 'react';
import { Table, Input, Select, Switch, Button } from 'antd';
import { PlusOutlined, UpOutlined, DownOutlined, DeleteOutlined } from '@ant-design/icons';

export interface SimpleTableRow {
  id: string;
  fieldName: string;
  fieldCode: string;
  fieldType: string;
  fieldDict: string;
  description: string;
  isRequired: boolean;
}

interface SimpleEditableTableProps {
  value: SimpleTableRow[];
  onChange: (rows: SimpleTableRow[]) => void;
}

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: '文本框' },
  { value: 'select', label: '下拉单选' },
  { value: 'select_multiple', label: '下拉多选' },
  { value: 'radio', label: '单选' },
  { value: 'checkbox', label: '多选' },
  { value: 'textarea', label: '文本域' },
  { value: 'number', label: '数字输入框' },
  { value: 'date', label: '时间选择框' },
  { value: 'file', label: '文件上传框' },
];

const SimpleEditableTable: React.FC<SimpleEditableTableProps> = ({ value = [], onChange }) => {
  const handleAddRow = () => {
    const newRow: SimpleTableRow = {
      id: `row_${Date.now()}`,
      fieldName: '',
      fieldCode: '',
      fieldType: 'text',
      fieldDict: '',
      description: '',
      isRequired: false,
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
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => handleUpdateRow(record.id, 'fieldName', e.target.value)}
          placeholder="请输入字段中文名"
        />
      ),
    },
    {
      title: '字段编码',
      dataIndex: 'fieldCode',
      key: 'fieldCode',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => handleUpdateRow(record.id, 'fieldCode', e.target.value)}
          placeholder="请输入字段编码"
        />
      ),
    },
    {
      title: '属性类型',
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Select
          size="small"
          value={text}
          onChange={(value) => handleUpdateRow(record.id, 'fieldType', value)}
          style={{ width: '100%' }}
        >
          {FIELD_TYPE_OPTIONS.map(option => (
            <Select.Option key={option.value} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: '值域字典',
      dataIndex: 'fieldDict',
      key: 'fieldDict',
      width: 120,
      render: (text: string, record: SimpleTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => handleUpdateRow(record.id, 'fieldDict', e.target.value)}
          placeholder="请输入值域字典"
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
        />
      ),
    },
    {
      title: '是否必填',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 80,
      render: (checked: boolean, record: SimpleTableRow) => (
        <Switch
          checked={checked}
          onChange={(value) => handleUpdateRow(record.id, 'isRequired', value)}
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
            disabled={index === 0}
          />
          <Button
            size="small"
            icon={<DownOutlined />}
            onClick={() => handleMoveDown(index)}
            disabled={index === value.length - 1}
          />
          <Button
            size="small"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteRow(record.id)}
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
