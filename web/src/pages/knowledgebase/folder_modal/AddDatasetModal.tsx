import React from 'react';
import { Modal, Form, Input, Button } from 'antd';

interface AddDatasetModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const AddDatasetModal: React.FC<AddDatasetModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      console.log('Dataset values:', values);
      onSuccess();
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <Modal
      title="新增数据集"
      open={visible}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      width={600}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="数据集名称"
          rules={[{ required: true, message: '请输入数据集名称' }]}
        >
          <Input placeholder="请输入数据集名称" />
        </Form.Item>
        <Form.Item
          name="description"
          label="数据集描述"
        >
          <Input.TextArea rows={3} placeholder="请输入数据集描述" />
        </Form.Item>
        <Form.Item
          name="source"
          label="数据来源"
        >
          <Input placeholder="请输入数据来源" />
        </Form.Item>
        <Form.Item
          name="size"
          label="数据大小"
        >
          <Input placeholder="请输入数据大小" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddDatasetModal;