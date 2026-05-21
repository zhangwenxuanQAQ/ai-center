import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, Tag, message, Spin } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import { knowledgebaseService } from '../../services/knowledgebase';

interface ChunkSettingProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (chunk?: any) => void;
  knowledgebaseId: string;
  documentId: string;
  chunk?: any;
  mode: 'create' | 'edit';
}

const ChunkSetting: React.FC<ChunkSettingProps> = ({
  visible,
  onCancel,
  onSuccess,
  knowledgebaseId,
  documentId,
  chunk,
  mode,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.document.body) return;
    
    const currentTheme = window.document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'dark' | 'light');

    const observer = new MutationObserver(() => {
      if (!window.document.body) return;
      const newTheme = window.document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'dark' | 'light');
    });

    observer.observe(window.document.body, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && chunk) {
        setContent(chunk.content_with_weight || '');
        setKeywords(chunk.important_kwd || []);
        form.setFieldsValue({
          available_int: chunk.available_int === 1,
        });
      } else {
        setContent('');
        setKeywords([]);
        form.setFieldsValue({
          available_int: true,
        });
      }
    }
  }, [visible, mode, chunk, form]);

  const handleOk = async () => {
    if (!content || !content.trim()) {
      message.error('切片内容不能为空');
      return;
    }

    setLoading(true);
    try {
      const values = await form.validateFields();
      const available_int = values.available_int ? 1 : 0;

      if (mode === 'create') {
        const result = await knowledgebaseService.createChunk(
          knowledgebaseId,
          documentId,
          content,
          keywords.length > 0 ? keywords : undefined,
          available_int
        );
        message.success('切片创建成功');
        onSuccess(result);
      } else {
        const result = await knowledgebaseService.updateChunk(
          knowledgebaseId,
          chunk._id,
          content,
          keywords.length > 0 ? keywords : undefined,
          available_int
        );
        message.success('切片更新成功');
        onSuccess(result);
      }

      handleCancel();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setContent('');
    setKeywords([]);
    setInputVisible(false);
    setInputValue('');
    onCancel();
  };

  const handleCloseTag = (removedTag: string) => {
    setKeywords(keywords.filter(tag => tag !== removedTag));
  };

  const showInput = () => {
    setInputVisible(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputConfirm = () => {
    if (inputValue && !keywords.includes(inputValue)) {
      setKeywords([...keywords, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  return (
    <Modal
      title={mode === 'create' ? '新增切片' : '编辑切片'}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
      confirmLoading={loading}
      okText="确定"
      cancelText="取消"
      bodyStyle={{
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ available_int: true }}
      >
        <Form.Item label="切片内容" required>
          <div 
            style={{ 
              border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : '#d9d9d9'}`,
              borderRadius: 4,
              overflow: 'hidden'
            }}
          >
            <MDEditor
              value={content}
              onChange={(value) => setContent(value || '')}
              height={300}
              preview="edit"
              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
              style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
              }}
            />
          </div>
        </Form.Item>

        <Form.Item label="关键词">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {keywords.map((tag) => (
              <Tag
                key={tag}
                closable
                onClose={() => handleCloseTag(tag)}
                style={{
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#fafafa',
                  border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#d9d9d9'}`,
                  color: theme === 'dark' ? '#fff' : '#333',
                }}
              >
                {tag}
              </Tag>
            ))}
            {inputVisible && (
              <Input
                type="text"
                size="small"
                style={{ width: 100 }}
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputConfirm}
                onPressEnter={handleInputConfirm}
                autoFocus
              />
            )}
            {!inputVisible && (
              <Tag
                onClick={showInput}
                style={{
                  background: 'transparent',
                  border: `1px dashed ${theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : '#d9d9d9'}`,
                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : '#666',
                  cursor: 'pointer',
                }}
              >
                <PlusOutlined /> 添加关键词
              </Tag>
            )}
          </div>
        </Form.Item>

        <Form.Item
          name="available_int"
          label="是否启用"
          valuePropName="checked"
        >
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChunkSetting;
