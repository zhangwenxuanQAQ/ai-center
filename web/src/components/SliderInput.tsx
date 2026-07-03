import React, { useState, useEffect } from 'react';
import { Slider, InputNumber, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

interface SliderInputProps {
  label: string;
  tooltip?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const SliderInput: React.FC<SliderInputProps> = ({
  label,
  tooltip,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}) => {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleSliderChange = (newValue: number | number[]) => {
    const val = Array.isArray(newValue) ? newValue[0] : newValue;
    setInputValue(val);
    onChange(val);
  };

  const handleInputChange = (newValue: number | null) => {
    if (newValue !== null) {
      setInputValue(newValue);
      onChange(newValue);
    }
  };

  const handleBlur = () => {
    if (inputValue < min) {
      setInputValue(min);
      onChange(min);
    } else if (inputValue > max) {
      setInputValue(max);
      onChange(max);
    }
  };

  return (
    <div style={{ marginBottom: 16, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, justifyContent: 'flex-start' }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {tooltip && (
          <Tooltip title={tooltip} placement="top">
            <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
          </Tooltip>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-start' }}>
        <Slider
          min={min}
          max={max}
          step={step}
          value={typeof inputValue === 'number' ? inputValue : 0}
          onChange={handleSliderChange}
          style={{ flex: 1, minWidth: 0 }}
        />
        <InputNumber
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          style={{ width: 100 }}
        />
      </div>
    </div>
  );
};

export default SliderInput;
