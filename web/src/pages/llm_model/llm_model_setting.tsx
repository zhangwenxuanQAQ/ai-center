import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, Switch, message, Row, Col, Spin, Slider, InputNumber, Tooltip, Tag } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UndoOutlined, ApiTwoTone, SettingOutlined, ClearOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, InfoCircleOutlined, BulbOutlined, CopyOutlined, ReloadOutlined, EditOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { llmModelService, LLMModel, LLMCategory } from '../../services/llm_model';
import { request, post } from '../../utils/request';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './llm_model_setting.less';

const { Option } = Select;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  reasoning_content?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface ConfigParam {
  key: string;
  label: string;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  default: any;
  description: string;
  options?: string[];
}

const LLMModelSetting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState<LLMModel | null>(null);
  const [originalData, setOriginalData] = useState<Partial<LLMModel>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [categories, setCategories] = useState<LLMCategory[]>([]);
  const [modelTypes, setModelTypes] = useState<Record<string, string>>({});
  const [configParams, setConfigParams] = useState<Record<string, ConfigParam[]>>({});
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [showParams, setShowParams] = useState(false);
  const [modelConfig, setModelConfig] = useState<Record<string, any>>({});
  const [originalModelConfig, setOriginalModelConfig] = useState<Record<string, any>>({});
  const [configHasChanges, setConfigHasChanges] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [deepThinking, setDeepThinking] = useState(true);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingStartTimeRef = useRef<Record<string, number>>({});

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
    if (id) {
      fetchModel(id);
      fetchCategories();
      fetchModelTypes();
      fetchConfigParams();
    }
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchModel = async (modelId: string) => {
    setLoading(true);
    try {
      const data = await llmModelService.getLLMModel(modelId);
      setModel(data);
      setOriginalData({
        name: data.name,
        provider: data.provider,
        model_type: data.model_type,
        category_id: data.category_id,
        endpoint: data.endpoint,
        api_key: data.api_key,
        tags: data.tags,
        config: data.config,
        status: data.status
      });
      
      form.setFieldsValue({
        name: data.name,
        model_type: data.model_type,
        category_id: data.category_id,
        endpoint: data.endpoint,
        api_key: data.api_key,
        tags: data.tags,
        status: data.status
      });
      
      if (data.config) {
        try {
          const config = JSON.parse(data.config);
          setModelConfig(config);
          setOriginalModelConfig(config);
        } catch (e) {
          setModelConfig({});
          setOriginalModelConfig({});
        }
      }
      setHasChanges(false);
      setConfigHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch model:', error);
      message.error('获取模型信息失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await llmModelService.getCategoryTree();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchModelTypes = async () => {
    try {
      const data = await llmModelService.getModelTypes();
      setModelTypes(data);
    } catch (error) {
      console.error('Failed to fetch model types:', error);
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

  const handleValuesChange = () => {
    const currentValues = form.getFieldsValue();
    const changed = Object.keys(currentValues).some(key => {
      return JSON.stringify(currentValues[key]) !== JSON.stringify(originalData[key as keyof typeof originalData]);
    });
    setHasChanges(changed);
  };

  const handleConfigChange = (newConfig: Record<string, any>) => {
    setModelConfig(newConfig);
    const changed = JSON.stringify(newConfig) !== JSON.stringify(originalModelConfig);
    setConfigHasChanges(changed);
  };

  const handleTestConnection = async () => {
    if (!model) return;
    setTestingConnection(true);
    setConnectionTestResult(null);
    
    try {
      const result = await llmModelService.testConnection(model.id);
      
      setConnectionTestResult({
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        message.success('连接测试成功！');
      } else {
        message.error(result.message || '连接测试失败');
      }
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.message || '连接测试失败'
      });
      message.error('连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRestore = () => {
    form.setFieldsValue(originalData);
    setModelConfig(originalModelConfig);
    setConnectionTestResult(null);
    setHasChanges(false);
    setConfigHasChanges(false);
    message.info('已恢复原始数据');
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
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        message.success(`${type}已复制到剪贴板`);
      }).catch(() => {
        fallbackCopyTextToClipboard(text, type);
      });
    } else {
      fallbackCopyTextToClipboard(text, type);
    }
  };

  const fallbackCopyTextToClipboard = (text: string, type: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        message.success(`${type}已复制到剪贴板`);
      } else {
        message.error('复制失败，请手动复制');
      }
    } catch (err) {
      message.error('复制失败，请手动复制');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) {
      message.error('内容不能为空');
      return;
    }
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    const updatedMessages = messages.slice(0, messageIndex);
    setMessages(updatedMessages);
    setEditingMessageId(null);
    setEditingContent('');
    
    setInputMessage(editingContent);
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages, editingContent);
    }, 100);
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (messageIndex < 1) return;
    
    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;
    
    const updatedMessages = messages.slice(0, messageIndex);
    setMessages(updatedMessages);
    
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages.slice(0, -1), userMessage.content);
    }, 100);
  };

  const handleSendMessageWithMessages = async (previousMessages: Message[], content: string) => {
    if (!model || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    const newMessages = [...previousMessages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsGenerating(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      abortControllerRef.current = new AbortController();
      
      const chatMessages = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const requestBody = {
        messages: chatMessages,
        config: {
          ...modelConfig,
          deep_thinking: deepThinking
        }
      };
      
      const url = '/aicenter/v1/llm_model/model/' + model.id + '/chat';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`请求失败: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                setThinkingMessageId(null);
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: '错误: ' + parsed.error }
                      : msg
                  ));
                  setThinkingMessageId(null);
                  break;
                }
                
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== assistantMessageId) return msg;
                  
                  const updates: Partial<Message> = {};
                  
                  if (parsed.text) {
                    updates.content = msg.content + parsed.text;
                  }
                  
                  if (parsed.reasoning_content) {
                    updates.reasoning_content = (msg.reasoning_content || '') + parsed.reasoning_content;
                  }
                  
                  if (parsed.usage) {
                    updates.usage = parsed.usage;
                  }
                  
                  return { ...msg, ...updates };
                }));
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: msg.content + '\n[已停止生成]' }
            : msg
        ));
      } else {
        console.error('Chat error:', error);
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: '抱歉，生成回复时出现错误: ' + error.message }
            : msg
        ));
      }
    } finally {
      if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
        const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
        setThinkingDuration(prev => ({
          ...prev,
          [assistantMessageId]: duration
        }));
      }
      setIsGenerating(false);
      setThinkingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  const handleSave = async () => {
    if (!model) return;
    setSaving(true);
    try {
      if (showParams) {
        const configStr = JSON.stringify(modelConfig);
        await llmModelService.updateLLMModel(model.id, {
          config: configStr
        });
        message.success('保存成功');
        
        setModel(prev => prev ? {
          ...prev,
          config: configStr
        } : null);
        
        setOriginalData({
          ...originalData,
          config: configStr
        });
        setOriginalModelConfig({...modelConfig});
        setConfigHasChanges(false);
      } else {
        const values = await form.validateFields();
        const configStr = JSON.stringify(modelConfig);
        await llmModelService.updateLLMModel(model.id, {
          ...values,
          config: configStr
        });
        message.success('保存成功');
        
        setModel(prev => prev ? {
          ...prev,
          name: values.name,
          model_type: values.model_type,
          category_id: values.category_id,
          endpoint: values.endpoint,
          api_key: values.api_key,
          tags: values.tags,
          status: values.status,
          config: configStr
        } : null);
        
        setOriginalData({
          name: values.name,
          provider: model.provider,
          model_type: values.model_type,
          category_id: values.category_id,
          endpoint: values.endpoint,
          api_key: values.api_key,
          tags: values.tags,
          config: configStr,
          status: values.status
        });
        setOriginalModelConfig({...modelConfig});
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/llm_models');
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
                onChange={(v) => handleConfigChange({ ...modelConfig, [param.key]: v })}
              />
              <InputNumber
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => handleConfigChange({ ...modelConfig, [param.key]: v })}
                style={{ width: 80 }}
              />
            </div>
          </div>
        );
      case 'number':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}>
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <InputNumber
              min={param.min}
              max={param.max}
              value={value}
              onChange={(v) => handleConfigChange({ ...modelConfig, [param.key]: v })}
              style={{ width: '100%' }}
            />
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
              onChange={(v) => handleConfigChange({ ...modelConfig, [param.key]: v })}
              style={{ width: '100%' }}
            >
              {param.options?.map(opt => (
                <Option key={opt} value={opt}>{opt}</Option>
              ))}
            </Select>
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
                onChange={(v) => handleConfigChange({ ...modelConfig, [param.key]: v })}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !model || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsGenerating(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      abortControllerRef.current = new AbortController();
      
      const chatMessages = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const requestBody = {
        messages: chatMessages,
        config: {
          ...modelConfig,
          deep_thinking: deepThinking
        }
      };
      
      const url = '/aicenter/v1/llm_model/model/' + model.id + '/chat';
      console.log('[DEBUG] Request URL:', url);
      console.log('[DEBUG] Request Body:', JSON.stringify(requestBody, null, 2));
      
      // 使用原生fetch处理SSE流式响应
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      console.log('[DEBUG] Response status:', response.status);
      console.log('[DEBUG] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Error response:', errorText);
        throw new Error(`请求失败: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                setThinkingMessageId(null);
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: '错误: ' + parsed.error }
                      : msg
                  ));
                  setThinkingMessageId(null);
                  break;
                }
                
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== assistantMessageId) return msg;
                  
                  const updates: Partial<Message> = {};
                  
                  if (parsed.text) {
                    updates.content = msg.content + parsed.text;
                  }
                  
                  if (parsed.reasoning_content) {
                    updates.reasoning_content = (msg.reasoning_content || '') + parsed.reasoning_content;
                  }
                  
                  if (parsed.usage) {
                    updates.usage = parsed.usage;
                  }
                  
                  return { ...msg, ...updates };
                }));
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: msg.content + '\n[已停止生成]' }
            : msg
        ));
      } else {
        console.error('Chat error:', error);
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: '抱歉，生成回复时出现错误: ' + error.message }
            : msg
        ));
      }
    } finally {
      if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
        const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
        setThinkingDuration(prev => ({
          ...prev,
          [assistantMessageId]: duration
        }));
      }
      setIsGenerating(false);
      setThinkingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  const getModelTypeLabel = (modelType?: string): string => {
    return modelTypes[modelType || 'text'] || modelType || '文本模型';
  };

  const getProviderAvatar = (provider: string): string => {
    if (!provider) {
      return '/src/assets/llm/default.svg';
    }
    const lowercaseProvider = provider.toLowerCase();
    return `/src/assets/llm/${lowercaseProvider}.svg`;
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

  const currentConfigParams = configParams[model?.model_type || 'text'] || [];
  const canSave = showParams ? configHasChanges : hasChanges;

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader
        items={[
          { title: '模型库', icon: <SettingOutlined />, onClick: () => navigate('/llm_models') },
          { title: '模型配置' },
          { title: model?.name || '' }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回列表
          </Button>
        }
      />

      <div className="llm-model-setting-container">
        <div className="setting-left-panel">
          <div className={`setting-section ${theme === 'dark' ? 'dark' : 'light'}`}>
            <div className="section-header">
              <h3>{showParams ? '模型参数' : '基本信息'}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(hasChanges || configHasChanges) && (
                  <span style={{ color: '#faad14', fontSize: 12 }}>
                    • 有未保存的变动
                  </span>
                )}
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  onClick={() => setShowParams(!showParams)}
                >
                  {showParams ? '基本信息' : '参数设置'}
                </Button>
              </div>
            </div>
            
            {!showParams ? (
              <>
                {connectionTestResult && (
                  <div className={`connection-result ${connectionTestResult.success ? 'success' : 'error'}`}>
                    {connectionTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    {connectionTestResult.message}
                  </div>
                )}
                <Form 
                  form={form} 
                  layout="vertical"
                  onValuesChange={handleValuesChange}
                  className="setting-form"
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
                        <Input placeholder="请输入模型名称" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="model_type" label="模型类型">
                        <Select disabled placeholder="请选择模型类型">
                          {Object.entries(modelTypes).map(([key, value]) => (
                            <Option key={key} value={key}>{value}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="category_id" label="分类">
                        <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="status" label="状态" valuePropName="checked">
                        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="endpoint" label="端点地址" rules={[{ required: true, message: '请输入端点地址' }]}>
                    <Input placeholder="请输入端点地址" />
                  </Form.Item>
                  <Form.Item name="api_key" label="API密钥" rules={[{ required: true, message: '请输入API密钥' }]}>
                    <Input.Password placeholder="请输入API密钥" />
                  </Form.Item>
                </Form>
              </>
            ) : (
              <div className="params-container">
                {currentConfigParams.length > 0 ? (
                  currentConfigParams.map(param => renderConfigParam(param))
                ) : (
                  <div className="empty-params">
                    该模型类型暂无可配置参数
                  </div>
                )}
              </div>
            )}
            
            <div className="section-footer">
              {!showParams && (
                <Button 
                  icon={testingConnection ? <LoadingOutlined /> : <ApiTwoTone />}
                  onClick={handleTestConnection}
                  loading={testingConnection}
                >
                  测试连接
                </Button>
              )}
              <Button 
                icon={<UndoOutlined />}
                onClick={handleRestore}
                disabled={!hasChanges && !configHasChanges}
              >
                恢复
              </Button>
              <Button 
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                disabled={!canSave}
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', color: '#fff' }}
              >
                保存
              </Button>
            </div>
          </div>
        </div>

        <div className="setting-right-panel">
          <div className={`chat-section ${theme === 'dark' ? 'dark' : 'light'}`}>
            <div className="chat-header">
              <div className="chat-title">
                <img 
                  src={getProviderAvatar(model?.provider || '')} 
                  alt={model?.provider} 
                  className="model-avatar"
                />
                <div className="model-info">
                  <span className="model-name">{model?.name}</span>
                  <Tag color="blue">{getModelTypeLabel(model?.model_type)}</Tag>
                </div>
              </div>
              <div className="chat-actions">
                <Tooltip title="参数设置">
                  <Button 
                    type="text" 
                    icon={<SettingOutlined />} 
                    onClick={() => setShowParams(!showParams)}
                  />
                </Tooltip>
                <Tooltip title="清空对话">
                  <Button 
                    type="text" 
                    icon={<ClearOutlined />} 
                    onClick={handleClearMessages}
                  />
                </Tooltip>
              </div>
            </div>
            
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <div className="welcome-icon">💬</div>
                  <div className="welcome-text">开始与 {model?.name} 对话</div>
                  <div className="welcome-hint">输入消息开始体验模型能力</div>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={msg.id} className={`message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === 'user' ? '👤' : (
                        <img 
                          src={getProviderAvatar(model?.provider || '')} 
                          alt={model?.provider || 'AI'} 
                          className="avatar-image"
                        />
                      )}
                    </div>
                    <div className="message-content">
                      {msg.role === 'assistant' && (thinkingMessageId === msg.id && deepThinking) && (
                        <div className="message-reasoning">
                          <div className="reasoning-header" onClick={() => toggleReasoning(msg.id)}>
                            <LoadingOutlined spin />
                            <BulbOutlined /> 正在思考中
                          </div>
                          {expandedReasoning.has(msg.id) && msg.reasoning_content && (
                            <div className="reasoning-text">{msg.reasoning_content}</div>
                          )}
                        </div>
                      )}
                      {msg.role === 'assistant' && msg.reasoning_content && !(thinkingMessageId === msg.id && deepThinking) && (
                        <div className="message-reasoning">
                          <div className="reasoning-header" onClick={() => toggleReasoning(msg.id)}>
                            {expandedReasoning.has(msg.id) ? (
                              <DownOutlined />
                            ) : (
                              <RightOutlined />
                            )}
                            <BulbOutlined /> 思考过程
                            {thinkingDuration[msg.id] && (
                              <span className="reasoning-duration">
                                ({(thinkingDuration[msg.id] / 1000).toFixed(1)}s)
                              </span>
                            )}
                          </div>
                          {expandedReasoning.has(msg.id) && (
                            <div className="reasoning-text">{msg.reasoning_content}</div>
                          )}
                        </div>
                      )}
                      {editingMessageId === msg.id ? (
                        <div className="message-edit-area">
                          <TextArea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            autoSize={{ minRows: 3, maxRows: 8 }}
                            style={{ width: '100%' }}
                          />
                          <div className="edit-actions">
                            <Button size="small" onClick={handleCancelEdit}>取消</Button>
                            <Button size="small" type="primary" onClick={() => handleSaveEdit(msg.id)}>发送</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="message-text">{msg.content}</div>
                      )}
                      <div className="message-footer">
                        <span className="message-time">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                        <div className="message-actions">
                          {msg.role === 'assistant' && msg.content && (
                            <>
                              <Tooltip title="重新回答">
                                <Button 
                                  type="text" 
                                  size="small"
                                  icon={<ReloadOutlined />} 
                                  onClick={() => handleRegenerate(index)}
                                />
                              </Tooltip>
                              <Tooltip title="复制回答">
                                <Button 
                                  type="text" 
                                  size="small"
                                  icon={<CopyOutlined />} 
                                  onClick={() => copyToClipboard(msg.content, '回答')}
                                />
                              </Tooltip>
                            </>
                          )}
                          {msg.role === 'user' && !editingMessageId && (
                            <>
                              <Tooltip title="编辑问题">
                                <Button 
                                  type="text" 
                                  size="small"
                                  icon={<EditOutlined />} 
                                  onClick={() => handleEditMessage(msg.id, msg.content)}
                                />
                              </Tooltip>
<Tooltip title="复制问题">
                                <Button 
                                  type="text" 
                                  size="small"
                                  icon={<CopyOutlined />} 
                                  onClick={() => copyToClipboard(msg.content, '问题')}
                                />
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="chat-input-area">
              <div className="chat-input-wrapper">
                <TextArea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="输入消息... (Shift+Enter换行，Enter发送)"
                  autoSize={{ minRows: 5, maxRows: 12 }}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="chat-input"
                />
                <div className="chat-input-inner-footer">
                  <div className={`deep-thinking-switch ${theme === 'dark' ? 'dark' : 'light'}`} onClick={() => setDeepThinking(!deepThinking)}>
                    <BulbOutlined className={deepThinking ? 'bulb-active' : ''} />
                    <span>深度思考</span>
                    <Switch size="small" checked={deepThinking} onChange={setDeepThinking} />
                  </div>
                </div>
                {isGenerating ? (
                  <Button 
                    type="primary" 
                    danger
                    onClick={handleStopGeneration}
                    className="input-send-button"
                  >
                    停止
                  </Button>
                ) : (
                  <Button 
                    type="primary" 
                    icon={<SendOutlined />}
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim()}
                    className="input-send-button"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LLMModelSetting;
