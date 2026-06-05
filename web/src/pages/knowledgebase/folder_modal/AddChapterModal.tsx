import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, TreeSelect, Radio, Button, message } from 'antd';
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
  richTextOnly?: boolean;
  editingChapter?: Chapter | null;
  documentConstants?: any;
}

const AddChapterModal: React.FC<AddChapterModalProps> = ({
  visible,
  chapters,
  onCancel,
  onAdd,
  richTextOnly = false,
  editingChapter = null,
  documentConstants,
}) => {
  const [form] = Form.useForm();
  const [chapterType, setChapterType] = useState<'form' | 'list' | 'rich_text'>('form');
  const [fields, setFields] = useState<SimpleTableRow[]>([]);

  const treeData = useMemo(() => {
    const buildNode = (chapter: Chapter): any => {
      const children = chapters.filter(ch => ch.parentId === chapter.id);
      return {
        title: chapter.name,
        value: chapter.id,
        key: chapter.id,
        children: children.length > 0 ? children.map(buildNode) : undefined,
      };
    };
    const rootChapters = chapters.filter(ch => !ch.parentId);
    return rootChapters.map(buildNode);
  }, [chapters]);

  useEffect(() => {
    if (visible) {
      if (editingChapter) {
        // 编辑模式：回填数据
        form.setFieldsValue({
          name: editingChapter.name,
          parentId: editingChapter.parentId,
        });
        setChapterType(editingChapter.type);
        setFields(editingChapter.fields || []);
      } else {
        // 添加模式：重置表单
        form.resetFields();
        setChapterType(richTextOnly ? 'rich_text' : 'form');
        setFields([]);
      }
    }
  }, [visible, form, richTextOnly, editingChapter]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      // 校验字段中文名是否重复
      if (chapterType === 'form' || chapterType === 'list') {
        const fieldNames = fields.map(f => f.field_name).filter(name => name);
        const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
          message.error(`字段中文名重复：${[...new Set(duplicates)].join('、')}`);
          return;
        }
      }
      
      const chapter: Chapter = {
        id: editingChapter?.id || `chapter_${Date.now()}`,
        name: values.name,
        parentId: values.parentId,
        type: chapterType,
        fields: (chapterType === 'form' || chapterType === 'list') ? fields : undefined,
      };

      onAdd(chapter);
      message.success(editingChapter ? '章节编辑成功' : '章节添加成功');
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
      title={editingChapter ? "编辑章节" : "添加章节"}
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
          <TreeSelect 
            placeholder="请选择上级章节" 
            allowClear
            treeData={treeData}
            treeDefaultExpandAll
            showSearch
            treeNodeFilterProp="title"
          />
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
              fieldTypes={documentConstants?.metadata_field_types || []}
              disabled={false}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export { AddChapterModal };
export type { Chapter };