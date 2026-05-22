import React from 'react';
import { Form, Input, TreeSelect } from 'antd';

interface StepBasicInfoProps {
  form: any;
  categories: any[];
}

const StepBasicInfo: React.FC<StepBasicInfoProps> = ({ form, categories }) => {
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
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="分类名称"
        rules={[{ required: true, message: '请输入分类名称' }]}
      >
        <Input placeholder="请输入分类名称" />
      </Form.Item>
      <Form.Item
        name="description"
        label="分类描述"
      >
        <Input.TextArea rows={3} placeholder="请输入分类描述" />
      </Form.Item>
      <Form.Item
        name="parent_id"
        label="父分类"
      >
        <TreeSelect
          placeholder="请选择父分类"
          treeData={buildCategoryTreeSelectData(categories)}
          allowClear
          treeDefaultExpandAll
        />
      </Form.Item>
      <Form.Item
        name="sort_order"
        label="排序顺序"
        initialValue={1}
        rules={[{ required: true, message: '请输入排序顺序' }]}
      >
        <Input type="number" placeholder="请输入排序顺序（大于0）" />
      </Form.Item>
    </Form>
  );
};

export default StepBasicInfo;
