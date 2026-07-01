import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Button, Upload, message, Select, Radio, Checkbox, DatePicker, Tooltip } from 'antd';
import { UploadOutlined, InfoCircleOutlined, InboxOutlined } from '@ant-design/icons';
import MDEditorTheme from '../../components/MDEditorTheme';
import dayjs from 'dayjs';
import TagsInput from '../../components/TagsInput';
import ChapterEditor from '../../components/ChapterEditor';
import { Chapter } from './folder_modal/AddChapterModal';
import { SimpleTableRow } from '../../components/SimpleEditableTable';
import { KnowledgebaseDocument, KnowledgebaseDocumentCategory, knowledgebaseService } from '../../services/knowledgebase';

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
  document?: KnowledgebaseDocument | undefined;
  onCancel: () => void;
  onSuccess: () => void;
}

const KnowledgeModal: React.FC<KnowledgeModalProps> = ({
  visible,
  knowledgebaseId,
  selectedCategory,
  document,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [fileList, setFileList] = useState<any[]>([]);
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

  // 文件映射，用于保存实际的 File 对象
  const fileMapRef = useRef<Map<string, File>>(new Map());

  const isEditMode = !!document;

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
      setFileList([]);
      fileMapRef.current.clear();
      setCustomFormValues({});
      setSelectedChapterId(null);

      if (isEditMode && document) {
        // 编辑模式：加载现有文档数据
        
        // 先解析 document_config
        let docConfig: Record<string, any> = {};
        if (document.document_config) {
          try {
            docConfig = typeof document.document_config === 'string' 
              ? JSON.parse(document.document_config) 
              : document.document_config;
          } catch (e) {
            console.error('Failed to parse document_config:', e);
          }
        }
        
        // 优先从 document_config 中获取标题
        setTitle(docConfig.title || document.title || document.file_name || '');
        setTags(Array.isArray(document.tags) ? document.tags : []);
        setRichTextContent(document.content || '');
        
        setChapters(docConfig.chapters || []);
        
        // 如果是文件类型，设置已上传的文件列表
        if (document.source_type === 'local_document' && document.file_name) {
          setFileList([{
            uid: document.id || document.file_name,
            name: document.file_name,
            size: document.file_size || 0,
            status: 'done',
          }]);
        }
        setCustomFormValues(docConfig.custom_fields || {});
        
        // 获取目录配置作为基础，然后用文档自己的配置覆盖（但保留目录的字段定义）
        const categoryConfig = getDocumentConfigFromCategory(selectedCategory);
        // 删除 docConfig 中的 custom_fields，避免覆盖目录的字段定义
        const { custom_fields: _docCustomFields, ...restDocConfig } = docConfig;
        setDocumentConfig({
          ...categoryConfig,
          ...restDocConfig,
          chapters: docConfig.chapters || categoryConfig.chapters,
        });
      } else {
        // 新增模式：使用目录配置
        setTitle('');
        setTags([]);
        setRichTextContent('');
        const config = getDocumentConfigFromCategory(selectedCategory);
        setDocumentConfig(config);
        setChapters(config.chapters || []);
      }
    }
  }, [visible, selectedCategory, document, isEditMode]);

  const handleFileChange = (file: File) => {
    const isExe = file.name.toLowerCase().endsWith('.exe');
    if (isExe) {
      message.error('不支持上传可执行文件（.exe）');
      return false;
    }
    fileMapRef.current.set(file.uid, file);
    setFileList(prev => [...prev, { uid: file.uid, name: file.name, size: file.size }]);
    return false;
  };

  const handleRemoveFile = (file: any) => {
    fileMapRef.current.delete(file.uid);
    setFileList(prev => prev.filter(f => f.uid !== file.uid));
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

      if (documentConfig.template_type === 'file' && fileList.length === 0) {
        message.error('请上传文件');
        return;
      }

      setLoading(true);

      // 构建 document_config（自定义字段和章节目录信息）
      let documentConfigData: Record<string, any> = {};
      
      if (isEditMode && document?.document_config) {
        // 编辑模式：先获取原有的 document_config，然后合并新数据
        try {
          const existingConfig = typeof document.document_config === 'string' 
            ? JSON.parse(document.document_config) 
            : document.document_config;
          documentConfigData = { ...existingConfig };
        } catch (e) {
          console.error('Failed to parse existing document_config:', e);
        }
      }
      
      // 更新自定义字段
      documentConfigData.custom_fields = customFormValues;
      // 更新知识标题
      documentConfigData.title = title.trim();
      // 更新章节目录信息
      if (documentConfig.has_knowledge_content && chapters.length > 0) {
        documentConfigData.chapters = chapters;
        documentConfigData.chapter_type = documentConfig.chapter_type;
      } else {
        // 如果没有章节目录，删除相关字段
        delete documentConfigData.chapters;
        delete documentConfigData.chapter_type;
      }

      switch (documentConfig.template_type) {
        case 'file':
          // 文件类型：使用 uploadDocuments 接口上传文件
          const files = fileList.map(f => fileMapRef.current.get(f.uid)).filter(Boolean) as File[];
          
          if (!isEditMode && files.length === 0) {
            // 新增模式需要上传文件，编辑模式不需要
            message.error('请先上传文件');
            setLoading(false);
            return;
          }
          
          if (isEditMode && document) {
            const editFiles = fileList.map(f => fileMapRef.current.get(f.uid)).filter(Boolean) as File[];
            
            if (editFiles.length > 0) {
              // 如果上传了新文件，先删除旧文档，然后上传新文件
              await knowledgebaseService.deleteDocument(knowledgebaseId, document.id);
              
              const result = await knowledgebaseService.uploadDocuments(
                knowledgebaseId,
                editFiles,
                'local_document',
                selectedCategory.id,
                selectedCategory.chunk_method || 'default',
                selectedCategory.chunk_config || {},
                tags,
                true
              );
              
              // 更新新文档的配置
              const uploadedDocs = Array.isArray(result) ? result : (result.data || result.documents || []);
              if (uploadedDocs.length > 0) {
                await knowledgebaseService.updateDocument(knowledgebaseId, uploadedDocs[0].id, {
                  title: title.trim(),
                  document_config: documentConfigData,
                } as any);
              }
            } else {
              // 如果没有上传新文件，只更新文档配置
              await knowledgebaseService.updateDocument(knowledgebaseId, document.id, {
                kb_id: knowledgebaseId,
                title: title.trim(),
                tags,
                category_id: selectedCategory.id,
                source_type: 'local_document',
                chunk_method: selectedCategory.chunk_method || 'default',
                chunk_config: selectedCategory.chunk_config || {},
                document_config: documentConfigData,
              } as any);
            }
          } else {
            // 新增模式：使用 uploadDocuments 接口
            const result = await knowledgebaseService.uploadDocuments(
              knowledgebaseId,
              files,
              'local_document',
              selectedCategory.id,
              selectedCategory.chunk_method || 'default',
              selectedCategory.chunk_config || {},
              tags,
              true
            );
            
            if (result.errors && result.errors.length > 0) {
              message.warning(`${result.errors.length}个文件上传失败`);
            }
            
            // 如果有文档创建成功，更新文档配置
            // result 直接就是文档数组，因为 request.ts 已经提取了 result.data
            const uploadedDocs = Array.isArray(result) ? result : (result.data || result.documents || []);
            if (Array.isArray(uploadedDocs) && uploadedDocs.length > 0) {
              for (const doc of uploadedDocs) {
                await knowledgebaseService.updateDocument(knowledgebaseId, doc.id, {
                  title: title.trim(),
                  document_config: documentConfigData,
                } as any);
              }
            } else {
              // 所有文件都上传失败，显示错误并保持弹窗打开
              message.error('文件上传失败，请检查文件内容是否为空或格式是否正确');
              setLoading(false);
              return;
            }
          }
          break;
        case 'rich_text':
        case 'custom_template':
        default:
          // 其他类型：使用 createDocument 或 updateDocument 接口
          if (isEditMode && document) {
            await knowledgebaseService.updateDocument(knowledgebaseId, document.id, {
              kb_id: knowledgebaseId,
              title: title.trim(),
              tags,
              category_id: selectedCategory.id,
              source_type: 'rich_text',
              chunk_method: selectedCategory.chunk_method || 'default',
              chunk_config: selectedCategory.chunk_config || {},
              content: richTextContent,
              document_config: documentConfigData,  // 直接传递对象，不是字符串
            } as any);
          } else {
            await knowledgebaseService.createDocument(knowledgebaseId, {
              kb_id: knowledgebaseId,
              title: title.trim(),
              tags,
              category_id: selectedCategory.id,
              source_type: 'rich_text',
              chunk_method: selectedCategory.chunk_method || 'default',
              chunk_config: selectedCategory.chunk_config || {},
              content: richTextContent,
              document_config: documentConfigData,  // 直接传递对象，不是字符串
            } as any);
          }
          break;
      }

      message.success(isEditMode ? '知识更新成功' : '知识添加成功');
      setLoading(false);
      onSuccess();
      onCancel();
    } catch (error) {
      console.error('Failed to save knowledge:', error);
      message.error((isEditMode ? '更新' : '添加') + '知识失败: ' + (error as Error).message);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setTitle('');
    setTags([]);
    setFileList([]);
    fileMapRef.current.clear();
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
        <Upload.Dragger
          multiple
          beforeUpload={handleFileChange}
          onRemove={handleRemoveFile}
          showUploadList={true}
          fileList={fileList.map(f => ({
            uid: f.uid,
            name: f.name,
            status: 'done',
            size: f.size
          }))}
          style={{
            background: '#fafafa',
            border: '1px dashed #d9d9d9',
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: 'var(--primary-color)', fontSize: 40 }} />
          </p>
          <p style={{ color: '#666' }}>
            点击或拖拽文件到此区域上传
          </p>
          <p style={{ color: '#999', fontSize: 12 }}>
            支持上传文档、图片或音频文件
          </p>
        </Upload.Dragger>
      </div>
    );
  };

  const renderRichTextContent = () => {
    return (
      <div style={{ marginBottom: 16 }}>
        {/* <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>富文本内容</span>
          <Tooltip title="使用富文本框录入知识">
            <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
          </Tooltip>
        </div> */}
        <MDEditorTheme
          height={250}
          value={richTextContent}
          onChange={setRichTextContent}
          placeholder="请输入内容..."
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
                  value={customFormValues[field.fieldCode] ? dayjs(customFormValues[field.fieldCode]) : undefined}
                  onChange={(date, dateString) => handleCustomFieldChange(field.fieldCode, dateString || '')}
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
      case 'custom_template':
        return renderCustomFormContent();
      default:
        // 如果没有配置模板类型，显示默认的富文本编辑器
        return (
          <div style={{ marginBottom: 16 }}>
            {/* <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>富文本内容</span>
              <Tooltip title="目录未配置模板类型，显示默认富文本编辑器">
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
              </Tooltip>
            </div> */}
            <MDEditorTheme
              height={250}
              value={richTextContent}
              onChange={setRichTextContent}
              placeholder="请输入内容..."
            />
          </div>
        );
    }
  };

  return (
    <Modal
      title={isEditMode ? '编辑知识' : '新增知识'}
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
            {/* <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>章节目录</span>
              <Tooltip title="根据章节目录显示信息">
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
              </Tooltip>
            </div> */}
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