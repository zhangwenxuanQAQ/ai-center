import React from 'react';
import { Form, Input, TreeSelect, InputNumber } from 'antd';

interface StepBasicInfoProps {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  parentId: string | undefined;
  setParentId: (value: string | undefined) => void;
  sortOrder: number;
  setSortOrder: (value: number) => void;
  categories: any[];
}

const StepBasicInfo: React.FC<StepBasicInfoProps> = ({ 
  name, 
  setName, 
  description, 
  setDescription, 
  parentId, 
  setParentId, 
  sortOrder, 
  setSortOrder,
  categories 
}) => {
  const buildCategoryTreeSelectData = (items: any[] = []): any[] => {
    return items.map(item => ({
      title: item.name,
      value: item.id,
      key: item.id,
      children: item.children && Array.isArray(item.children) && item.children.length > 0
        ? buildCategoryTreeSelectData(item.children)
        : undefined,
    }));
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>分类名称 <span style={{ color: '#ff4d4f' }}>*</span></label>
        <Input 
          placeholder="请输入分类名称" 
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>分类描述</label>
        <Input.TextArea 
          rows={3} 
          placeholder="请输入分类描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>父分类</label>
        <TreeSelect
          placeholder="请选择父分类"
          treeData={buildCategoryTreeSelectData(categories)}
          allowClear
          treeDefaultExpandAll
          value={parentId}
          onChange={(value) => setParentId(value || undefined)}
          style={{ width: '50%' }}
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>排序顺序 <span style={{ color: '#ff4d4f' }}>*</span></label>
        <InputNumber 
          min={1}
          placeholder="请输入排序顺序（最小为1）"
          value={sortOrder}
          onChange={(value) => setSortOrder(value || 1)}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};

export default StepBasicInfo;
