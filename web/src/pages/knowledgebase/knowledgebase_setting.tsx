import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Input, Select, TreeSelect, Button, Switch, message, Row, Col, Upload, Slider, InputNumber, Tooltip, Modal, Tag } from 'antd';
const { TextArea } = Input;
const { Option } = Select;
import { SaveOutlined, UndoOutlined, UploadOutlined, InfoCircleOutlined, ApiOutlined, DatabaseOutlined, QuestionCircleOutlined, EyeOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { knowledgebaseService, Knowledgebase, KnowledgebaseCategory } from '../../services/knowledgebase';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { RETRIEVAL_CONFIGS } from '../../constants/knowledgebase';
import '../../styles/common.css';
import './knowledgebase.less';

const getProviderAvatar = (provider: string): string => {
  if (!provider) {
    return '/src/assets/llm/default.svg';
  }
  const lowercaseProvider = provider.toLowerCase();
  return `/src/assets/llm/${lowercaseProvider}.svg`;
};

interface KnowledgebaseSettingProps {
  knowledgebase: Knowledgebase;
  onUpdate: (id: string) => void;
  onViewModel?: (model: LLMModel) => void;
}

const KnowledgebaseSetting: React.FC<KnowledgebaseSettingProps> = ({ knowledgebase, onUpdate, onViewModel }) => {
  const [form] = Form.useForm();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<KnowledgebaseCategory[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<LLMModel[]>([]);
  const [rerankModels, setRerankModels] = useState<LLMModel[]>([]);
  const [textModels, setTextModels] = useState<LLMModel[]>([]);
  const [originalData, setOriginalData] = useState<Partial<Knowledgebase>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [retrievalConfig, setRetrievalConfig] = useState<Record<string, any>>({});
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [modelTypes, setModelTypes] = useState<Record<string, string>>({});
  const isInitialized = useRef(false);
  
  // 模型选择相关状态
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<LLMModel | null>(null);
  const [selectedRerankModel, setSelectedRerankModel] = useState<LLMModel | null>(null);
  const [selectedTextModel, setSelectedTextModel] = useState<LLMModel | null>(null);
  const [isModelSelectModalVisible, setIsModelSelectModalVisible] = useState(false);
  const [selectingModelType, setSelectingModelType] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'dark' | 'light');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'dark' | 'light');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchModels();
    fetchModelTypes();
  }, [knowledgebase]);

  useEffect(() => {
    if (embeddingModels.length > 0 || rerankModels.length > 0 || textModels.length > 0) {
      initializeForm();
    }
  }, [embeddingModels, rerankModels, textModels]);

  const fetchCategories = async () => {
    try {
      const data = await knowledgebaseService.getCategoryTree();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchModels = async () => {
    try {
      const data = await llmModelService.getLLMModels(1, 100);
      const models = data.data;
      setEmbeddingModels(models.filter(m => m.model_type === 'embedding'));
      setRerankModels(models.filter(m => m.model_type === 'rerank'));
      setTextModels(models.filter(m => m.model_type === 'text' || m.model_type === 'vision'));
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

  const getModelTypeName = (modelType: string): string => {
    return modelTypes[modelType] || modelType;
  };

  const initializeForm = () => {
    // 标记为正在初始化，防止触发变化检测
    isInitialized.current = false;

    // 初始化检索配置
    let configToSet: Record<string, any> = {};
    if (knowledgebase.retrieval_config) {
      configToSet = knowledgebase.retrieval_config;
    } else {
      RETRIEVAL_CONFIGS.forEach(config => {
        configToSet[config.key] = config.default;
      });
    }

    const statusValue = knowledgebase.status !== undefined ? knowledgebase.status : true;

    setOriginalData({
      name: knowledgebase.name,
      code: knowledgebase.code,
      description: knowledgebase.description,
      avatar: knowledgebase.avatar,
      category_id: knowledgebase.category_id,
      embedding_model_id: knowledgebase.embedding_model_id,
      rerank_model_id: knowledgebase.rerank_model_id,
      text_model_id: knowledgebase.text_model_id,
      retrieval_config: configToSet,
      status: statusValue
    });

    form.setFieldsValue({
      name: knowledgebase.name,
      code: knowledgebase.code,
      description: knowledgebase.description,
      category_id: knowledgebase.category_id,
      embedding_model_id: knowledgebase.embedding_model_id,
      rerank_model_id: knowledgebase.rerank_model_id,
      text_model_id: knowledgebase.text_model_id,
      status: statusValue
    });

    setRetrievalConfig(configToSet);

    if (knowledgebase.avatar) {
      setAvatarPreview(knowledgebase.avatar);
    }

    // 初始化选中的模型
    if (knowledgebase.embedding_model_id) {
      const embeddingModel = embeddingModels.find(m => m.id === knowledgebase.embedding_model_id);
      if (embeddingModel) {
        setSelectedEmbeddingModel(embeddingModel);
        form.setFieldsValue({ embedding_model_id: knowledgebase.embedding_model_id });
      }
    }
    if (knowledgebase.rerank_model_id) {
      const rerankModel = rerankModels.find(m => m.id === knowledgebase.rerank_model_id);
      if (rerankModel) {
        setSelectedRerankModel(rerankModel);
        form.setFieldsValue({ rerank_model_id: knowledgebase.rerank_model_id });
      }
    }
    if (knowledgebase.text_model_id) {
      const textModel = textModels.find(m => m.id === knowledgebase.text_model_id);
      if (textModel) {
        setSelectedTextModel(textModel);
        form.setFieldsValue({ text_model_id: knowledgebase.text_model_id });
      }
    }

    // 使用 setTimeout 确保所有状态更新完成后再标记为已初始化
    setTimeout(() => {
      isInitialized.current = true;
      setHasChanges(false);
    }, 0);
  };
  const checkHasChanges = useCallback(() => {
    if (!isInitialized.current) return;
    
    const currentValues = form.getFieldsValue();
    const nameChanged = currentValues.name !== originalData.name;
    const codeChanged = currentValues.code !== originalData.code;
    const descriptionChanged = currentValues.description !== originalData.description;
    const categoryChanged = currentValues.category_id !== originalData.category_id;
    
    // 模型ID比较，处理 null 和 undefined 的情况
    const getModelId = (value: any) => value === undefined || value === null ? null : value;
    const embeddingModelChanged = getModelId(currentValues.embedding_model_id) !== getModelId(originalData.embedding_model_id);
    const rerankModelChanged = getModelId(currentValues.rerank_model_id) !== getModelId(originalData.rerank_model_id);
    const textModelChanged = getModelId(currentValues.text_model_id) !== getModelId(originalData.text_model_id);
    
    const statusChanged = currentValues.status !== originalData.status;
    const retrievalConfigChanged = JSON.stringify(retrievalConfig) !== JSON.stringify(originalData.retrieval_config);

    setHasChanges(
      nameChanged || codeChanged || descriptionChanged || categoryChanged ||
      embeddingModelChanged || rerankModelChanged || textModelChanged ||
      statusChanged || retrievalConfigChanged
    );
  }, [form, originalData, retrievalConfig]);

  const handleValuesChange = useCallback(() => {
    if (!isInitialized.current) return;
    checkHasChanges();
  }, [checkHasChanges]);

  useEffect(() => {
    if (!isInitialized.current) return;
    checkHasChanges();
  }, [retrievalConfig, checkHasChanges]);

  const handleRetrievalConfigChange = (key: string, value: any) => {
    setRetrievalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleAvatarChange = async (info: any) => {
    if (info.file.status === 'done' || info.file.originFileObj) {
      const file = info.file.originFileObj;
      if (file) {
        try {
          const compressedBase64 = await compressImage(file, 200, 0.7);
          form.setFieldsValue({ avatar: compressedBase64 });
          setAvatarPreview(compressedBase64);
          message.success('头像上传成功');
          // 延迟检查变化，确保表单值已更新
          setTimeout(() => {
            checkHasChanges();
          }, 0);
        } catch (error) {
          message.error('头像处理失败');
        }
      }
    }
  };

  const compressImage = (file: File, maxWidth: number = 100, quality: number = 0.5): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new window.Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleRestore = () => {
    initializeForm();
    message.info('已恢复原始数据');
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const data = {
        ...values,
        retrieval_config: retrievalConfig
      };

      await knowledgebaseService.updateKnowledgebase(knowledgebase.id, data);
      message.success('知识库更新成功');

      // 更新原始数据，但不刷新页面
      setOriginalData({
        name: values.name,
        code: values.code,
        description: values.description,
        avatar: values.avatar,
        category_id: values.category_id,
        embedding_model_id: values.embedding_model_id,
        rerank_model_id: values.rerank_model_id,
        text_model_id: values.text_model_id,
        retrieval_config: retrievalConfig,
        status: values.status
      });

      setHasChanges(false);
      // 不调用 onUpdate，避免刷新页面
    } catch (error) {
      console.error('Failed to save knowledgebase:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const buildCategoryTreeSelectData = () => {
    const buildTree = (cats: KnowledgebaseCategory[]): any[] => {
      return cats.map(cat => ({
        title: cat.name,
        value: cat.id,
        children: cat.children && cat.children.length > 0 ? buildTree(cat.children) : undefined
      }));
    };
    return buildTree(categories);
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
                style={{ flex: 1 }}
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => handleRetrievalConfigChange(param.key, v)}
              />
              <InputNumber
                size="small"
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => handleRetrievalConfigChange(param.key, v)}
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
              onChange={(v) => handleRetrievalConfigChange(param.key, v)}
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

  const handleSelectModel = (modelType: string) => {
    setSelectingModelType(modelType);
    switch (modelType) {
      case 'embedding':
        setAvailableModels(embeddingModels);
        break;
      case 'rerank':
        setAvailableModels(rerankModels);
        break;
      case 'text':
        setAvailableModels(textModels);
        break;
    }
    setIsModelSelectModalVisible(true);
  };

  const handleModelSelect = (model: LLMModel) => {
    switch (selectingModelType) {
      case 'embedding':
        setSelectedEmbeddingModel(model);
        form.setFieldsValue({ embedding_model_id: model.id });
        break;
      case 'rerank':
        setSelectedRerankModel(model);
        form.setFieldsValue({ rerank_model_id: model.id });
        break;
      case 'text':
        setSelectedTextModel(model);
        form.setFieldsValue({ text_model_id: model.id });
        break;
    }
    setIsModelSelectModalVisible(false);
    // 延迟检查变化，确保表单值已更新
    setTimeout(() => {
      checkHasChanges();
    }, 0);
  };

  const handleUnbindModel = (modelType: string) => {
    switch (modelType) {
      case 'embedding':
        setSelectedEmbeddingModel(null);
        form.setFieldsValue({ embedding_model_id: null });
        break;
      case 'rerank':
        setSelectedRerankModel(null);
        form.setFieldsValue({ rerank_model_id: null });
        break;
      case 'text':
        setSelectedTextModel(null);
        form.setFieldsValue({ text_model_id: null });
        break;
    }
    // 延迟检查变化，确保表单值已更新
    setTimeout(() => {
      checkHasChanges();
    }, 0);
  };

  const handleViewModel = (model: LLMModel) => {
    if (onViewModel) {
      onViewModel(model);
    }
  };

  // 模型类型信息
  const MODEL_TYPES = [
    { type: 'embedding', name: '向量模型', required: true, description: '用于将文本转换为向量存储' },
    { type: 'rerank', name: 'Rerank模型', required: false, description: '用于重排序，如果不选那么默认使用余弦相似度排序' },
    { type: 'text', name: '文本模型', required: false, description: '用于关键词提取' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '8px', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '30%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', overflowX: 'hidden' }} className="hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .hide-scrollbar-inner::-webkit-scrollbar { display: none; } .hide-scrollbar-inner { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
          <div 
            className={`setting-section ${theme === 'dark' ? 'dark' : 'light'}`}
            style={{ 
              padding: '16px', 
              borderRadius: '4px', 
              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgb(248 249 254)',
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
              onValuesChange={handleValuesChange}
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
                      <Upload
                        name="file"
                        showUploadList={false}
                        accept="image/*"
                        beforeUpload={(file) => {
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
                        }}
                        customRequest={({ file, onSuccess }) => {
                          setTimeout(() => {
                            if (onSuccess) {
                              onSuccess({ status: 'done' }, file);
                            }
                          }, 0);
                        }}
                        onChange={handleAvatarChange}
                        maxCount={1}
                      >
                        <Button icon={<UploadOutlined />} size="small">上传</Button>
                      </Upload>
                    </div>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="status" label="状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
              {/* 隐藏的模型ID字段，用于表单值管理 */}
              <Form.Item name="embedding_model_id" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="rerank_model_id" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="text_model_id" hidden>
                <Input />
              </Form.Item>
            </Form>
          </div>
        </div>

        <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', overflowX: 'hidden', flex: 1 }} className="hide-scrollbar">
          <div style={{ 
            padding: '16px', 
            borderRadius: '4px', 
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgb(248 249 254)'
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      {modelTypeInfo.description && (
                        <Tooltip title={modelTypeInfo.description}>
                          <InfoCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
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

          <div style={{ 
            padding: '16px', 
            borderRadius: '4px', 
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgb(248 249 254)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DatabaseOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
              <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>检索配置</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              {RETRIEVAL_CONFIGS.map(param => renderRetrievalConfig(param))}
            </div>
          </div>
        </div>
      </div>

      <div className={`restore-save-buttons ${theme === 'dark' ? 'dark' : 'light'}`} style={{ 
        paddingTop: '8px', 
        borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px'
      }}>
        {hasChanges && (
          <span style={{ color: '#faad14', fontSize: 12 }}>
            • 有未保存的变动
          </span>
        )}
        <Button onClick={handleRestore} icon={<UndoOutlined />} disabled={!hasChanges}>
          恢复
        </Button>
        <Button 
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
        >
          保存
        </Button>
      </div>

      {/* 模型选择弹窗 */}
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
                onClick={() => handleModelSelect(model)}
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
    </div>
  );
};

export default KnowledgebaseSetting;
