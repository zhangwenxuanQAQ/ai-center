import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, message, Row, Col, Upload, Spin, Tag, Avatar, Modal, InputNumber, Switch, Slider, Tooltip } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UploadOutlined, DatabaseOutlined, ApiOutlined, QuestionCircleOutlined, EyeOutlined, PlusOutlined, DeleteOutlined, SettingOutlined, CloseOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { knowledgebaseService, KnowledgebaseCategory } from '../../services/knowledgebase';
import { llmModelService, LLMModel } from '../../services/llm_model';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './knowledgebase_create.less';

const { Option } = Select;

const MODEL_TYPES = [
  { type: 'embedding', name: '向量模型', required: true , description: '用于将文本转换为向量存储'},
  { type: 'rerank', name: 'Rerank模型', required: false, description: '用于重排序，如果不选那么默认使用余弦相似度排序' },
  { type: 'text', name: '文本模型', required: false, description: '用于关键词提取' }
];

const getProviderAvatar = (provider: string): string => {
  if (!provider) {
    return '/src/assets/llm/default.svg';
  }
  const lowercaseProvider = provider.toLowerCase();
  return `/src/assets/llm/${lowercaseProvider}.svg`;
};

const KnowledgebaseCreate: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<KnowledgebaseCategory[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  
  const [embeddingModels, setEmbeddingModels] = useState<LLMModel[]>([]);
  const [rerankModels, setRerankModels] = useState<LLMModel[]>([]);
  const [textModels, setTextModels] = useState<LLMModel[]>([]);
  
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<LLMModel | null>(null);
  const [selectedRerankModel, setSelectedRerankModel] = useState<LLMModel | null>(null);
  const [selectedTextModel, setSelectedTextModel] = useState<LLMModel | null>(null);
  
  const [isModelSelectModalVisible, setIsModelSelectModalVisible] = useState(false);
  const [selectingModelType, setSelectingModelType] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);
  
  const [retrievalConfig, setRetrievalConfig] = useState<any>({
    vector_similarity: 0.2,
    keyword_similarity: 0.3,
    top_k: 5
  });

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'light';
      setTheme(newTheme as 'light' | 'dark');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchModels();
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await knowledgebaseService.getCategoryTree();
      setCategories(data);
      
      const defaultCategory = data.find((cat: KnowledgebaseCategory) => cat.name === '默认分类');
      if (defaultCategory) {
        form.setFieldValue('category_id', defaultCategory.id);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await llmModelService.getLLMModels(1, 100, undefined, undefined, undefined, 'true');
      const models = response.data || [];
      
      setEmbeddingModels(models.filter((m: LLMModel) => m.model_type === 'embedding' && m.status));
      setRerankModels(models.filter((m: LLMModel) => m.model_type === 'rerank' && m.status));
      setTextModels(models.filter((m: LLMModel) => m.model_type === 'text' && m.status));
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleSelectModel = (modelType: string) => {
    setSelectingModelType(modelType);
    let models: LLMModel[] = [];
    switch (modelType) {
      case 'embedding':
        models = embeddingModels;
        break;
      case 'rerank':
        models = rerankModels;
        break;
      case 'text':
        models = textModels;
        break;
    }
    setAvailableModels(models);
    setIsModelSelectModalVisible(true);
  };

  const handleBindModel = (model: LLMModel) => {
    switch (selectingModelType) {
      case 'embedding':
        setSelectedEmbeddingModel(model);
        break;
      case 'rerank':
        setSelectedRerankModel(model);
        break;
      case 'text':
        setSelectedTextModel(model);
        break;
    }
    setIsModelSelectModalVisible(false);
  };

  const handleUnbindModel = (modelType: string) => {
    switch (modelType) {
      case 'embedding':
        setSelectedEmbeddingModel(null);
        break;
      case 'rerank':
        setSelectedRerankModel(null);
        break;
      case 'text':
        setSelectedTextModel(null);
        break;
    }
  };

  const handleSliderChange = (key: string, value: any) => {
    setRetrievalConfig((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleInputChange = (key: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setRetrievalConfig((prev: any) => ({
        ...prev,
        [key]: numValue
      }));
    }
  };

  const handleSave = async () => {
    if (!selectedEmbeddingModel) {
      message.error('请选择向量模型');
      return;
    }

    setSaving(true);
    try {
      const values = await form.validateFields();
      
      if (!values.name || !values.name.trim()) {
        message.error('请输入名称');
        return;
      }
      if (!values.code || !values.code.trim()) {
        message.error('请输入编码');
        return;
      }
      if (!values.description || !values.description.trim()) {
        message.error('请输入描述');
        return;
      }
      
      const createData = {
        ...values,
        avatar: avatarPreview,
        embedding_model_id: selectedEmbeddingModel.id,
        rerank_model_id: selectedRerankModel?.id,
        text_model_id: selectedTextModel?.id,
        retrieval_config: retrievalConfig
      };
      
      await knowledgebaseService.createKnowledgebase(createData);
      message.success('知识库创建成功');
      navigate('/knowledgebases');
    } catch (error) {
      console.error('Failed to create knowledgebase:', error);
      if (error.errorFields) {
        const missingFields = error.errorFields.map((field: any) => field.name[0]);
        message.error(`请填写必填项：${missingFields.join(', ')}`);
      } else {
        message.error('知识库创建失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/knowledgebases');
  };

  const uploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    accept: 'image/*',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('图片大小不能超过 5MB！');
        return false;
      }
      return true;
    },
    customRequest: ({ file, onSuccess }) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setAvatarPreview(base64);
        form.setFieldValue('avatar', base64);
      };
      reader.readAsDataURL(file as Blob);
      if (onSuccess) {
        onSuccess({ status: 'done' }, file);
      }
    },
  };

  const buildCategoryTreeSelectData = () => {
    return categories.map(category => ({
      title: category.name,
      value: category.id,
      children: category.children?.map(child => ({
        title: child.name,
        value: child.id
      }))
    }));
  };

  if (loading) {
    return (
      <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader
        items={[
          { title: '知识库管理', icon: <DatabaseOutlined />, onClick: () => navigate('/knowledgebases') },
          { title: '创建知识库' }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回列表
          </Button>
        }
      />

      <div className="knowledgebase-create-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '30%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', overflowX: 'hidden' }} className="hide-scrollbar">
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .hide-scrollbar-inner::-webkit-scrollbar { display: none; } .hide-scrollbar-inner { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
            <div 
              className={`setting-section ${theme === 'dark' ? 'dark' : 'light'}`}
              style={{ 
                padding: '16px', 
                borderRadius: '4px', 
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}
            >
              <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>基本信息</h3>
              </div>
              
              <Form 
                form={form} 
                layout="vertical"
                style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
                className="hide-scrollbar-inner"
              >
                <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                  <Input placeholder="请输入名称" />
                </Form.Item>
                <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }, { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }]}>
                  <Input placeholder="请输入编码（字母、数字、下划线）" />
                </Form.Item>
                <Form.Item name="description" label="描述" rules={[{ required: true, message: '请输入描述' }]}>
                  <TextArea rows={4} placeholder="请输入描述，介绍知识库包含的内容以及使用场景，这将知道模型何时调用知识库" />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="category_id" label="分类">
                      <TreeSelect
                        placeholder="请选择分类"
                        treeData={buildCategoryTreeSelectData()}
                        treeDefaultExpandAll
                        allowClear
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="avatar" label="头像">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {avatarPreview && (
                          <img 
                            src={avatarPreview} 
                            alt="头像预览" 
                            style={{ 
                              width: 48, 
                              height: 48, 
                              borderRadius: '50%', 
                              objectFit: 'cover',
                              border: '2px solid #d9d9d9'
                            }} 
                          />
                        )}
                        <Upload {...uploadProps} maxCount={1}>
                          <Button icon={<UploadOutlined />} size="small">上传</Button>
                        </Upload>
                      </div>
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="status" label="启用状态" valuePropName="checked" initialValue={true}>
                  <Switch checkedChildren="启用" unCheckedChildren="停用" />
                </Form.Item>
              </Form>
            </div>
          </div>

          <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', overflowX: 'hidden', flex: 1 }} className="hide-scrollbar">
            {/* 模型配置 */}
            <div style={{ 
              padding: '16px', 
              borderRadius: '4px', 
              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa'
            }}>
              <div style={{ marginBottom: '12px',display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ApiOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
                <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>模型配置</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {MODEL_TYPES.map(modelTypeInfo => {
                  let selectedModel: LLMModel | null = null;
                  switch (modelTypeInfo.type) {
                    case 'embedding':
                      selectedModel = selectedEmbeddingModel;
                      break;
                    case 'rerank':
                      selectedModel = selectedRerankModel;
                      break;
                    case 'text':
                      selectedModel = selectedTextModel;
                      break;
                  }
                  
                  return (
                    <div key={modelTypeInfo.type} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      padding: '8px 12px',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                      borderRadius: '4px',
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff'
                    }}>
                      <div style={{ 
                        minWidth: '80px', 
                        fontSize: '13px', 
                        fontWeight: 500,
                        color: theme === 'dark' ? '#fff' : '#000',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {modelTypeInfo.name}：
                        {modelTypeInfo.required && (
                          <span style={{ color: '#ff4d4f' }}>*</span>
                        )}
                        {(modelTypeInfo.type === 'text' || modelTypeInfo.type === 'embedding' || modelTypeInfo.type === 'rerank') && modelTypeInfo.description && (
                          <Tooltip title={modelTypeInfo.description}>
                            <EyeOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
                          </Tooltip>
                        )}
                      </div>
                      
                      {selectedModel ? (
                        <>
                          <div style={{ 
                            flex: 1, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px' 
                          }}>
                            <img 
                              src={getProviderAvatar(selectedModel.provider || '')}
                              alt={selectedModel.provider}
                              style={{ 
                                width: 28, 
                                height: 28, 
                                borderRadius: '50%',
                                objectFit: 'cover',
                                flexShrink: 0
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/src/assets/llm/default.svg';
                              }}
                            />
                            <span style={{ fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>
                              {selectedModel.name}
                            </span>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {selectedModel.tags && (Array.isArray(selectedModel.tags) ? selectedModel.tags : JSON.parse(selectedModel.tags)).map((tag: string, index: number) => (
                              <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                                {tag}
                              </Tag>
                            ))}
                          </div>
                          </div>
                          <Button
                            type="text"
                            icon={<EyeOutlined />}
                            size="small"
                            title="查看模型"
                          />
                          <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            size="small"
                            danger
                            onClick={() => handleUnbindModel(modelTypeInfo.type)}
                            title="解绑模型"
                          />
                        </>
                      ) : (
                        <>
                          <div style={{ flex: 1, fontSize: '13px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                            {modelTypeInfo.required ? '未选择（必填）' : '未选择（可选）'}
                          </div>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            size="small"
                            onClick={() => handleSelectModel(modelTypeInfo.type)}
                          >
                            选择模型
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 检索配置 */}
            <div style={{ 
              padding: '16px', 
              borderRadius: '4px', 
              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa',
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DatabaseOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
                <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>检索配置</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                {/* 文本相似度阈值 */}
                <div>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>文本相似度阈值</span>
                    <Tooltip title="文档相似度的最低阈值，低于此阈值的文档将被过滤">
                      <QuestionCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
                    </Tooltip>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={retrievalConfig.vector_similarity}
                      onChange={(value) => handleSliderChange('vector_similarity', value)}
                      style={{ flex: 1 }}
                    />
                    <InputNumber
                      size="small"
                      min={0}
                      max={1}
                      step={0.01}
                      value={retrievalConfig.vector_similarity}
                      onChange={(value) => value !== null && handleSliderChange('vector_similarity', value)}
                      style={{ width: 80 }}
                    />
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>0</span>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>1</span>
                  </div>
                </div>

                {/* 关键词相似度阈值 */}
                <div>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>关键词相似度阈值</span>
                    <Tooltip title="关键词相似度的最低阈值，低于此阈值的关键词将被过滤">
                      <QuestionCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
                    </Tooltip>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={retrievalConfig.keyword_similarity}
                      onChange={(value) => handleSliderChange('keyword_similarity', value)}
                      style={{ flex: 1 }}
                    />
                    <InputNumber
                      size="small"
                      min={0}
                      max={1}
                      step={0.01}
                      value={retrievalConfig.keyword_similarity}
                      onChange={(value) => value !== null && handleSliderChange('keyword_similarity', value)}
                      style={{ width: 80 }}
                    />
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>0</span>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>1</span>
                  </div>
                </div>

                {/* 召回数量 */}
                <div>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>召回数量</span>
                    <Tooltip title="检索时返回的文档数量">
                      <QuestionCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
                    </Tooltip>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Slider
                      min={1}
                      max={20}
                      step={1}
                      value={retrievalConfig.top_k}
                      onChange={(value) => handleSliderChange('top_k', value)}
                      style={{ flex: 1 }}
                    />
                    <InputNumber
                      size="small"
                      min={1}
                      max={20}
                      step={1}
                      value={retrievalConfig.top_k}
                      onChange={(value) => value !== null && handleSliderChange('top_k', value)}
                      style={{ width: 80 }}
                    />
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>1</span>
                    <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>20</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          paddingTop: '16px', 
          borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px'
        }}>
          <Button onClick={handleBack}>
            返回
          </Button>
          <Button 
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存
          </Button>
        </div>
      </div>

      {/* 模型选择模态框 */}
      <Modal
        title={`选择${MODEL_TYPES.find(m => m.type === selectingModelType)?.name}`}
        open={isModelSelectModalVisible}
        onCancel={() => setIsModelSelectModalVisible(false)}
        footer={null}
        width={600}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {availableModels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: theme === 'dark' ? '#aaa' : '#999' }}>
            暂无可用模型
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {availableModels.map(model => (
              <div
                key={model.id}
                onClick={() => handleBindModel(model)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                  borderRadius: '4px',
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5';
                  e.currentTarget.style.borderColor = '#faad14';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff';
                  e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e8e8e8';
                }}
              >
                <img 
                  src={getProviderAvatar(model.provider || '')}
                  alt={model.provider}
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/src/assets/llm/default.svg';
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                    {model.name}
                  </div>
                  <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', marginTop: '4px' }}>
                    {model.provider}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {model.tags && (Array.isArray(model.tags) ? model.tags : JSON.parse(model.tags)).map((tag: string, index: number) => (
                    <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default KnowledgebaseCreate;
