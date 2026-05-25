import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Radio, Button, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import SimpleEditableTable, { SimpleTableRow } from '../../../components/SimpleEditableTable';

interface Chapter {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
  type: 'form' | 'list' | 'rich_text';
  fields?: SimpleTableRow[];
}

interface AddChapterModalProps {
  visible: boolean;
  chapters: Chapter[];
  onCancel: () => void;
  onAdd: (chapter: Chapter) => void;
  // 新增属性：是否仅显示富文本类型（用于动态章节）
  richTextOnly?: boolean;
}

const AddChapterModal: React.FC<AddChapterModalProps> = ({
  visible,
  chapters,
  onCancel,
  onAdd,
  richTextOnly = false,
}) => {
  const [form] = Form.useForm();
  const [chapterType, setChapterType] = useState<'form' | 'list' | 'rich_text'>('form');
  const [fields, setFields] = useState<SimpleTableRow[]>([]);

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setChapterType(richTextOnly ? 'rich_text' : 'form');
      setFields([]);
    }
  }, [visible, form, richTextOnly]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      const newChapter: Chapter = {
        id: `chapter_${Date.now()}`,
        name: values.name,
        parentId: values.parentId,
        type: chapterType,
        fields: (chapterType === 'form' || chapterType === 'list') ? fields : undefined,
      };

      onAdd(newChapter);
      message.success('章节添加成功');
      form.resetFields();
      setChapterType(richTextOnly ? 'rich_text' : 'form');
      setFields([]);
      onCancel();
    } catch (error) {
      console.error('Failed to add chapter:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setChapterType(richTextOnly ? 'rich_text' : 'form');
    setFields([]);
    onCancel();
  };

  return (
    <Modal
      title="添加章节"
      open={visible}
      onCancel={handleCancel}
      onOk={handleOk}
      width={richTextOnly ? 500 : 800}
      okText="确定"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="章节名称"
          rules={[{ required: true, message: '请输入章节名称' }]}
        >
          <Input placeholder="请输入章节名称" />
        </Form.Item>

        <Form.Item
          name="parentId"
          label="上级章节"
        >
          <Select placeholder="请选择上级章节" allowClear>
            {chapters.map(chapter => (
              <Select.Option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {!richTextOnly && (
          <Form.Item label="章节类型">
            <Radio.Group
              value={chapterType}
              onChange={e => setChapterType(e.target.value)}
            >
              <Radio value="form">表单</Radio>
              <Radio value="list">列表</Radio>
              <Radio value="rich_text">富文本</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        {richTextOnly && (
          <Form.Item label="章节类型">
            <Radio.Group
              value={chapterType}
              onChange={e => setChapterType(e.target.value)}
              disabled
            >
              <Radio value="rich_text" defaultChecked>富文本</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        {!richTextOnly && (chapterType === 'form' || chapterType === 'list') && (
          <Form.Item label="字段配置">
            <SimpleEditableTable
              value={fields}
              onChange={setFields}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export { AddChapterModal };
export type { Chapter };