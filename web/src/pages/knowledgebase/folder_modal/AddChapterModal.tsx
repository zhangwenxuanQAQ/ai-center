import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Radio, Upload, Button, message } from 'antd';
import { PlusOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
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
}

const AddChapterModal: React.FC<AddChapterModalProps> = ({
  visible,
  chapters,
  onCancel,
  onAdd,
}) => {
  const [form] = Form.useForm();
  const [chapterType, setChapterType] = useState<'form' | 'list' | 'rich_text'>('form');
  const [fields, setFields] = useState<SimpleTableRow[]>([]);
  const [iconUrl, setIconUrl] = useState<string>('');

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setChapterType('form');
      setFields([]);
      setIconUrl('');
    }
  }, [visible, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      const newChapter: Chapter = {
        id: `chapter_${Date.now()}`,
        name: values.name,
        parentId: values.parentId,
        icon: iconUrl,
        type: chapterType,
        fields: (chapterType === 'form' || chapterType === 'list') ? fields : undefined,
      };

      onAdd(newChapter);
      message.success('章节添加成功');
      form.resetFields();
      setChapterType('form');
      setFields([]);
      setIconUrl('');
      onCancel();
    } catch (error) {
      console.error('Failed to add chapter:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setChapterType('form');
    setFields([]);
    setIconUrl('');
    onCancel();
  };

  const handleUploadChange = (info: any) => {
    if (info.file.status === 'done') {
      const url = info.file.response?.url || info.file.name;
      setIconUrl(url);
      message.success('图片上传成功');
    } else if (info.file.status === 'error') {
      message.error('图片上传失败');
    }
  };

  const handleRemoveIcon = () => {
    setIconUrl('');
  };

  return (
    <Modal
      title="添加章节"
      open={visible}
      onCancel={handleCancel}
      onOk={handleOk}
      width={800}
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

        <Form.Item label="章节图标">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {iconUrl ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={iconUrl}
                  alt="章节图标"
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleRemoveIcon}
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    padding: 0
                  }}
                />
              </div>
            ) : (
              <Upload
                accept="image/*"
                showUploadList={false}
                action="/api/upload"
                onChange={handleUploadChange}
              >
                <Button icon={<UploadOutlined />}>上传图标</Button>
              </Upload>
            )}
          </div>
        </Form.Item>

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

        {(chapterType === 'form' || chapterType === 'list') && (
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
