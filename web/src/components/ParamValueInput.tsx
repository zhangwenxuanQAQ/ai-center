import React from 'react';
import { Input, InputNumber, Select, Switch, Tooltip } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import Tag from 'antd/es/tag';

/** 参数定义（与后端入参定义结构一致） */
export interface ParamDefinition {
  /** 参数名（对应main函数形参） */
  name: string;
  /** 参数类型 */
  type: string;
  /** 参数描述 */
  description?: string;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  default?: any;
}

interface ParamValueInputProps {
  /** 参数定义 */
  param: ParamDefinition;
  /** 当前值 */
  value: any;
  /** 值变化回调 */
  onChange: (value: any) => void;
  /** 明暗主题 */
  theme: 'light' | 'dark';
}

/**
 * 按参数类型渲染值输入控件的公共组件
 *
 * - string: 文本输入；integer/number: 数字输入；boolean: 开关
 * - array/object: JSON文本域（array须为JSON数组，object须为JSON对象）
 * - 布局：参数名 + 类型标签 + 描述图标 + 输入控件（与新增代码脚本的测试入参布局一致）
 */
const ParamValueInput: React.FC<ParamValueInputProps> = ({ param, value, onChange, theme }) => {
  const placeholder = param.description
    ? `${param.description}（${param.type}）`
    : `请输入参数值（${param.type}）`;

  const renderControl = () => {
    switch (param.type) {
      case 'boolean':
        return (
          <Select
            value={value !== undefined && value !== null && value !== '' ? String(value) : undefined}
            onChange={(v) => onChange(v === 'true')}
            placeholder="请选择布尔值"
            allowClear
            style={{ width: '100%' }}
          >
            <Select.Option value="true">true</Select.Option>
            <Select.Option value="false">false</Select.Option>
          </Select>
        );
      case 'integer':
      case 'number':
        return (
          <InputNumber
            value={value !== undefined && value !== null && value !== '' ? Number(value) : undefined}
            onChange={(v) => onChange(v)}
            placeholder={placeholder}
            style={{ width: '100%' }}
          />
        );
      case 'array':
      case 'object':
        return (
          <Input.TextArea
            value={typeof value === 'string' ? value : (value !== undefined && value !== null ? JSON.stringify(value, null, 2) : '')}
            onChange={(e) => onChange(e.target.value)}
            rows={param.type === 'array' ? 3 : 4}
            placeholder={param.type === 'array' ? '请输入JSON数组，如 [1, 2, 3]' : '请输入JSON对象，如 {"a": 1}'}
          />
        );
      default:
        return (
          <Input
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            allowClear
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
      {/* 参数名 + 必填标记 + 类型标签 + 描述提示 */}
      <div style={{ width: 200, flexShrink: 0, textAlign: 'right', paddingRight: 8, paddingTop: 5 }}>
        <span title={param.description || param.name}>
          {param.name}
          {param.required && <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span>}
          <Tag style={{ marginLeft: 6 }}>{param.type}</Tag>
          {param.description && (
            <Tooltip title={param.description}>
              <EyeOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', cursor: 'pointer', marginLeft: 4 }} />
            </Tooltip>
          )}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        {renderControl()}
      </div>
    </div>
  );
};

export default ParamValueInput;
