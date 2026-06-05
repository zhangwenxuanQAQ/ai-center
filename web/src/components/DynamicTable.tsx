import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { Table, Input, Select, Switch, Button } from 'antd';
import { PlusOutlined, UpOutlined, DownOutlined, DeleteOutlined } from '@ant-design/icons';

export interface DynamicTableRow {
  id: string;
  field_name: string;
  field_code: string;
  field_type: string;
  field_dict: string;
  description: string;
  is_param_search: boolean;
  is_required: boolean;
}

export interface DynamicTableRef {
  validate: () => boolean;
}

interface FieldTypeOption {
  key: string;
  label: string;
}

interface DynamicTableProps {
  value: DynamicTableRow[];
  onChange: (rows: DynamicTableRow[]) => void;
  label?: string;
  fieldTypes?: FieldTypeOption[];
}

const DynamicTableComponent = (props: DynamicTableProps, ref: React.Ref<DynamicTableRef>) => {
  const { value = [], onChange, label, fieldTypes } = props;
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, { field_name?: boolean; field_code?: boolean }>>({});

  useImperativeHandle(ref, () => ({
    validate: () => {
      const errors: Record<string, { field_name?: boolean; field_code?: boolean }> = {};
      let isValid = true;

      value.forEach(row => {
        const rowErrors: { field_name?: boolean; field_code?: boolean } = {};
        if (!row.field_name || !row.field_name.trim()) {
          rowErrors.field_name = true;
          isValid = false;
        }
        if (!row.field_code || !row.field_code.trim()) {
          rowErrors.field_code = true;
          isValid = false;
        }
        if (Object.keys(rowErrors).length > 0) {
          errors[row.id] = rowErrors;
        }
      });

      setValidationErrors(errors);
      return isValid;
    }
  }));

  const handleAddRow = () => {
    const newRow: DynamicTableRow = {
      id: `row_${Date.now()}`,
      field_name: '',
      field_code: '',
      field_type: 'text',
      field_dict: '',
      description: '',
      is_param_search: false,
      is_required: false,
    };
    onChange([...value, newRow]);
  };

  const handleUpdateRow = (id: string, field: keyof DynamicTableRow, fieldValue: any) => {
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
      title: <span>字段中文名 <span style={{ color: '#ff4d4f' }}>*</span></span>,
      dataIndex: 'field_name',
      key: 'field_name',
      width: 120,
      render: (text: string, record: DynamicTableRow) => {
        const hasError = validationErrors[record.id]?.field_name;
        return (
          <Input
            size="small"
            value={text}
            onChange={e => {
              handleUpdateRow(record.id, 'field_name', e.target.value);
              if (e.target.value.trim()) {
                setValidationErrors(prev => {
                  const newErrors = { ...prev };
                  if (newErrors[record.id]) {
                    delete newErrors[record.id].field_name;
                    if (Object.keys(newErrors[record.id]).length === 0) {
                      delete newErrors[record.id];
                    }
                  }
                  return newErrors;
                });
              }
            }}
            placeholder="请输入字段中文名"
            status={hasError ? 'error' : undefined}
          />
        );
      },
    },
    {
      title: <span>字段编码 <span style={{ color: '#ff4d4f' }}>*</span></span>,
      dataIndex: 'field_code',
      key: 'field_code',
      width: 120,
      render: (text: string, record: DynamicTableRow) => {
        const hasError = validationErrors[record.id]?.field_code;
        return (
          <Input
            size="small"
            value={text}
            onChange={e => {
              handleUpdateRow(record.id, 'field_code', e.target.value);
              if (e.target.value.trim()) {
                setValidationErrors(prev => {
                  const newErrors = { ...prev };
                  if (newErrors[record.id]) {
                    delete newErrors[record.id].field_code;
                    if (Object.keys(newErrors[record.id]).length === 0) {
                      delete newErrors[record.id];
                    }
                  }
                  return newErrors;
                });
              }
            }}
            placeholder="请输入字段编码"
            status={hasError ? 'error' : undefined}
          />
        );
      },
    },
    {
      title: '属性类型',
      dataIndex: 'field_type',
      key: 'field_type',
      width: 120,
      render: (text: string, record: DynamicTableRow) => (
        <Select
          size="small"
          value={text}
          onChange={(value) => handleUpdateRow(record.id, 'field_type', value)}
          style={{ width: '100%' }}
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
      render: (text: string, record: DynamicTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => handleUpdateRow(record.id, 'field_dict', e.target.value)}
          placeholder="请输入值域字典"
        />
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 120,
      render: (text: string, record: DynamicTableRow) => (
        <Input
          size="small"
          value={text}
          onChange={e => handleUpdateRow(record.id, 'description', e.target.value)}
          placeholder="请输入说明"
        />
      ),
    },
    {
      title: '是否参数检索',
      dataIndex: 'is_param_search',
      key: 'is_param_search',
      width: 100,
      render: (checked: boolean, record: DynamicTableRow) => (
        <Switch
          checked={checked}
          onChange={(value) => handleUpdateRow(record.id, 'is_param_search', value)}
        />
      ),
    },
    {
      title: '是否必填',
      dataIndex: 'is_required',
      key: 'is_required',
      width: 80,
      render: (checked: boolean, record: DynamicTableRow) => (
        <Switch
          checked={checked}
          onChange={(value) => handleUpdateRow(record.id, 'is_required', value)}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: DynamicTableRow, index: number) => (
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
            icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
            danger
            onClick={() => handleDeleteRow(record.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      {label && (
        <div style={{ marginBottom: 12, fontWeight: 500, textAlign: 'left' }}>
          {label}
        </div>
      )}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-start' }}>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddRow}
        >
          添加字段
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

const DynamicTable = forwardRef<DynamicTableRef, DynamicTableProps>(DynamicTableComponent);

export default DynamicTable;
