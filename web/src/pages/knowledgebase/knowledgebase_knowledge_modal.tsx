import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Upload, message, Select, Radio, Checkbox, DatePicker, Tooltip } from 'antd';
import { UploadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import TagsInput from '../../components/TagsInput';
import ChapterEditor from '../../components/ChapterEditor';
import { Chapter } from './folder_modal/AddChapterModal';
import { SimpleTableRow } from '../../components/SimpleEditableTable';
import { KnowledgebaseDocumentCategory } from '../../services/knowledgebase';

interface DocumentConfig {
  tags: string[];
  template_type: string;
  custom_fields?: SimpleTableRow[];
  has_knowledge_content: boolean;
  chapter_type?: 'fixed' | 'dynamic' | 'rich_text_only';
  chapters?: Chapter[];
}

interface KnowledgeModalProps {
  visible: boolean;
  knowledgebaseId: string;
  selectedCategory: KnowledgebaseDocumentCategory | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const KnowledgeModal: React.FC<KnowledgeModalProps> = ({
  visible,
  knowledgebaseId,
  selectedCategory,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [richTextContent, setRichTextContent] = useState('');
  const [customFormValues, setCustomFormValues] = useState<Record<string, any>>({});
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [documentConfig, setDocumentConfig] = useState<DocumentConfig>({
    tags: [],
    template_type: 'rich_text',
    has_knowledge_content: true,
    chapter_type: 'rich_text_only',
    chapters: [],
  });

  // 获取目录配置（document_config是JSON对象，不是字符串）
  const getDocumentConfigFromCategory = (category: KnowledgebaseDocumentCategory | null): DocumentConfig => {
    if (!category?.document_config) {
      return {
        tags: [],
        template_type: 'rich_text',
        has_knowledge_content: true,
        chapter_type: 'rich_text_only',
        chapters: [],
      };
    }
    
    // document_config已经是JSON对象，不需要解析
    const config = category.document_config as Record<string, any>;
    
    return {
      tags: config.tags || [],
      template_type: config.template_type || 'rich_text',
      custom_fields: config.custom_fields || [],
      has_knowledge_content: config.has_knowledge_content || false,
      chapter_type: (config.chapter_type as 'fixed' | 'dynamic' | 'rich_text_only') || 'rich_text_only',
      chapters: config.chapters || [],
    };
  };

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setTitle('');
      setTags([]);
      setUploadedFiles([]);
      setRichTextContent('');
      setCustomFormValues({});
      // 获取目录配置并更新状态
      const config = getDocumentConfigFromCategory(selectedCategory);
      setDocumentConfig(config);
      setChapters(config.chapters || []);
      setSelectedChapterId(null);
    }
  }, [visible, selectedCategory]);

  const handleFileChange = (info: any) => {
    if (info.file.status === 'done') {
      setUploadedFiles([...uploadedFiles, info.file]);
      message.success('文件上传成功');
    } else if (info.file.status === 'error') {
      message.error('文件上传失败');
    }
  };

  const handleRemoveFile = (file: any) => {
    setUploadedFiles(uploadedFiles.filter(f => f.uid !== file.uid));
  };

  const handleCustomFieldChange = (fieldCode: string, value: any) => {
    setCustomFormValues({ ...customFormValues, [fieldCode]: value });
  };

  const handleOk = async () => {
    try {
      if (!selectedCategory) {
        message.error('请先选择左侧的知识目录');
        return;
      }
      if (!title.trim()) {
        message.error('请输入知识标题');
        return;
      }
      if (tags.length === 0) {
        message.error('请添加标签');
        return;
      }

      if (documentConfig.template_type === 'file' && uploadedFiles.length === 0) {
        message.error('请上传文件');
        return;
      }

      setLoading(true);

      const knowledgeData: any = {
        title: title.trim(),
        tags,
        category_id: selectedCategory.id,
      };

      switch (documentConfig.template_type) {
        case 'file':
          knowledgeData.source_type = 'local_document';
          knowledgeData.files = uploadedFiles.map(f => f.response?.url || f.name);
          break;
        case 'rich_text':
          knowledgeData.content = richTextContent;
          break;
        case 'custom':
          knowledgeData.custom_fields = customFormValues;
          break;
        default:
          break;
      }

      if (documentConfig.has_knowledge_content) {
        knowledgeData.chapter_type = documentConfig.chapter_type;
        knowledgeData.chapters = chapters;
        if (documentConfig.chapter_type === 'rich_text_only') {
          knowledgeData.chapter_content = richTextContent;
        }
      }

      console.log('Knowledge data:', knowledgeData);

      message.success('知识添加成功');
      setLoading(false);
      onSuccess();
      onCancel();
    } catch (error) {
      console.error('Failed to create knowledge:', error);
      message.error('添加知识失败: ' + (error as Error).message);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setTitle('');
    setTags([]);
    setUploadedFiles([]);
    setRichTextContent('');
    setCustomFormValues({});
    onCancel();
  };

  const renderFileUploadContent = () => {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>文件上传</span>
          <Tooltip title="支持上传本地文件快速录入知识">
            <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
          </Tooltip>
        </div>
        <Upload
          multiple
          showUploadList={{
            showPreviewIcon: false,
            removeIcon: <Button size="small">删除</Button>,
          }}
          action="/api/upload"
          onChange={handleFileChange}
          fileList={uploadedFiles}
          onRemove={handleRemoveFile}
        >
          <Button icon={<UploadOutlined />}>点击上传文件</Button>
        </Upload>
      </div>
    );
  };

  const renderRichTextContent = () => {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>富文本内容</span>
          <Tooltip title="使用富文本框录入知识">
            <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
          </Tooltip>
        </div>
        <Input.TextArea
          rows={8}
          value={richTextContent}
          onChange={(e) => setRichTextContent(e.target.value)}
          placeholder="请输入富文本内容..."
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
      </div>
    );
  };

  const renderCustomFormContent = () => {
    const fields = documentConfig.custom_fields || [];
    
    if (fields.length === 0) {
      return (
        <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <p style={{ color: '#999', textAlign: 'center' }}>该目录没有配置自定义字段</p>
        </div>
      );
    }

    return (
      <div
        style={{
          marginBottom: 16,
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          padding: 16,
          background: 'transparent',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {fields.map(field => (
            <div key={field.id}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                {field.fieldName}
                {field.isRequired && <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span>}
              </label>
              {field.fieldType === 'text' && (
                <Input
                  value={customFormValues[field.fieldCode]}
                  onChange={(e) => handleCustomFieldChange(field.fieldCode, e.target.value)}
                  placeholder={field.description || `请输入${field.fieldName}`}
                />
              )}
              {field.fieldType === 'textarea' && (
                <Input.TextArea
                  value={customFormValues[field.fieldCode]}
                  onChange={(e) => handleCustomFieldChange(field.fieldCode, e.target.value)}
                  rows={3}
                  placeholder={field.description || `请输入${field.fieldName}`}
                />
              )}
              {field.fieldType === 'number' && (
                <Input
                  type="number"
                  value={customFormValues[field.fieldCode]}
                  onChange={(e) => handleCustomFieldChange(field.fieldCode, parseInt(e.target.value) || 0)}
                  placeholder={field.description || `请输入${field.fieldName}`}
                />
              )}
              {field.fieldType === 'select' && (
                <Select
                  value={customFormValues[field.fieldCode]}
                  onChange={(value) => handleCustomFieldChange(field.fieldCode, value)}
                  placeholder={field.description || `请选择${field.fieldName}`}
                >
                  {field.fieldDict?.split(',').map(item => (
                    <Select.Option key={item.trim()} value={item.trim()}>{item.trim()}</Select.Option>
                  ))}
                </Select>
              )}
              {field.fieldType === 'select_multiple' && (
                <Select
                  mode="multiple"
                  value={customFormValues[field.fieldCode] || []}
                  onChange={(value) => handleCustomFieldChange(field.fieldCode, value)}
                  placeholder={field.description || `请选择${field.fieldName}`}
                >
                  {field.fieldDict?.split(',').map(item => (
                    <Select.Option key={item.trim()} value={item.trim()}>{item.trim()}</Select.Option>
                  ))}
                </Select>
              )}
              {field.fieldType === 'date' && (
                <DatePicker
                  value={customFormValues[field.fieldCode] ? new Date(customFormValues[field.fieldCode]) : null}
                  onChange={(date) => handleCustomFieldChange(field.fieldCode, date?.format('YYYY-MM-DD') || '')}
                  style={{ width: '100%' }}
                />
              )}
              {field.fieldType === 'radio' && (
                <Radio.Group
                  value={customFormValues[field.fieldCode]}
                  onChange={(e) => handleCustomFieldChange(field.fieldCode, e.target.value)}
                >
                  {field.fieldDict?.split(',').map(item => (
                    <Radio key={item.trim()} value={item.trim()}>{item.trim()}</Radio>
                  ))}
                </Radio.Group>
              )}
              {field.fieldType === 'checkbox' && (
                <Checkbox.Group
                  value={customFormValues[field.fieldCode] || []}
                  onChange={(value) => handleCustomFieldChange(field.fieldCode, value)}
                >
                  {field.fieldDict?.split(',').map(item => (
                    <Checkbox key={item.trim()} value={item.trim()}>{item.trim()}</Checkbox>
                  ))}
                </Checkbox.Group>
              )}
              {field.fieldType === 'file' && (
                <Upload
                  showUploadList={false}
                  action="/api/upload"
                  onChange={(info) => {
                    if (info.file.status === 'done') {
                      handleCustomFieldChange(field.fieldCode, info.file.response?.url);
                      message.success('文件上传成功');
                    }
                  }}
                >
                  <Button icon={<UploadOutlined />}>上传文件</Button>
                </Upload>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTemplateContent = () => {
    const templateType = documentConfig.template_type;
    
    // 调试信息
    console.log('Template type:', templateType);
    console.log('Document config:', documentConfig);
    
    switch (templateType) {
      case 'file':
        return renderFileUploadContent();
      case 'rich_text':
        return renderRichTextContent();
      case 'custom':
        return renderCustomFormContent();
      default:
        // 如果没有配置模板类型，显示默认的富文本编辑器
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>富文本内容</span>
              <Tooltip title="目录未配置模板类型，显示默认富文本编辑器">
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
              </Tooltip>
            </div>
            <Input.TextArea
              rows={8}
              value={richTextContent}
              onChange={(e) => setRichTextContent(e.target.value)}
              placeholder="请输入富文本内容..."
              style={{ width: '100%', fontFamily: 'monospace' }}
            />
          </div>
        );
    }
  };

  return (
    <Modal
      title="新增知识"
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={900}
    >
      <Form form={form} layout="vertical">
        {/* 知识标题 */}
        <Form.Item
          label="知识标题"
          rules={[{ required: true, message: '请输入知识标题' }]}
          style={{ marginBottom: 16 }}
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入知识标题"
          />
        </Form.Item>

        {/* 标签 */}
        <Form.Item
          label="标签"
          rules={[{ required: true, message: '请添加标签' }]}
          style={{ marginBottom: 16 }}
        >
          <TagsInput value={tags} onChange={setTags} />
        </Form.Item>

        {/* 如果没有选择目录，显示提示 */}
        {!selectedCategory && (
          <div style={{ padding: 24, textAlign: 'center', background: '#f5f5f5', borderRadius: 8, marginBottom: 16 }}>
            <p style={{ color: '#999' }}>请先在左侧目录树中选择一个知识目录</p>
            <p style={{ color: '#bbb', fontSize: 12, marginTop: 8 }}>选择后将根据目录配置显示对应的编辑内容</p>
          </div>
        )}

        {/* 根据模板类型显示内容 */}
        {selectedCategory && renderTemplateContent()}

        {/* 如果知识正文开启，显示章节编辑器 */}
        {selectedCategory && documentConfig.has_knowledge_content && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>章节目录</span>
              <Tooltip title="根据章节目录显示信息">
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
              </Tooltip>
            </div>
            <ChapterEditor
              chapterType={documentConfig.chapter_type || 'fixed'}
              chapters={chapters}
              onChaptersChange={setChapters}
              selectedChapterId={selectedChapterId}
              onSelectChapter={setSelectedChapterId}
            />
          </div>
        )}
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <Button onClick={handleCancel} disabled={loading}>
          取消
        </Button>
        <Button
          type="primary"
          onClick={handleOk}
          loading={loading}
        >
          保存
        </Button>
      </div>
    </Modal>
  );
};

export default KnowledgeModal;