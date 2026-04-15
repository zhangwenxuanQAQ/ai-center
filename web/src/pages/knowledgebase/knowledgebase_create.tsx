import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, message, Row, Col, Upload, Spin, Tag, Avatar, Modal, InputNumber, Switch, Slider, Tooltip, Drawer, Descriptions } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UploadOutlined, DatabaseOutlined, ApiOutlined, QuestionCircleOutlined, EyeOutlined, PlusOutlined, DeleteOutlined, SettingOutlined, CloseOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { knowledgebaseService, KnowledgebaseCategory } from '../../services/knowledgebase';
import { llmModelService, LLMModel } from '../../services/llm_model';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './knowledgebase_create.less';

const { Option } = Select;

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
  const [viewModelDrawerVisible, setViewModelDrawerVisible] = useState(false);
  const [currentModel, setCurrentModel] = useState<any>(null);
  
  const [retrievalConfig, setRetrievalConfig] = useState<any>({});
  const [retrievalConfigs, setRetrievalConfigs] = useState<any[]>([]);
  const [modelTypes, setModelTypes] = useState<Record<string, string>>({});

  // 模型类型信息
  const MODEL_TYPES = [
    { type: 'embedding', name: '向量模型', required: true , description: '用于将文本转换为向量存储'},
    { type: 'rerank', name: 'Rerank模型', required: false, description: '用于重排序，如果不选那么默认使用余弦相似度排序' },
    { type: 'text', name: '文本模型', required: false, description: '用于关键词提取' }
  ];

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
    fetchModelTypes();
    fetchRetrievalConfigs();
    
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

  const fetchModelTypes = async () => {
    try {
      const types = await llmModelService.getModelTypes();
      setModelTypes(types);
    } catch (error) {
      console.error('Failed to fetch model types:', error);
    }
  };

  const fetchRetrievalConfigs = async () => {
    try {
      // 这里应该调用后端API获取检索配置项
      // 暂时使用前端常量，后续替换为后端API
      const configs = [
        {
          key: "vector_similarity",
          label: "文本相似度阈值",
          type: "slider",
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.2,
          description: "文本相似度阈值，用于筛选检索结果"
        },
        {
          key: "keyword_similarity",
          label: "关键词相似度阈值",
          type: "slider",
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.3,
          description: "关键词相似度阈值，用于筛选检索结果"
        },
        {
          key: "top_k",
          label: "召回数量",
          type: "slider",
          min: 1,
          max: 20,
          step: 1,
          default: 5,
          description: "检索时返回的最大结果数量"
        },
        {
          key: "sort_by",
          label: "排序方式",
          type: "select",
          options: [
            { value: "sim", label: "混合相似度" },
            { value: "vsim", label: "向量相似度" },
            { value: "tsim", label: "关键词相似度" }
          ],
          default: "sim",
          description: "检索结果的排序方式"
        }
      ];
      setRetrievalConfigs(configs);
      
      // 初始化默认值
      const defaultConfig: any = {};
      configs.forEach(config => {
        defaultConfig[config.key] = config.default;
      });
      setRetrievalConfig(defaultConfig);
    } catch (error) {
      console.error('Failed to fetch retrieval configs:', error);
    }
  };

  const getModelTypeName = (modelType: string): string => {
    return modelTypes[modelType] || modelType;
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

  const handleViewModel = (model: LLMModel) => {
    setCurrentModel(model);
    setViewModelDrawerVisible(true);
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

  const renderRetrievalConfig = (param: any) => {
    const value = retrievalConfig[param.key] ?? param.default;

    switch (param.type) {
      case 'slider':
        return (
          <div key={param.key}>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>{param.label}</span>
              <Tooltip title={param.description}>
                <QuestionCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
              </Tooltip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Slider
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => handleSliderChange(param.key, v)}
                style={{ flex: 1 }}
              />
              <InputNumber
                size="small"
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(value) => value !== null && handleSliderChange(param.key, value)}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>{param.min}</span>
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>{param.max}</span>
            </div>
          </div>
        );
      case 'select':
        return (
          <div key={param.key}>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>{param.label}</span>
              <Tooltip title={param.description}>
                <QuestionCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
              </Tooltip>
            </div>
            <Select
              value={value}
              onChange={(v) => handleSliderChange(param.key, v)}
              style={{ width: '100%' }}
            >
              {param.options?.map((opt: any) => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </div>
        );
      default:
        return null;
    }
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

      <div className="knowledgebase-create-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 80px)', overflow: 'hidden' }}>
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
                            onClick={() => handleViewModel(selectedModel)}
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
                {retrievalConfigs.map(param => renderRetrievalConfig(param))}
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
                    {model.provider} · {getModelTypeName(model.model_type)}
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

      {/* 模型查看抽屉 */}
      <Drawer
        title="模型详情"
        placement="right"
        onClose={() => setViewModelDrawerVisible(false)}
        open={viewModelDrawerVisible}
        width={600}
        getContainer={false}
        className={`chatbot-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {currentModel && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <img 
                src={getProviderAvatar(currentModel.provider || '')}
                alt={currentModel.provider}
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/src/assets/llm/default.svg';
                }}
              />
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                  {currentModel.name}
                </h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                  {currentModel.provider} · {getModelTypeName(currentModel.model_type)}
                </p>
              </div>
            </div>
            
            <Descriptions 
              bordered 
              column={{ xs: 1, sm: 1, md: 1, lg: 1, xl: 1, xxl: 1 }}
              style={{ 
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fafafa',
                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e8e8e8'
              }}
            >
              <Descriptions.Item label="模型类型">
                {getModelTypeName(currentModel.model_type)}
              </Descriptions.Item>
              <Descriptions.Item label="端点地址">
                {currentModel.endpoint || '未配置'}
              </Descriptions.Item>
              <Descriptions.Item label="支持图片">
                {currentModel.support_image ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentModel.status ? 'green' : 'red'}>
                  {currentModel.status ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {currentModel.tags && (Array.isArray(currentModel.tags) ? currentModel.tags : JSON.parse(currentModel.tags)).map((tag: string, index: number) => (
                    <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px' }}>
                      {tag}
                    </Tag>
                  ))}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="配置">
                <pre style={{ 
                  fontSize: '12px', 
                  color: theme === 'dark' ? '#ccc' : '#333',
                  backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflowX: 'auto'
                }}>
                  {JSON.stringify(currentModel.config || {}, null, 2)}
                </pre>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {currentModel.created_at || '未设置'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {currentModel.updated_at || '未更新'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default KnowledgebaseCreate;