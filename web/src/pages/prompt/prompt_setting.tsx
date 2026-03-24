import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, message, Row, Col, Switch, Modal, Spin, Drawer, Tag, Popover, Slider, InputNumber, Tooltip } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, FileTextOutlined, TagsOutlined, PlayCircleOutlined, SendOutlined, PlusOutlined, SettingOutlined, ClearOutlined, BulbOutlined, CopyOutlined, EditOutlined, DownOutlined, RightOutlined, LoadingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { promptService, Prompt, PromptCategory } from '../../services/prompt';
import { llmModelService, LLMModel } from '../../services/llm_model';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './prompt_setting.less';

interface ConfigParam {
  key: string;
  label: string;
  type: 'slider' | 'input' | 'switch' | 'select';
  min?: number;
  max?: number;
  step?: number;
  default: any;
  description?: string;
  options?: { value: string; label: string }[];
}

const PromptSetting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [originalData, setOriginalData] = useState<Partial<Prompt>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState<string>('');
  const [showTagInput, setShowTagInput] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [originalDescription, setOriginalDescription] = useState<string>('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const promptSettingContainerRef = useRef<HTMLDivElement>(null);
  const [testDrawerVisible, setTestDrawerVisible] = useState(false);
  const [testMessages, setTestMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string; reasoning_content?: string }[]>([]);
  const [testInput, setTestInput] = useState('');
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [deepThinking, setDeepThinking] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const [configParams, setConfigParams] = useState<Record<string, ConfigParam[]>>({});
  const [modelConfig, setModelConfig] = useState<Record<string, any>>({});
  const [modelDropdownVisible, setModelDropdownVisible] = useState(false);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    setTheme(currentTheme as 'dark' | 'light');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'light';
      setTheme(newTheme as 'dark' | 'light');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchModels();
    fetchConfigParams();
    if (id && id !== 'new') {
      fetchPrompt(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchModels = async () => {
    try {
      const data = await llmModelService.getLLMModels(1, 100);
      const filteredModels = data.data.filter(model => 
        model.model_type === 'text' || model.model_type === 'vision'
      );
      setModels(filteredModels);
      if (filteredModels.length > 0) {
        setSelectedModel(filteredModels[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const fetchConfigParams = async () => {
    try {
      const data = await llmModelService.getConfigParams();
      setConfigParams(data);
    } catch (error) {
      console.error('Failed to fetch config params:', error);
    }
  };

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  }, [hasChanges]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  const fetchCategories = async () => {
    try {
      const data = await promptService.getCategoryTree();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchPrompt = async (promptId: string) => {
    setLoading(true);
    try {
      const data = await promptService.getPrompt(promptId);
      setPrompt(data);
      setOriginalData(data);
      setContent(data.content || '');
      setOriginalContent(data.content || '');
      setTags(data.tags || []);
      setDescription(data.description || '');
      setOriginalDescription(data.description || '');
      form.setFieldsValue({
        name: data.name,
        category_id: data.category_id,
        status: data.status,
        description: data.description
      });
    } catch (error) {
      console.error('Failed to fetch prompt:', error);
      message.error('获取提示词失败');
    } finally {
      setLoading(false);
    }
  };

  const handleValuesChange = () => {
    checkHasChanges();
  };

  const checkHasChanges = () => {
    const currentValues = form.getFieldsValue();
    const nameChanged = currentValues.name !== originalData.name;
    const categoryChanged = currentValues.category_id !== originalData.category_id;
    const statusChanged = currentValues.status !== originalData.status;
    const contentChanged = content !== originalContent;
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(originalData.tags || []);
    const descriptionChanged = description !== originalDescription;
    setHasChanges(nameChanged || categoryChanged || statusChanged || contentChanged || tagsChanged || descriptionChanged);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    checkHasChanges();
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    checkHasChanges();
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      setShowTagInput(false);
      checkHasChanges();
    }
  };

  const handleTagClose = (removedTag: string) => {
    const newTags = tags.filter(tag => tag !== removedTag);
    setTags(newTags);
    checkHasChanges();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      if (!textContent.trim()) {
        message.warning('请输入提示词内容');
        return;
      }
      
      setSaving(true);
      const data = {
        ...values,
        content: content,
        tags: tags,
        description: description
      };

      if (id === 'new') {
        await promptService.createPrompt(data);
        message.success('提示词创建成功');
        navigate('/prompts');
      } else if (id) {
        await promptService.updatePrompt(id, data);
        message.success('提示词更新成功');
        fetchPrompt(id);
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save prompt:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      Modal.confirm({
        title: '确认离开',
        content: '您有未保存的更改，确定要离开吗？',
        okText: '确定',
        cancelText: '取消',
        onOk: () => {
          navigate('/prompts');
        }
      });
    } else {
      navigate('/prompts');
    }
  };

  const handleTestPrompt = () => {
    setTestDrawerVisible(true);
    setTestMessages([]);
  };

  const handleSendTestMessage = async () => {
    if (!testInput.trim() || !selectedModel || isGenerating) return;
    
    const userMessage = testInput.trim();
    const userMessageId = Date.now().toString();
    setTestMessages(prev => [...prev, { id: userMessageId, role: 'user', content: userMessage }]);
    setTestInput('');
    setIsGenerating(true);
    
    const assistantMessageId = (Date.now() + 1).toString();
    setTestMessages(prev => [...prev, { 
      id: assistantMessageId, 
      role: 'assistant', 
      content: '' 
    }]);
    setThinkingMessageId(assistantMessageId);
    
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      abortControllerRef.current = new AbortController();
      
      const chatMessages = [];
      
      if (content && content.trim()) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        chatMessages.push({
          role: 'system',
          content: textContent
        });
      }
      
      testMessages.forEach(msg => {
        chatMessages.push({
          role: msg.role,
          content: msg.content
        });
      });
      
      chatMessages.push({
        role: 'user',
        content: userMessage
      });
      
      const requestBody = {
        messages: chatMessages,
        config: {
          ...modelConfig,
          deep_thinking: deepThinking
        }
      };
      
      const url = '/aicenter/v1/llm_model/model/' + selectedModel + '/chat';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsGenerating(false);
              setThinkingMessageId(null);
              break;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.content) {
                setTestMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: msg.content + parsed.content }
                    : msg
                ));
              }
              
              if (parsed.reasoning_content) {
                setTestMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, reasoning_content: (msg.reasoning_content || '') + parsed.reasoning_content }
                    : msg
                ));
              }
              
              if (parsed.thinking_duration !== undefined) {
                setThinkingDuration(prev => ({
                  ...prev,
                  [assistantMessageId]: parsed.thinking_duration
                }));
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Chat error:', error);
        setTestMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: '抱歉，发生了错误：' + error.message }
            : msg
        ));
      }
    } finally {
      setIsGenerating(false);
      setThinkingMessageId(null);
    }
  };

  const toggleReasoning = (messageId: string) => {
    setExpandedReasoning(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(`已复制${type}`);
    });
  };

  const getProviderAvatar = (provider: string): string => {
    if (!provider) {
      return '/src/assets/llm/default.svg';
    }
    const lowercaseProvider = provider.toLowerCase();
    return `/src/assets/llm/${lowercaseProvider}.svg`;
  };

  const getSelectedModelInfo = () => {
    return models.find(m => m.id === selectedModel);
  };

  const renderConfigParam = (param: ConfigParam) => {
    const value = modelConfig[param.key] ?? param.default;
    
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
                onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
              />
              <InputNumber
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
                style={{ width: 80 }}
              />
            </div>
          </div>
        );
      case 'input':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}>
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <Input
              value={value}
              onChange={(e) => setModelConfig({ ...modelConfig, [param.key]: e.target.value })}
            />
          </div>
        );
      case 'switch':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
                <Tooltip title={param.description}>
                  <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
                </Tooltip>
              </div>
              <Switch
                checked={value}
                onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
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
              onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
              options={param.options}
              style={{ width: '100%' }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const currentConfigParams = configParams[getSelectedModelInfo()?.model_type || 'text'] || [];

  const configPopoverContent = (
    <div style={{ width: 280, maxHeight: 400, overflowY: 'auto' }}>
      {currentConfigParams.length > 0 ? (
        currentConfigParams.map(param => renderConfigParam(param))
      ) : (
        <div style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
          该模型类型暂无可配置参数
        </div>
      )}
    </div>
  );

  const buildCategoryTreeSelectData = () => {
    const buildTree = (cats: PromptCategory[]): any[] => {
      return cats.map(cat => ({
        title: cat.name,
        value: cat.id,
        children: cat.children && cat.children.length > 0 ? buildTree(cat.children) : undefined
      }));
    };
    return buildTree(categories);
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ]
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'align',
    'link', 'image'
  ];

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
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`} ref={contentContainerRef}>
      <PageHeader
        items={[
          { title: '提示词管理', icon: <FileTextOutlined />, onClick: () => navigate('/prompts') },
          { title: id === 'new' ? '新增提示词' : '编辑提示词' }
        ]}
      />

      <div ref={promptSettingContainerRef} className="prompt-setting-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '30%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', overflowX: 'hidden' }} className="hide-scrollbar">
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
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
                onValuesChange={handleValuesChange}
                style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
                className="hide-scrollbar"
                initialValues={{ status: true }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                      <Input placeholder="请输入提示词名称" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="category_id" label="分类">
                      <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="描述">
                  <TextArea 
                    placeholder="请输入提示词描述" 
                    value={description} 
                    onChange={handleDescriptionChange} 
                    rows={4}
                  />
                </Form.Item>

                <Form.Item label="标签">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {tags.map((tag, index) => (
                        <Tag
                          key={index}
                          closable
                          onClose={() => handleTagClose(tag)}
                          style={{ marginBottom: 4 }}
                        >
                          {tag}
                        </Tag>
                      ))}
                      {showTagInput ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Input
                            ref={tagInputRef}
                            type="text"
                            size="small"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                            placeholder="输入标签"
                            style={{ width: 120, height: 24 }}
                          />
                          <Button size="small" onClick={handleAddTag} style={{ height: 24 }}>添加</Button>
                          <Button size="small" onClick={() => setShowTagInput(false)} style={{ height: 24 }}>取消</Button>
                        </div>
                      ) : (
                        <Button 
                          type="dashed" 
                          icon={<PlusOutlined />} 
                          onClick={() => {
                            setShowTagInput(true);
                            setTimeout(() => tagInputRef.current?.focus(), 100);
                          }}
                          style={{ borderStyle: 'dashed', height: 24, minWidth: 80 }}
                        >
                          添加标签
                        </Button>
                      )}
                    </div>
                  </div>
                </Form.Item>

                <Form.Item name="status" label="状态" valuePropName="checked">
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Form>
            </div>
          </div>

          <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', overflowX: 'hidden' }} className="hide-scrollbar">
            <div
              ref={contentContainerRef}
              style={{
                padding: '16px',
                borderRadius: '4px',
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
            >
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileTextOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
                  <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>提示词内容</span>
                </div>
                <Button
                  type="default"
                  icon={<PlayCircleOutlined />}
                  onClick={handleTestPrompt}
                  size="small"
                  style={{ background: theme === 'dark' ? '#1890ff' : 'transparent' }}
                >
                  测试提示词
                </Button>
              </div>
              <div style={{ flex: 1, minHeight: '300px', maxHeight: 'calc(100vh - 10px)' }} className={`quill-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                <ReactQuill
                  theme="snow"
                  value={content}
                  onChange={handleContentChange}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{
                    height: 'calc(100% - 42px)',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                  placeholder="请输入提示词内容..."
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          paddingTop: '16px', 
          borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
          display: 'flex',
          justifyContent: 'center',
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

      <Drawer
        title="提示词测试"
        placement="right"
        width={600}
        open={testDrawerVisible}
        onClose={() => setTestDrawerVisible(false)}
        getContainer={false}
        mask={false}
        className={`prompt-test-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
        styles={{
          header: { background: theme === 'dark' ? '#1a1a1a' : '#fff', color: theme === 'dark' ? '#fff' : '#000' },
          body: { background: theme === 'dark' ? '#0d0d0d' : '#f5f5f5', padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
          footer: { display: 'none' }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '12px 16px', borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
                onClick={() => setModelDropdownVisible(!modelDropdownVisible)}
              >
                <RightOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#666' }} />
                {selectedModel ? (
                  <>
                    <img 
                      src={getProviderAvatar(getSelectedModelInfo()?.provider || '')} 
                      alt={getSelectedModelInfo()?.provider || 'model'} 
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{ fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>{getSelectedModelInfo()?.name}</span>
                  </>
                ) : (
                  <span style={{ color: theme === 'dark' ? '#aaa' : '#666' }}>请选择模型</span>
                )}
              </div>
              {modelDropdownVisible && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    marginTop: '4px',
                    background: theme === 'dark' ? '#1a1a1a' : '#fff',
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    width: 'max-content'
                  }}
                >
                  {models.map(model => (
                    <div
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setModelDropdownVisible(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        background: selectedModel === model.id ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#f5f5f5') : 'transparent'
                      }}
                    >
                      <img 
                        src={getProviderAvatar(model.provider || '')} 
                        alt={model.provider || 'model'} 
                        style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <span style={{ color: theme === 'dark' ? '#fff' : '#000', whiteSpace: 'nowrap' }}>{model.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Popover
                content={configPopoverContent}
                title="模型参数配置"
                trigger="click"
                placement="bottomRight"
              >
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  style={{ color: theme === 'dark' ? '#fff' : '#000' }}
                />
              </Popover>
              <Button
                type="text"
                icon={<ClearOutlined />}
                style={{ color: theme === 'dark' ? '#fff' : '#000' }}
                onClick={() => setTestMessages([])}
              />
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {testMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: theme === 'dark' ? '#666' : '#999', padding: '40px 0' }}>
                <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                <p>输入消息开始测试提示词</p>
              </div>
            ) : (
              testMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: msg.role === 'user'
                        ? '#1890ff'
                        : (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#fff'),
                      color: msg.role === 'user' ? '#fff' : (theme === 'dark' ? '#fff' : '#000'),
                      border: msg.role === 'user' ? 'none' : (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8')
                    }}
                  >
                    <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
                      {msg.role === 'user' ? '用户' : '助手'}
                    </div>
                    {msg.role === 'assistant' && (thinkingMessageId === msg.id) && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#666' }}>
                          <LoadingOutlined spin style={{ fontSize: '12px' }} />
                          <BulbOutlined style={{ fontSize: '12px' }} />
                          <span>正在思考中...</span>
                        </div>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.reasoning_content && !(thinkingMessageId === msg.id) && (
                      <div style={{ marginBottom: '8px' }}>
                        <div 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            fontSize: '12px', 
                            color: theme === 'dark' ? '#aaa' : '#666',
                            cursor: 'pointer'
                          }}
                          onClick={() => toggleReasoning(msg.id)}
                        >
                          {expandedReasoning.has(msg.id) ? <DownOutlined style={{ fontSize: '12px' }} /> : <RightOutlined style={{ fontSize: '12px' }} />}
                          <BulbOutlined style={{ fontSize: '12px' }} />
                          <span>思考过程</span>
                          {thinkingDuration[msg.id] && (
                            <span style={{ fontSize: '10px' }}>
                              ({(thinkingDuration[msg.id] / 1000).toFixed(1)}s)
                            </span>
                          )}
                        </div>
                        {expandedReasoning.has(msg.id) && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: theme === 'dark' ? '#aaa' : '#666',
                            marginTop: '4px',
                            padding: '8px',
                            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                            borderRadius: '4px'
                          }}>
                            {msg.reasoning_content}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{msg.content}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chat-input-area" style={{ borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', padding: '12px 16px', background: theme === 'dark' ? '#1a1a1a' : '#fff' }}>
            <div className="chat-input-wrapper" style={{ position: 'relative' }}>
              <TextArea
                placeholder="输入消息... (Shift+Enter换行，Enter发送)"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSendTestMessage();
                  }
                }}
                autoSize={{ minRows: 5, maxRows: 12 }}
                className={`chat-input ${theme === 'dark' ? 'dark' : 'light'}`}
                style={{ 
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff', 
                  color: theme === 'dark' ? '#fff' : '#000',
                  borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e8e8e8',
                  borderRadius: '12px',
                  resize: 'none',
                  paddingRight: '50px',
                  paddingBottom: '32px'
                }}
              />
              <div className="chat-input-inner-footer" style={{ position: 'absolute', bottom: '8px', left: '12px', zIndex: 10 }}>
                <div 
                  className={`deep-thinking-switch ${theme === 'dark' ? 'dark' : 'light'}`} 
                  onClick={() => setDeepThinking(!deepThinking)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '4px 12px', 
                    borderRadius: '16px', 
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    fontSize: '14px',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                    color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
                  }}
                >
                  <BulbOutlined style={{ color: deepThinking ? '#faad14' : undefined }} />
                  <span style={{ userSelect: 'none' }}>深度思考</span>
                  <Switch size="small" checked={deepThinking} onChange={setDeepThinking} />
                </div>
              </div>
              {isGenerating ? (
                <Button 
                  type="primary" 
                  danger
                  onClick={() => {
                    setIsGenerating(false);
                    setThinkingMessageId(null);
                  }}
                  className="input-send-button"
                  style={{ position: 'absolute', right: '8px', bottom: '8px', borderRadius: '8px' }}
                >
                  停止
                </Button>
              ) : (
                <Button 
                  type="primary" 
                  icon={<SendOutlined />}
                  onClick={handleSendTestMessage}
                  disabled={!testInput.trim()}
                  className="input-send-button"
                  style={{ 
                    position: 'absolute', 
                    right: '8px', 
                    bottom: '8px', 
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none'
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default PromptSetting;
