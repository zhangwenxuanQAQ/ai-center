import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Switch, Modal, Slider, message, Popconfirm, Tooltip, Dropdown, Empty, Spin, Popover, InputNumber, Select } from 'antd';
import { SendOutlined, ClearOutlined, SettingOutlined, RobotOutlined, BulbOutlined, LoadingOutlined, DownOutlined, RightOutlined, CopyOutlined, ReloadOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { chatbotService, Chatbot } from '../../services/chatbot';
import { chatService, Conversation, Message } from '../../services/chat';

const { TextArea } = Input;

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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at: string;
  reasoning_content?: string;
  reasoning_time?: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  group_id?: string;
  group_name?: string;
}

interface ChatConversationProps {
  theme: 'light' | 'dark';
  conversation: Conversation | null;
  onConversationCreated?: (newConversation?: Conversation) => void;
}

interface CodeBlockProps {
  node: any;
  inline: boolean;
  className: string;
  children: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  const [theme] = useState<'light' | 'dark'>(() => {
    return document.body.getAttribute('data-theme') as 'light' | 'dark' || 'light';
  });

  if (!inline && (className || language)) {
    return (
      <SyntaxHighlighter
        style={theme === 'dark' ? oneDark : oneLight}
        language={language}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const ChatConversation: React.FC<ChatConversationProps> = ({
  theme,
  conversation,
  onConversationCreated
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [deepThinking, setDeepThinking] = useState(true);
  const [selectedType, setSelectedType] = useState<'model' | 'chatbot'>('model');
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [selectedChatbot, setSelectedChatbot] = useState<Chatbot | null>(null);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingChatbots, setLoadingChatbots] = useState(false);
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [configParams, setConfigParams] = useState<Record<string, ConfigParam[]>>({});
  const [modelConfig, setModelConfig] = useState<Record<string, any>>({});
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const isCreatingNewConversation = useRef(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchModels();
    fetchChatbots();
    fetchConfigParams();
  }, []);

  useEffect(() => {
    if (isCreatingNewConversation.current) {
      isCreatingNewConversation.current = false;
      return;
    }
    
    if (conversation) {
      fetchMessages(conversation.id);
      fetchConversationConfig(conversation.id);
    } else {
      // 新建对话时，清空消息列表
      setMessages([]);
      // 清空系统提示词
      setSystemPrompt('');
      // 恢复模型配置参数为选中模型的默认配置
      if (selectedModel && selectedModel.config) {
        setModelConfig(selectedModel.config);
      } else {
        setModelConfig({});
      }
    }
  }, [conversation, models, chatbots]);

  const fetchConversationConfig = async (conversationId: string) => {
    try {
      const detail = await chatService.getConversation(conversationId);
      
      // 加载系统提示词
      setSystemPrompt(detail.system_prompt || '');
      
      if (detail.model_id) {
        const model = models.find(m => m.id === detail.model_id);
        if (model) {
          setSelectedModel(model);
          setSelectedChatbot(null);
          setSelectedType('model');
          if (detail.config) {
            const configObj = typeof detail.config === 'string' ? JSON.parse(detail.config) : detail.config;
            setModelConfig(configObj);
          } else if (model.config) {
            setModelConfig(model.config);
          } else {
            setModelConfig({});
          }
        }
      } else if (detail.chatbot_id) {
        const chatbot = chatbots.find(c => c.id === detail.chatbot_id);
        if (chatbot) {
          setSelectedChatbot(chatbot);
          setSelectedModel(null);
          setSelectedType('chatbot');
          if (detail.config) {
            const configObj = typeof detail.config === 'string' ? JSON.parse(detail.config) : detail.config;
            setModelConfig(configObj);
          } else if (chatbot.model_id) {
            const model = models.find(m => m.id === chatbot.model_id);
            if (model && model.config) {
              setModelConfig(model.config);
            }
          } else {
            setModelConfig({});
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversation config:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const result = await llmModelService.getLLMModels(1, 100, undefined, undefined, undefined, 'true');
      console.log('Fetched models:', result.data);
      const textModels = result.data.filter((model: LLMModel) => 
        model.model_type === 'text' || model.model_type === 'vision' || model.model_type === 'multimodal'
      );
      setModels(textModels);
      if (textModels.length > 0) {
        handleSelectModel(textModels[0]);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchChatbots = async () => {
    setLoadingChatbots(true);
    try {
      const result = await chatbotService.getChatbots(undefined, 1, 100);
      setChatbots(result.data);
    } catch (error) {
      console.error('Failed to fetch chatbots:', error);
    } finally {
      setLoadingChatbots(false);
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

  const fetchMessages = async (conversationId: string) => {
    setLoading(true);
    try {
      const result = await chatService.getMessages(conversationId, 1, 50);
      const mappedMessages = result.items.map((msg: any) => ({
        id: msg.message_id || msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        reasoning_content: msg.reasoning_content,
        reasoning_time: msg.reasoning_time,
        usage: msg.usage
      }));
      setMessages(mappedMessages);
      
      const durations: Record<string, number> = {};
      mappedMessages.forEach((msg: Message) => {
        if (msg.reasoning_time) {
          durations[msg.id] = msg.reasoning_time;
        }
      });
      setThinkingDuration(durations);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    let currentConversation = conversation;

    // 如果没有选中的对话，先创建一个新对话
    if (!currentConversation) {
      try {
        // 标题为用户问题的前20个字符
        const title = inputValue.trim().substring(0, 20);
        
        // 标记正在创建新对话，防止 useEffect 清空消息
        isCreatingNewConversation.current = true;
        
        currentConversation = await chatService.createConversation(
          title,
          selectedModel?.id,
          selectedChatbot?.id,
          modelConfig,
          systemPrompt
        );
        // 通知父组件更新对话列表并选中新创建的对话
        if (onConversationCreated) {
          onConversationCreated({
            id: currentConversation.id,
            title: currentConversation.title,
            created_at: currentConversation.created_at,
            updated_at: currentConversation.updated_at,
            is_pinned: currentConversation.is_pinned || false
          });
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        message.error('创建对话失败，请重试');
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      created_at: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, assistantMessage]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      // 发送消息到后端
      console.log('Sending message with config:', modelConfig);
      
      // 使用流式发送
      chatService.sendMessageStream(
        inputValue,
        selectedModel?.id,
        selectedChatbot?.id,
        currentConversation?.id,
        { ...modelConfig, deep_thinking: deepThinking },
        undefined, // messageId is undefined for new messages
        systemPrompt, // 系统提示词
        (data) => {
          // 流式更新消息内容
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? {
                  ...msg,
                  content: data.full_text,
                  reasoning_content: data.full_reasoning
                }
              : msg
          ));
        },
        (error) => {
          console.error('Failed to send message:', error);
          const errorMessage = typeof error === 'string' ? error : (error?.message || error?.error || '发送失败，请重试');
          message.error(errorMessage);
          
          // 失败时显示错误消息
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { 
                  ...msg, 
                  content: `抱歉，发送消息时出现错误：${errorMessage}`,
                  reasoning_content: undefined
                }
              : msg
          ));
          
          if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
            const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
            setThinkingDuration(prev => ({
              ...prev,
              [assistantMessageId]: duration
            }));
          }
          setLoading(false);
          setThinkingMessageId(null);
        },
        () => {
          // 完成时的处理
          if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
            const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
            setThinkingDuration(prev => ({
              ...prev,
              [assistantMessageId]: duration
            }));
          }
          setLoading(false);
          setThinkingMessageId(null);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = typeof error === 'string' ? error : (error?.message || error?.error || '发送失败，请重试');
      message.error(errorMessage);
      
      // 失败时显示错误消息
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: `抱歉，发送消息时出现错误：${errorMessage}`,
              reasoning_content: undefined
            }
          : msg
      ));
      
      if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
        const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
        setThinkingDuration(prev => ({
          ...prev,
          [assistantMessageId]: duration
        }));
      }
      setLoading(false);
      setThinkingMessageId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearMessages = async () => {
    if (!conversation) {
      message.warning('请先选择对话');
      return;
    }
    
    try {
      await chatService.clearMessages(conversation.id);
      setMessages([]);
      message.success('已清空对话');
    } catch (error) {
      console.error('Failed to clear messages:', error);
      message.error('清空对话失败，请重试');
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

    setInputValue(editingContent);
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages, editingContent, messageId);
    }, 100);
  };

  const handleSendMessageWithMessages = async (
    previousMessages: Message[],
    content: string,
    messageId?: string
  ) => {
    if (loading) return;

    let newMessages = [...previousMessages];
    
    // 只在发送新消息时创建用户消息，重新回答时不创建
    if (!messageId) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: content.trim(),
        created_at: new Date().toISOString()
      };
      newMessages = [...previousMessages, userMessage];
    }
    
    setMessages(newMessages);
    setInputValue('');
    setLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, assistantMessage]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      chatService.sendMessageStream(
        content,
        selectedModel?.id,
        selectedChatbot?.id,
        conversation?.id,
        { ...modelConfig, deep_thinking: deepThinking },
        messageId,
        systemPrompt, // 系统提示词
        (data) => {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: data.full_text,
                  reasoning_content: data.full_reasoning
                }
              : msg
          ));
        },
        (error) => {
          console.error('Failed to send message:', error);
          const errorMessage = typeof error === 'string' ? error : (error?.message || error?.error || '发送失败，请重试');
          message.error(errorMessage);

          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: `抱歉，发送消息时出现错误：${errorMessage}`,
                  reasoning_content: undefined
                }
              : msg
          ));

          if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
            const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
            setThinkingDuration(prev => ({
              ...prev,
              [assistantMessageId]: duration
            }));
          }
          setLoading(false);
          setThinkingMessageId(null);
        },
        () => {
          if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
            const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
            setThinkingDuration(prev => ({
              ...prev,
              [assistantMessageId]: duration
            }));
          }
          setLoading(false);
          setThinkingMessageId(null);
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: '抱歉，生成回复时出现错误' }
          : msg
      ));
      setLoading(false);
      setThinkingMessageId(null);
    }
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (messageIndex < 1) return;

    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;

    // Remove all messages after and including the current assistant message
    const updatedMessages = messages.slice(0, messageIndex);
    setMessages(updatedMessages);

    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages, userMessage.content, userMessage.id);
    }, 100);
  };

  const getProviderAvatar = (provider: string): string => {
    if (!provider) {
      return '/src/assets/llm/default.svg';
    }
    const lowercaseProvider = provider.toLowerCase();
    return `/src/assets/llm/${lowercaseProvider}.svg`;
  };

  const getChatbotAvatar = (chatbot: Chatbot): string => {
    if (chatbot.avatar) {
      return chatbot.avatar;
    }
    return '/src/assets/llm/default.svg';
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
                <Select.Option key={opt} value={opt}>{opt}</Select.Option>
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

  const currentConfigParams = configParams[selectedModel?.model_type || 'text'] || [];

  const handleSelectModel = (model: LLMModel) => {
    setSelectedModel(model);
    setSelectedChatbot(null);
    setSelectedType('model');
    if (model.config) {
      setModelConfig(model.config);
    } else {
      setModelConfig({});
    }
  };

  const handleSelectChatbot = (chatbot: Chatbot) => {
    setSelectedChatbot(chatbot);
    setSelectedModel(null);
    setSelectedType('chatbot');
  };

  const getDropdownItems = (): MenuProps['items'] => {
    const items: MenuProps['items'] = [];

    if (models.length > 0) {
      items.push({
        key: 'model-group',
        type: 'group',
        label: (
          <div className={`dropdown-group-label ${theme === 'dark' ? 'dark' : 'light'}`}>
            <span>模型</span>
          </div>
        ),
      });
      
      models.forEach((model) => {
        items.push({
          key: `model-${model.id}`,
          label: (
            <div 
              className={`dropdown-item ${theme === 'dark' ? 'dark' : 'light'} ${selectedModel?.id === model.id ? 'selected' : ''}`}
            >
              <img 
                src={getProviderAvatar(model.provider)} 
                alt={model.provider} 
                className="dropdown-item-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
                }}
              />
              <div className="dropdown-item-content">
                <div className="dropdown-item-name">{model.name}</div>
                <div className="dropdown-item-provider">
                  <span className="dropdown-item-tag">{model.model_type || 'text'}</span>
                  {model.tags && model.tags.split(',').map((tag, index) => (
                    <span key={index} className="dropdown-item-tag">{tag.trim()}</span>
                  ))}
                </div>
              </div>
              {selectedModel?.id === model.id && (
                <span className="dropdown-item-check">✓</span>
              )}
            </div>
          ),
          onClick: () => handleSelectModel(model),
        });
      });
    }

    if (chatbots.length > 0) {
      items.push({
        key: 'chatbot-group',
        type: 'group',
        label: (
          <div className={`dropdown-group-label ${theme === 'dark' ? 'dark' : 'light'}`}>
            <span>机器人</span>
          </div>
        ),
      });
      
      chatbots.forEach((chatbot) => {
        items.push({
          key: `chatbot-${chatbot.id}`,
          label: (
            <div 
              className={`dropdown-item ${theme === 'dark' ? 'dark' : 'light'} ${selectedChatbot?.id === chatbot.id ? 'selected' : ''}`}
            >
              <img 
                src={getChatbotAvatar(chatbot)} 
                alt={chatbot.name} 
                className="dropdown-item-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
                }}
              />
              <div className="dropdown-item-content">
                <div className="dropdown-item-name">{chatbot.name}</div>
                {chatbot.description && (
                  <div className="dropdown-item-provider">{chatbot.description}</div>
                )}
              </div>
              {selectedChatbot?.id === chatbot.id && (
                <span className="dropdown-item-check">✓</span>
              )}
            </div>
          ),
          onClick: () => handleSelectChatbot(chatbot),
        });
      });
    }

    return items;
  };

  const getCurrentSelection = () => {
    if (selectedType === 'model' && selectedModel) {
      return {
        avatar: getProviderAvatar(selectedModel.provider),
        name: selectedModel.name,
        type: 'model' as const
      };
    }
    if (selectedType === 'chatbot' && selectedChatbot) {
      return {
        avatar: getChatbotAvatar(selectedChatbot),
        name: selectedChatbot.name,
        type: 'chatbot' as const
      };
    }
    return null;
  };

  const currentSelection = getCurrentSelection();
  const hasModelsOrChatbots = models.length > 0 || chatbots.length > 0;

  const renderMessage = (msg: Message, index: number) => {
    // 跳过工具消息的显示
    if (msg.role === 'tool') {
      return null;
    }
    
    const isUser = msg.role === 'user';
    
    return (
      <div key={msg.id} className={`message ${msg.role}`}>
        <div className={`message-avatar ${theme === 'dark' ? 'dark' : 'light'}`}>
          {isUser ? '👤' : (
            <img 
              src={currentSelection?.avatar || '/src/assets/llm/default.svg'} 
              alt="AI" 
              className="avatar-image"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
              }}
            />
          )}
        </div>
        <div className="message-content">
          {msg.role === 'assistant' && thinkingMessageId === msg.id && (
            <div className="message-reasoning">
              <div className="reasoning-header" onClick={() => toggleReasoning(msg.id)}>
                <LoadingOutlined spin />
                <BulbOutlined /> 正在思考中
                {thinkingDuration[msg.id] && (
                  <span className="reasoning-duration">
                    ({(thinkingDuration[msg.id] / 1000).toFixed(1)}s)
                  </span>
                )}
              </div>
              {expandedReasoning.has(msg.id) && msg.reasoning_content && (
                <div className="reasoning-text">
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code: CodeBlock as any
                      }}
                    >
                      {msg.reasoning_content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
          {msg.role === 'assistant' && msg.reasoning_content && thinkingMessageId !== msg.id && (
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
              {expandedReasoning.has(msg.id) && msg.reasoning_content && (
                <div className="reasoning-text">
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code: CodeBlock as any
                      }}
                    >
                      {msg.reasoning_content}
                    </ReactMarkdown>
                  </div>
                </div>
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
          ) : msg.content ? (
            <div className={`message-text ${theme === 'dark' ? 'dark' : 'light'}`}>
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: CodeBlock as any
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ) : null}
          <div className="message-footer">
            <span className="message-time">
              {new Date(msg.created_at).toLocaleTimeString()}
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
    );
  };

  const renderEmptyState = () => (
    <div className="empty-chat">
      <div className="welcome-icon">💬</div>
      <div className="welcome-text">
        {currentSelection 
          ? (currentSelection.type === 'chatbot' && selectedChatbot?.greeting 
              ? selectedChatbot.greeting 
              : `开始与 ${currentSelection.name} 对话`)
          : '请选择模型或机器人'
        }
      </div>
      <div className="welcome-hint">输入消息开始体验</div>
    </div>
  );

  return (
    <div className={`chat-conversation ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className="chat-header">
        <div className="chat-title">
          {hasModelsOrChatbots ? (
            <Dropdown
              menu={{ 
                items: getDropdownItems(),
                className: `chat-selector-dropdown ${theme === 'dark' ? 'dark' : 'light'}`
              }}
              trigger={['click']}
              placement="bottomLeft"
            >
              <div className={`chat-selector ${theme === 'dark' ? 'dark' : 'light'}`}>
                <img 
                  src={currentSelection?.avatar || '/src/assets/llm/default.svg'} 
                  alt={currentSelection?.name || 'default'} 
                  className="selector-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
                  }}
                />
                <span className="selector-name">
                  {currentSelection?.name || '请选择模型或机器人'}
                </span>
                <DownOutlined className="selector-arrow" />
              </div>
            </Dropdown>
          ) : (
            <div className={`chat-selector ${theme === 'dark' ? 'dark' : 'light'}`}>
              <img 
                src="/src/assets/llm/default.svg" 
                alt="default" 
                className="selector-avatar"
              />
              <span className="selector-name">请选择模型或机器人</span>
            </div>
          )}
        </div>
        <div className="chat-actions">
          {selectedType === 'model' && selectedModel && (
            <Tooltip title="模型配置">
              <Button 
                type="text" 
                icon={<SettingOutlined />} 
                onClick={() => setIsConfigModalVisible(true)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="确认清空"
            description="确定要清空当前对话吗？"
            onConfirm={handleClearMessages}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="清空对话">
              <Button 
                type="text" 
                icon={<ClearOutlined />} 
              />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>

      <div className={`chat-messages ${theme === 'dark' ? 'dark' : 'light'}`}>
        {loading && messages.length === 0 ? (
          <div className="loading-container">
            <LoadingOutlined style={{ fontSize: 32, color: '#667eea' }} />
          </div>
        ) : messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {messages.map((msg, index) => renderMessage(msg, index))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息... (Shift+Enter换行，Enter发送)"
            autoSize={{ minRows: 5, maxRows: 12 }}
            className={`chat-input ${theme === 'dark' ? 'dark' : 'light'}`}
          />
          <div className="chat-input-inner-footer">
            <div 
              className={`deep-thinking-switch ${theme === 'dark' ? 'dark' : 'light'}`} 
              onClick={() => setDeepThinking(!deepThinking)}
            >
              <BulbOutlined className={deepThinking ? 'bulb-active' : ''} />
              <span>深度思考</span>
              <Switch size="small" checked={deepThinking} onChange={setDeepThinking} />
            </div>
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim() || !currentSelection}
            className="input-send-button"
          />
        </div>
      </div>

      <Modal
        title="模型配置"
        open={isConfigModalVisible}
        onCancel={() => setIsConfigModalVisible(false)}
        footer={null}
        width={500}
        className={`chat-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>系统提示词</span>
              <Tooltip title="设置AI助手的角色和行为方式">
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <TextArea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="请输入系统提示词，定义AI助手的角色和行为方式..."
              autoSize={{ minRows: 3, maxRows: 6 }}
              style={{ width: '100%' }}
            />
          </div>
          {currentConfigParams.length > 0 ? (
            currentConfigParams.map(param => renderConfigParam(param))
          ) : (
          <div style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', textAlign: 'center' }}>
            该模型类型暂无可配置参数
          </div>
          )}
        </div>
        <div className="config-actions">
          <Button onClick={() => setIsConfigModalVisible(false)}>取消</Button>
          <Button type="primary" onClick={async () => {
            // 如果有对话，更新对话的系统提示词
            if (conversation) {
              try {
                await chatService.updateConversationConfig(conversation.id, {
                  system_prompt: systemPrompt,
                  config: modelConfig
                });
                message.success('配置已保存');
              } catch (error) {
                console.error('Failed to save config:', error);
                message.error('保存配置失败，请重试');
                return;
              }
            }
            setIsConfigModalVisible(false);
          }}>
            保存
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ChatConversation;
