import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, message, Row, Col, Switch, Modal, Spin, Drawer, Tag, Popover, Slider, InputNumber, Tooltip } from 'antd';
const { TextArea } = Input;
const { Option } = Select;
import { ArrowLeftOutlined, SaveOutlined, FileTextOutlined, TagsOutlined, PlayCircleOutlined, SendOutlined, PlusOutlined, SettingOutlined, ClearOutlined, BulbOutlined, CopyOutlined, EditOutlined, DownOutlined, RightOutlined, LoadingOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import { promptService, Prompt, PromptCategory } from '../../services/prompt';
import { llmModelService, LLMModel } from '../../services/llm_model';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './prompt_setting.less';

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
  const testDrawerRef = useRef<HTMLDivElement>(null);
  const [testDrawerVisible, setTestDrawerVisible] = useState(false);
  const [testMessages, setTestMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string; reasoning_content?: string; timestamp: Date; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; stopped?: boolean }[]>([]);
  const [testInput, setTestInput] = useState('');
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [deepThinking, setDeepThinking] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const [configParams, setConfigParams] = useState<Record<string, ConfigParam[]>>({});
  const [modelConfig, setModelConfig] = useState<Record<string, any>>({});
  const [modelDropdownVisible, setModelDropdownVisible] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

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

  useEffect(() => {
    if (!isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [testMessages, isUserScrolling]);

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

  const checkHasChanges = useCallback(() => {
    const currentValues = form.getFieldsValue();
    const nameChanged = currentValues.name !== originalData.name;
    const categoryChanged = currentValues.category_id !== originalData.category_id;
    const statusChanged = currentValues.status !== originalData.status;
    const contentChanged = content !== originalContent;
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(originalData.tags || []);
    const descriptionChanged = description !== originalDescription;
    setHasChanges(nameChanged || categoryChanged || statusChanged || contentChanged || tagsChanged || descriptionChanged);
  }, [content, description, tags, originalData, originalContent, originalDescription, form]);

  useEffect(() => {
    checkHasChanges();
  }, [content, description, tags, checkHasChanges]);

  useEffect(() => {
    const chatMessages = chatMessagesRef.current;
    if (!chatMessages) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatMessages;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      
      setShowScrollToBottom(!isAtBottom);
      
      if (!isAtBottom) {
        setIsUserScrolling(true);
      }
    };

    chatMessages.addEventListener('scroll', handleScroll);
    return () => {
      chatMessages.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsUserScrolling(false);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const handleTagClose = (removedTag: string) => {
    const newTags = tags.filter(tag => tag !== removedTag);
    setTags(newTags);
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
        const newPrompt = await promptService.createPrompt(data);
        message.success('提示词创建成功');
        navigate(`/prompt/setting/${newPrompt.id}`);
      } else if (id) {
        await promptService.updatePrompt(id, data);
        message.success('提示词更新成功');
        setOriginalData({
          name: values.name,
          category_id: values.category_id,
          status: values.status,
          tags: tags
        });
        setOriginalContent(content);
        setOriginalDescription(description);
        setHasChanges(false);
      }
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
    setTestMessages(prev => [...prev, { 
      id: userMessageId, 
      role: 'user', 
      content: userMessage,
      timestamp: new Date()
    }]);
    setTestInput('');
    setIsGenerating(true);
    setIsUserScrolling(false);
    
    const assistantMessageId = (Date.now() + 1).toString();
    setTestMessages(prev => [...prev, { 
      id: assistantMessageId, 
      role: 'assistant', 
      content: '',
      timestamp: new Date()
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
              
              if (parsed.text) {
                setTestMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: msg.content + parsed.text }
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
              
              if (parsed.usage) {
                setTestMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, usage: parsed.usage }
                    : msg
                ));
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
      if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
        const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
        setThinkingDuration(prev => ({
          ...prev,
          [assistantMessageId]: duration
        }));
      }
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        message.success(`已复制${type}`);
      }).catch(() => {
        fallbackCopyToClipboard(text, type);
      });
    } else {
      fallbackCopyToClipboard(text, type);
    }
  };

  const fallbackCopyToClipboard = (text: string, type: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      message.success(`已复制${type}`);
    } catch (err) {
      message.error('复制失败');
    }
    document.body.removeChild(textArea);
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
    
    const messageIndex = testMessages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    const updatedMessages = testMessages.slice(0, messageIndex);
    setTestMessages(updatedMessages);
    setEditingMessageId(null);
    setEditingContent('');
    
    setTestInput(editingContent);
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages, editingContent);
    }, 100);
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (messageIndex < 1) return;
    
    const userMessage = testMessages[messageIndex - 1];
    if (userMessage.role !== 'user') return;
    
    const updatedMessages = testMessages.slice(0, messageIndex);
    setTestMessages(updatedMessages);
    
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages.slice(0, -1), userMessage.content);
    }, 100);
  };

  const handleSendMessageWithMessages = async (previousMessages: { id: string; role: 'user' | 'assistant'; content: string; reasoning_content?: string; timestamp: Date; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }[], content: string) => {
    if (!selectedModel || isGenerating) return;
    
    const userMessageId = Date.now().toString();
    const userMessage = { id: userMessageId, role: 'user' as const, content: content.trim(), timestamp: new Date() };
    const newMessages = [...previousMessages, userMessage];
    setTestMessages(newMessages);
    setTestInput('');
    setIsGenerating(true);
    setIsUserScrolling(false);
    
    const assistantMessageId = (Date.now() + 1).toString();
    setTestMessages(prev => [...prev, { 
      id: assistantMessageId, 
      role: 'assistant', 
      content: '',
      timestamp: new Date()
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
      
      previousMessages.forEach(msg => {
        chatMessages.push({
          role: msg.role,
          content: msg.content
        });
      });
      
      chatMessages.push({
        role: 'user',
        content: userMessage.content
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
              
              if (parsed.text) {
                setTestMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: msg.content + parsed.text }
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
              
              if (parsed.usage) {
                setTestMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, usage: parsed.usage }
                    : msg
                ));
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
      if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
        const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
        setThinkingDuration(prev => ({
          ...prev,
          [assistantMessageId]: duration
        }));
      }
      setIsGenerating(false);
      setThinkingMessageId(null);
    }
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
              style={{ width: '100%' }}
            >
              {param.options?.map(opt => (
                <Option key={opt} value={opt}>{opt}</Option>
              ))}
            </Select>
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
              step={param.step || 1}
              value={value}
              onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
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
    <div style={{ width: 350 }}>
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
              <div style={{ flex: 1, minHeight: '300px', maxHeight: 'calc(100vh - 10px)' }} className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                <MDEditor
                  value={content}
                  onChange={(value) => handleContentChange(value || '')}
                  height="100%"
                  preview="edit"
                  className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                  style={{
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                    height: '100%',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
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
          alignItems: 'center',
          gap: '16px'
        }}>
          {hasChanges && (
            <span style={{ color: '#faad14', fontSize: 12 }}>
              • 有未保存的变动
            </span>
          )}
          <Button onClick={handleBack}>
            返回
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
      </div>

      <Drawer
        title="提示词测试"
        placement="right"
        width={600}
        open={testDrawerVisible}
        onClose={() => setTestDrawerVisible(false)}
        getContainer={false}
        mask={true}
        maskClosable={true}
        className={`prompt-test-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
        styles={{
          header: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' },
          body: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5', padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
          footer: { display: 'none' }
        }}
      >
        <div ref={testDrawerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '12px 16px', borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme === 'dark' ? 'none' : '#fff' }}>
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
                        if (model.config) {
                          setModelConfig(model.config);
                        } else {
                          setModelConfig({});
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        background: selectedModel === model.id ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#f5f5f5') : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#f5f5f5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = selectedModel === model.id ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#f5f5f5') : 'transparent';
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
          
          <div ref={chatMessagesRef} className={`chat-messages ${theme === 'dark' ? 'dark' : 'light'}`} style={{ position: 'relative' }}>
            {testMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: theme === 'dark' ? '#fff' : '#999', padding: '40px 0' }}>
                <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '0px', opacity: 0.3 }} />
                <p>输入消息开始测试提示词</p>
              </div>
            ) : (
              testMessages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`message ${msg.role}`}
                >
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : (
                      <img 
                        src={getProviderAvatar(getSelectedModelInfo()?.provider || '')} 
                        alt={getSelectedModelInfo()?.provider || 'AI'} 
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
                      <>
                        {msg.content && (
                          <div 
                            className="message-text"
                          >
                            {msg.content}
                          </div>
                        )}
                        {msg.stopped && (
                          <div 
                            style={{
                              fontSize: '12px',
                              color: theme === 'dark' ? '#ff4d4f' : '#ff4d4f',
                              marginTop: '4px',
                              fontStyle: 'italic'
                            }}
                          >
                            [已停止生成]
                          </div>
                        )}
                      </>
                    )}
                    <div className="message-footer">
                      <span className="message-time">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                      {msg.role === 'assistant' && msg.usage && !isGenerating && (
                        <span className="message-usage">
                          Token: {msg.usage.total_tokens || 0} | 耗时: {thinkingDuration[msg.id] ? (thinkingDuration[msg.id] / 1000).toFixed(1) : '0.0'}s
                        </span>
                      )}
                      <div className="message-actions">
                        {msg.role === 'assistant' && msg.content && !isGenerating && (
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
                        {msg.role === 'user' && !editingMessageId && !isGenerating && (
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
            {showScrollToBottom && (
              <Button
                className="scroll-to-bottom-btn"
                icon={<DownOutlined />}
                onClick={scrollToBottom}
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  zIndex: 10,
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                }}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chat-input-area" style={{ borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', padding: '12px 16px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff' }}>
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
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                    }
                    // 更新当前生成的消息，添加[已停止生成]提示
                    if (thinkingMessageId) {
                      setTestMessages(prevMessages => {
                        return prevMessages.map(msg => {
                          if (msg.id === thinkingMessageId && msg.role === 'assistant') {
                            return {
                              ...msg,
                              content: msg.content || '',
                              stopped: true
                            };
                          }
                          return msg;
                        });
                      });
                    }
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
