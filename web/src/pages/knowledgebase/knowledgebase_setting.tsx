import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Select, TreeSelect, Button, Switch, message, Row, Col, Upload, Slider, InputNumber, Tooltip, Modal, Layout } from 'antd';
const { TextArea } = Input;
const { Option } = Select;
import { SaveOutlined, UndoOutlined, UploadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { knowledgebaseService, Knowledgebase, KnowledgebaseCategory } from '../../services/knowledgebase';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { RETRIEVAL_CONFIGS } from '../../constants/knowledgebase';
import '../../styles/common.css';
import './knowledgebase.less';

const { Sider, Content } = Layout;

interface KnowledgebaseSettingProps {
  knowledgebase: Knowledgebase;
  onUpdate: () => void;
}

const KnowledgebaseSetting: React.FC<KnowledgebaseSettingProps> = ({ knowledgebase, onUpdate }) => {
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
    initializeForm();
  }, [knowledgebase]);

  const initializeForm = () => {
    setOriginalData({
      name: knowledgebase.name,
      code: knowledgebase.code,
      description: knowledgebase.description,
      avatar: knowledgebase.avatar,
      category_id: knowledgebase.category_id,
      embedding_model_id: knowledgebase.embedding_model_id,
      rerank_model_id: knowledgebase.rerank_model_id,
      text_model_id: knowledgebase.text_model_id,
      retrieval_config: knowledgebase.retrieval_config,
      status: knowledgebase.status
    });

    form.setFieldsValue({
      name: knowledgebase.name,
      code: knowledgebase.code,
      description: knowledgebase.description,
      category_id: knowledgebase.category_id,
      embedding_model_id: knowledgebase.embedding_model_id,
      rerank_model_id: knowledgebase.rerank_model_id,
      text_model_id: knowledgebase.text_model_id,
      status: knowledgebase.status
    });

    if (knowledgebase.retrieval_config) {
      setRetrievalConfig(knowledgebase.retrieval_config);
    } else {
      const defaultConfig: Record<string, any> = {};
      RETRIEVAL_CONFIGS.forEach(config => {
        defaultConfig[config.key] = config.default;
      });
      setRetrievalConfig(defaultConfig);
    }

    if (knowledgebase.avatar) {
      setAvatarPreview(knowledgebase.avatar);
    }

    setHasChanges(false);
  };

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

  const handleValuesChange = useCallback(() => {
    checkHasChanges();
  }, []);

  const checkHasChanges = useCallback(() => {
    const currentValues = form.getFieldsValue();
    const nameChanged = currentValues.name !== originalData.name;
    const codeChanged = currentValues.code !== originalData.code;
    const descriptionChanged = currentValues.description !== originalData.description;
    const categoryChanged = currentValues.category_id !== originalData.category_id;
    const embeddingModelChanged = currentValues.embedding_model_id !== originalData.embedding_model_id;
    const rerankModelChanged = currentValues.rerank_model_id !== originalData.rerank_model_id;
    const textModelChanged = currentValues.text_model_id !== originalData.text_model_id;
    const statusChanged = currentValues.status !== originalData.status;
    const retrievalConfigChanged = JSON.stringify(retrievalConfig) !== JSON.stringify(originalData.retrieval_config);

    setHasChanges(
      nameChanged || codeChanged || descriptionChanged || categoryChanged ||
      embeddingModelChanged || rerankModelChanged || textModelChanged ||
      statusChanged || retrievalConfigChanged
    );
  }, [form, originalData, retrievalConfig]);

  useEffect(() => {
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
          setHasChanges(true);
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
    Modal.confirm({
      title: '确认恢复',
      content: '确定要恢复到原始数据吗？所有未保存的更改将丢失。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        initializeForm();
        message.info('已恢复原始数据');
      }
    });
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
      onUpdate();
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
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}>
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Slider
                style={{ flex: 1 }}
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => handleRetrievalConfigChange(param.key, v)}
              />
              <InputNumber
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => handleRetrievalConfigChange(param.key, v)}
                style={{ width: 80 }}
              />
            </div>
          </div>
        );
      case 'select':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}>
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
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

  return (
    <Layout className="knowledgebase-layout" style={{ height: '100%' }}>
      <Sider width={400} className={`knowledgebase-setting-sider ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className="setting-section">
          <h3 className="section-title">基本信息</h3>
          <Form
            form={form}
            layout="vertical"
            onValuesChange={handleValuesChange}
            initialValues={{ status: true }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="name" label="知识库名称" rules={[{ required: true, message: '请输入知识库名称' }]}>
                  <Input placeholder="请输入知识库名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="code" label="知识库编码" rules={[{ required: true, message: '请输入知识库编码' }]}>
                  <Input placeholder="请输入知识库编码" disabled />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="category_id" label="分类">
              <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
            </Form.Item>

            <Form.Item name="description" label="知识库描述" rules={[{ required: true, message: '请输入知识库描述' }]}>
              <TextArea rows={4} placeholder="请输入描述，介绍知识库包含的内容以及使用场景" />
            </Form.Item>

            <Form.Item name="avatar" label="头像">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {avatarPreview && (
                  <img
                    src={avatarPreview}
                    alt="头像预览"
                    style={{
                      width: 80,
                      height: 80,
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
                  <Button icon={<UploadOutlined />}>点击上传</Button>
                </Upload>
              </div>
            </Form.Item>

            <Form.Item name="status" label="状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </Form>
        </div>
      </Sider>

      <Content className={`knowledgebase-setting-content ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className="setting-section">
          <h3 className="section-title">模型配置</h3>
          <div className="model-config-grid">
            <div className="model-config-card">
              <h4>Embedding 模型</h4>
              <Form.Item
                name="embedding_model_id"
                label="选择模型"
              >
                <Select placeholder="请选择 Embedding 模型" allowClear>
                  {embeddingModels.map(model => (
                    <Option key={model.id} value={model.id}>{model.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </div>
            
            <div className="model-config-card">
              <h4>Rerank 模型</h4>
              <Form.Item
                name="rerank_model_id"
                label="选择模型"
              >
                <Select placeholder="请选择 Rerank 模型" allowClear>
                  {rerankModels.map(model => (
                    <Option key={model.id} value={model.id}>{model.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </div>
            
            <div className="model-config-card">
              <h4>Text 模型</h4>
              <Form.Item
                name="text_model_id"
                label="选择模型"
              >
                <Select placeholder="请选择 Text 模型" allowClear>
                  {textModels.map(model => (
                    <Option key={model.id} value={model.id}>{model.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </div>
          </div>
        </div>

        <div className="setting-section">
          <h3 className="section-title">检索配置</h3>
          <div className="retrieval-config">
            {RETRIEVAL_CONFIGS.map(param => renderRetrievalConfig(param))}
          </div>
        </div>

        <div className="setting-actions">
          {hasChanges && (
            <span style={{ color: '#faad14', fontSize: 12, marginRight: '16px' }}>
              • 有未保存的变动
            </span>
          )}
          <Button onClick={handleRestore} icon={<UndoOutlined />} disabled={!hasChanges} style={{ marginRight: '16px' }}>
            恢复
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '18px',
              padding: '0 32px',
              height: '44px',
              fontSize: '16px'
            }}
          >
            保存
          </Button>
        </div>
      </Content>
    </Layout>
  );
};

export default KnowledgebaseSetting;
