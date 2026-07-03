import React, { useState, useRef, useEffect } from 'react';
import { Tag, Input, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

const TagsInput: React.FC<TagsInputProps> = ({
  value = [],
  onChange,
  label,
  required = false,
  placeholder = '输入标签',
}) => {
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      const timer = setTimeout(() => {
        tagInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showTagInput]);

  const handleAddTag = () => {
    if (newTag.trim() && !value.includes(newTag.trim())) {
      onChange([...value, newTag.trim()]);
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const handleTagClose = (removedTag: string) => {
    onChange(value.filter(tag => tag !== removedTag));
  };

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ marginBottom: 8, fontWeight: 500, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}>
          {label}
          {required && <span style={{ color: '#ff4d4f' }}>*</span>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Array.isArray(value) && value.length > 0 ? value.map((tag, index) => (
            <Tag
              key={index}
              closable
              onClose={() => handleTagClose(tag)}
              style={{ marginBottom: 4 }}
            >
              {tag}
            </Tag>
          )) : null}
          {showTagInput ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Input
                ref={tagInputRef as any}
                type="text"
                size="small"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onPressEnter={handleAddTag}
                onBlur={handleAddTag}
                placeholder={placeholder}
                style={{ width: 120, height: 24 }}
              />
              <Button size="small" onClick={handleAddTag} style={{ height: 24 }}>添加</Button>
              <Button size="small" onClick={() => setShowTagInput(false)} style={{ height: 24 }}>取消</Button>
            </div>
          ) : (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setShowTagInput(true)}
              style={{ borderStyle: 'dashed', height: 24, minWidth: 80 }}
            >
              添加标签
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagsInput;
