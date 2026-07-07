import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, Switch, message, Row, Col, Spin, Slider, InputNumber, Tooltip, Tag, Dropdown } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UndoOutlined, ApiTwoTone, SettingOutlined, ClearOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, InfoCircleOutlined, BulbOutlined, CopyOutlined, ReloadOutlined, EditOutlined, DownOutlined, RightOutlined, PlusOutlined, PaperClipOutlined, UploadOutlined, CloseCircleOutlined as RemoveFileOutlined, InboxOutlined } from '@ant-design/icons';
import DataSourceFileSelector from '../datasource/datasource data_select';
import { llmModelService, LLMModel, LLMCategory } from '../../services/llm_model';
import { request, post } from '../../utils/request';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './llm_model_setting.less';
import { getDefaultAvatar } from '../../utils/avatar';

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
  files?: any[]; // 存储上传的文件信息
  isComplete?: boolean; // 标记消息是否已完成（是否已接收到[DONE]）
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
  
  const [tags, setTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [deepThinking, setDeepThinking] = useState(true);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [isDataSourceModalVisible, setIsDataSourceModalVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  // 检测是否在底部
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100; // 容差阈值，距离底部100px以内视为在底部
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  };

  useEffect(() => {
    // 只有在底部时才自动滚动
    if (isAtBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
        status: data.status,
        is_default: data.is_default
      });
      
      form.setFieldsValue({
        name: data.name,
        model_type: data.model_type,
        category_id: data.category_id,
        endpoint: data.endpoint,
        api_key: data.api_key,
        support_image: data.support_image || false,
        status: data.status,
        is_default: data.is_default
      });
      
      const modelTags = data.tags ? (Array.isArray(data.tags) ? data.tags : JSON.parse(data.tags)) : [];
      setTags(modelTags);
      
      if (data.config) {
        setModelConfig(data.config);
        setOriginalModelConfig(data.config);
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
    
    const formValues = form.getFieldsValue();
    
    if (!formValues.name || !formValues.api_key || !formValues.endpoint || !formValues.model_type) {
      message.error('请填写完整的模型配置信息');
      return;
    }
    
    setTestingConnection(true);
    setConnectionTestResult(null);
    
    try {
      const result = await llmModelService.testModelConfig({
        name: formValues.name,
        provider: formValues.provider,
        api_key: formValues.api_key,
        endpoint: formValues.endpoint,
        model_type: formValues.model_type
      });
      
      setConnectionTestResult({
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        message.success('连接测试成功！');
        if (result.support_image !== undefined) {
          // 更新 support_image 字段但不触发"有未保存的变动"提示
          // 因为这是测试连接自动检测的结果，不是用户的主动修改
          form.setFieldsValue({ support_image: result.support_image });
          // 更新原始数据，避免触发 hasChanges
          setOriginalData(prev => ({
            ...prev,
            support_image: result.support_image
          }));
        }
      }
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.message || '连接测试失败'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      if (!tags.includes(newTag.trim())) {
        setTags([...tags, newTag.trim()]);
        setHasChanges(true);
      }
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const handleRestore = () => {
    const originalTags = originalData.tags ? (Array.isArray(originalData.tags) ? originalData.tags : JSON.parse(originalData.tags)) : [];
    form.setFieldsValue(originalData);
    setTags(originalTags);
    setModelConfig(originalModelConfig);
    setConnectionTestResult(null);
    setHasChanges(false);
    setConfigHasChanges(false);
    message.info('已恢复原始数据');
  };

  // 处理本地文件上传
  const handleLocalFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Content = (e.target?.result as string).split(',')[1];
      const mimeType = file.type || 'application/octet-stream';

      const newFile = {
        type: 'file_base64',
        content: base64Content,
        mime_type: mimeType,
        file_name: file.name,
        file_size: file.size
      };

      setSelectedFiles(prev => [...prev, newFile]);
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传行为
  };

  // 移除已选择的文件
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 处理数据源文件选择确认
  const handleDataSourceFileConfirm = (files: any[]) => {
    const newFiles: any[] = files.map(file => ({
      type: 'document',
      content: {
        datasource_id: file.datasource_id,
        bucket: file.bucket,
        location: file.path,
        file_name: file.name,
        file_size: file.size
      }
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
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
    const messageIndex = messages.findIndex(m => m.id === messageId);
    const originalMessage = messageIndex !== -1 ? messages[messageIndex] : null;
    const hasFiles = originalMessage && originalMessage.files && originalMessage.files.length > 0;
    
    if (!editingContent.trim() && !hasFiles) {
      message.error('内容不能为空');
      return;
    }

    if (messageIndex === -1) return;

    // 获取所有历史用户消息中的文件（包括被编辑的消息）
    // 编辑问题时，需要将所有历史文件都包含进去，确保模型能够访问所有文件
    const updatedMessages = messages.slice(0, messageIndex);
    const allFiles: any[] = [];
    
    updatedMessages.forEach(msg => {
      if (msg.role === 'user' && msg.files && msg.files.length > 0) {
        msg.files.forEach(file => {
          // 避免重复添加同一个文件
          const fileExists = allFiles.some(existingFile =>
            existingFile.file_name === file.file_name &&
            existingFile.file_size === file.file_size
          );
          if (!fileExists) {
            allFiles.push(file);
          }
        });
      }
    });

    // 添加被编辑消息的文件
    if (originalMessage && originalMessage.files && originalMessage.files.length > 0) {
      originalMessage.files.forEach(file => {
        const fileExists = allFiles.some(existingFile =>
          existingFile.file_name === file.file_name &&
          existingFile.file_size === file.file_size
        );
        if (!fileExists) {
          allFiles.push(file);
        }
      });
    }

    setMessages(updatedMessages);
    setEditingMessageId(null);
    setEditingContent('');

    setInputMessage(editingContent);

    // 直接传递所有历史文件参数给发送函数，避免异步状态更新的问题
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages, editingContent, allFiles);
    }, 100);
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (messageIndex < 1) return;

    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;

    // 获取所有历史用户消息中的文件（包括当前用户消息）
    // 重新回答时，需要将所有历史文件都包含进去，确保模型能够访问所有文件
    const updatedMessages = messages.slice(0, messageIndex);
    const allFiles: any[] = [];
    
    updatedMessages.forEach(msg => {
      if (msg.role === 'user' && msg.files && msg.files.length > 0) {
        msg.files.forEach(file => {
          // 避免重复添加同一个文件
          const fileExists = allFiles.some(existingFile =>
            existingFile.file_name === file.file_name &&
            existingFile.file_size === file.file_size
          );
          if (!fileExists) {
            allFiles.push(file);
          }
        });
      }
    });

    setMessages(updatedMessages);

    // 直接传递所有历史文件参数给发送函数，避免异步状态更新的问题
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages.slice(0, -1), userMessage.content, allFiles);
    }, 100);
  };

  const handleSendMessageWithMessages = async (previousMessages: Message[], content: string, files?: any[]) => {
    if (!model || isGenerating) return;

    // 使用传入的文件参数或当前选中的文件
    const currentFiles = files || selectedFiles;

    // 创建用户消息，包含文件信息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      files: currentFiles.length > 0 ? [...currentFiles] : undefined // 存储本次上传的文件
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
      timestamp: new Date(),
      isComplete: false // 标记为未完成，等待[DONE]消息
    };
    setMessages(prev => [...prev, assistantMessage]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      abortControllerRef.current = new AbortController();

      // 构建request body：messages包含历史文件，query包含本次上传的新文件
      const requestBody = {
        messages: newMessages.map((msg, index) => {
          // 最新用户消息（最后一条用户消息）不包含文件，文件通过query传递
          // 避免文件重复（既在messages中又在query中）
          const isLatestUserMessage = index === newMessages.length - 1 && msg.role === 'user';

          // 如果是历史用户消息（不是最新的）且包含文件，将文件信息编码到消息的content中
          if (msg.role === 'user' && msg.files && msg.files.length > 0 && !isLatestUserMessage) {
            // 构建OpenAI多部分消息格式
            const contentParts: any[] = [];

            // 添加文本内容
            if (msg.content && msg.content.trim()) {
              contentParts.push({
                type: 'text',
                text: msg.content
              });
            }

            // 添加文件信息，转换为OpenAI支持的标准格式
            msg.files.forEach(file => {
              if (file.type === 'file_base64') {
                const mimeType = file.mime_type || 'application/octet-stream';

                // 图片文件：转换为image_url格式
                if (mimeType.startsWith('image/')) {
                  contentParts.push({
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${file.content}`
                    }
                  });
                } else if (mimeType.startsWith('audio/') || file.file_name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
                  // 音频文件：使用input_audio格式（OpenAI格式）
                  contentParts.push({
                    type: 'input_audio',
                    input_audio: {
                      data: `data:${mimeType};base64,${file.content}`,
                      format: 'wav' // 假设音频格式为wav
                    }
                  });
                } else {
                  // 其他文件（文档、PDF等）：暂时保留为自定义格式
                  // 后端会将这些文件转换为文本内容
                  contentParts.push({
                    type: 'file_base64',
                    content: file.content,
                    mime_type: mimeType,
                    file_name: file.file_name,
                    file_size: file.file_size
                  });
                }
              } else if (file.type === 'document') {
                // 数据源文件：保留为自定义格式
                contentParts.push({
                  type: 'document',
                  content: file.content
                });
              }
            });

            return {
              role: msg.role,
              content: contentParts
            };
          } else {
            // 没有文件的消息或最新用户消息，保持原样（最新用户消息的文件通过query传递）
            return {
              role: msg.role,
              content: msg.content
            };
          }
        }),
        query: currentFiles.length > 0 ? [...currentFiles] : [], // query只包含本次上传的新文件
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
                // 标记消息为已完成
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, isComplete: true }
                    : msg
                ));
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
      // 清空已选择的文件
      setSelectedFiles([]);
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
        
        const hasParamsChanged = originalData && (
          originalData.name !== values.name ||
          originalData.endpoint !== values.endpoint ||
          originalData.api_key !== values.api_key ||
          originalData.model_type !== values.model_type
        );
        
        let supportImage = model.support_image || false;
        
        if (hasParamsChanged && !connectionTestResult?.success) {
          const testData = {
            name: values.name,
            provider: model.provider,
            endpoint: values.endpoint,
            api_key: values.api_key,
            model_type: values.model_type
          };
          
          setTestingConnection(true);
          const key = `test-model-${model.id}`;
          message.loading({ content: `正在测试连接...`, key, duration: 0 });
          
          try {
            const result = await llmModelService.testModelConfig(testData);
            
            setTestingConnection(false);
            
            if (result.success) {
              message.success({ content: `连接测试成功！`, key });
              supportImage = result.support_image || false;
              setConnectionTestResult({
                success: true,
                message: '连接测试成功'
              });
            } else {
              message.error({ content: `连接测试失败: ${result.message}`, key });
              setSaving(false);
              return;
            }
          } catch (error: any) {
            setTestingConnection(false);
            message.error({ content: `测试失败: ${error.message}`, key });
            setSaving(false);
            return;
          }
        }
        
        const configStr = JSON.stringify(modelConfig);

        let tagsArray = values.tags || [];
        if (supportImage && !tagsArray.includes('图片支持')) {
          tagsArray.push('图片支持');
        }
        const tags = JSON.stringify(tagsArray);

        const updateData: any = {
          ...values,
          tags: tags,
          config: configStr
        };

        if (hasParamsChanged) {
          updateData.support_image = supportImage;
        }

        // 根据测试结果设置连接状态
        if (connectionTestResult?.success) {
          updateData.connection_status = 1; // 连接成功
        } else if (connectionTestResult && !connectionTestResult.success) {
          updateData.connection_status = 0; // 连接失败
        } else if (!hasParamsChanged) {
          // 参数未改变且未重新测试，保持原有连接状态
          updateData.connection_status = model.connection_status;
        }

        await llmModelService.updateLLMModel(model.id, updateData);
        message.success('保存成功');
        
        setModel(prev => prev ? {
          ...prev,
          name: values.name,
          model_type: values.model_type,
          category_id: values.category_id,
          endpoint: values.endpoint,
          api_key: values.api_key,
          tags: tags,
          status: values.status,
          support_image: supportImage,
          config: configStr
        } : null);
        
        setOriginalData({
          name: values.name,
          provider: model.provider,
          model_type: values.model_type,
          category_id: values.category_id,
          endpoint: values.endpoint,
          api_key: values.api_key,
          tags: tags,
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
    if ((!inputMessage.trim() && selectedFiles.length === 0) || !model || isGenerating) return;

    // 创建用户消息，包含文件信息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      files: selectedFiles.length > 0 ? [...selectedFiles] : undefined // 存储本次上传的文件
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
      timestamp: new Date(),
      isComplete: false // 标记为未完成，等待[DONE]消息
    };
    setMessages(prev => [...prev, assistantMessage]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      abortControllerRef.current = new AbortController();

      // 构建request body：messages包含历史文件，query包含本次上传的新文件
      const requestBody = {
        messages: newMessages.map((msg, index) => {
          // 最新用户消息（最后一条用户消息）不包含文件，文件通过query传递
          // 避免文件重复（既在messages中又在query中）
          const isLatestUserMessage = index === newMessages.length - 1 && msg.role === 'user';

          // 如果是历史用户消息（不是最新的）且包含文件，将文件信息编码到消息的content中
          if (msg.role === 'user' && msg.files && msg.files.length > 0 && !isLatestUserMessage) {
            // 构建OpenAI多部分消息格式
            const contentParts: any[] = [];

            // 添加文本内容
            if (msg.content && msg.content.trim()) {
              contentParts.push({
                type: 'text',
                text: msg.content
              });
            }

            // 添加文件信息，转换为OpenAI支持的标准格式
            msg.files.forEach(file => {
              if (file.type === 'file_base64') {
                const mimeType = file.mime_type || 'application/octet-stream';

                // 图片文件：转换为image_url格式
                if (mimeType.startsWith('image/')) {
                  contentParts.push({
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${file.content}`
                    }
                  });
                } else if (mimeType.startsWith('audio/') || file.file_name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
                  // 音频文件：使用input_audio格式（OpenAI格式）
                  contentParts.push({
                    type: 'input_audio',
                    input_audio: {
                      data: `data:${mimeType};base64,${file.content}`,
                      format: 'wav' // 假设音频格式为wav
                    }
                  });
                } else {
                  // 其他文件（文档、PDF等）：暂时保留为自定义格式
                  // 后端会将这些文件转换为文本内容
                  contentParts.push({
                    type: 'file_base64',
                    content: file.content,
                    mime_type: mimeType,
                    file_name: file.file_name,
                    file_size: file.file_size
                  });
                }
              } else if (file.type === 'document') {
                // 数据源文件：保留为自定义格式
                contentParts.push({
                  type: 'document',
                  content: file.content
                });
              }
            });

            return {
              role: msg.role,
              content: contentParts
            };
          } else {
            // 没有文件的消息或最新用户消息，保持原样（最新用户消息的文件通过query传递）
            return {
              role: msg.role,
              content: msg.content
            };
          }
        }),
        query: selectedFiles.length > 0 ? [...selectedFiles] : [], // query只包含本次上传的新文件
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
        throw new Error(`请求失败: {response.status} ${errorText}`);
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
                // 标记消息为已完成
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, isComplete: true }
                    : msg
                ));
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
      // 清空已选择的文件
      setSelectedFiles([]);
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
    return getDefaultAvatar();
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
      {/* <PageHeader
        items={[
          { title: '模型列表', icon: <SettingOutlined />, onClick: () => navigate('/llm_models') },
          { title: '模型配置' },
          { title: model?.name || '' }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回列表
          </Button>
        }
      /> */}

      <div className="llm-model-setting-container">
        <div className="setting-left-panel">
          <div className={`setting-section ${theme === 'dark' ? 'dark' : 'light'}`}>
            <div className={`section-header ${theme === 'dark' ? 'dark' : 'light'}`}>
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
                        <Select disabled placeholder="请选择模型类型" style={{ color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)' }}>
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
                      <Form.Item name="support_image" label="支持图片" valuePropName="checked" tooltip="通过测试连接自动检测">
                        <Switch checkedChildren="是" unCheckedChildren="否" disabled />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="endpoint" label="端点地址" rules={[{ required: true, message: '请输入端点地址' }]}>
                    <Input placeholder="请输入端点地址" />
                  </Form.Item>
                  <Form.Item name="api_key" label="API密钥" rules={[{ required: true, message: '请输入API密钥' }]}>
                    <Input.Password placeholder="请输入API密钥" />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="status" label="状态" valuePropName="checked">
                        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="is_default" label="是否默认" valuePropName="checked">
                        <Switch checkedChildren="是" unCheckedChildren="否" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="标签">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tags.map((tag, index) => (
                          <Tag
                            key={index}
                            closable
                            onClose={() => {
                              const newTags = tags.filter((_, i) => i !== index);
                              setTags(newTags);
                              setHasChanges(true);
                            }}
                            style={{ marginBottom: 4, background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f0f0f0', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)' }}
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
                              style={{ width: 120, height: 24, background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff' }}
                            />
                            <Button size="small" onClick={handleAddTag} style={{ height: 24, background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff' }}>添加</Button>
                            <Button size="small" onClick={() => setShowTagInput(false)} style={{ height: 24, background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff' }}>取消</Button>
                          </div>
                        ) : (
                          <Button 
                            type="dashed" 
                            icon={<PlusOutlined />} 
                            onClick={() => {
                              setShowTagInput(true);
                              setTimeout(() => tagInputRef.current?.focus(), 100);
                            }}
                            style={{ borderStyle: 'dashed', height: 24, minWidth: 80, background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'transparent', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#d9d9d9', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)' }}
                          >
                            添加标签
                          </Button>
                        )}
                      </div>
                    </div>
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
                style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)', border: 'none', color: '#fff' }}
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
            
            <div className="chat-messages" ref={messagesContainerRef}>
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
                        <>
                          {/* 显示用户上传的文件（在文本上方） */}
                          {msg.role === 'user' && msg.files && msg.files.length > 0 && (
                            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {msg.files.map((file, fileIndex) => {
                                // 计算文件大小
                                let fileSize = '';
                                if (file.file_size) {
                                  const size = file.file_size;
                                  if (size < 1024) {
                                    fileSize = `${size.toFixed(0)} B`;
                                  } else if (size < 1024 * 1024) {
                                    fileSize = `${(size / 1024).toFixed(2)} KB`;
                                  } else {
                                    fileSize = `${(size / (1024 * 1024)).toFixed(2)} MB`;
                                  }
                                } else if (file.content && typeof file.content === 'string') {
                                  // Base64 编码的文件大小（作为后备）
                                  const base64Size = file.content.length * 3 / 4;
                                  if (base64Size < 1024) {
                                    fileSize = `${base64Size.toFixed(0)} B`;
                                  } else if (base64Size < 1024 * 1024) {
                                    fileSize = `${(base64Size / 1024).toFixed(2)} KB`;
                                  } else {
                                    fileSize = `${(base64Size / (1024 * 1024)).toFixed(2)} MB`;
                                  }
                                }

                                // 获取文件图标
                                const getFileIcon = () => {
                                  const fileName = file.file_name || file.content?.file_name || '';
                                  if (fileName.endsWith('.pdf')) return '📄';
                                  if (fileName.match(/\.(doc|docx)$/i)) return '📝';
                                  if (fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) return '🖼️';
                                  if (fileName.match(/\.(mp3|wav|ogg|m4a)$/i)) return '🎵';
                                  if (fileName.match(/\.(mp4|avi|mov|mkv)$/i)) return '🎬';
                                  if (fileName.match(/\.(zip|rar|7z)$/i)) return '📦';
                                  if (fileName.match(/\.(txt|md)$/i)) return '📃';
                                  return '📎';
                                };

                                // 获取文件扩展名
                                const fileName = file.file_name || file.content?.file_name || '';
                                const extension = fileName.split('.').pop()?.toUpperCase() || '';

                                return (
                                  <div
                                    key={fileName || `file-${fileIndex}`}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '10px 12px',
                                      borderRadius: 6,
                                      backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                                      border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <div style={{ marginRight: 12, fontSize: 20 }}>
                                      {getFileIcon()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{
                                        fontSize: 14,
                                        fontWeight: 500,
                                        marginBottom: 2,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}>
                                        {fileName}
                                      </div>
                                      <div style={{
                                        fontSize: 12,
                                        color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)'
                                      }}>
                                        {extension} {fileSize ? `· ${fileSize}` : ''}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="message-text">{msg.content}</div>
                        </>
                      )}
                      <div className="message-footer">
                        <span className="message-time">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                        <div className="message-actions">
                          {msg.role === 'assistant' && (
                            <>
                              {/* 如果消息未完成，显示运行中图标 */}
                              {!msg.isComplete ? (
                                <Tooltip title="正在生成中">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<LoadingOutlined spin />}
                                  />
                                </Tooltip>
                              ) : (
                                msg.content && (
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
                                )
                              )}
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
              {/* 显示已选择的文件列表 */}
              {selectedFiles.length > 0 && (
                <div style={{
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  padding: '0 16px'
                }}>
                  {selectedFiles.map((file, index) => {
                    // 计算文件大小
                    let fileSize = '';
                    if (file.file_size) {
                      const size = file.file_size;
                      if (size < 1024) {
                        fileSize = `${size.toFixed(0)} B`;
                      } else if (size < 1024 * 1024) {
                        fileSize = `${(size / 1024).toFixed(2)} KB`;
                      } else {
                        fileSize = `${(size / (1024 * 1024)).toFixed(2)} MB`;
                      }
                    }

                    // 获取文件图标
                    const getFileNameIcon = () => {
                      const fileName = file.file_name || '';
                      if (fileName.endsWith('.pdf')) return <span style={{ marginRight: 8 }}>📄</span>;
                      if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return <span style={{ marginRight: 8 }}>📝</span>;
                      if (fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) return <span style={{ marginRight: 8 }}>🖼️</span>;
                      if (fileName.match(/\.(mp3|wav|ogg|m4a)$/i)) return <span style={{ marginRight: 8 }}>🎵</span>;
                      return <span style={{ marginRight: 8 }}>📎</span>;
                    };

                    return (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        borderRadius: 6,
                        border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                        maxWidth: '33.33%',
                        flex: '0 0 auto',
                        minWidth: '200px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          {getFileNameIcon()}
                          <span style={{
                            fontSize: 14,
                            color: theme === 'dark' ? '#fff' : '#333',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {file.file_name}
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginLeft: 12
                        }}>
                          <span style={{
                            fontSize: 12,
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)'
                          }}>
                            {fileSize}
                          </span>
                          <Tooltip title="移除文件">
                            <Button
                              type="text"
                              size="small"
                              icon={<RemoveFileOutlined />}
                              onClick={() => handleRemoveFile(index)}
                              style={{
                                color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)'
                              }}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className={`deep-thinking-switch ${theme === 'dark' ? 'dark' : 'light'}`} onClick={() => setDeepThinking(!deepThinking)}>
                      <BulbOutlined className={deepThinking ? 'bulb-active' : ''} />
                      <span>深度思考</span>
                      <Switch size="small" checked={deepThinking} onChange={setDeepThinking} />
                    </div>

                    {/* 上传文件下拉菜单 */}
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'local',
                            label: (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '8px 16px',
                                  height: '36px',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <UploadOutlined />
                                <span>上传本地文件</span>
                              </div>
                            ),
                            onClick: () => {
                              // 触发文件选择
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.multiple = true;
                              input.onchange = (e) => {
                                const files = (e.target as HTMLInputElement).files;
                                if (files) {
                                  Array.from(files).forEach(file => handleLocalFileUpload(file));
                                }
                              };
                              input.click();
                            }
                          },
                          {
                            key: 'datasource',
                            label: (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '8px 16px',
                                  height: '36px',
                                  boxSizing: 'border-box',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setIsDataSourceModalVisible(true)}
                              >
                                <InboxOutlined />
                                <span>从数据源选择文件</span>
                              </div>
                            )
                          }
                        ]
                      }}
                      trigger={['click']}
                      placement="bottomRight"
                    >
                      <Button icon={<PaperClipOutlined />} type="text" />
                    </Dropdown>
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
                    disabled={!inputMessage.trim() && selectedFiles.length === 0}
                    className="input-send-button"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 数据源选择文件弹窗 */}
      <DataSourceFileSelector
        visible={isDataSourceModalVisible}
        onCancel={() => setIsDataSourceModalVisible(false)}
        onConfirm={handleDataSourceFileConfirm}
        theme={theme}
      />
    </div>
  );
};

export default LLMModelSetting;
