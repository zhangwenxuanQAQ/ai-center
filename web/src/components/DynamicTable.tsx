import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { Table, Input, Select, Switch, Button } from 'antd';
import { PlusOutlined, UpOutlined, DownOutlined, DeleteOutlined } from '@ant-design/icons';

export interface DynamicTableRow {
  id: string;
  fieldName: string;
  fieldCode: string;
  fieldType: string;
  fieldDict: string;
  description: string;
  isParamSearch: boolean;
  isRequired: boolean;
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
  const [validationErrors, setValidationErrors] = useState<Record<string, { fieldName?: boolean; fieldCode?: boolean }>>({});

  useImperativeHandle(ref, () => ({
    validate: () => {
      const errors: Record<string, { fieldName?: boolean; fieldCode?: boolean }> = {};
      let isValid = true;

      value.forEach(row => {
        const rowErrors: { fieldName?: boolean; fieldCode?: boolean } = {};
        if (!row.fieldName || !row.fieldName.trim()) {
          rowErrors.fieldName = true;
          isValid = false;
        }
        if (!row.fieldCode || !row.fieldCode.trim()) {
          rowErrors.fieldCode = true;
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
      fieldName: '',
      fieldCode: '',
      fieldType: 'text',
      fieldDict: '',
      description: '',
      isParamSearch: false,
      isRequired: false,
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
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 120,
      render: (text: string, record: DynamicTableRow) => {
        const hasError = validationErrors[record.id]?.fieldName;
        return (
          <Input
            size="small"
            value={text}
            onChange={e => {
              handleUpdateRow(record.id, 'fieldName', e.target.value);
              if (e.target.value.trim()) {
                setValidationErrors(prev => {
                  const newErrors = { ...prev };
                  if (newErrors[record.id]) {
                    delete newErrors[record.id].fieldName;
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
      dataIndex: 'fieldCode',
      key: 'fieldCode',
      width: 120,
      render: (text: string, record: DynamicTableRow) => {
        const hasError = validationErrors[record.id]?.fieldCode;
        return (
          <Input
            size="small"
            value={text}
            onChange={e => {
              handleUpdateRow(record.id, 'fieldCode', e.target.value);
              if (e.target.value.trim()) {
                setValidationErrors(prev => {
                  const newErrors = { ...prev };
                  if (newErrors[record.id]) {
                    delete newErrors[record.id].fieldCode;
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
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 120,
      render: (text: string, record: DynamicTableRow) => (
        <Select
          size="small"
          value={text}
          onChange={(value) => handleUpdateRow(record.id, 'fieldType', value)}
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
      dataIndex: 'fieldDict',
      key: 'fieldDict',
      width: 120,
      render: (text: string, record: DynamicTableRow) => (
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
      dataIndex: 'isParamSearch',
      key: 'isParamSearch',
      width: 100,
      render: (checked: boolean, record: DynamicTableRow) => (
        <Switch
          checked={checked}
          onChange={(value) => handleUpdateRow(record.id, 'isParamSearch', value)}
        />
      ),
    },
    {
      title: '是否必填',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 80,
      render: (checked: boolean, record: DynamicTableRow) => (
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
