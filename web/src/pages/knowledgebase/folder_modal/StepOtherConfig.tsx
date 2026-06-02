import React, { useState, useEffect } from 'react';
import { Select, Input, Tooltip, InputNumber, Slider, Switch } from 'antd';

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

interface StepOtherConfigProps {
  chunkMethod: string;
  setChunkMethod: (value: string) => void;
  chunkConfig: Record<string, unknown>;
  setChunkConfig: (value: Record<string, unknown>) => void;
  documentConstants: any;
  availableMethods: Array<{ key: string; label: string; is_default: boolean }>;
}

const StepOtherConfig: React.FC<StepOtherConfigProps> = ({
  chunkMethod,
  setChunkMethod,
  chunkConfig,
  setChunkConfig,
  documentConstants,
  availableMethods,
}) => {
  const [theme, setTheme] = useState<string>(getTheme());

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  const initDefaultChunkConfig = (method: string, constantsData?: any) => {
    const configs = constantsData || documentConstants;
    if (!configs) return {};
    const fields = configs.chunk_configs[method] || [];
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

  const handleChunkMethodChange = (value: string) => {
    setChunkMethod(value);
    const defaultConfig = initDefaultChunkConfig(value);
    setChunkConfig(defaultConfig);
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setChunkConfig(prev => ({ ...prev, [key]: value }));
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
    if (!documentConstants || !chunkMethod) return null;
    const fields = documentConstants.chunk_configs[chunkMethod] || [];
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
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: 24, textAlign: 'left' }}>
        <div style={{ marginBottom: 16, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, justifyContent: 'flex-start' }}>
            <span style={{ fontWeight: 500 }}>切片方法</span>
          </div>
          <Select
              value={chunkMethod}
              onChange={handleChunkMethodChange}
              style={{ width: '100%' }}
              placeholder="请选择切片方法"
            >
              {availableMethods?.map((method) => (
                <Select.Option key={method.key} value={method.key}>
                  {method.label}
                </Select.Option>
              ))}
            </Select>
        </div>
        
        {chunkMethod && renderChunkConfig()}
      </div>
    </div>
  );
};

export default StepOtherConfig;
